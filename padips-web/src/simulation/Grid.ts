/**
 * Grid - Spatial subdivision for efficient collision detection
 *
 * Based on original grid.cpp/h from IRIX version (1993)
 * Divides 3D space into uniform voxels to reduce collision checks from O(n²) to O(n)
 */

import * as THREE from 'three';
import { Ball } from '../core/Ball';

/**
 * Voxel cell containing ball IDs
 */
class VoxelCell {
  ballIds: Set<number> = new Set();

  add(ballId: number): void {
    this.ballIds.add(ballId);
  }

  remove(ballId: number): void {
    this.ballIds.delete(ballId);
  }

  clear(): void {
    this.ballIds.clear();
  }

  isEmpty(): boolean {
    return this.ballIds.size === 0;
  }

  getBalls(): number[] {
    return Array.from(this.ballIds);
  }
}

/**
 * Ball supplementary data for grid tracking
 */
interface BallGridData {
  ballId: number;
  voxelIndices: THREE.Vector3; // Current voxel indices (x, y, z)
  occupiedCells: Set<number>; // Set of cell indices this ball occupies
}

export class Grid {
  // Grid dimensions
  private segments: THREE.Vector3; // Number of segments in x, y, z
  private origin: THREE.Vector3; // Lower bound of grid space
  private extent: THREE.Vector3; // Upper bound of grid space
  private cellSize: THREE.Vector3; // Size of each voxel

  // Voxel storage
  private voxels: VoxelCell[]; // Flat array of voxel cells
  private totalCells: number;

  // Ball tracking
  private ballData: Map<number, BallGridData> = new Map();
  private maxRadius: number = 0;

  // Statistics
  public numChecks: number = 0;
  public numOccupiedCells: number = 0;

  constructor(
    segmentsX: number,
    segmentsY: number,
    segmentsZ: number,
    origin: THREE.Vector3,
    extent: THREE.Vector3
  ) {
    this.segments = new THREE.Vector3(segmentsX, segmentsY, segmentsZ);
    this.origin = origin.clone();
    this.extent = extent.clone();

    // Calculate cell size
    const size = new THREE.Vector3().subVectors(extent, origin);
    this.cellSize = new THREE.Vector3(
      size.x / segmentsX,
      size.y / segmentsY,
      size.z / segmentsZ
    );

    // Initialize voxel array
    this.totalCells = segmentsX * segmentsY * segmentsZ;
    this.voxels = new Array(this.totalCells);
    for (let i = 0; i < this.totalCells; i++) {
      this.voxels[i] = new VoxelCell();
    }

    console.log('🔲 Grid created:', {
      segments: this.segments,
      cellSize: this.cellSize,
      totalCells: this.totalCells
    });
  }

  /**
   * Convert 3D voxel indices to flat array index
   */
  private voxelIndexToFlat(x: number, y: number, z: number): number {
    return x + y * this.segments.x + z * this.segments.x * this.segments.y;
  }

  /**
   * Convert world position to voxel indices
   */
  private worldToVoxel(position: THREE.Vector3): THREE.Vector3 {
    const relative = new THREE.Vector3().subVectors(position, this.origin);
    return new THREE.Vector3(
      Math.floor(relative.x / this.cellSize.x),
      Math.floor(relative.y / this.cellSize.y),
      Math.floor(relative.z / this.cellSize.z)
    );
  }

  /**
   * Clamp voxel indices to valid range
   */
  private clampVoxelIndices(indices: THREE.Vector3): THREE.Vector3 {
    return new THREE.Vector3(
      Math.max(0, Math.min(this.segments.x - 1, indices.x)),
      Math.max(0, Math.min(this.segments.y - 1, indices.y)),
      Math.max(0, Math.min(this.segments.z - 1, indices.z))
    );
  }

  /**
   * Insert a ball into the grid
   *
   * IRIX Logic: A ball can touch max. 8 voxels because it's smaller than a voxel
   * and can only cross one boundary per dimension (x, y, z).
   * This gives us max. 2 voxel indices per axis: 2×2×2 = 8 voxels.
   */
  insertBall(ball: Ball, ballId: number): void {
    // Track maximum radius for validation
    if (ball.radius > this.maxRadius) {
      this.maxRadius = ball.radius;
    }

    // Validate ball radius (should not be larger than a cell)
    const maxAllowedRadius = Math.min(
      this.cellSize.x,
      this.cellSize.y,
      this.cellSize.z
    ) / 2;

    if (ball.radius > maxAllowedRadius) {
      console.warn('⚠️ Ball radius', ball.radius, 'exceeds max allowed', maxAllowedRadius);
    }

    // Calculate which voxels this ball occupies
    const minPos = new THREE.Vector3().subVectors(ball.position, new THREE.Vector3(ball.radius, ball.radius, ball.radius));
    const maxPos = new THREE.Vector3().addVectors(ball.position, new THREE.Vector3(ball.radius, ball.radius, ball.radius));

    const minVoxel = this.clampVoxelIndices(this.worldToVoxel(minPos));
    const maxVoxel = this.clampVoxelIndices(this.worldToVoxel(maxPos));

    const occupiedCells = new Set<number>();

    // Insert ball into all occupied voxels
    for (let z = minVoxel.z; z <= maxVoxel.z; z++) {
      for (let y = minVoxel.y; y <= maxVoxel.y; y++) {
        for (let x = minVoxel.x; x <= maxVoxel.x; x++) {
          const cellIndex = this.voxelIndexToFlat(x, y, z);
          this.voxels[cellIndex].add(ballId);
          occupiedCells.add(cellIndex);
        }
      }
    }

    // Store ball grid data
    this.ballData.set(ballId, {
      ballId,
      voxelIndices: minVoxel.clone(),
      occupiedCells
    });
  }

  /**
   * Update ball position in grid
   */
  updateBall(ball: Ball, ballId: number): void {
    // Remove from old cells
    this.removeBall(ballId);

    // Insert into new cells
    this.insertBall(ball, ballId);
  }

  /**
   * Remove a ball from the grid
   */
  removeBall(ballId: number): void {
    const data = this.ballData.get(ballId);
    if (!data) return;

    // Remove from all occupied cells
    for (const cellIndex of data.occupiedCells) {
      this.voxels[cellIndex].remove(ballId);
    }

    this.ballData.delete(ballId);
  }

  /**
   * Get potential collision candidates for a ball
   *
   * IRIX Logic: Returns only balls that share AT LEAST ONE voxel with this ball.
   * No checking of neighboring voxels! Two balls can only collide if they
   * occupy the same voxel (not just adjacent voxels).
   *
   * Returns array of ball IDs that share voxels with this ball
   */
  getPotentialCollisions(ballId: number): number[] {
    const data = this.ballData.get(ballId);
    if (!data) return [];

    const candidates = new Set<number>();

    // Collect all balls in occupied cells
    for (const cellIndex of data.occupiedCells) {
      const cell = this.voxels[cellIndex];
      for (const otherId of cell.getBalls()) {
        if (otherId !== ballId) {
          candidates.add(otherId);
        }
      }
    }

    return Array.from(candidates);
  }

  /**
   * Clear the entire grid
   */
  clear(): void {
    for (let i = 0; i < this.totalCells; i++) {
      this.voxels[i].clear();
    }
    this.ballData.clear();
    this.maxRadius = 0;
    this.numChecks = 0;
    this.numOccupiedCells = 0;
  }

  /**
   * Update statistics
   */
  updateStatistics(): void {
    this.numOccupiedCells = 0;
    for (let i = 0; i < this.totalCells; i++) {
      if (!this.voxels[i].isEmpty()) {
        this.numOccupiedCells++;
      }
    }
  }

  /**
   * Get occupied voxel cells (for visualization)
   */
  getOccupiedCells(): Array<{
    indices: THREE.Vector3;
    center: THREE.Vector3;
    ballIds: number[];
    cellSize: THREE.Vector3;
  }> {
    const occupied: Array<{
      indices: THREE.Vector3;
      center: THREE.Vector3;
      ballIds: number[];
      cellSize: THREE.Vector3;
    }> = [];

    for (let z = 0; z < this.segments.z; z++) {
      for (let y = 0; y < this.segments.y; y++) {
        for (let x = 0; x < this.segments.x; x++) {
          const cellIndex = this.voxelIndexToFlat(x, y, z);
          const cell = this.voxels[cellIndex];

          if (!cell.isEmpty()) {
            const center = new THREE.Vector3(
              this.origin.x + (x + 0.5) * this.cellSize.x,
              this.origin.y + (y + 0.5) * this.cellSize.y,
              this.origin.z + (z + 0.5) * this.cellSize.z
            );

            occupied.push({
              indices: new THREE.Vector3(x, y, z),
              center,
              ballIds: cell.getBalls(),
              cellSize: this.cellSize.clone()
            });
          }
        }
      }
    }

    return occupied;
  }

  /**
   * Get grid properties
   */
  getProperties() {
    return {
      segments: this.segments.clone(),
      origin: this.origin.clone(),
      extent: this.extent.clone(),
      cellSize: this.cellSize.clone(),
      totalCells: this.totalCells,
      maxRadius: this.maxRadius,
      numOccupiedCells: this.numOccupiedCells
    };
  }

  /**
   * Validate grid configuration
   */
  validateConfiguration(balls: Ball[]): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    // Check if any ball is too large for a cell
    const maxAllowedRadius = Math.min(
      this.cellSize.x,
      this.cellSize.y,
      this.cellSize.z
    ) / 2;

    const maxBallRadius = Math.max(...balls.map(b => b.radius));

    if (maxBallRadius > maxAllowedRadius) {
      errors.push(`Max ball radius (${maxBallRadius.toFixed(3)}m) exceeds max allowed (${maxAllowedRadius.toFixed(3)}m)`);
      errors.push(`Increase grid segments or reduce ball size`);
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }
}


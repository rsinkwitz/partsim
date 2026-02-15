/**
 * Physics Engine - Main simulation loop
 * Port from model.cpp calculate()
 */

import * as THREE from 'three';
import { BallSet } from '../core/BallSet';
import { Parallelogram } from '../core/Parallelogram';
import { GlobalParams } from '../core/GlobalParams';
import { CBR } from '../core/Constants';
import { Grid } from './Grid';

export interface PhysicsStats {
  numChecks: number;
  numCollisions: number;
  calcTime: number; // milliseconds
}

export class PhysicsEngine {
  private ballSet: BallSet;
  private walls: Parallelogram[];
  private global: GlobalParams;

  // Configuration
  private timeStep: number = 0.01; // seconds
  private calcFactor: number = 10; // calculations per frame
  private collisionsEnabled: boolean = true;

  // Grid system (opt-in)
  private grid: Grid | null = null;
  private gridEnabled: boolean = false;
  private gridSegments: THREE.Vector3 = new THREE.Vector3(8, 8, 8);

  // Statistics
  public stats: PhysicsStats = {
    numChecks: 0,
    numCollisions: 0,
    calcTime: 0,
  };

  constructor(
    ballSet: BallSet,
    walls: Parallelogram[],
    global: GlobalParams
  ) {
    this.ballSet = ballSet;
    this.walls = walls;
    this.global = global;
  }

  /**
   * Main calculation loop (model.cpp line 471)
   */
  calculate(): void {
    const startTime = performance.now();
    this.stats.numChecks = 0;
    this.stats.numCollisions = 0;

    for (let k = 0; k < this.calcFactor; k++) {
      // Let global communicate with each ball (apply gravity)
      for (let i = 0; i < this.ballSet.num; i++) {
        const ball = this.ballSet.get(i);
        if (ball) {
          this.global.communicate(ball);
        }
      }

      // Check collisions
      if (this.collisionsEnabled) {
        if (this.gridEnabled && this.grid) {
          this.checkCollisionsGrid();
        } else {
          this.checkCollisionsBruteForce();
        }
      }

      // Integrate motion for all balls
      this.integrateBalls(this.timeStep);

      // Update grid if enabled
      if (this.gridEnabled && this.grid) {
        this.updateGrid();
      }
    }

    this.ballSet.generation++;
    this.stats.calcTime = performance.now() - startTime;
  }

  /**
   * Grid-based collision detection O(n)
   */
  private checkCollisionsGrid(): void {
    if (!this.grid) return;

    // Ball-Ball collisions using grid
    for (let i = 0; i < this.ballSet.num; i++) {
      const ballA = this.ballSet.get(i);
      if (!ballA) continue;

      // Get potential collision candidates from grid
      const candidates = this.grid.getPotentialCollisions(i);

      for (const j of candidates) {
        if (j <= i) continue; // Avoid duplicate checks

        const ballB = this.ballSet.get(j);
        if (ballB) {
          this.stats.numChecks++;
          const result = ballA.communicate(ballB);
          if (result.collided) {
            this.stats.numCollisions++;
          }
        }
      }
    }

    // Ball-Wall collisions (same as brute-force)
    // NOTE: In IRIX, only balls in edge voxels were checked against nearby walls.
    // This could be optimized in the future by tracking which voxels are at the boundaries.
    for (let i = 0; i < this.ballSet.num; i++) {
      const ball = this.ballSet.get(i);
      if (ball) {
        for (const wall of this.walls) {
          this.stats.numChecks++;
          const result = wall.communicate(ball);
          if (result.collided) {
            this.stats.numCollisions++;
          }
        }
      }
    }
  }

  /**
   * Brute-force collision detection O(n²)
   * (model.cpp line 480)
   */
  private checkCollisionsBruteForce(): void {
    // Ball-Ball collisions
    for (let i = 0; i < this.ballSet.num; i++) {
      for (let j = i + 1; j < this.ballSet.num; j++) {
        const ballA = this.ballSet.get(i);
        const ballB = this.ballSet.get(j);

        if (ballA && ballB) {
          this.stats.numChecks++;
          const result = ballA.communicate(ballB);
          if (result.collided) {
            this.stats.numCollisions++;
          }
        }
      }
    }

    // Ball-Wall collisions
    for (let i = 0; i < this.ballSet.num; i++) {
      const ball = this.ballSet.get(i);
      if (ball) {
        for (const wall of this.walls) {
          this.stats.numChecks++;
          const result = wall.communicate(ball);
          if (result.collided) {
            this.stats.numCollisions++;
          }
        }
      }
    }
  }

  /**
   * Integrate ball motion using Euler method
   * (model.cpp line 497)
   */
  private integrateBalls(dt: number): void {
    for (let i = 0; i < this.ballSet.num; i++) {
      const ball = this.ballSet.get(i);
      if (ball) {
        ball.proceedFullStep(dt);
      }
    }
  }

  /**
   * Update grid with new ball positions
   */
  private updateGrid(): void {
    if (!this.grid) return;

    for (let i = 0; i < this.ballSet.num; i++) {
      const ball = this.ballSet.get(i);
      if (ball) {
        this.grid.updateBall(ball, i);
      }
    }

    this.grid.updateStatistics();
  }

  /**
   * Initialize grid system
   */
  initializeGrid(segments: THREE.Vector3): void {
    const origin = new THREE.Vector3(-CBR, -CBR, -CBR);
    const extent = new THREE.Vector3(CBR, CBR, CBR);

    this.grid = new Grid(
      segments.x,
      segments.y,
      segments.z,
      origin,
      extent
    );

    // Insert all balls into grid
    for (let i = 0; i < this.ballSet.num; i++) {
      const ball = this.ballSet.get(i);
      if (ball) {
        this.grid.insertBall(ball, i);
      }
    }

    this.grid.updateStatistics();

    console.log('🔲 Grid initialized:', {
      segments: segments,
      balls: this.ballSet.num,
      occupiedCells: this.grid.numOccupiedCells
    });
  }

  /**
   * Enable/disable grid system
   */
  setGridEnabled(enabled: boolean): void {
    this.gridEnabled = enabled;

    if (enabled && !this.grid) {
      this.initializeGrid(this.gridSegments);
    } else if (!enabled && this.grid) {
      this.grid.clear();
    }

    console.log('🔲 Grid:', enabled ? 'ENABLED' : 'DISABLED');
  }

  /**
   * Set grid segments
   */
  setGridSegments(segments: THREE.Vector3): void {
    this.gridSegments = segments;

    // Reinitialize grid if already enabled
    if (this.gridEnabled) {
      this.initializeGrid(segments);
    }
  }

  /**
   * Get grid instance
   */
  getGrid(): Grid | null {
    return this.grid;
  }

  /**
   * Validate grid configuration with current balls
   */
  validateGridConfiguration(): { valid: boolean; errors: string[] } {
    if (!this.grid) {
      return { valid: true, errors: [] };
    }

    const balls: any[] = [];
    for (let i = 0; i < this.ballSet.num; i++) {
      const ball = this.ballSet.get(i);
      if (ball) balls.push(ball);
    }

    return this.grid.validateConfiguration(balls);
  }

  // Configuration setters

  setTimeStep(dt: number): void {
    this.timeStep = dt;
  }

  setCalcFactor(factor: number): void {
    this.calcFactor = factor;
  }

  setCollisionsEnabled(enabled: boolean): void {
    this.collisionsEnabled = enabled;
  }
}


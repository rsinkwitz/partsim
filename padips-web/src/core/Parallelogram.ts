/**
 * Parallelogram class - Cube walls
 * Port from model.h/model.cpp
 */

import * as THREE from 'three';
import { Ball } from './Ball';
import { DEFAULT_ELASTICITY } from './Constants';

export class Parallelogram {
  // 4 corners
  v0: THREE.Vector3;
  v1: THREE.Vector3;
  v2: THREE.Vector3;
  v3: THREE.Vector3;

  // Surface normal
  normal: THREE.Vector3;

  // Properties
  elasticity: number;
  color: number;

  constructor(
    origin: THREE.Vector3,
    vec1: THREE.Vector3,
    vec2: THREE.Vector3,
    elasticity = DEFAULT_ELASTICITY,
    color = 0x64ff64
  ) {
    this.v0 = origin.clone();
    this.v1 = origin.clone().add(vec1);
    this.v2 = origin.clone().add(vec1).add(vec2);
    this.v3 = origin.clone().add(vec2);

    // Calculate normal (model.cpp line 257)
    this.normal = vec1.clone().cross(vec2).normalize();

    this.elasticity = elasticity;
    this.color = color;
  }

  /**
   * Ball-Wall collision (model.cpp line 282)
   */
  communicate(ball: Ball): { collided: boolean } {
    const diff = ball.position.clone().sub(this.v0);
    const linDep = this.normal.clone().multiplyScalar(diff.dot(this.normal));
    // const ortho = diff.clone().sub(linDep); // Not used

    // const oldDiff = ball.oldPosition.clone().sub(this.v0); // Not used
    // const oldLinDep = this.normal.clone().multiplyScalar(oldDiff.dot(this.normal)); // Not used

    const dist = linDep.length() - ball.radius; // Distance to surface
    const sign = linDep.dot(ball.velocity); // < 0: intrusion
    const elasticity = ball.elasticity * this.elasticity;

    // Test collision
    if (dist < 0.0 && sign < 0.0) {
      // Collision detected
      const vLinDep = this.normal.clone().multiplyScalar(ball.velocity.dot(this.normal));
      const vOrtho = ball.velocity.clone().sub(vLinDep);

      // Mirror and scale velocity (model.cpp line 298)
      ball.velocity = vOrtho.sub(vLinDep.multiplyScalar(elasticity));

      return { collided: true };
    }

    return { collided: false };
  }

  /**
   * Create cube walls (6 parallelograms)
   */
  static createCube(radius: number, elasticity = DEFAULT_ELASTICITY): Parallelogram[] {
    const walls: Parallelogram[] = [];

    // Bottom wall (z = -radius)
    walls.push(
      new Parallelogram(
        new THREE.Vector3(-radius, -radius, -radius),
        new THREE.Vector3(2 * radius, 0, 0),
        new THREE.Vector3(0, 2 * radius, 0),
        elasticity,
        0x64ff64
      )
    );

    // Top wall (z = +radius)
    walls.push(
      new Parallelogram(
        new THREE.Vector3(-radius, -radius, radius),
        new THREE.Vector3(0, 2 * radius, 0),
        new THREE.Vector3(2 * radius, 0, 0),
        elasticity,
        0x64ff64
      )
    );

    // Front wall (y = -radius)
    walls.push(
      new Parallelogram(
        new THREE.Vector3(-radius, -radius, -radius),
        new THREE.Vector3(0, 0, 2 * radius),
        new THREE.Vector3(2 * radius, 0, 0),
        elasticity,
        0x6464ff
      )
    );

    // Back wall (y = +radius)
    walls.push(
      new Parallelogram(
        new THREE.Vector3(-radius, radius, -radius),
        new THREE.Vector3(2 * radius, 0, 0),
        new THREE.Vector3(0, 0, 2 * radius),
        elasticity,
        0x6464ff
      )
    );

    // Left wall (x = -radius)
    walls.push(
      new Parallelogram(
        new THREE.Vector3(-radius, -radius, -radius),
        new THREE.Vector3(0, 2 * radius, 0),
        new THREE.Vector3(0, 0, 2 * radius),
        elasticity,
        0xff6464
      )
    );

    // Right wall (x = +radius)
    walls.push(
      new Parallelogram(
        new THREE.Vector3(radius, -radius, -radius),
        new THREE.Vector3(0, 0, 2 * radius),
        new THREE.Vector3(0, 2 * radius, 0),
        elasticity,
        0xff6464
      )
    );

    return walls;
  }
}


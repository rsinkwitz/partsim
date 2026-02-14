/**
 * Ball class - Particle with physics properties
 * Port from model.h/model.cpp
 */

import * as THREE from 'three';
import { DEFAULT_DENSITY, DEFAULT_ELASTICITY } from './Constants';

export interface BallParams {
  position?: THREE.Vector3;
  velocity?: THREE.Vector3;
  radius?: number;
  density?: number;
  elasticity?: number;
  color?: number;
  mass?: number;
}

export class Ball {
  // Position & Dynamics
  position: THREE.Vector3;
  velocity: THREE.Vector3;
  force: THREE.Vector3;
  oldPosition: THREE.Vector3;

  // Physical properties
  radius: number;
  mass: number;
  density: number;
  elasticity: number;
  field: number; // Electrical field (not used in MVP)

  // Rendering
  color: number; // 0xRRGGBB format

  // Time integration
  time: number;

  constructor(params: BallParams = {}) {
    this.position = params.position?.clone() || new THREE.Vector3();
    this.velocity = params.velocity?.clone() || new THREE.Vector3();
    this.force = new THREE.Vector3();
    this.oldPosition = this.position.clone();

    this.radius = params.radius || 0.1;
    this.density = params.density || DEFAULT_DENSITY;
    this.elasticity = params.elasticity || DEFAULT_ELASTICITY;

    // Calculate mass from radius and density (sphere volume)
    const volume = (4 / 3) * Math.PI * Math.pow(this.radius, 3);
    this.mass = params.mass !== undefined ? params.mass : volume * this.density;

    this.field = 0;
    this.color = params.color || 0xff0000; // Default red
    this.time = 0;
  }

  /**
   * Initialize for next time step (model.cpp line 55)
   */
  stepInit(): void {
    this.time = 0;
  }

  /**
   * Proceed to partial time within step (model.cpp line 208)
   */
  proceedPartialTo(time: number): void {
    this.oldPosition.copy(this.position);
    const dt = time - this.time;
    this.position.addScaledVector(this.velocity, dt);
    this.time = time;
  }

  /**
   * Finish time step and update velocity (model.cpp line 215)
   */
  stepFinish(time: number): void {
    this.proceedPartialTo(time); // Proceed to final time
    const acceleration = this.force.clone().divideScalar(this.mass);
    this.velocity.addScaledVector(acceleration, time);
  }

  /**
   * Proceed full step: position and velocity (model.cpp line 199)
   * Euler integration: position += velocity * dt; velocity += acceleration * dt
   */
  proceedFullStep(dt: number): void {
    const acceleration = this.force.clone().divideScalar(this.mass);

    this.oldPosition.copy(this.position);
    this.position.addScaledVector(this.velocity, dt);
    this.velocity.addScaledVector(acceleration, dt);
    this.time += dt;
  }

  /**
   * Ball-Ball collision (model.cpp line 221)
   * Elastic collision with friction
   */
  communicate(other: Ball): { collided: boolean } {
    const diff = other.position.clone().sub(this.position);
    const oldDiff = other.oldPosition.clone().sub(this.oldPosition);

    const dist = diff.length() - this.radius - other.radius;
    const sign = other.velocity.clone().sub(this.velocity).dot(diff); // < 0: converging
    const elasticity = this.elasticity * other.elasticity;

    // Test collision
    if (dist < 0.0 && sign < 0.0) {
      // Collision detected
      const normal = diff.clone().normalize();

      // Split velocities into normal and tangential components
      const aLinDep = normal.clone().multiplyScalar(this.velocity.dot(normal));
      const aOrtho = this.velocity.clone().sub(aLinDep);

      const bLinDep = normal.clone().multiplyScalar(other.velocity.dot(normal));
      const bOrtho = other.velocity.clone().sub(bLinDep);

      const k = this.mass / other.mass;

      // Calculate new velocities (model.cpp line 240)
      const newALinDep = aLinDep
        .clone()
        .multiplyScalar(k - elasticity)
        .add(bLinDep.clone().multiplyScalar(1 + elasticity))
        .divideScalar(1 + k);

      const newBLinDep = aLinDep
        .clone()
        .multiplyScalar((1 + elasticity) * k)
        .add(bLinDep.clone().multiplyScalar(1 - k * elasticity))
        .divideScalar(1 + k);

      // Reassemble velocities
      this.velocity = newALinDep.add(aOrtho);
      other.velocity = newBLinDep.add(bOrtho);

      return { collided: true };
    }

    return { collided: false };
  }

  /**
   * Clone ball
   */
  clone(): Ball {
    return new Ball({
      position: this.position,
      velocity: this.velocity,
      radius: this.radius,
      density: this.density,
      elasticity: this.elasticity,
      color: this.color,
      mass: this.mass,
    });
  }
}


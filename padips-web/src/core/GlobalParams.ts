/**
 * Global parameters (gravity, elasticity)
 * Port from model.h/model.cpp
 */

import * as THREE from 'three';
import { Ball } from './Ball';
import { ACC_G, DEFAULT_ELASTICITY } from './Constants';

export class GlobalParams {
  acceleration: THREE.Vector3;
  elasticity: number;

  constructor(
    acceleration: THREE.Vector3 = new THREE.Vector3(0, 0, -ACC_G),
    elasticity = DEFAULT_ELASTICITY
  ) {
    this.acceleration = acceleration.clone();
    this.elasticity = elasticity;
  }

  /**
   * Apply global forces to ball (model.cpp line 367)
   * This must be called first for each ball in a simulation step
   */
  communicate(ball: Ball): void {
    // force = mass * acceleration
    ball.force.copy(this.acceleration).multiplyScalar(ball.mass);
  }

  /**
   * Set gravity direction from preset
   */
  setGravityPreset(preset: string, magnitude = ACC_G): void {
    switch (preset) {
      case 'ZERO':
        this.acceleration.set(0, 0, 0);
        break;
      case 'DOWN':
        this.acceleration.set(0, 0, -magnitude);
        break;
      case 'UP':
        this.acceleration.set(0, 0, magnitude);
        break;
      case 'LEFT':
        this.acceleration.set(-magnitude, 0, 0);
        break;
      case 'RIGHT':
        this.acceleration.set(magnitude, 0, 0);
        break;
      case 'FRONT':
        this.acceleration.set(0, -magnitude, 0);
        break;
      case 'REAR':
        this.acceleration.set(0, magnitude, 0);
        break;
      default:
        console.warn('Unknown gravity preset:', preset);
    }
  }
}


/**
 * Physics Engine - Main simulation loop
 * Port from model.cpp calculate()
 */

import { Ball } from '../core/Ball';
import { BallSet } from '../core/BallSet';
import { Parallelogram } from '../core/Parallelogram';
import { GlobalParams } from '../core/GlobalParams';
import { CalculationMethod } from '../core/Constants';

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
  private calcMethod: CalculationMethod = CalculationMethod.EVENT;
  private timeStep: number = 0.01; // seconds
  private calcFactor: number = 10; // calculations per frame
  private collisionsEnabled: boolean = true;

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
        if (this.calcMethod === CalculationMethod.EVENT) {
          this.checkCollisionsBruteForce();
        } else {
          // Grid method not implemented in MVP
          this.checkCollisionsBruteForce();
        }
      }

      // Integrate motion for all balls
      this.integrateBalls(this.timeStep);
    }

    this.ballSet.generation++;
    this.stats.calcTime = performance.now() - startTime;
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

  // Configuration setters
  setCalculationMethod(method: CalculationMethod): void {
    this.calcMethod = method;
  }

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


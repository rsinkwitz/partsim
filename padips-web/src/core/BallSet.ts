/**
 * BallSet container
 * Port from model.h
 */

import { Ball } from './Ball';
import { BALLSETSIZE } from './Constants';

export class BallSet {
  generation: number;
  series: number;
  balls: Ball[];

  constructor() {
    this.generation = 0;
    this.series = 0;
    this.balls = [];
  }

  get num(): number {
    return this.balls.length;
  }

  add(ball: Ball): void {
    if (this.balls.length >= BALLSETSIZE) {
      console.warn('BallSet full, cannot add more balls');
      return;
    }
    this.balls.push(ball);
  }

  clear(): void {
    this.balls = [];
  }

  get(index: number): Ball | undefined {
    return this.balls[index];
  }

  /**
   * Copy from another BallSet (model.cpp line 359)
   */
  copyFrom(other: BallSet): void {
    this.generation = other.generation;
    this.series = other.series;
    this.balls = other.balls.map((ball) => ball.clone());
  }
}


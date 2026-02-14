/**
 * Ball generation utilities
 * Port from ui.cpp newBalls()
 */

import * as THREE from 'three';
import { Ball } from '../core/Ball';
import { BallSet } from '../core/BallSet';
import { CBR } from '../core/Constants';

export interface BallGenerationParams {
  count: number;
  minRadius: number;
  maxRadius: number;
  maxVelocity: number;
  elasticity: number;
  cubeRadius: number;
}

/**
 * Generate random balls within cube (ui.cpp line 234)
 */
export function generateBalls(params: BallGenerationParams): BallSet {
  const ballSet = new BallSet();
  ballSet.series++;

  const colors = [
    0xff0000, // red
    0x00ff00, // green
    0x0000ff, // blue
    0xffff00, // yellow
    0xff00ff, // magenta
    0x00ffff, // cyan
    0xff8800, // orange
    0x8800ff, // purple
  ];

  for (let i = 0; i < params.count; i++) {
    // Random radius
    const radius = params.minRadius + Math.random() * (params.maxRadius - params.minRadius);

    // Random position within cube bounds (minus radius for safety)
    const maxPos = params.cubeRadius - radius * 1.1;
    const position = new THREE.Vector3(
      (Math.random() - 0.5) * 2 * maxPos,
      (Math.random() - 0.5) * 2 * maxPos,
      (Math.random() - 0.5) * 2 * maxPos
    );

    // Random velocity
    const velocity = new THREE.Vector3(
      (Math.random() - 0.5) * 2 * params.maxVelocity,
      (Math.random() - 0.5) * 2 * params.maxVelocity,
      (Math.random() - 0.5) * 2 * params.maxVelocity
    );

    // Random color from palette
    const color = colors[i % colors.length];

    const ball = new Ball({
      position,
      velocity,
      radius,
      elasticity: params.elasticity,
      color,
    });

    ballSet.add(ball);
  }

  return ballSet;
}

/**
 * Default ball generation parameters
 */
export const DEFAULT_BALL_PARAMS: BallGenerationParams = {
  count: 100,  // Initial number of balls (changed from 30)
  minRadius: 0.05,
  maxRadius: 0.15,
  maxVelocity: 2.0,
  elasticity: 0.9,
  cubeRadius: CBR,
};


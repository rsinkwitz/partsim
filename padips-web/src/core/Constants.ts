/**
 * Constants from original PaDIPS (model.h, ui.h)
 */

// Physics constants
export const ACC_G = 9.81; // Earth acceleration [m/s²]
export const MIN_COLL_VELOCITY = 0.0001; // Minimum collision velocity

// Cube/World bounds
export const CBR = 1.518; // Cube radius (1.518 meter = 15% größer als vorher)
export const DCBR = 2 * CBR; // Cube diameter

// Ball set limits
export const BALLSETSIZE = 10000; // Max number of balls
export const PLANESETSIZE = 50; // Max number of planes

// Default ball properties
export const BALLSIZE = 0.1; // Default ball radius [m]
export const DEFAULT_DENSITY = 1000; // Default density [kg/m³]
export const DEFAULT_ELASTICITY = 0.9; // Default elasticity [0..1]

// Rendering
export enum DrawMode {
  WIREFRAME = 'WIREFRAME',
  CIRCLE = 'CIRCLE',
  LIGHTED = 'LIGHTED',
  POINTS = 'POINTS',
  TEXTURED = 'TEXTURED',
}

// 3D Stereo Modes
export enum StereoMode {
  OFF = 'off',
  ANAGLYPH = 'anaglyph',
  TOP_BOTTOM = 'topbottom',
}

// Collision detection method
export enum CalculationMethod {
  EVENT = 'EVENT', // Brute-Force O(n²)
  GRID = 'GRID', // Spatial Grid O(n)
}


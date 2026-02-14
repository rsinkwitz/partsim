/**
 * PaDIPS Main Application
 * Phase 1 MVP - Vanilla TypeScript + Three.js
 */

import { BallSet } from './core/BallSet';
import { GlobalParams } from './core/GlobalParams';
import { Parallelogram } from './core/Parallelogram';
import { CBR, DrawMode } from './core/Constants';
import { PhysicsEngine } from './simulation/PhysicsEngine';
import { SceneManager } from './rendering/SceneManager';
import { generateBalls, DEFAULT_BALL_PARAMS } from './utils/BallGenerator';
import type { BallGenerationParams } from './utils/BallGenerator';

class PaDIPSApp {
  private sceneManager: SceneManager;
  private physicsEngine: PhysicsEngine;
  private ballSet: BallSet;
  private walls: Parallelogram[];
  private global: GlobalParams;

  private isRunning: boolean = false;
  private animationId: number | null = null;
  private lastTime: number = 0;
  private frameCount: number = 0;
  private lastFpsUpdate: number = 0;
  private currentFps: number = 0;

  // UI state
  private ballParams: BallGenerationParams = { ...DEFAULT_BALL_PARAMS };

  constructor(canvas: HTMLCanvasElement) {
    // Initialize core objects
    this.global = new GlobalParams();
    this.walls = Parallelogram.createCube(CBR);
    this.ballSet = generateBalls(DEFAULT_BALL_PARAMS);

    // Initialize physics engine
    this.physicsEngine = new PhysicsEngine(
      this.ballSet,
      this.walls,
      this.global
    );

    // Initialize scene manager
    this.sceneManager = new SceneManager(canvas);
    this.sceneManager.initializeScene(this.ballSet, this.walls);

    // Setup UI event listeners
    this.setupUI();

    // Update initial stats
    this.updateStats();

    console.log('🎱 PaDIPS initialized with', this.ballSet.num, 'balls');

    // Starte Animation-Loop (läuft immer für Rendering & Kamera-Interaktion)
    this.lastTime = performance.now();
    this.lastFpsUpdate = this.lastTime;
    this.animationId = requestAnimationFrame(this.animate);
    console.log('🎬 Animation loop started (rendering active)');

    // Auto-start Physik-Simulation
    this.start();
  }

  /**
   * Setup UI event handlers
   */
  private setupUI(): void {
    // Buttons
    const startBtn = document.getElementById('startBtn') as HTMLButtonElement;
    const stopBtn = document.getElementById('stopBtn') as HTMLButtonElement;
    const resetBtn = document.getElementById('resetBtn') as HTMLButtonElement;

    startBtn.addEventListener('click', () => this.start());
    stopBtn.addEventListener('click', () => this.stop());
    resetBtn.addEventListener('click', () => this.reset());

    // Simulation controls
    this.setupRangeControl('calcFactor', (value) => {
      this.physicsEngine.setCalcFactor(value);
      console.log('⚙️ Calc factor changed to:', value);
    });

    const collisionsCheckbox = document.getElementById('collisionsEnabled') as HTMLInputElement;
    collisionsCheckbox.addEventListener('change', () => {
      this.physicsEngine.setCollisionsEnabled(collisionsCheckbox.checked);
      console.log('⚙️ Collisions:', collisionsCheckbox.checked ? 'ON' : 'OFF');
    });

    // Rendering controls
    const drawModeSelect = document.getElementById('drawMode') as HTMLSelectElement;
    drawModeSelect.addEventListener('change', () => {
      this.updateDrawMode(drawModeSelect.value as DrawMode);
      console.log('🎨 Draw mode changed to:', drawModeSelect.value);
    });

    const anaglyphCheckbox = document.getElementById('anaglyphStereo') as HTMLInputElement;
    anaglyphCheckbox.addEventListener('change', () => {
      this.sceneManager.setAnaglyphEnabled(anaglyphCheckbox.checked);
      console.log('🕶️ Anaglyph stereo:', anaglyphCheckbox.checked ? 'ON' : 'OFF');
    });

    // Eye separation for stereo (in cm, converted to meters)
    this.setupRangeControl('eyeSeparation', (value) => {
      this.sceneManager.setEyeSeparation(value / 100); // Convert cm to meters
      console.log('👁️ Eye separation:', (value / 100).toFixed(3), 'm');
    }, 100);

    // Ball controls
    this.setupRangeControl('ballCount', (value) => {
      this.ballParams.count = value;
      console.log('🎱 Ball count changed to:', value, '(click New to apply)');
    });

    this.setupRangeControl('minRadius', (value) => {
      this.ballParams.minRadius = value / 100;
      console.log('🎱 Min radius will be:', (value / 100).toFixed(2), 'm');
    }, 100);

    this.setupRangeControl('maxRadius', (value) => {
      this.ballParams.maxRadius = value / 100;
      console.log('🎱 Max radius will be:', (value / 100).toFixed(2), 'm');
    }, 100);

    this.setupRangeControl('maxVelocity', (value) => {
      this.ballParams.maxVelocity = value;
      console.log('🎱 Max velocity will be:', value, 'm/s');
    });

    this.setupRangeControl('elasticity', (value) => {
      this.ballParams.elasticity = value / 100;
      console.log('🎱 Ball elasticity will be:', (value / 100).toFixed(2));
    }, 100);

    // Physics controls
    const gravityPresetSelect = document.getElementById('gravityPreset') as HTMLSelectElement;
    gravityPresetSelect.addEventListener('change', () => {
      const magnitude = parseFloat((document.getElementById('gravityMagnitude') as HTMLInputElement).value);
      this.global.setGravityPreset(gravityPresetSelect.value, magnitude);
      console.log('🌍 Gravity preset changed to:', gravityPresetSelect.value, 'magnitude:', magnitude, 'm/s²');
      console.log('🌍 New acceleration:', this.global.acceleration);
    });

    this.setupRangeControl('gravityMagnitude', (value) => {
      const preset = (document.getElementById('gravityPreset') as HTMLSelectElement).value;
      this.global.setGravityPreset(preset, value);
      console.log('🌍 Gravity magnitude changed to:', value, 'm/s² (preset:', preset + ')');
      console.log('🌍 New acceleration:', this.global.acceleration);
    });

    this.setupRangeControl('globalElasticity', (value) => {
      this.global.elasticity = value / 100;
      console.log('⚡ Global elasticity:', (value / 100).toFixed(2));
    }, 100);
  }

  /**
   * Helper: Setup range control with value display
   */
  private setupRangeControl(id: string, onChange: (value: number) => void, multiplier = 1): void {
    const input = document.getElementById(id) as HTMLInputElement;
    const valueDisplay = document.getElementById(`${id}Value`);

    const updateValue = () => {
      const value = parseFloat(input.value);
      const displayValue = multiplier === 100 ? (value / 100).toFixed(2) : value;
      if (valueDisplay) {
        valueDisplay.textContent = displayValue.toString();
      }
      onChange(value);
    };

    input.addEventListener('input', updateValue);
    updateValue(); // Initial update
  }

  /**
   * Start simulation (Animation-Loop läuft bereits immer)
   */
  start(): void {
    if (this.isRunning) return;

    this.isRunning = true;
    this.lastTime = performance.now();
    this.lastFpsUpdate = this.lastTime;
    this.frameCount = 0;

    const startBtn = document.getElementById('startBtn') as HTMLButtonElement;
    const stopBtn = document.getElementById('stopBtn') as HTMLButtonElement;
    startBtn.disabled = true;
    stopBtn.disabled = false;

    console.log('▶ Simulation started (physics enabled)');
  }

  /**
   * Stop simulation (Rendering läuft weiter für Kamera-Interaktion)
   */
  stop(): void {
    if (!this.isRunning) return;

    this.isRunning = false;
    // Animation-Loop NICHT stoppen - läuft weiter für Rendering!

    const startBtn = document.getElementById('startBtn') as HTMLButtonElement;
    const stopBtn = document.getElementById('stopBtn') as HTMLButtonElement;
    startBtn.disabled = false;
    stopBtn.disabled = true;

    console.log('⏸ Simulation stopped (rendering continues for camera interaction)');
  }

  /**
   * Reset simulation
   */
  reset(): void {
    console.log('🔄 Reset called');
    const wasRunning = this.isRunning;
    this.stop();

    console.log('🎱 Generating', this.ballParams.count, 'balls with params:', this.ballParams);
    // Generate new balls with current parameters
    this.ballSet = generateBalls(this.ballParams);
    console.log('✅ Generated', this.ballSet.num, 'balls');

    // Reinitialize physics engine
    this.physicsEngine = new PhysicsEngine(
      this.ballSet,
      this.walls,
      this.global
    );

    // Reinitialize scene
    console.log('🎬 Calling initializeScene with', this.ballSet.num, 'balls');
    this.sceneManager.initializeScene(this.ballSet, this.walls);
    console.log('✅ initializeScene complete');

    // Force initial render to show balls immediately
    this.sceneManager.render();
    console.log('🖼️ Initial render done');

    // Update stats
    this.updateStats();

    console.log('🔄 Simulation reset with', this.ballSet.num, 'balls, wasRunning:', wasRunning);

    if (wasRunning) {
      console.log('▶ Auto-restarting simulation');
      this.start();
    }
  }

  /**
   * Update draw mode without resetting simulation
   */
  updateDrawMode(mode: DrawMode): void {
    console.log('🎨 Updating draw mode to:', mode);

    // Update draw mode in scene manager
    this.sceneManager.setDrawMode(mode);

    // Recreate ball meshes with new mode (without resetting physics)
    this.sceneManager.recreateBallMeshes(this.ballSet);

    console.log('✅ Draw mode updated, simulation continues');
  }

  /**
   * Main animation loop - läuft IMMER (auch im Stopp-Modus für Kamera-Interaktion)
   */
  private animate = (): void => {
    const currentTime = performance.now();
    const deltaTime = (currentTime - this.lastTime) / 1000; // Convert to seconds
    this.lastTime = currentTime;

    // Update physics NUR wenn Simulation läuft
    if (this.isRunning) {
      this.physicsEngine.calculate();

      // Update ball positions in rendering
      this.sceneManager.updateBalls(this.ballSet);
    }

    // Rendering läuft IMMER (auch im Stopp-Modus)
    // So kann man im Stopp-Modus drehen, zoomen und visuelle Änderungen sehen
    this.sceneManager.render();

    // Update FPS
    this.frameCount++;
    if (currentTime - this.lastFpsUpdate >= 1000) {
      this.currentFps = this.frameCount;
      this.frameCount = 0;
      this.lastFpsUpdate = currentTime;
    }

    // Update stats display
    this.updateStats();

    // Continue loop - IMMER
    this.animationId = requestAnimationFrame(this.animate);
  };

  /**
   * Update stats display
   */
  private updateStats(): void {
    const fpsEl = document.getElementById('fps');
    const ballCountEl = document.getElementById('ballCountStat');
    const generationEl = document.getElementById('generation');
    const checksEl = document.getElementById('checks');
    const collisionsEl = document.getElementById('collisions');
    const calcTimeEl = document.getElementById('calcTime');

    if (fpsEl) fpsEl.textContent = this.currentFps.toString();
    if (ballCountEl) ballCountEl.textContent = this.ballSet.num.toString();
    if (generationEl) generationEl.textContent = this.ballSet.generation.toString();
    if (checksEl) checksEl.textContent = this.physicsEngine.stats.numChecks.toString();
    if (collisionsEl) collisionsEl.textContent = this.physicsEngine.stats.numCollisions.toString();
    if (calcTimeEl) calcTimeEl.textContent = this.physicsEngine.stats.calcTime.toFixed(2);
  }

  /**
   * Dispose resources
   */
  dispose(): void {
    this.isRunning = false;

    // Stoppe Animation-Loop
    if (this.animationId !== null) {
      cancelAnimationFrame(this.animationId);
      this.animationId = null;
    }

    this.sceneManager.dispose();
  }

  /**
   * Debug: Dump scene state
   */
  debugScene(): void {
    this.sceneManager.dumpSceneState();
  }

  /**
   * Debug: Anaglyph status
   */
  debugAnaglyph(): void {
    this.sceneManager.debugAnaglyph();
  }
}

// Initialize app
const canvas = document.getElementById('canvas') as HTMLCanvasElement;
const app = new PaDIPSApp(canvas);

// Handle cleanup on page unload
window.addEventListener('beforeunload', () => {
  app.dispose();
});

// Export for debugging
(window as any).padips = app;
(window as any).debugScene = () => app.debugScene();
(window as any).debugAnaglyph = () => app.debugAnaglyph();

console.log('💡 Debug-Befehle verfügbar:');
console.log('  window.padips - Zugriff auf App');
console.log('  debugScene() - Scene-Status ausgeben');
console.log('  debugAnaglyph() - Anaglyph-Status prüfen');

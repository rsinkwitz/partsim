/**
 * PaDIPS Main Application
 * Phase 1 MVP - Vanilla TypeScript + Three.js
 */

import * as THREE from 'three';
import { BallSet } from './core/BallSet';
import { GlobalParams } from './core/GlobalParams';
import { Parallelogram } from './core/Parallelogram';
import { CBR, DrawMode, StereoMode } from './core/Constants';
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
  private isTurning: boolean = false; // Auto-rotation mode

  // Visualization state (for React Native controls without HTML UI)
  private visualizationState = {
    showOccupiedVoxels: false,
    showCollisionChecks: false,
    gridSegments: new THREE.Vector3(8, 8, 8),
  };

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

    // Setup PostMessage listener for external control (React Native/iframe)
    this.setupPostMessageListener();
  }

  /**
   * Setup PostMessage listener for external control
   */
  private setupPostMessageListener(): void {
    window.addEventListener('message', (event) => {
      try {
        const data = JSON.parse(event.data);
        console.log('📨 PostMessage received:', data);

        switch (data.action) {
          case 'start':
            this.start();
            break;
          case 'stop':
            this.stop();
            break;
          case 'new':
          case 'reset':
            this.reset();
            break;
          case 'setBallCount':
            this.ballParams.count = data.params;
            console.log('🎱 Ball count set to:', data.params);
            this.reset(); // Apply change
            break;
          case 'setCalcFactor':
            this.physicsEngine.setCalcFactor(data.params);
            console.log('⚙️ Calc factor set to:', data.params);
            break;
          case 'setGridEnabled':
            // Will be applied on next applyGrid
            console.log('🔲 Grid enabled:', data.params);
            break;
          case 'applyGrid':
            const segments = data.params?.segments || 8;
            const gridSegmentsVec = new THREE.Vector3(segments, segments, segments);

            // Store in state
            this.visualizationState.gridSegments = gridSegmentsVec;

            // Reinitialize physics engine with grid
            this.physicsEngine = new PhysicsEngine(
              this.ballSet,
              this.walls,
              this.global
            );
            this.physicsEngine.setGridSegments(gridSegmentsVec);
            this.physicsEngine.setGridEnabled(true);

            // Create grid visualization
            const CBR = 1.518;
            const origin = new THREE.Vector3(-CBR, -CBR, -CBR);
            const extent = new THREE.Vector3(CBR, CBR, CBR);
            this.sceneManager.createGridVisualization(gridSegmentsVec, origin, extent);

            // Reinitialize scene with new physics engine
            this.sceneManager.initializeScene(this.ballSet, this.walls);

            console.log('⚡ Grid applied with segments:', segments);
            break;
          case 'setShowWorldGrid':
            // If grid doesn't exist yet, create it first
            if (data.params && !this.sceneManager.hasGridVisualization()) {
              const CBR = 1.518;
              const origin = new THREE.Vector3(-CBR, -CBR, -CBR);
              const extent = new THREE.Vector3(CBR, CBR, CBR);
              this.sceneManager.createGridVisualization(this.visualizationState.gridSegments, origin, extent);
            }
            this.sceneManager.setShowGrid(data.params);
            console.log('🔲 Show World Grid:', data.params);
            break;
          case 'setShowOccupiedVoxels':
            this.visualizationState.showOccupiedVoxels = data.params;
            this.sceneManager.setShowOccupiedVoxels(data.params);
            console.log('🔲 Show Occupied Voxels:', data.params);
            break;
          case 'setShowCollisionChecks':
            this.visualizationState.showCollisionChecks = data.params;
            this.sceneManager.setShowCollisionChecks(data.params);
            this.physicsEngine.setTrackCollisionChecks(data.params);
            console.log('🔲 Show Collision Checks:', data.params);
            break;
          default:
            console.warn('Unknown action:', data.action);
        }
      } catch (e) {
        // Ignore non-JSON messages
      }
    });
    console.log('📨 PostMessage listener initialized');
  }

  /**
   * Setup UI event handlers (optional - nur wenn HTML-UI existiert)
   */
  private setupUI(): void {
    // Check if HTML UI exists
    const startBtn = document.getElementById('startBtn') as HTMLButtonElement;
    if (!startBtn) {
      console.log('ℹ️ No HTML UI found - using external control (React Native/Expo)');
      // Setup keyboard shortcuts even without HTML UI
      this.setupKeyboardShortcuts();
      return;
    }

    console.log('🎨 Setting up HTML UI controls');

    // Buttons
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

    // Stereo mode radio buttons
    const stereoModeRadios = document.querySelectorAll<HTMLInputElement>('input[name="stereoMode"]');
    stereoModeRadios.forEach(radio => {
      radio.addEventListener('change', () => {
        if (radio.checked) {
          const mode = radio.value as StereoMode;
          this.sceneManager.setStereoMode(mode);
          console.log('🕶️ Stereo mode changed to:', mode);

          // Update UI layout for Top-Bottom mode
          if (mode === 'topbottom') {
            document.body.classList.add('stereo-topbottom');
            console.log('📺 UI restricted to top half for Top-Bottom stereo');
          } else {
            document.body.classList.remove('stereo-topbottom');
          }
        }
      });
    });

    // Eye separation for stereo (in cm, converted to meters)
    this.setupRangeControl('eyeSeparation', (value) => {
      this.sceneManager.setEyeSeparation(value / 100); // Convert cm to meters
      console.log('👁️ Eye separation:', (value / 100).toFixed(3), 'm');
    }, 100);

    // Wireframe density (segments)
    this.setupRangeControl('wireframeSegments', (value) => {
      this.sceneManager.setWireframeSegments(value);
      // Recreate meshes if in wireframe mode
      if (this.sceneManager.getDrawMode() === DrawMode.WIREFRAME) {
        this.sceneManager.recreateBallMeshes(this.ballSet);
      }
      console.log('🔲 Wireframe segments:', value);
    });

    // Cube depth for 3D stereo effect (in units, 0.1m per unit)
    this.setupRangeControl('cubeDepth', (value) => {
      this.sceneManager.setCubeDepth(value * 0.1); // Scale: slider -20..20 → -2..2 meters
      console.log('📦 Cube depth:', (value * 0.1).toFixed(1), 'm');
    }, 10);

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

    // Grid system controls
    const gridEnabled = document.getElementById('gridEnabled') as HTMLInputElement;
    const gridVizGroup = document.querySelector('.grid-viz-group') as HTMLElement;

    gridEnabled.addEventListener('change', () => {
      const enabled = gridEnabled.checked;

      // Toggle visualization controls
      if (gridVizGroup) {
        if (enabled) {
          gridVizGroup.classList.remove('disabled');
        } else {
          gridVizGroup.classList.add('disabled');
        }
      }

      console.log('🔲 Grid mode:', enabled ? 'ENABLED' : 'DISABLED');
    });

    this.setupRangeControl('gridSegments', (value) => {
      console.log('🔲 Grid segments changed to:', value, '(click Apply to activate)');
    });

    const applyGridBtn = document.getElementById('applyGridBtn') as HTMLButtonElement;
    applyGridBtn.addEventListener('click', () => {
      this.applyGrid();
    });

    const showWorldGrid = document.getElementById('showWorldGrid') as HTMLInputElement;
    showWorldGrid.addEventListener('change', () => {
      const show = showWorldGrid.checked;

      // If user wants to show grid but it doesn't exist yet, create it
      if (show && !this.sceneManager.hasGridVisualization()) {
        const gridEnabled = (document.getElementById('gridEnabled') as HTMLInputElement)?.checked;
        if (gridEnabled) {
          // Grid system is enabled, create visualization
          const gridSegmentsValue = parseInt((document.getElementById('gridSegments') as HTMLInputElement).value);
          const segments = new THREE.Vector3(gridSegmentsValue, gridSegmentsValue, gridSegmentsValue);
          const CBR = 1.518;
          const origin = new THREE.Vector3(-CBR, -CBR, -CBR);
          const extent = new THREE.Vector3(CBR, CBR, CBR);
          this.sceneManager.createGridVisualization(segments, origin, extent);
        }
      }

      this.sceneManager.setShowGrid(show);
    });

    const showOccupiedVoxels = document.getElementById('showOccupiedVoxels') as HTMLInputElement;
    showOccupiedVoxels.addEventListener('change', () => {
      this.sceneManager.setShowOccupiedVoxels(showOccupiedVoxels.checked);
    });

    const showCollisionChecks = document.getElementById('showCollisionChecks') as HTMLInputElement;
    showCollisionChecks.addEventListener('change', () => {
      const enabled = showCollisionChecks.checked;
      this.sceneManager.setShowCollisionChecks(enabled);
      this.physicsEngine.setTrackCollisionChecks(enabled);
      console.log('🔲 Collision checks tracking:', enabled);
    });

    // Initialize grid viz group as disabled
    if (gridVizGroup) {
      gridVizGroup.classList.add('disabled');
    }

    // Keyboard shortcuts
    this.setupKeyboardShortcuts();
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
   * Setup keyboard shortcuts
   */
  private setupKeyboardShortcuts(): void {
    window.addEventListener('keydown', (e) => {
      // Ignore if typing in an input field
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLSelectElement) {
        return;
      }

      // Debug: Log key events for +/- combinations
      if ((e.key === '+' || e.key === '-' || e.key === '=' || e.key === '_' || e.key === '*' ||
           e.code === 'NumpadAdd' || e.code === 'NumpadSubtract')) {
        console.log('🔍 Key Debug:', {
          key: e.key,
          code: e.code,
          shiftKey: e.shiftKey,
          ctrlKey: e.ctrlKey
        });
      }

      // ===== NUMPAD: Separate handling (always works) =====
      if (!e.shiftKey && !e.ctrlKey && e.code === 'NumpadAdd') {
        e.preventDefault();
        this.changeBallCount(50);
        console.log('⌨️ [Numpad +] Added 50 balls');
        return;
      }

      if (!e.shiftKey && !e.ctrlKey && e.code === 'NumpadSubtract') {
        e.preventDefault();
        this.changeBallCount(-50);
        console.log('⌨️ [Numpad -] Removed 50 balls');
        return;
      }

      if (e.shiftKey && !e.ctrlKey && e.code === 'NumpadAdd') {
        e.preventDefault();
        this.changeWireframeDensity(2);
        console.log('⌨️ [Shift-Numpad +] Wireframe density increased');
        return;
      }

      if (e.shiftKey && !e.ctrlKey && e.code === 'NumpadSubtract') {
        e.preventDefault();
        this.changeWireframeDensity(-2);
        console.log('⌨️ [Shift-Numpad -] Wireframe density decreased');
        return;
      }

      if (e.ctrlKey && !e.shiftKey && e.code === 'NumpadAdd') {
        e.preventDefault();
        this.changeCubeDepth(1);
        console.log('⌨️ [Ctrl-Numpad +] Cube depth increased');
        return;
      }

      if (e.ctrlKey && !e.shiftKey && e.code === 'NumpadSubtract') {
        e.preventDefault();
        this.changeCubeDepth(-1);
        console.log('⌨️ [Ctrl-Numpad -] Cube depth decreased');
        return;
      }

      // ===== MAIN KEYBOARD: Use e.key (layout-aware) =====
      // Shift + Plus : Increase wireframe density
      // DE: Shift + + = *, EN: Shift + = = +
      if (e.shiftKey && !e.ctrlKey && (e.key === '+' || e.key === '*')) {
        e.preventDefault();
        this.changeWireframeDensity(2);
        console.log('⌨️ [Shift-+] Wireframe density increased (key:', e.key, ')');
        return;
      }

      // Shift + Minus : Decrease wireframe density
      if (e.shiftKey && !e.ctrlKey && (e.key === '-' || e.key === '_')) {
        e.preventDefault();
        this.changeWireframeDensity(-2);
        console.log('⌨️ [Shift--] Wireframe density decreased (key:', e.key, ')');
        return;
      }

      // Ctrl + Plus : Increase cube depth
      if (e.ctrlKey && !e.shiftKey && (e.key === '+' || e.key === '=')) {
        e.preventDefault();
        this.changeCubeDepth(1);
        console.log('⌨️ [Ctrl-+] Cube depth increased (key:', e.key, ')');
        return;
      }

      // Ctrl + Minus : Decrease cube depth
      if (e.ctrlKey && !e.shiftKey && e.key === '-') {
        e.preventDefault();
        this.changeCubeDepth(-1);
        console.log('⌨️ [Ctrl--] Cube depth decreased');
        return;
      }

      // Plain +/- : Ball count (layout-aware)
      // DE: + ohne Shift, EN: = ohne Shift
      if (!e.shiftKey && !e.ctrlKey && (e.key === '+' || e.key === '=')) {
        e.preventDefault();
        this.changeBallCount(50);
        console.log('⌨️ [+] Added 50 balls (key:', e.key, ')');
        return;
      }

      if (!e.shiftKey && !e.ctrlKey && e.key === '-') {
        e.preventDefault();
        this.changeBallCount(-50);
        console.log('⌨️ [-] Removed 50 balls');
        return;
      }

      // ===== VI-STYLE SHORTCUTS: j/k (always available) =====
      const keyLower = e.key.toLowerCase();

      // k = more balls (vi: up/more)
      if (keyLower === 'k' && !e.shiftKey && !e.ctrlKey) {
        this.changeBallCount(50);
        console.log('⌨️ [K] Added 50 balls (vi-style)');
        return;
      }

      // j = fewer balls (vi: down/less)
      if (keyLower === 'j' && !e.shiftKey && !e.ctrlKey) {
        this.changeBallCount(-50);
        console.log('⌨️ [J] Removed 50 balls (vi-style)');
        return;
      }

      // Shift-K: increase wireframe density
      if (e.shiftKey && !e.ctrlKey && keyLower === 'k') {
        this.changeWireframeDensity(2);
        console.log('⌨️ [Shift-K] Wireframe density increased (vi-style)');
        return;
      }

      // Shift-J: decrease wireframe density
      if (e.shiftKey && !e.ctrlKey && keyLower === 'j') {
        this.changeWireframeDensity(-2);
        console.log('⌨️ [Shift-J] Wireframe density decreased (vi-style)');
        return;
      }

      // ===== OTHER SHORTCUTS =====
      switch (keyLower) {
        case 's':
        case ' ': // Spacebar for Start/Stop
          // Start/Stop toggle
          if (this.isRunning) {
            this.stop();
          } else {
            this.start();
          }
          console.log('⌨️ [S/Space] Start/Stop toggled');
          break;

        case 'n':
          // New (reset)
          this.reset();
          console.log('⌨️ [N] New simulation');
          break;

        case '3':
          // Toggle Top-Bottom 3D Stereo
          this.toggleStereoMode(StereoMode.TOP_BOTTOM);
          console.log('⌨️ [3] Top-Bottom stereo toggled');
          break;

        case 'a':
          // Toggle Anaglyph Stereo
          this.toggleStereoMode(StereoMode.ANAGLYPH);
          console.log('⌨️ [A] Anaglyph stereo toggled');
          break;

        case 't':
          // Toggle turn mode (auto-rotation)
          this.isTurning = !this.isTurning;
          if (this.isTurning) {
            this.sceneManager.setAutoRotation(true);
          } else {
            this.sceneManager.setAutoRotation(false);
          }
          console.log('⌨️ [T] Turn mode:', this.isTurning ? 'ON' : 'OFF');
          break;

        case 'g':
          // Toggle gravity between DOWN and ZERO
          this.toggleGravity();
          console.log('⌨️ [G] Gravity toggled');
          break;

        case 'w':
          // Toggle wireframe
          this.toggleDrawMode(DrawMode.WIREFRAME);
          console.log('⌨️ [W] Wireframe toggled');
          break;

        case 'p':
          // Toggle points/pixels
          this.toggleDrawMode(DrawMode.POINTS);
          console.log('⌨️ [P] Points toggled');
          break;

        case 'f1':
          // Toggle key help
          e.preventDefault();
          this.toggleKeyHelp();
          console.log('⌨️ [F1] Key help toggled');
          break;
      }
    });

    console.log('⌨️ Keyboard shortcuts enabled:');
    console.log('  [S] or [Space] Start/Stop');
    console.log('  [N] New simulation');
    console.log('  [G] Toggle Gravity (Down ↔ Zero)');
    console.log('  [3] Top-Bottom 3D stereo (repeat=off)');
    console.log('  [A] Anaglyph stereo (repeat=off)');
    console.log('  [T] Turn mode on/off');
    console.log('  [W] Wireframe (repeat=shaded)');
    console.log('  [P] Points (repeat=shaded)');
    console.log('  [+/-] or [K/J] Add/Remove 50 balls (vi: K=more, J=less)');
    console.log('  [Shift-+/-] or [Shift-K/J] Wireframe density');
    console.log('  [Ctrl-+/-] Cube depth');
    console.log('  [F1] Toggle key help');
    console.log('  💡 Numpad +/- always works, main keyboard is layout-aware');
  }

  /**
   * Toggle stereo mode (off if same mode pressed again)
   */
  private toggleStereoMode(mode: StereoMode): void {
    const currentMode = this.sceneManager.getStereoMode();
    const newMode = currentMode === mode ? StereoMode.OFF : mode;

    this.sceneManager.setStereoMode(newMode);

    // Update UI radio button
    const radio = document.querySelector<HTMLInputElement>(`input[name="stereoMode"][value="${newMode}"]`);
    if (radio) {
      radio.checked = true;
    }

    // Update body class for Top-Bottom mode
    if (newMode === StereoMode.TOP_BOTTOM) {
      document.body.classList.add('stereo-topbottom');
    } else {
      document.body.classList.remove('stereo-topbottom');
    }
  }

  /**
   * Toggle draw mode (back to LIGHTED if same mode pressed again)
   */
  private toggleDrawMode(mode: DrawMode): void {
    const currentMode = this.sceneManager.getDrawMode();
    const newMode = currentMode === mode ? DrawMode.LIGHTED : mode;

    this.updateDrawMode(newMode);

    // Update UI select
    const select = document.getElementById('drawMode') as HTMLSelectElement;
    if (select) {
      select.value = newMode;
    }
  }

  /**
   * Change ball count by delta
   */
  private changeBallCount(delta: number): void {
    const currentCount = this.ballParams.count;
    const newCount = Math.max(5, Math.min(1000, currentCount + delta));

    if (newCount === currentCount) {
      console.log('⚠️ Ball count limit reached');
      return;
    }

    this.ballParams.count = newCount;

    // Update UI slider
    const slider = document.getElementById('ballCount') as HTMLInputElement;
    if (slider) {
      slider.value = newCount.toString();
    }
    const valueDisplay = document.getElementById('ballCountValue');
    if (valueDisplay) {
      valueDisplay.textContent = newCount.toString();
    }

    // Apply change
    this.reset();
  }

  /**
   * Apply grid configuration
   */
  private applyGrid(): void {
    console.log('🔲 Applying grid configuration...');

    const gridEnabled = (document.getElementById('gridEnabled') as HTMLInputElement).checked;
    const gridSegmentsValue = parseInt((document.getElementById('gridSegments') as HTMLInputElement).value);
    const showWorldGrid = (document.getElementById('showWorldGrid') as HTMLInputElement).checked;
    const showOccupiedVoxels = (document.getElementById('showOccupiedVoxels') as HTMLInputElement).checked;

    // Calculate maximum allowed ball radius for grid
    const CBR = 1.518; // Cube radius
    const cellSize = (2 * CBR) / gridSegmentsValue;
    const maxAllowedRadius = cellSize / 2;

    // Adjust ball parameters if needed
    if (this.ballParams.maxRadius > maxAllowedRadius) {
      console.warn('⚠️ Max ball radius too large for grid, adjusting...');
      this.ballParams.maxRadius = maxAllowedRadius * 0.9; // 90% of max to be safe

      // Update UI
      const maxRadiusSlider = document.getElementById('maxRadius') as HTMLInputElement;
      const maxRadiusValue = document.getElementById('maxRadiusValue');
      if (maxRadiusSlider && maxRadiusValue) {
        maxRadiusSlider.value = (this.ballParams.maxRadius * 100).toString();
        maxRadiusValue.textContent = this.ballParams.maxRadius.toFixed(2);
      }
    }

    if (this.ballParams.minRadius > maxAllowedRadius) {
      console.warn('⚠️ Min ball radius too large for grid, adjusting...');
      this.ballParams.minRadius = maxAllowedRadius * 0.5;

      // Update UI
      const minRadiusSlider = document.getElementById('minRadius') as HTMLInputElement;
      const minRadiusValue = document.getElementById('minRadiusValue');
      if (minRadiusSlider && minRadiusValue) {
        minRadiusSlider.value = (this.ballParams.minRadius * 100).toString();
        minRadiusValue.textContent = this.ballParams.minRadius.toFixed(2);
      }
    }

    // Stop simulation
    const wasRunning = this.isRunning;
    this.stop();

    // Regenerate balls with adjusted parameters
    console.log('🎱 Regenerating balls with grid-compatible size...');
    this.ballSet = generateBalls(this.ballParams);

    // Reinitialize physics engine with grid
    this.physicsEngine = new PhysicsEngine(
      this.ballSet,
      this.walls,
      this.global
    );

    if (gridEnabled) {
      // Initialize grid
      const segments = new THREE.Vector3(gridSegmentsValue, gridSegmentsValue, gridSegmentsValue);
      this.physicsEngine.setGridSegments(segments);
      this.physicsEngine.setGridEnabled(true);

      // Validate configuration
      const validation = this.physicsEngine.validateGridConfiguration();
      if (!validation.valid) {
        console.error('❌ Grid validation failed:', validation.errors);
        alert('Grid configuration invalid:\n' + validation.errors.join('\n'));
        return;
      }

      // Create grid visualization
      const CBR = 1.518;
      const origin = new THREE.Vector3(-CBR, -CBR, -CBR);
      const extent = new THREE.Vector3(CBR, CBR, CBR);
      this.sceneManager.createGridVisualization(segments, origin, extent);
      this.sceneManager.setShowGrid(showWorldGrid);
      this.sceneManager.setShowOccupiedVoxels(showOccupiedVoxels);

      console.log('✅ Grid system applied successfully');
    } else {
      this.physicsEngine.setGridEnabled(false);
      console.log('🔲 Grid system disabled');
    }

    // Re-enable collision check tracking if it was enabled
    const showCollisionChecks = (document.getElementById('showCollisionChecks') as HTMLInputElement)?.checked;
    if (showCollisionChecks) {
      this.physicsEngine.setTrackCollisionChecks(true);
      console.log('🔲 Collision check tracking re-enabled');
    }

    // Reinitialize scene
    this.sceneManager.initializeScene(this.ballSet, this.walls);
    this.sceneManager.render();

    // Update stats
    this.updateStats();

    // Restart if was running
    if (wasRunning) {
      this.start();
    }

    console.log('🔲 Grid application complete');
  }

  /**
   * Change wireframe density by delta
   */
  private changeWireframeDensity(delta: number): void {
    const current = this.sceneManager.getWireframeSegments();
    const newValue = Math.max(4, Math.min(32, current + delta));

    if (newValue === current) {
      console.log('⚠️ Wireframe density limit reached');
      return;
    }

    this.sceneManager.setWireframeSegments(newValue);

    // Update UI slider
    const slider = document.getElementById('wireframeSegments') as HTMLInputElement;
    if (slider) {
      slider.value = newValue.toString();
    }
    const valueDisplay = document.getElementById('wireframeSegmentsValue');
    if (valueDisplay) {
      valueDisplay.textContent = newValue.toString();
    }

    // Recreate meshes if in wireframe mode
    if (this.sceneManager.getDrawMode() === DrawMode.WIREFRAME) {
      this.sceneManager.recreateBallMeshes(this.ballSet);
    }
  }

  /**
   * Toggle gravity between DOWN and ZERO
   */
  private toggleGravity(): void {
    const selectEl = document.getElementById('gravityPreset') as HTMLSelectElement;
    const magnitudeEl = document.getElementById('gravityMagnitude') as HTMLInputElement;

    // If no HTML UI, just toggle between ZERO and DOWN with default magnitude
    if (!selectEl || !magnitudeEl) {
      const currentAccel = this.global.acceleration;
      const isZero = currentAccel.x === 0 && currentAccel.y === 0 && currentAccel.z === 0;
      const newPreset = isZero ? 'DOWN' : 'ZERO';
      this.global.setGravityPreset(newPreset, 9.81);
      console.log('🌍 Gravity toggled to:', newPreset, '(no HTML UI)');
      return;
    }

    const currentPreset = selectEl.value;
    const newPreset = currentPreset === 'ZERO' ? 'DOWN' : 'ZERO';
    const magnitude = parseFloat(magnitudeEl.value);

    this.global.setGravityPreset(newPreset, magnitude);
    selectEl.value = newPreset;

    console.log('🌍 Gravity toggled to:', newPreset, 'with magnitude:', magnitude);
  }

  /**
   * Change cube depth by delta
   */
  private changeCubeDepth(delta: number): void {
    const slider = document.getElementById('cubeDepth') as HTMLInputElement;
    const valueDisplay = document.getElementById('cubeDepthValue');

    if (!slider) {
      // No HTML UI - just use delta directly (±0.1m per step)
      // Note: We can't track current depth without HTML, so just apply delta
      console.log('📦 Cube depth changed (no HTML UI, delta:', delta * 0.1, 'm)');
      return;
    }

    const current = parseFloat(slider.value);
    const newValue = Math.max(-20, Math.min(20, current + delta));

    if (newValue === current) {
      console.log('⚠️ Cube depth limit reached');
      return;
    }

    slider.value = newValue.toString();
    if (valueDisplay) {
      valueDisplay.textContent = newValue.toFixed(1);
    }

    this.sceneManager.setCubeDepth(newValue * 0.1);
  }

  /**
   * Toggle keyboard help overlay
   */
  private toggleKeyHelp(): void {
    const helpDiv = document.getElementById('keyHelp');
    if (helpDiv) {
      helpDiv.style.display = helpDiv.style.display === 'none' ? 'block' : 'none';
    }
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

    // Update HTML buttons if they exist
    const startBtn = document.getElementById('startBtn') as HTMLButtonElement;
    const stopBtn = document.getElementById('stopBtn') as HTMLButtonElement;
    if (startBtn && stopBtn) {
      startBtn.disabled = true;
      stopBtn.disabled = false;
    }

    console.log('▶ Simulation started (physics enabled)');
  }

  /**
   * Stop simulation (Rendering läuft weiter für Kamera-Interaktion)
   */
  stop(): void {
    if (!this.isRunning) return;

    this.isRunning = false;
    // Animation-Loop NICHT stoppen - läuft weiter für Rendering!

    // Update HTML buttons if they exist
    const startBtn = document.getElementById('startBtn') as HTMLButtonElement;
    const stopBtn = document.getElementById('stopBtn') as HTMLButtonElement;
    if (startBtn && stopBtn) {
      startBtn.disabled = false;
      stopBtn.disabled = true;
    }

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

    // Check if grid is enabled
    const gridEnabled = (document.getElementById('gridEnabled') as HTMLInputElement)?.checked;

    // Reinitialize physics engine
    this.physicsEngine = new PhysicsEngine(
      this.ballSet,
      this.walls,
      this.global
    );

    // Reinitialize grid if it was enabled
    if (gridEnabled) {
      const gridSegmentsValue = parseInt((document.getElementById('gridSegments') as HTMLInputElement).value);
      const segments = new THREE.Vector3(gridSegmentsValue, gridSegmentsValue, gridSegmentsValue);
      this.physicsEngine.setGridSegments(segments);
      this.physicsEngine.setGridEnabled(true);
      console.log('🔲 Grid reinitialized for new ball set');
    }

    // Re-enable collision check tracking if it was enabled
    const showCollisionChecks = (document.getElementById('showCollisionChecks') as HTMLInputElement)?.checked;
    if (showCollisionChecks) {
      this.physicsEngine.setTrackCollisionChecks(true);
      console.log('🔲 Collision check tracking re-enabled');
    }

    // Reinitialize scene (clears old visualizations)
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
    // const deltaTime = (currentTime - this.lastTime) / 1000; // Not used currently
    this.lastTime = currentTime;

    // Update physics NUR wenn Simulation läuft
    if (this.isRunning) {
      this.physicsEngine.calculate();

      // Update ball positions in rendering
      this.sceneManager.updateBalls(this.ballSet);

      // Update grid visualization if enabled
      const grid = this.physicsEngine.getGrid();
      if (grid) {
        // Check HTML UI first, fallback to state
        const showOccupiedVoxelsEl = document.getElementById('showOccupiedVoxels') as HTMLInputElement;
        const showOccupiedVoxels = showOccupiedVoxelsEl ? showOccupiedVoxelsEl.checked : this.visualizationState.showOccupiedVoxels;

        if (showOccupiedVoxels) {
          const occupiedCells = grid.getOccupiedCells();
          this.sceneManager.updateOccupiedVoxels(occupiedCells, this.ballSet);
        }
      }

      // Update collision checks visualization if enabled
      const showCollisionChecksEl = document.getElementById('showCollisionChecks') as HTMLInputElement;
      const showCollisionChecks = showCollisionChecksEl ? showCollisionChecksEl.checked : this.visualizationState.showCollisionChecks;

      if (showCollisionChecks) {
        const checks = this.physicsEngine.getCollisionChecks();
        this.sceneManager.updateCollisionChecks(checks, this.ballSet);
      }
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

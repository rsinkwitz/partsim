/**
 * PaDIPS Main Application
 * Phase 1 MVP - Vanilla TypeScript + Three.js
 */

import * as THREE from 'three';
import { Ball } from './core/Ball';
import { BallSet } from './core/BallSet';
import { GlobalParams } from './core/GlobalParams';
import { Parallelogram } from './core/Parallelogram';
import { CBR, DrawMode, StereoMode } from './core/Constants';
import { PhysicsEngine } from './simulation/PhysicsEngine';
import { SceneManager } from './rendering/SceneManager';
import { generateBalls, DEFAULT_BALL_PARAMS } from './utils/BallGenerator';
import type { BallGenerationParams } from './utils/BallGenerator';
import { RGBELoader } from 'three/examples/jsm/loaders/RGBELoader';

let silverMaterial: THREE.MeshStandardMaterial = new THREE.MeshStandardMaterial({
  color: 0xc0c0c0,
  roughness: 0.05,
  metalness: 1.0
});

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
  private turnSpeed: number = 1; // Auto-rotation speed: 0=off, 1=1x, 2=2x, 3=3x, 4=4x
  private gravityMagnitude: number = 9.81; // Current gravity magnitude (m/s²)

  // Track last sent values to avoid duplicate updates
  private lastSentState = {
    drawMode: '',
    gravityPreset: '',
    turnSpeed: -1,
  };

  // Visualization state (persistent across resets)
  private visualizationState = {
    gridEnabled: false,
    gridSegments: new THREE.Vector3(8, 8, 8),
    showWorldGrid: false,
    showOccupiedVoxels: false,
    showCollisionChecks: false,
  };

  // Simulation state (persistent across resets)
  private simulationState = {
    calcFactor: 10,
    collisionsEnabled: true,
  };

  // UI state
  private ballParams: BallGenerationParams = { ...DEFAULT_BALL_PARAMS };
  private isDarkMode: boolean = false; // Dark mode for F1 help UI

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

    // Signal to parent that WebView is ready
    this.sendInitializedSignal();

    // Starte Animation-Loop (läuft immer für Rendering & Kamera-Interaktion)
    this.lastTime = performance.now();
    this.lastFpsUpdate = this.lastTime;
    this.animationId = requestAnimationFrame(this.animate);
    console.log('🎬 Animation loop started (rendering active)');

    // Auto-start Physik-Simulation
    this.start();

    // Enable auto-rotation at startup (turnSpeed = 1)
    this.sceneManager.setAutoRotation(true, this.turnSpeed);
    console.log('🔄 Auto-rotation enabled at startup: ' + this.turnSpeed + 'x speed');

    // Setup PostMessage listener for external control (React Native/iframe)
    this.setupPostMessageListener();

    console.log('INIT: Cube created, now loading HDR texture...');

    // Load HDR texture in background for Mirror Cube reflections
    const loadEnvironmentTexture = async () => {
    try {
      console.log('HDR: Loading environment texture...');
      const loader = new RGBELoader();

      const baseUrl = window.location.href.substring(0, window.location.href.lastIndexOf('/') + 1);
      const texturePath = 'textures/rosendal_plains_2_1k-rot.hdr';
      const fullTexturePath = baseUrl + texturePath;

      // Use XMLHttpRequest instead of fetch (fetch doesn't work with file:// in Android WebView)
      return new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open('GET', fullTexturePath, true);
        xhr.responseType = 'arraybuffer';

        xhr.onprogress = (event) => {
          if (event.lengthComputable) {
            const percent = Math.round((event.loaded / event.total) * 100);
            if (percent % 25 === 0) { // Log every 25%
              console.log('HDR: Loading... ' + percent + '%');
            }
          }
        };

        xhr.onload = () => {
          // iOS WebView returns status 0 for file:// URLs even on success
          // Check if we have valid data instead
          const buffer = xhr.response as ArrayBuffer;

          if ((xhr.status === 200 || xhr.status === 0) && buffer && buffer.byteLength > 0) {
            try {
              console.log('HDR: Parsing buffer (' + Math.round(buffer.byteLength / 1024) + ' KB)...');
              const textureData = loader.parse(buffer);

              const texture = new THREE.DataTexture(
                textureData.data as any,
                textureData.width,
                textureData.height,
                THREE.RGBAFormat,
                textureData.type
              );
              texture.minFilter = THREE.LinearFilter;
              texture.magFilter = THREE.LinearFilter;
              texture.generateMipmaps = false;
              texture.needsUpdate = true;

              texture.mapping = THREE.EquirectangularReflectionMapping;

              this.sceneManager.getScene().environment = texture;

              console.log('✨ Environment map loaded');


              silverMaterial.envMap = texture;
              silverMaterial.envMapIntensity = 1.0;
              silverMaterial.metalness = 1.0;
              silverMaterial.roughness = 0.05;
              silverMaterial.needsUpdate = true;

              // Pass environment map to SceneManager for SILVER draw mode
              this.sceneManager.setEnvironmentMap(texture);

              console.log('HDR texture loaded and applied to silver material + SceneManager');
              resolve(texture);
            } catch (parseError) {
              console.log('HDR: ERROR - Parse failed:', parseError);
              reject(parseError);
            }
          } else {
            console.log('HDR: ERROR - HTTP status:', xhr.status, 'Buffer size:', buffer ? buffer.byteLength : 0);
            reject(new Error('HTTP ' + xhr.status + ' or empty buffer'));
          }
        };

        xhr.onerror = () => {
          console.log('HDR: ERROR - XMLHttpRequest failed');
          reject(new Error('XMLHttpRequest failed'));
        };

        xhr.send();
      });
    } catch (e) {
      console.log('HDR: Exception:', e);
      return Promise.reject(e);
    }
    };

    console.log('INIT: Calling loadEnvironmentTexture...');
    loadEnvironmentTexture().catch(error => {
    console.log('HDR: Final catch, error:', error);
    });
    console.log('INIT: loadEnvironmentTexture called');

  }

  /**
   * Setup PostMessage listener for external control
   */
  private setupPostMessageListener(): void {
    // Handler function for processing messages
    const handleMessage = (event: MessageEvent | any) => {
      try {
        // For React Native WebView, event.data might be a string or already parsed
        let data;
        if (typeof event.data === 'string') {
          data = JSON.parse(event.data);
        } else {
          data = event.data;
        }

        console.log('📨 PostMessage received:', data);

        switch (data.action) {
          case 'start':
            this.start();
            break;
          case 'stop':
            this.stop();
            break;
          case 'new':
            // Apply: Generate new balls WITHOUT camera reset
            this.newBalls();
            break;
          case 'reset':
            // Full reset: new balls + camera reset
            this.reset();
            break;

          // Ball parameters
          case 'setBallCount':
            this.ballParams.count = data.params;
            console.log('🎱 Ball count will be:', data.params, '(click New to apply)');
            break;
          case 'setMinRadius':
            this.ballParams.minRadius = data.params;
            console.log('🎱 Min radius will be:', data.params.toFixed(2), 'm');
            break;
          case 'setMaxRadius':
            this.ballParams.maxRadius = data.params;
            console.log('🎱 Max radius will be:', data.params.toFixed(2), 'm');
            break;
          case 'setMaxVelocity':
            this.ballParams.maxVelocity = data.params;
            console.log('🎱 Max velocity will be:', data.params, 'm/s');
            break;
          case 'setElasticity':
            this.ballParams.elasticity = data.params;
            console.log('🎱 Ball elasticity will be:', data.params.toFixed(2));
            break;

          // Physics
          case 'setGravityPreset':
            this.gravityMagnitude = data.params.magnitude; // Store magnitude for toggleGravity
            this.global.setGravityPreset(data.params.preset, data.params.magnitude);
            console.log('🌍 Gravity preset:', data.params.preset, 'magnitude:', data.params.magnitude, 'm/s²');
            this.sendStateToParent();
            break;
          case 'setGlobalElasticity':
            this.global.elasticity = data.params;
            console.log('⚡ Global elasticity:', data.params.toFixed(2));
            break;

          // Simulation
          case 'setCalcFactor':
            this.simulationState.calcFactor = data.params;
            this.physicsEngine.setCalcFactor(data.params);
            console.log('⚙️ Calc factor set to:', data.params);
            break;
          case 'setCollisionsEnabled':
            this.simulationState.collisionsEnabled = data.params;
            this.physicsEngine.setCollisionsEnabled(data.params);
            console.log('⚙️ Collisions:', data.params ? 'ON' : 'OFF');
            break;

          // Grid System
          case 'setGridEnabled':
            // Will be applied on next applyGrid
            console.log('🔲 Grid enabled:', data.params);
            break;
          case 'applyGrid':
            const segments = data.params?.segments || 8;
            const gridSegmentsVec = new THREE.Vector3(segments, segments, segments);

            // Store in state (persistent across resets)
            this.visualizationState.gridEnabled = true;
            this.visualizationState.gridSegments = gridSegmentsVec;

            // Reinitialize physics engine with grid
            this.physicsEngine = new PhysicsEngine(
              this.ballSet,
              this.walls,
              this.global
            );
            this.physicsEngine.setGridSegments(gridSegmentsVec);
            this.physicsEngine.setGridEnabled(true);

            // Restore collision checks tracking if it was enabled
            if (this.visualizationState.showCollisionChecks) {
              this.physicsEngine.setTrackCollisionChecks(true);
              console.log('🔲 Collision checks tracking restored after grid apply');
            }

            // Create grid visualization
            const CBR = 1.518;
            const origin = new THREE.Vector3(-CBR, -CBR, -CBR);
            const extent = new THREE.Vector3(CBR, CBR, CBR);
            this.sceneManager.createGridVisualization(gridSegmentsVec, origin, extent);

            // Reinitialize scene with new physics engine
            this.sceneManager.initializeScene(this.ballSet, this.walls);

            console.log('⚡ Grid applied with segments:', segments);
            break;
          case 'disableGrid':
            // Disable grid system
            this.visualizationState.gridEnabled = false;
            this.physicsEngine.setGridEnabled(false);

            // Clear grid visualization
            this.sceneManager.clearGridVisualization();

            // Reset visualizations in state
            this.visualizationState.showWorldGrid = false;
            this.visualizationState.showOccupiedVoxels = false;
            // Note: showCollisionChecks is now independent of grid
            this.sceneManager.setShowGrid(false);
            this.sceneManager.setShowOccupiedVoxels(false);

            console.log('🔲 Grid disabled');
            break;
          case 'setShowWorldGrid':
            // Store in state
            this.visualizationState.showWorldGrid = data.params;

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

          // Rendering
          case 'setDrawMode':
            this.updateDrawMode(data.params as DrawMode);
            console.log('🎨 Draw mode set to:', data.params);
            break;
          case 'setDarkMode':
            this.isDarkMode = data.params;
            const helpDiv = document.getElementById('keyHelp');
            if (helpDiv) {
              if (this.isDarkMode) {
                helpDiv.classList.add('dark');
              } else {
                helpDiv.classList.remove('dark');
              }
            }
            console.log('🌓 Dark mode:', this.isDarkMode ? 'ON' : 'OFF', '(from UI toggle)');
            break;
          case 'setWireframeSegments':
            this.sceneManager.setWireframeSegments(data.params);
            if (this.sceneManager.getDrawMode() === DrawMode.WIREFRAME) {
              this.sceneManager.recreateBallMeshes(this.ballSet);
            }
            console.log('🔲 Wireframe segments:', data.params);
            break;

          // 3D Stereo
          case 'setStereoMode':
            this.sceneManager.setStereoMode(data.params as StereoMode);
            console.log('🕶️ Stereo mode set to:', data.params);
            // Update UI layout for Top-Bottom mode
            if (data.params === 'topbottom') {
              document.body.classList.add('stereo-topbottom');
            } else {
              document.body.classList.remove('stereo-topbottom');
            }
            break;
          case 'setEyeSeparation':
            this.sceneManager.setEyeSeparation(data.params);
            console.log('👁️ Eye separation:', data.params.toFixed(3), 'm');
            break;
          case 'setCubeDepth':
            this.sceneManager.setCubeDepth(data.params);
            console.log('📦 Cube depth:', data.params.toFixed(1), 'm');
            break;

          case 'setAutoRotation':
            // Update internal turnSpeed state to match slider
            if (data.params.enabled) {
              this.turnSpeed = data.params.speed || 1;
              this.sceneManager.setAutoRotation(true, this.turnSpeed);
              console.log('🔄 Auto-rotation: ON (' + this.turnSpeed + 'x) from slider');
            } else {
              this.turnSpeed = 0;
              this.sceneManager.setAutoRotation(false);
              console.log('🔄 Auto-rotation: OFF from slider');
            }
            break;


          // Forwarded keyboard events
          case 'keydown':
            // Simulate keyboard event from forwarded data
            const keyEvent = new KeyboardEvent('keydown', {
              key: data.params.key,
              code: data.params.code,
              ctrlKey: data.params.ctrlKey,
              shiftKey: data.params.shiftKey,
              altKey: data.params.altKey,
              metaKey: data.params.metaKey,
              bubbles: true,
              cancelable: true
            });
            // Dispatch the event to trigger keyboard shortcuts
            window.dispatchEvent(keyEvent);
            console.log('⌨️ Processed forwarded key:', data.params.key);
            break;

          // Orientation change from React Native
          case 'orientationChanged':
            console.log('📱 Orientation change received from React Native:', data.params);
            // Manually trigger resize with new dimensions
            this.sceneManager.handleOrientationChange(
              data.params.isPortrait,
              data.params.width,
              data.params.height
            );
            break;

          default:
            console.warn('Unknown action:', data.action);
        }
      } catch (e) {
        console.warn('⚠️ Error processing message:', e);
        // Ignore non-JSON messages
      }
    };

    // Listen on window for iframe messages (Web)
    window.addEventListener('message', handleMessage);

    // Listen on document for React Native WebView messages (Android/iOS)
    document.addEventListener('message', handleMessage as any);

    // React Native WebView specific: Listen for messages sent via injectedJavaScript
    // These arrive as custom events on window
    if (typeof (window as any).ReactNativeWebView !== 'undefined') {
      console.log('🔧 React Native WebView detected - setting up RN-specific handler');
      // RN WebView is available - messages might come through differently
    }

    console.log('📨 PostMessage listeners initialized (window + document)');
  }

  /**
   * Setup UI event handlers (optional - nur wenn HTML-UI existiert)
   */
  private setupUI(): void {
    // Stats overlay click listener (always active, Web + Mobile)
    const statsOverlay = document.getElementById('statsOverlay');
    if (statsOverlay) {
      statsOverlay.addEventListener('click', () => {
        this.toggleStatsOverlay();
        console.log('👆 Stats overlay clicked - toggled');
      });
    }

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
        case ' ': // Spacebar for Start/Stop
          // Start/Stop toggle
          if (this.isRunning) {
            this.stop();
          } else {
            this.start();
          }
          console.log('⌨️ [Space] Start/Stop toggled');
          break;

        case 's':
          // Toggle between LIGHTED and SILVER
          const currentMode = this.sceneManager.getDrawMode();
          const newMode = currentMode === DrawMode.SILVER ? DrawMode.LIGHTED : DrawMode.SILVER;
          this.updateDrawMode(newMode);
          console.log('⌨️ [S] Draw mode toggled:', newMode);
          break;

        case 'a':
        case 'A':
          // Apply - generate new balls without camera reset
          this.newBalls();
          console.log('⌨️ [A] Apply - New balls generated');
          break;

        case 'r':
        case 'R':
          // Reset to defaults - send message to parent UI to trigger full reset
          this.sendResetRequest();
          console.log('⌨️ [R] Reset to defaults requested');
          break;

        case 'm':
        case 'M':
        case 'F10':
          // Menu toggle - send message to parent UI
          this.sendMenuToggleRequest();
          console.log('⌨️ [M/F10] Menu toggle requested');
          break;

        case '3':
          // Toggle Stereo on/off (platform-specific mode)
          // Web: Top-Bottom, Mobile Portrait: Anaglyph, Mobile Landscape: Side-by-Side
          const currentStereo = this.sceneManager.getStereoMode();
          if (currentStereo === StereoMode.OFF) {
            // Turn on with platform-appropriate mode
            // Default to Top-Bottom for web/desktop
            this.sceneManager.setStereoMode(StereoMode.TOP_BOTTOM);
            this.sendStereoModeUpdate(StereoMode.TOP_BOTTOM);
            console.log('⌨️ [3] Stereo ON: Top-Bottom');
          } else {
            // Turn off
            this.sceneManager.setStereoMode(StereoMode.OFF);
            this.sendStereoModeUpdate(StereoMode.OFF);
            console.log('⌨️ [3] Stereo OFF');
          }
          break;

        case 'y':
        case 'Y':
          // Toggle Anaglyph Stereo specifically
          this.toggleStereoMode(StereoMode.ANAGLYPH);
          console.log('⌨️ [Y] Anaglyph stereo toggled');
          break;

        case 't':
          // Cycle turn mode through 5 speeds: 0x, 1x, 2x, 3x, 4x
          this.turnSpeed = (this.turnSpeed + 1) % 5; // 0→1→2→3→4→0

          if (this.turnSpeed === 0) {
            this.sceneManager.setAutoRotation(false);
            console.log('⌨️ [T] Turn mode: OFF (0x)');
          } else {
            this.sceneManager.setAutoRotation(true, this.turnSpeed);
            console.log(`⌨️ [T] Turn mode: ${this.turnSpeed}x speed`);
          }

          // Send immediate feedback to UI
          this.sendImmediateUpdate('turnSpeed');
          break;

        case 'g':
          // Toggle gravity between DOWN and ZERO
          this.toggleGravity();
          console.log('⌨️ [G] Gravity toggled');
          break;

        case 'i':
          // Toggle grid system
          this.toggleGrid();
          console.log('⌨️ [I] Grid toggled');
          break;

        case 'v':
          // Toggle show occupied voxels
          this.toggleShowOccupiedVoxels();
          console.log('⌨️ [V] Voxels toggled');
          break;

        case 'o':
        case 'O':
          // Toggle show world grid
          this.toggleShowWorldGrid();
          console.log('⌨️ [O] World grid toggled');
          break;

        case 'c':
          // Toggle show collision checks
          this.toggleShowCollisionChecks();
          console.log('⌨️ [C] Collision checks toggled');
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

        case 'x':
          // Toggle coordinate axes
          this.sceneManager.toggleAxes();
          console.log('⌨️ [X] Coordinate axes toggled');
          break;

        case 'd':
          // Toggle dark mode
          this.toggleDarkMode();
          console.log('⌨️ [D] Dark mode toggled');
          break;

        case 'f1':
          // Toggle key help
          e.preventDefault();
          this.toggleKeyHelp();
          console.log('⌨️ [F1] Key help toggled');
          break;

        case 'f2':
          // Toggle stats overlay
          e.preventDefault();
          this.toggleStatsOverlay();
          console.log('⌨️ [F2] Stats overlay toggled');
          break;
      }
    });

    // Keyboard shortcuts are enabled silently
  }

  /**
   * Toggle stereo mode (off if same mode pressed again)
   */
  private toggleStereoMode(mode: StereoMode): void {
    const currentMode = this.sceneManager.getStereoMode();
    const newMode = currentMode === mode ? StereoMode.OFF : mode;

    console.log('🔄 Toggle Stereo Mode:', {
      requested: mode,
      current: currentMode,
      newMode: newMode
    });

    this.sceneManager.setStereoMode(newMode);

    // Update HTML UI radio button
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

    // Send state update to parent (React Native UI)
    this.sendStereoModeUpdate(newMode);
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

    // Send state update to parent
    this.sendStateToParent();
  }

  /**
   * Change ball count by doubling or halving (for logarithmic control)
   * delta > 0: double, delta < 0: halve
   */
  private changeBallCount(delta: number): void {
    const currentCount = this.ballParams.count;
    let newCount: number;

    if (delta > 0) {
      // Double the count
      newCount = Math.round((currentCount * 2) / 5) * 5; // Round to nearest 5
      newCount = Math.min(10000, newCount); // Cap at 10000
    } else {
      // Halve the count
      newCount = Math.round((currentCount / 2) / 5) * 5; // Round to nearest 5
      newCount = Math.max(5, newCount); // Minimum 5
    }

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

    // Store in visualizationState for persistence
    this.visualizationState.gridEnabled = gridEnabled;
    this.visualizationState.gridSegments = new THREE.Vector3(gridSegmentsValue, gridSegmentsValue, gridSegmentsValue);
    this.visualizationState.showWorldGrid = showWorldGrid;
    this.visualizationState.showOccupiedVoxels = showOccupiedVoxels;

    // Calculate maximum allowed ball radius for grid
    const CBR = 1.518; // Cube radius
    const cellSize = (2 * CBR) / gridSegmentsValue;
    const maxAllowedRadius = cellSize / 2;

    // Track if we need to send parameter updates to UI
    let parametersAdjusted = false;

    // Adjust ball parameters if needed (Grid constraints)
    if (this.ballParams.maxRadius > maxAllowedRadius) {
      console.warn('⚠️ Max ball radius too large for grid, adjusting...');
      this.ballParams.maxRadius = maxAllowedRadius * 0.9; // 90% of max to be safe
      parametersAdjusted = true;

      // Update HTML UI if it exists
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
      parametersAdjusted = true;

      // Update HTML UI if it exists
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

    // Re-enable collision check tracking from state (persistent!)
    if (this.visualizationState.showCollisionChecks) {
      this.physicsEngine.setTrackCollisionChecks(true);
      this.sceneManager.setShowCollisionChecks(true);
      console.log('🔲 Collision check tracking restored from state');
    }

    // Reinitialize scene
    this.sceneManager.initializeScene(this.ballSet, this.walls);
    this.sceneManager.render();

    // Update stats
    this.updateStats();

    // Restart if was running
    if (wasRunning) {
      this.start();
    } else {
      // Send state update
      this.sendStateToParent();
    }

    // Send ball parameter updates if they were constrained by grid
    if (parametersAdjusted) {
      this.sendBallParameterUpdate();
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

    // If no HTML UI, just toggle between ZERO and DOWN with current magnitude
    if (!selectEl || !magnitudeEl) {
      const currentAccel = this.global.acceleration;
      const isZero = currentAccel.x === 0 && currentAccel.y === 0 && currentAccel.z === 0;
      const newPreset = isZero ? 'DOWN' : 'ZERO';
      // Use stored magnitude instead of hardcoded 9.81
      this.global.setGravityPreset(newPreset, this.gravityMagnitude);
      console.log('🌍 Gravity toggled to:', newPreset, 'magnitude:', this.gravityMagnitude);
      // Send state update to parent
      this.sendStateToParent();
      return;
    }

    const currentPreset = selectEl.value;
    const newPreset = currentPreset === 'ZERO' ? 'DOWN' : 'ZERO';
    const magnitude = parseFloat(magnitudeEl.value);

    this.global.setGravityPreset(newPreset, magnitude);
    selectEl.value = newPreset;

    console.log('🌍 Gravity toggled to:', newPreset, 'with magnitude:', magnitude);
    // Send state update to parent
    this.sendStateToParent();
  }

  /**
   * Toggle grid system on/off
   */
  private toggleGrid(): void {
    // No HTML UI in React Native - toggle internal state directly
    this.visualizationState.gridEnabled = !this.visualizationState.gridEnabled;
    const newState = this.visualizationState.gridEnabled;

    console.log('🔲 Grid toggled to:', newState);

    // Actually enable/disable the grid in the physics engine
    if (newState) {
      // Enable grid
      const segments = this.visualizationState.gridSegments?.x || 8;
      const segmentsVec = new THREE.Vector3(segments, segments, segments);

      this.physicsEngine.setGridSegments(segmentsVec);
      this.physicsEngine.setGridEnabled(true);

      console.log('✅ Grid enabled with', segments, 'segments');
    } else {
      // Disable grid
      this.physicsEngine.setGridEnabled(false);

      console.log('✅ Grid disabled');
    }

    // Send state update to parent so UI controls update
    this.sendStateToParent();
  }

  /**
   * Toggle show occupied voxels
   */
  private toggleShowOccupiedVoxels(): void {
    // No HTML UI in React Native - toggle internal state directly
    this.visualizationState.showOccupiedVoxels = !this.visualizationState.showOccupiedVoxels;
    const newState = this.visualizationState.showOccupiedVoxels;

    console.log('📦 Show Voxels toggled to:', newState);

    // Update visualization
    this.sceneManager.setShowOccupiedVoxels(newState);

    // Send state update to parent so UI controls update
    this.sendStateToParent();
  }

  /**
   * Toggle show world grid
   */
  private toggleShowWorldGrid(): void {
    // No HTML UI in React Native - toggle internal state directly
    this.visualizationState.showWorldGrid = !this.visualizationState.showWorldGrid;
    const newState = this.visualizationState.showWorldGrid;

    console.log('🌐 Show World Grid toggled to:', newState);

    // If grid doesn't exist yet, create it first
    if (newState && !this.sceneManager.hasGridVisualization()) {
      const CBR = 1.518;
      const origin = new THREE.Vector3(-CBR, -CBR, -CBR);
      const extent = new THREE.Vector3(CBR, CBR, CBR);
      this.sceneManager.createGridVisualization(this.visualizationState.gridSegments, origin, extent);
      console.log('🔲 Grid visualization created for toggle');
    }

    // Update visualization
    this.sceneManager.setShowGrid(newState);

    // Send state update to parent so UI controls update
    this.sendStateToParent();
  }

  /**
   * Toggle show collision checks
   */
  private toggleShowCollisionChecks(): void {
    // No HTML UI in React Native - toggle internal state directly
    this.visualizationState.showCollisionChecks = !this.visualizationState.showCollisionChecks;
    const newState = this.visualizationState.showCollisionChecks;

    console.log('🔍 Show Collision Checks toggled to:', newState);

    // Update visualization (SceneManager)
    this.sceneManager.setShowCollisionChecks(newState);

    // IMPORTANT: Also tell PhysicsEngine to track collision checks!
    // Without this, the checks won't be recorded and no lines will appear
    this.physicsEngine.setTrackCollisionChecks(newState);

    // Send state update to parent so UI controls update
    this.sendStateToParent();
  }

  /**
   * Change cube depth by delta
   */
  private changeCubeDepth(delta: number): void {
    // Get current depth from SceneManager
    const currentDepth = this.sceneManager.getCubeDepth();
    const currentValue = currentDepth / 0.1; // Convert from meters to slider units
    const newValue = Math.max(-20, Math.min(20, currentValue + delta));

    if (newValue === currentValue) {
      console.log('⚠️ Cube depth limit reached');
      return;
    }

    // Apply change
    this.sceneManager.setCubeDepth(newValue * 0.1);
    console.log('📦 Cube depth changed to:', (newValue * 0.1).toFixed(1), 'm');

    // Update HTML UI if it exists
    const slider = document.getElementById('cubeDepth') as HTMLInputElement;
    const valueDisplay = document.getElementById('cubeDepthValue');
    if (slider) {
      slider.value = newValue.toString();
    }
    if (valueDisplay) {
      valueDisplay.textContent = newValue.toFixed(1);
    }

    // Send state update to parent (React Native)
    this.sendCubeDepthUpdate(newValue);
  }

  /**
   * Send cube depth update to parent
   */
  private sendCubeDepthUpdate(value: number): void {
    const update = {
      type: 'cubeDepthUpdate',
      cubeDepth: value,
    };

    // For iframe (Web)
    if (window.parent !== window) {
      window.parent.postMessage(JSON.stringify(update), '*');
    }

    // For React Native WebView
    if ((window as any).ReactNativeWebView) {
      (window as any).ReactNativeWebView.postMessage(JSON.stringify(update));
    }
  }

  /**
   * Toggle keyboard help overlay
   */
  private toggleKeyHelp(): void {
    const helpDiv = document.getElementById('keyHelp');
    if (helpDiv) {
      // Check computed style (includes CSS), not just inline style
      const isVisible = window.getComputedStyle(helpDiv).display !== 'none';
      helpDiv.style.display = isVisible ? 'none' : 'block';
    }
  }

  /**
   * Toggle stats overlay (F2) - Game-style HUD
   */
  private toggleStatsOverlay(): void {
    const statsDiv = document.getElementById('statsOverlay');
    if (statsDiv) {
      statsDiv.classList.toggle('visible');
      const isVisible = statsDiv.classList.contains('visible');
      console.log('📊 Stats overlay:', isVisible ? 'ON' : 'OFF');
    }
  }

  /**
   * Toggle dark mode for F1 help UI and send to parent (React Native)
   */
  private toggleDarkMode(): void {
    this.isDarkMode = !this.isDarkMode;
    const helpDiv = document.getElementById('keyHelp');
    if (helpDiv) {
      if (this.isDarkMode) {
        helpDiv.classList.add('dark');
      } else {
        helpDiv.classList.remove('dark');
      }
    }

    // Send dark mode state to parent (React Native UI)
    this.sendMessageToParent({
      type: 'darkModeChanged',
      isDarkMode: this.isDarkMode
    });

    console.log('🌓 Dark mode:', this.isDarkMode ? 'ON' : 'OFF', '(sent to UI)');
  }

  /**
   * Send state updates to parent (React Native/iframe parent)
   */
  private sendStateToParent(): void {
    // Get current gravity preset
    const currentAccel = this.global.acceleration;
    let gravityPreset = 'ZERO';
    // Match the axis mapping from GlobalParams.setGravityPreset (standard Y-up system):
    // DOWN: (0, -mag, 0), UP: (0, +mag, 0)
    // LEFT: (-mag, 0, 0), RIGHT: (+mag, 0, 0)
    // FRONT: (0, 0, +mag), REAR: (0, 0, -mag)
    if (currentAccel.y < -0.1) gravityPreset = 'DOWN';
    else if (currentAccel.y > 0.1) gravityPreset = 'UP';
    else if (currentAccel.x < -0.1) gravityPreset = 'LEFT';
    else if (currentAccel.x > 0.1) gravityPreset = 'RIGHT';
    else if (currentAccel.z > 0.1) gravityPreset = 'FRONT';
    else if (currentAccel.z < -0.1) gravityPreset = 'REAR';

    const state = {
      type: 'stateUpdate',
      fps: this.currentFps,
      ballCount: this.ballSet.num,
      generation: this.ballSet.generation,
      isRunning: this.isRunning,
      checks: this.physicsEngine.stats.numChecks,
      // NOTE: minRadius/maxRadius are NOT included in regular updates
      // They are only sent when Grid constraints force a change
      // Rendering & Physics (for keyboard shortcut feedback)
      drawMode: this.sceneManager.getDrawMode(),
      gravityPreset: gravityPreset,
      // Grid & Visualization states (for keyboard shortcut feedback)
      gridEnabled: this.visualizationState.gridEnabled,
      showWorldGrid: this.visualizationState.showWorldGrid,
      showOccupiedVoxels: this.visualizationState.showOccupiedVoxels,
      showCollisionChecks: this.visualizationState.showCollisionChecks,
      // NOTE: turnSpeed is NOT included in regular updates
      // It is only sent when changed via 't' keyboard shortcut (sendImmediateUpdate)
    };

    // For iframe (Web)
    if (window.parent !== window) {
      window.parent.postMessage(JSON.stringify(state), '*');
    }

    // For React Native WebView
    if ((window as any).ReactNativeWebView) {
      (window as any).ReactNativeWebView.postMessage(JSON.stringify(state));
    }

    // Update last sent values
    this.lastSentState.drawMode = state.drawMode;
    this.lastSentState.gravityPreset = gravityPreset;
    this.lastSentState.turnSpeed = this.turnSpeed;
  }

  /**
   * Send custom message to parent (React Native/iframe parent)
   */
  private sendMessageToParent(message: any): void {
    // For iframe (Web)
    if (window.parent !== window) {
      window.parent.postMessage(JSON.stringify(message), '*');
    }

    // For React Native WebView
    if ((window as any).ReactNativeWebView) {
      (window as any).ReactNativeWebView.postMessage(JSON.stringify(message));
    }
  }

  /**
   * Send immediate updates for settings that changed (via keyboard shortcuts)
   */
  private sendImmediateUpdate(changedField: 'drawMode' | 'gravityPreset' | 'turnSpeed'): void {
    // Only send if value actually changed
    if (changedField === 'drawMode' && this.sceneManager.getDrawMode() === this.lastSentState.drawMode) return;
    if (changedField === 'turnSpeed' && this.turnSpeed === this.lastSentState.turnSpeed) return;

    // Get current gravity preset
    const currentAccel = this.global.acceleration;
    let gravityPreset = 'ZERO';
    if (currentAccel.y < -0.1) gravityPreset = 'DOWN';
    else if (currentAccel.y > 0.1) gravityPreset = 'UP';
    else if (currentAccel.x < -0.1) gravityPreset = 'LEFT';
    else if (currentAccel.x > 0.1) gravityPreset = 'RIGHT';
    else if (currentAccel.z > 0.1) gravityPreset = 'FRONT';
    else if (currentAccel.z < -0.1) gravityPreset = 'REAR';

    if (changedField === 'gravityPreset' && gravityPreset === this.lastSentState.gravityPreset) return;

    // Prepare update with only changed field
    const update: any = { type: changedField + 'Update' };

    if (changedField === 'turnSpeed') {
      update.turnSpeed = this.turnSpeed;
      console.log('📤 Sending turnSpeed update to UI:', this.turnSpeed);
      this.lastSentState.turnSpeed = this.turnSpeed;
    } else if (changedField === 'drawMode') {
      update.drawMode = this.sceneManager.getDrawMode();
      this.lastSentState.drawMode = update.drawMode;
    } else if (changedField === 'gravityPreset') {
      update.gravityPreset = gravityPreset;
      this.lastSentState.gravityPreset = gravityPreset;
    }

    // Send to parent
    if (window.parent !== window) {
      window.parent.postMessage(JSON.stringify(update), '*');
    }
    if ((window as any).ReactNativeWebView) {
      (window as any).ReactNativeWebView.postMessage(JSON.stringify(update));
    }
  }

  /**
   * Send ball parameter updates (only when constrained by grid)
   */
  private sendBallParameterUpdate(): void {
    const update = {
      type: 'stateUpdate',
      minRadius: this.ballParams.minRadius,
      maxRadius: this.ballParams.maxRadius,
    };

    console.log('📏 Sending ball parameter update:', update);

    // For iframe (Web)
    if (window.parent !== window) {
      window.parent.postMessage(JSON.stringify(update), '*');
    }

    // For React Native WebView
    if ((window as any).ReactNativeWebView) {
      (window as any).ReactNativeWebView.postMessage(JSON.stringify(update));
    }
  }

  /**
   * Send stereo mode update to parent (React Native UI)
   */
  private sendStereoModeUpdate(mode: StereoMode): void {
    const update = {
      type: 'stereoModeUpdate',
      stereoMode: mode,
    };

    console.log('🕶️ Sending stereo mode update:', update);

    // For iframe (Web)
    if (window.parent !== window) {
      window.parent.postMessage(JSON.stringify(update), '*');
    }

    // For React Native WebView
    if ((window as any).ReactNativeWebView) {
      (window as any).ReactNativeWebView.postMessage(JSON.stringify(update));
    }
  }

  /**
   * Send reset request to parent UI (triggered by 'R' key)
   */
  private sendResetRequest(): void {
    const message = {
      type: 'resetRequest',
    };

    console.log('🔄 Sending reset request to UI');

    // For iframe (Web)
    if (window.parent !== window) {
      window.parent.postMessage(JSON.stringify(message), '*');
    }

    // For React Native WebView
    if ((window as any).ReactNativeWebView) {
      (window as any).ReactNativeWebView.postMessage(JSON.stringify(message));
    }
  }

  /**
   * Send menu toggle request to parent UI (triggered by 'M' or 'F10' key)
   */
  private sendMenuToggleRequest(): void {
    const message = {
      type: 'menuToggleRequest',
    };

    console.log('📱 Sending menu toggle request to UI');

    // For iframe (Web)
    if (window.parent !== window) {
      window.parent.postMessage(JSON.stringify(message), '*');
    }

    // For React Native WebView
    if ((window as any).ReactNativeWebView) {
      (window as any).ReactNativeWebView.postMessage(JSON.stringify(message));
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

    // Send state update to parent
    this.sendStateToParent();
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

    // Send state update to parent
    this.sendStateToParent();
  }

  /**
   * Generate new balls with current parameters (Apply button)
   * Does NOT reset camera or other view settings - only regenerates balls
   */
  newBalls(): void {
    console.log('🆕 New balls called (Apply)');
    const wasRunning = this.isRunning;
    this.stop();

    // Validate ball parameters: minRadius must be <= maxRadius
    let parametersAdjusted = false;
    if (this.ballParams.maxRadius < this.ballParams.minRadius) {
      console.warn('⚠️ Max radius < Min radius, adjusting min to match max');
      this.ballParams.minRadius = this.ballParams.maxRadius;
      parametersAdjusted = true;
    }

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

    // Restore simulation settings from state (persistent across resets)
    this.physicsEngine.setCalcFactor(this.simulationState.calcFactor);
    this.physicsEngine.setCollisionsEnabled(this.simulationState.collisionsEnabled);
    console.log('⚙️ Simulation settings restored: CalcFactor=', this.simulationState.calcFactor, 'Collisions=', this.simulationState.collisionsEnabled);

    // Restore grid configuration from state (persistent across resets)
    if (this.visualizationState.gridEnabled) {
      this.physicsEngine.setGridSegments(this.visualizationState.gridSegments);
      this.physicsEngine.setGridEnabled(true);
      console.log('🔲 Grid restored with segments:', this.visualizationState.gridSegments);

      // Recreate grid visualization
      const CBR = 1.518;
      const origin = new THREE.Vector3(-CBR, -CBR, -CBR);
      const extent = new THREE.Vector3(CBR, CBR, CBR);
      this.sceneManager.createGridVisualization(
        this.visualizationState.gridSegments,
        origin,
        extent
      );

      // Restore grid visualization states
      this.sceneManager.setShowGrid(this.visualizationState.showWorldGrid);
      this.sceneManager.setShowOccupiedVoxels(this.visualizationState.showOccupiedVoxels);
      console.log('🔲 Grid visualizations restored');
    }

    // Restore collision check tracking from state
    if (this.visualizationState.showCollisionChecks) {
      this.physicsEngine.setTrackCollisionChecks(true);
      this.sceneManager.setShowCollisionChecks(true);
      console.log('🔲 Collision check tracking restored');
    }

    // Reinitialize scene (clears old visualizations)
    console.log('🎬 Calling initializeScene with', this.ballSet.num, 'balls');
    this.sceneManager.initializeScene(this.ballSet, this.walls);
    console.log('✅ initializeScene complete');

    // DO NOT reset camera - preserve user's view position/rotation/zoom

    // Force initial render to show balls immediately
    this.sceneManager.render();
    console.log('🖼️ Initial render done');

    // Update stats
    this.updateStats();

    console.log('🆕 New balls generated with', this.ballSet.num, 'balls, wasRunning:', wasRunning);

    if (wasRunning) {
      console.log('▶ Auto-restarting simulation');
      this.start();
    } else {
      // Send state update even if not auto-starting
      this.sendStateToParent();
    }

    // Send ball parameter update if they were adjusted (max < min correction)
    if (parametersAdjusted) {
      this.sendBallParameterUpdate();
    }
  }

  /**
   * Full reset: new balls + camera reset + view reset (Reset button)
   */
  reset(): void {
    console.log('🔄 Full reset called (Reset button)');

    // First generate new balls (same as newBalls())
    this.newBalls();
    // Then reset camera and view
    this.sceneManager.resetCamera();
    console.log('📷 Camera reset to initial position');
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

    // Send state update to parent
    this.sendStateToParent();
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

      // Send state update to parent (every second with FPS update)
      this.sendStateToParent();

      // Note: State persistence moved to orientation change handler in App.js
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

    // Update stats overlay (F2) - Game-style HUD
    const statFpsEl = document.getElementById('statFps');
    const statBallsEl = document.getElementById('statBalls');
    const statGenEl = document.getElementById('statGen');
    const statChecksEl = document.getElementById('statChecks');
    const statCalcEl = document.getElementById('statCalc');

    if (statFpsEl) statFpsEl.textContent = this.currentFps.toString();
    if (statBallsEl) statBallsEl.textContent = this.ballSet.num.toString();
    if (statGenEl) statGenEl.textContent = this.ballSet.generation.toString();
    if (statChecksEl) statChecksEl.textContent = this.physicsEngine.stats.numChecks.toLocaleString();
    if (statCalcEl) statCalcEl.textContent = this.simulationState.calcFactor.toString();
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


  /**
   * Send initialized signal to parent
   */
  private sendInitializedSignal(): void {
    const message = { type: 'initialized' };

    // For iframe (Web)
    if (window.parent !== window) {
      window.parent.postMessage(JSON.stringify(message), '*');
    }

    // For React Native WebView
    if ((window as any).ReactNativeWebView) {
      (window as any).ReactNativeWebView.postMessage(JSON.stringify(message));
    }

    console.log('📤 Sent initialized signal to parent');
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

/**
 * Scene Manager - Three.js scene setup and management
 */

import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { Ball } from '../core/Ball';
import { BallSet } from '../core/BallSet';
import { Parallelogram } from '../core/Parallelogram';
import { DrawMode, StereoMode } from '../core/Constants';

export class SceneManager {
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private renderer: THREE.WebGLRenderer;
  private stereoCamera: THREE.StereoCamera; // Eigene StereoCamera für volle Kontrolle!
  private controls: OrbitControls;

  // Für manuelles Anaglyph-Rendering
  private renderTargetL: THREE.WebGLRenderTarget | null = null;
  private renderTargetR: THREE.WebGLRenderTarget | null = null;
  private anaglyphMaterial: THREE.ShaderMaterial | null = null;
  private anaglyphQuad: THREE.Mesh | null = null;

  private ballMeshes: Map<number, THREE.Mesh | THREE.Points> = new Map();
  private wallMeshes: THREE.Mesh[] = [];
  private wallGroup: THREE.Group | null = null;

  // Grid visualization
  private gridLines: THREE.LineSegments | null = null;
  private occupiedVoxels: THREE.Group | null = null;
  private collisionChecksLines: THREE.LineSegments | null = null;
  private showGrid: boolean = false;
  private showOccupiedVoxels: boolean = false;
  private showCollisionChecks: boolean = false;

  // Coordinate axes visualization
  private axesHelper: THREE.AxesHelper | null = null;
  private showAxes: boolean = false;

  private drawMode: DrawMode = DrawMode.LIGHTED;
  private sphereSegments: number = 16;
  private wireframeSegments: number = 8; // Segments für Wireframe-Modus (4-32)
  private stereoMode: StereoMode = StereoMode.OFF;
  private lastLoggedStereoMode: StereoMode = StereoMode.OFF; // Track last logged mode to avoid spam
  private initialCameraDistance: number = 0; // Initiale Distanz von Kamera zu Target
  private currentCubeDepth: number = 0; // Aktueller Cube Depth Wert (-20 bis +20)
  private lastAspectRatio: number = 0; // Letzter Aspect Ratio für Orientierungswechsel-Erkennung

  // Silver material for SILVER draw mode
  private silverMaterial: THREE.MeshStandardMaterial | null = null;
  private envMap: THREE.Texture | null = null;

  constructor(canvas: HTMLCanvasElement) {
    // Scene
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x666666); // Grau wie im Original IRIX

    // Camera (Standard Three.js Y-Up coordinate system)
    // FOV wird dynamisch angepasst basierend auf Aspect Ratio
    const aspect = window.innerWidth / window.innerHeight;

    // Calculate initial FOV based on aspect ratio
    const baseFOV = 60;
    let initialFOV = baseFOV;

    if (aspect < 1) {
      // Portrait: Increase vertical FOV to keep horizontal view angle constant
      const baseFOVRad = (baseFOV * Math.PI) / 180;
      const newFOVRad = 2 * Math.atan(Math.tan(baseFOVRad / 2) / aspect);
      initialFOV = (newFOVRad * 180) / Math.PI;
      console.log('📷 Portrait detected: FOV adjusted to', initialFOV.toFixed(1), '(aspect=', aspect.toFixed(2), ')');
    }

    this.camera = new THREE.PerspectiveCamera(
      initialFOV, // FOV basierend auf Aspect Ratio
      aspect,
      0.1, // near
      100 // far
    );

    // Kamera immer auf fester Distanz (5) - FOV passt sich an
    const cameraDistance = 5;

    this.camera.position.set(0, 0, cameraDistance);
    this.camera.lookAt(0, 0, 0);

    // Speichere initialen Aspect Ratio
    this.lastAspectRatio = aspect;

    console.log('📷 Camera setup: aspect=', aspect.toFixed(2), 'distance=', cameraDistance.toFixed(2), 'FOV=', initialFOV.toFixed(1));

    // Renderer
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
    });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(window.devicePixelRatio);

    // OrbitControls
    this.controls = new OrbitControls(this.camera, canvas);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.05;

    // Allow full vertical rotation (up to 90° in both directions)
    this.controls.minPolarAngle = 0; // Allow looking straight up
    this.controls.maxPolarAngle = Math.PI; // Allow looking straight down

    // No distance restrictions
    this.controls.minDistance = 0.5;
    this.controls.maxDistance = 50;

    console.log('🎮 OrbitControls: Full rotation enabled (0° to 180°)');

    // Speichere initiale Distanz für Cube Depth Funktion
    // Distanz = Abstand von Kamera zu Target (Ursprung)
    this.initialCameraDistance = this.camera.position.distanceTo(this.controls.target);
    console.log('📏 Initial camera distance:', this.initialCameraDistance.toFixed(2));

    // Anaglyph Effect - MANUELL für volle Kontrolle
    // Eigene StereoCamera
    this.stereoCamera = new THREE.StereoCamera();
    this.stereoCamera.eyeSep = 0.080; // 80mm = User's Augenabstand

    // Render-Targets für linkes und rechtes Auge
    const params = { minFilter: THREE.LinearFilter, magFilter: THREE.NearestFilter };
    this.renderTargetL = new THREE.WebGLRenderTarget(window.innerWidth, window.innerHeight, params);
    this.renderTargetR = new THREE.WebGLRenderTarget(window.innerWidth, window.innerHeight, params);

    // Anaglyph Shader Material (Rot-Blau mit Dubois-ähnlichen Matrizen)
    this.anaglyphMaterial = new THREE.ShaderMaterial({
      uniforms: {
        mapLeft: { value: this.renderTargetL.texture },
        mapRight: { value: this.renderTargetR.texture },
      },
      vertexShader: `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform sampler2D mapLeft;
        uniform sampler2D mapRight;
        varying vec2 vUv;

        void main() {
          vec4 colorL = texture2D(mapLeft, vUv);
          vec4 colorR = texture2D(mapRight, vUv);

          // Dubois-style Matrizen für Rot-Blau Anaglyph
          // Optimiert für gute Farbseparation und 3D-Effekt

          // Links (Rot-Auge): Optimierte Matrix für Rot-Kanal
          vec3 leftColor = vec3(
            0.437 * colorL.r + 0.449 * colorL.g + 0.164 * colorL.b,
            -0.062 * colorL.r - 0.062 * colorL.g - 0.024 * colorL.b,
            -0.048 * colorL.r - 0.050 * colorL.g - 0.017 * colorL.b
          );

          // Rechts (Blau-Auge): Optimierte Matrix für Blau-Kanal
          vec3 rightColor = vec3(
            -0.011 * colorR.r - 0.032 * colorR.g - 0.007 * colorR.b,
            0.377 * colorR.r + 0.761 * colorR.g + 0.009 * colorR.b,
            -0.026 * colorR.r - 0.093 * colorR.g + 1.234 * colorR.b
          );

          // Kombiniere beide mit Helligkeitsverstärkung
          float gain = 1.5;  // 50% heller
          vec3 color = clamp((leftColor + rightColor) * gain, 0.0, 1.0);

          gl_FragColor = vec4(color, max(colorL.a, colorR.a));
        }
      `
    });

    // Fullscreen Quad für Anaglyph-Compositing
    const quadGeometry = new THREE.PlaneGeometry(2, 2);
    this.anaglyphQuad = new THREE.Mesh(quadGeometry, this.anaglyphMaterial);

    console.log('🕶️ Manual Anaglyph rendering initialized');
    console.log('🕶️ StereoCamera eyeSep:', this.stereoCamera.eyeSep, 'meters');

    // Lighting
    this.setupLighting();

    // Handle window resize
    window.addEventListener('resize', () => this.onWindowResize());
  }

  /**
   * Setup lighting (port from light.cpp)
   */
  private setupLighting(): void {
    // Ambient light - leicht erhöht für bessere Sichtbarkeit
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
    this.scene.add(ambientLight);

    // Hauptlicht von oben/vorne (für Glossy-Reflexionen)
    const dirLight1 = new THREE.DirectionalLight(0xffffff, 0.8);
    dirLight1.position.set(2, -3, 8); // Von vorne und oben
    this.scene.add(dirLight1);

    // Fülllicht von der Seite
    const dirLight2 = new THREE.DirectionalLight(0xffffff, 0.4);
    dirLight2.position.set(-5, -5, 3);
    this.scene.add(dirLight2);

    // Rimlight von hinten für schöne Kanten
    const dirLight3 = new THREE.DirectionalLight(0xffffff, 0.3);
    dirLight3.position.set(0, 5, 2);
    this.scene.add(dirLight3);
  }

  /**
   * Set environment map for silver material
   */
  setEnvironmentMap(texture: THREE.Texture): void {
    this.envMap = texture;

    // Initialize silver material if not already done
    if (!this.silverMaterial) {
      this.silverMaterial = new THREE.MeshStandardMaterial({
        color: 0xffffff,
        metalness: 1.0,
        roughness: 0.05,
        envMap: texture,
        envMapIntensity: 1.0,
      });
    } else {
      this.silverMaterial.envMap = texture;
      this.silverMaterial.envMapIntensity = 1.0;
      this.silverMaterial.needsUpdate = true;
    }

    console.log('✨ Silver material environment map set');
  }

  /**
   * Create ball mesh
   */
  private createBallMesh(ball: Ball): THREE.Mesh | THREE.Points {

    let material: THREE.Material;
    let mesh: THREE.Mesh | THREE.Points;

    switch (this.drawMode) {
      case DrawMode.WIREFRAME:
        const wireframeGeometry = new THREE.SphereGeometry(
          ball.radius,
          this.wireframeSegments,
          this.wireframeSegments
        );
        material = new THREE.MeshBasicMaterial({
          color: ball.color,
          wireframe: true,
        });
        mesh = new THREE.Mesh(wireframeGeometry, material);
        mesh.position.copy(ball.position);
        break;

      case DrawMode.POINTS:
        // For points, use a single point geometry
        const pointGeometry = new THREE.BufferGeometry();
        const positions = new Float32Array(3);
        positions[0] = ball.position.x;
        positions[1] = ball.position.y;
        positions[2] = ball.position.z;
        pointGeometry.setAttribute(
          'position',
          new THREE.BufferAttribute(positions, 3)
        );
        material = new THREE.PointsMaterial({
          color: ball.color,
          size: ball.radius * 4, // Make points more visible
          sizeAttenuation: true,
        });
        mesh = new THREE.Points(pointGeometry, material);
        break;

      case DrawMode.LIGHTED:
      default:
        const lightedGeometry = new THREE.SphereGeometry(
          ball.radius,
          this.sphereSegments,
          this.sphereSegments
        );
        material = new THREE.MeshStandardMaterial({
          color: ball.color,
          metalness: 0.3,    // Leicht metallisch für Glanz
          roughness: 0.2,    // Niedrige Rauheit = glossy/glänzend
          emissive: ball.color,
          emissiveIntensity: 0.05, // Leichtes Eigenleuchten
        });
        mesh = new THREE.Mesh(lightedGeometry, material);
        mesh.position.copy(ball.position);
        break;

      case DrawMode.SILVER:
        const silverGeometry = new THREE.SphereGeometry(
          ball.radius,
          this.sphereSegments,
          this.sphereSegments
        );
        // Create silver material - works with or without envMap
        if (this.envMap) {
          // With envMap: Fully metallic for realistic reflections
          material = new THREE.MeshStandardMaterial({
            color: 0xffffff,
            metalness: 1.0,
            roughness: 0.05,
            envMap: this.envMap,
            envMapIntensity: 1.0,
          });
        } else {
          // Without envMap: Less metallic to show silver color
          material = new THREE.MeshStandardMaterial({
            color: 0xc0c0c0,  // Silver color
            metalness: 0.8,    // High but not full metalness
            roughness: 0.15,   // Slightly higher roughness
            emissive: 0x202020, // Slight glow to ensure visibility
            emissiveIntensity: 0.1,
          });
        }
        mesh = new THREE.Mesh(silverGeometry, material);
        mesh.position.copy(ball.position);
        break;
    }

    return mesh;
  }

  /**
   * Create wall mesh from parallelogram
   */
  private createWallMesh(wall: Parallelogram): THREE.Mesh {
    const geometry = new THREE.BufferGeometry();

    const vertices = new Float32Array([
      wall.v0.x, wall.v0.y, wall.v0.z,
      wall.v1.x, wall.v1.y, wall.v1.z,
      wall.v2.x, wall.v2.y, wall.v2.z,

      wall.v0.x, wall.v0.y, wall.v0.z,
      wall.v2.x, wall.v2.y, wall.v2.z,
      wall.v3.x, wall.v3.y, wall.v3.z,
    ]);

    geometry.setAttribute('position', new THREE.BufferAttribute(vertices, 3));
    geometry.computeVertexNormals();

    // FrontSide only: Outside faces opaque (visible from outside), inside faces not rendered
    const material = new THREE.MeshPhongMaterial({
      color: wall.color,
      side: THREE.FrontSide, // Only render outside faces
      transparent: false,    // No transparency needed - frontside is opaque
      opacity: 1.0,          // Fully opaque (100%)
    });

    const mesh = new THREE.Mesh(geometry, material);
    return mesh;
  }

  /**
   * Create cube edges (yellow lines)
   */
  private createCubeEdges(walls: Parallelogram[]): THREE.LineSegments {
    // Sammle alle einzigartigen Kanten des Würfels
    const edges: number[] = [];

    for (const wall of walls) {
      // Jede Wall hat 4 Kanten: v0-v1, v1-v2, v2-v3, v3-v0
      edges.push(
        wall.v0.x, wall.v0.y, wall.v0.z,
        wall.v1.x, wall.v1.y, wall.v1.z,

        wall.v1.x, wall.v1.y, wall.v1.z,
        wall.v2.x, wall.v2.y, wall.v2.z,

        wall.v2.x, wall.v2.y, wall.v2.z,
        wall.v3.x, wall.v3.y, wall.v3.z,

        wall.v3.x, wall.v3.y, wall.v3.z,
        wall.v0.x, wall.v0.y, wall.v0.z
      );
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(edges), 3));

    const material = new THREE.LineBasicMaterial({
      color: 0x00f0f0,  // Cyan wie im Original IRIX (war 0xff00f0f0)
      linewidth: 2,
    });

    return new THREE.LineSegments(geometry, material);
  }

  /**
   * Initialize scene with balls and walls
   */
  initializeScene(ballSet: BallSet, walls: Parallelogram[]): void {
    console.log('🎬 InitializeScene called - Balls:', ballSet.num, 'DrawMode:', this.drawMode);

    // Clear existing meshes
    this.clearScene();

    // Add walls with rotation
    this.wallGroup = new THREE.Group();
    for (const wall of walls) {
      const mesh = this.createWallMesh(wall);
      this.wallMeshes.push(mesh);
      this.wallGroup.add(mesh);
    }

    // Add yellow cube edges
    const cubeEdges = this.createCubeEdges(walls);
    this.wallGroup.add(cubeEdges);

    // No rotation - cube faces aligned with axes
    // Front/back faces parallel to screen (XZ-plane)
    this.scene.add(this.wallGroup);

    // Add balls
    let addedBalls = 0;
    for (let i = 0; i < ballSet.num; i++) {
      const ball = ballSet.get(i);
      if (ball) {
        const mesh = this.createBallMesh(ball);
        this.ballMeshes.set(i, mesh);
        this.scene.add(mesh);
        addedBalls++;
      }
    }
  }

  /**
   * Update ball positions from simulation
   */
  updateBalls(ballSet: BallSet): void {
    let missingCount = 0;

    for (let i = 0; i < ballSet.num; i++) {
      const ball = ballSet.get(i);
      const mesh = this.ballMeshes.get(i);

      if (!ball || !mesh) {
        missingCount++;
        continue;
      }

      if (this.drawMode === DrawMode.POINTS && mesh instanceof THREE.Points) {
        // For points, update geometry position attribute
        const positions = mesh.geometry.attributes.position;
        positions.setXYZ(0, ball.position.x, ball.position.y, ball.position.z);
        positions.needsUpdate = true;
      } else {
        // For meshes, update position
        mesh.position.copy(ball.position);
      }
    }

    // Only log if there's a problem
    if (missingCount > 0) {
      console.error(`❌ updateBalls: ${missingCount}/${ballSet.num} balls missing!`);
      console.log('📊 BallSet.num:', ballSet.num, 'Meshes:', this.ballMeshes.size);
    }
  }

  /**
   * Recreate ball meshes with new draw mode (without resetting physics)
   */
  recreateBallMeshes(ballSet: BallSet): void {
    console.log('🔄 Recreating ball meshes with new draw mode:', this.drawMode);

    // Remove old ball meshes
    for (const mesh of this.ballMeshes.values()) {
      this.scene.remove(mesh);
      mesh.geometry.dispose();
      if (Array.isArray(mesh.material)) {
        mesh.material.forEach(mat => mat.dispose());
      } else {
        mesh.material.dispose();
      }
    }
    this.ballMeshes.clear();

    // Create new ball meshes with current positions
    for (let i = 0; i < ballSet.num; i++) {
      const ball = ballSet.get(i);
      if (ball) {
        const mesh = this.createBallMesh(ball);
        this.ballMeshes.set(i, mesh);
        this.scene.add(mesh);
      }
    }

    console.log('✅ Recreated', this.ballMeshes.size, 'ball meshes');
  }

  /**
   * Clear scene
   */
  private clearScene(): void {
    console.log('🧹 clearScene - Removing', this.ballMeshes.size, 'ball meshes');

    // Remove ball meshes
    for (const mesh of this.ballMeshes.values()) {
      this.scene.remove(mesh);
      mesh.geometry.dispose();
      if (Array.isArray(mesh.material)) {
        mesh.material.forEach(mat => mat.dispose());
      } else {
        mesh.material.dispose();
      }
    }
    this.ballMeshes.clear();
    console.log('✅ Ball meshes cleared');

    // Remove wall group
    if (this.wallGroup) {
      this.scene.remove(this.wallGroup);
      console.log('✅ Wall group removed');
    }

    // Remove wall meshes
    for (const mesh of this.wallMeshes) {
      mesh.geometry.dispose();
      if (Array.isArray(mesh.material)) {
        mesh.material.forEach(mat => mat.dispose());
      } else {
        mesh.material.dispose();
      }
    }
    this.wallMeshes = [];
    this.wallGroup = null;

    // Remove grid visualizations
    if (this.gridLines) {
      this.scene.remove(this.gridLines);
      this.gridLines.geometry.dispose();
      (this.gridLines.material as THREE.Material).dispose();
      this.gridLines = null;
      console.log('✅ Grid lines removed');
    }

    if (this.occupiedVoxels) {
      this.scene.remove(this.occupiedVoxels);
      this.occupiedVoxels.children.forEach(child => {
        if (child instanceof THREE.LineSegments) {
          child.geometry.dispose();
          (child.material as THREE.Material).dispose();
        }
      });
      this.occupiedVoxels = null;
      console.log('✅ Occupied voxels removed');
    }

    if (this.collisionChecksLines) {
      this.scene.remove(this.collisionChecksLines);
      this.collisionChecksLines.geometry.dispose();
      (this.collisionChecksLines.material as THREE.Material).dispose();
      this.collisionChecksLines = null;
      console.log('✅ Collision checks lines removed');
    }

    console.log('✅ clearScene complete');
  }

  /**
   * Render scene
   */
  render(): void {
    this.controls.update();

    // Handle different stereo modes
    if (this.stereoMode === StereoMode.OFF) {
      // Normal mono rendering
      // Reset logger for next stereo activation
      if (this.lastLoggedStereoMode !== StereoMode.OFF) {
        this.lastLoggedStereoMode = StereoMode.OFF;
      }
      this.renderer.render(this.scene, this.camera);

    } else if (this.stereoMode === StereoMode.ANAGLYPH && this.stereoCamera && this.renderTargetL && this.renderTargetR && this.anaglyphMaterial) {
      // Anaglyph stereo rendering (Red-Blue)

      // 1. Update StereoCamera
      this.stereoCamera.update(this.camera);

      // 2. Render left eye
      this.renderer.setRenderTarget(this.renderTargetL);
      this.renderer.clear();
      this.renderer.render(this.scene, this.stereoCamera.cameraL);

      // 3. Render right eye
      this.renderer.setRenderTarget(this.renderTargetR);
      this.renderer.clear();
      this.renderer.render(this.scene, this.stereoCamera.cameraR);

      // 4. Composite Red-Blue Anaglyph
      this.renderer.setRenderTarget(null);

      if (this.anaglyphQuad) {
        const orthoCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
        const orthoScene = new THREE.Scene();
        orthoScene.add(this.anaglyphQuad);
        this.renderer.render(orthoScene, orthoCamera);
      }

    } else if (this.stereoMode === StereoMode.TOP_BOTTOM && this.stereoCamera) {
      // Top-Bottom split-screen stereo

      // 1. Update StereoCamera
      this.stereoCamera.update(this.camera);

      const width = window.innerWidth;
      const height = window.innerHeight;
      const halfHeight = height / 2;

      // 2. Render top half (left eye)
      this.renderer.setViewport(0, halfHeight, width, halfHeight);
      this.renderer.setScissor(0, halfHeight, width, halfHeight);
      this.renderer.setScissorTest(true);
      this.renderer.render(this.scene, this.stereoCamera.cameraL);

      // 3. Render bottom half (right eye)
      this.renderer.setViewport(0, 0, width, halfHeight);
      this.renderer.setScissor(0, 0, width, halfHeight);
      this.renderer.render(this.scene, this.stereoCamera.cameraR);

      // 4. Reset viewport and scissor
      this.renderer.setScissorTest(false);
      this.renderer.setViewport(0, 0, width, height);

    } else if (this.stereoMode === StereoMode.SIDE_BY_SIDE && this.stereoCamera) {
      // Side-by-Side stereo for VR Cardboard and Projectors

      const width = window.innerWidth;
      const height = window.innerHeight;
      const halfWidth = width / 2;

      // Detect platform:
      // - Mobile VR (React Native WebView): Each eye 1:1 aspect (for Cardboard headset)
      // - Web/Projector (Browser): Each eye 1/2 width aspect (projector will stretch to full width)

      // Check if running in React Native WebView
      const isReactNativeWebView = !!(window as any).ReactNativeWebView;

      let aspectPerEye: number;
      if (isReactNativeWebView) {
        // Mobile VR (React Native): Use full aspect for 1:1 (square per eye)
        aspectPerEye = halfWidth / height;
      } else {
        // Web/Projector (Browser): Cube should be 1/2 as wide as it is tall
        // For aspect ratio width:height = 1:2, we need aspect = 0.5
        // Since aspect = width/height, and we want width = height/2
        // aspect = (height/2) / height = 0.5
        // But we're rendering in halfWidth viewport, so:
        // aspect = height / (2 * halfWidth) to get narrow cubes
        aspectPerEye = height / (2 * halfWidth);
      }

      // Update camera aspect for each eye before updating StereoCamera
      const originalAspect = this.camera.aspect;
      this.camera.aspect = aspectPerEye;
      this.camera.updateProjectionMatrix();

      // Update StereoCamera with corrected aspect
      this.stereoCamera.aspect = aspectPerEye;
      this.stereoCamera.update(this.camera);

      // Log only once when mode changes
      if (this.lastLoggedStereoMode !== StereoMode.SIDE_BY_SIDE) {
        console.log('🥽 Side-by-Side Stereo Active:', {
          width,
          height,
          halfWidth,
          platform: isReactNativeWebView ? 'Mobile VR (React Native)' : 'Web/Projector (Browser)',
          aspectPerEye: aspectPerEye.toFixed(3),
          eyeSep: this.stereoCamera.eyeSep,
          cameraL: !!this.stereoCamera.cameraL,
          cameraR: !!this.stereoCamera.cameraR
        });
        this.lastLoggedStereoMode = StereoMode.SIDE_BY_SIDE;
      }

      // 2. Render left half (left eye)
      this.renderer.setViewport(0, 0, halfWidth, height);
      this.renderer.setScissor(0, 0, halfWidth, height);
      this.renderer.setScissorTest(true);
      this.renderer.render(this.scene, this.stereoCamera.cameraL);

      // 3. Render right half (right eye)
      this.renderer.setViewport(halfWidth, 0, halfWidth, height);
      this.renderer.setScissor(halfWidth, 0, halfWidth, height);
      this.renderer.render(this.scene, this.stereoCamera.cameraR);

      // 4. Reset viewport and scissor
      this.renderer.setScissorTest(false);
      this.renderer.setViewport(0, 0, width, height);

      // Restore original aspect
      this.camera.aspect = originalAspect;
      this.camera.updateProjectionMatrix();
    }
  }

  /**
   * Debug: Test stereo effect
   */
  debugStereo(): void {
    console.group('🔍 Stereo Debug');
    console.log('Stereo Mode:', this.stereoMode);
    console.log('StereoCamera exists:', !!this.stereoCamera);

    if (this.stereoCamera) {
      console.log('Eye Separation:', this.stereoCamera.eyeSep, 'meters');
      console.log('Aspect:', this.stereoCamera.aspect);
    }

    if (this.stereoMode === StereoMode.ANAGLYPH) {
      console.log('Render Targets:', {
        left: !!this.renderTargetL,
        right: !!this.renderTargetR
      });
      console.log('Anaglyph Material:', !!this.anaglyphMaterial);
      console.log('Shader: Red-Blue Dubois-style Anaglyph');
    } else if (this.stereoMode === StereoMode.TOP_BOTTOM) {
      console.log('Rendering: Top-Bottom Split Screen');
      console.log('Viewport: Top half = left eye, Bottom half = right eye');
    } else if (this.stereoMode === StereoMode.SIDE_BY_SIDE) {
      console.log('Rendering: Side-by-Side VR Cardboard');
      console.log('Viewport: Left half = left eye, Right half = right eye');
    }

    console.groupEnd();
  }

  // Keep old name for compatibility
  debugAnaglyph(): void {
    this.debugStereo();
  }

  /**
   * Handle window resize
   */
  private onWindowResize(): void {
    const newAspect = window.innerWidth / window.innerHeight;

    console.log('📐 Window resize:', {
      width: window.innerWidth,
      height: window.innerHeight,
      newAspect: newAspect.toFixed(2),
      oldAspect: this.lastAspectRatio.toFixed(2),
      currentFOV: this.camera.fov.toFixed(1)
    });

    this.updateCameraForAspect(newAspect);

    this.renderer.setSize(window.innerWidth, window.innerHeight);

    // Update Anaglyph Render-Targets
    if (this.renderTargetL && this.renderTargetR) {
      this.renderTargetL.setSize(window.innerWidth, window.innerHeight);
      this.renderTargetR.setSize(window.innerWidth, window.innerHeight);
    }

    // Update last aspect ratio
    this.lastAspectRatio = newAspect;
  }

  /**
   * Handle orientation change from React Native (manually triggered)
   */
  handleOrientationChange(isPortrait: boolean, width: number, height: number): void {
    console.log('📱 handleOrientationChange:', { isPortrait, width, height });

    const newAspect = width / height;

    this.updateCameraForAspect(newAspect);

    // Update renderer size (might not be needed, but doesn't hurt)
    this.renderer.setSize(width, height);

    // Update last aspect ratio
    this.lastAspectRatio = newAspect;
  }

  /**
   * Update camera FOV and aspect based on aspect ratio
   */
  private updateCameraForAspect(newAspect: number): void {
    this.camera.aspect = newAspect;

    // Adjust FOV based on aspect ratio to keep cube same size
    // Base FOV is 60° for landscape (aspect >= 1)
    // For portrait (aspect < 1), we need to increase FOV to compensate
    const baseFOV = 60;

    if (newAspect < 1) {
      // Portrait: Increase vertical FOV to keep horizontal view angle constant
      const baseFOVRad = (baseFOV * Math.PI) / 180;
      const newFOVRad = 2 * Math.atan(Math.tan(baseFOVRad / 2) / newAspect);
      const newFOV = (newFOVRad * 180) / Math.PI;

      this.camera.fov = newFOV;
      console.log('📱 Portrait: FOV=', newFOV.toFixed(1), '° (from', this.camera.fov.toFixed(1), '°)');
    } else {
      // Landscape/Square: Use base FOV
      this.camera.fov = baseFOV;
      console.log('📱 Landscape: FOV=', baseFOV, '° (from', this.camera.fov.toFixed(1), '°)');
    }

    this.camera.updateProjectionMatrix();
  }

  /**
   * Set draw mode
   */
  setDrawMode(mode: DrawMode): void {
    this.drawMode = mode;
  }

  /**
   * Get current draw mode
   */
  getDrawMode(): DrawMode {
    return this.drawMode;
  }

  /**
   * Set 3D Stereo Mode
   */
  setStereoMode(mode: StereoMode): void {
    this.stereoMode = mode;
    console.log('🕶️ Stereo Mode:', mode);

    if (mode !== StereoMode.OFF && this.stereoCamera) {
      console.log('👁️ Eye separation:', this.stereoCamera.eyeSep, 'meters');

      if (mode === StereoMode.ANAGLYPH) {
        console.log('🎨 Red-Blue Anaglyph rendering active');
      } else if (mode === StereoMode.TOP_BOTTOM) {
        console.log('📺 Top-Bottom split-screen rendering active');
      } else if (mode === StereoMode.SIDE_BY_SIDE) {
        console.log('🥽 Side-by-Side VR Cardboard rendering active');
      }
    }
  }

  /**
   * Get current stereo mode
   */
  getStereoMode(): StereoMode {
    return this.stereoMode;
  }

  /**
   * Set auto-rotation mode (gentle rotation about vertical Z-axis)
   * @param enabled - Enable/disable auto-rotation
   * @param speed - Rotation speed multiplier (1=normal, 2=2x, 3=3x, 4=4x)
   */
  setAutoRotation(enabled: boolean, speed: number = 1): void {
    this.controls.autoRotate = enabled;
    this.controls.autoRotateSpeed = speed * 2.0; // CCW rotation speed (degrees per second at 60 fps) - 2x faster

    if (enabled) {
      console.log(`🔄 Auto-rotation: ON (${speed}x speed)`);
    } else {
      console.log('🔄 Auto-rotation: OFF');
    }
  }

  /**
   * Set wireframe density (segments)
   */
  setWireframeSegments(segments: number): void {
    this.wireframeSegments = Math.max(4, Math.min(32, segments));
    console.log('🔲 Wireframe segments:', this.wireframeSegments);
  }

  /**
   * Get current wireframe segments
   */
  getWireframeSegments(): number {
    return this.wireframeSegments;
  }

  /**
   * Set stereo eye separation (Augenabstand) for optimal 3D effect
   * Default is 0.064 (64mm - average human eye distance)
   */
  setEyeSeparation(separation: number): void {
    if (this.stereoCamera) {
      this.stereoCamera.eyeSep = separation;
      console.log('👁️ Eye separation set to:', separation.toFixed(3), 'meters');
      console.log('👁️ StereoCamera eyeSep:', this.stereoCamera.eyeSep);
    } else {
      console.warn('⚠️ StereoCamera not initialized');
    }
  }

  /**
   * Set cube depth (camera distance) for 3D stereo effect
   * Negative values = camera moves closer (cube+balls come out of screen)
   * Positive values = camera moves farther (cube+balls go into screen)
   * Works correctly with OrbitControls rotation!
   */
  setCubeDepth(depth: number): void {
    // Store current value (depth is in meters, convert to slider units)
    this.currentCubeDepth = depth / 0.1; // -2.0m → -20, +2.0m → +20

    // Berechne neue Distanz basierend auf depth
    // Negative depth = näher (weniger Distanz), Positive depth = weiter (mehr Distanz)
    const newDistance = this.initialCameraDistance - depth;

    // Berechne Richtungsvektor von Target zur Kamera (normalisiert)
    const direction = new THREE.Vector3()
      .subVectors(this.camera.position, this.controls.target)
      .normalize();

    // Setze neue Kamera-Position: Target + Richtung * neue Distanz
    this.camera.position.copy(this.controls.target)
      .add(direction.multiplyScalar(newDistance));

    // OrbitControls update wird automatisch im nächsten Frame aufgerufen

    console.log('📦 Cube depth set to:', depth.toFixed(1), 'm (slider:', this.currentCubeDepth.toFixed(0), ', Distance:', newDistance.toFixed(2), ')');
  }

  /**
   * Reset camera to initial position and zoom
   */
  resetCamera(): void {
    // Reset camera position to initial (0, 0, 5) - konstante Distanz
    this.camera.position.set(0, 0, 5);

    // Reset controls target to origin
    this.controls.target.set(0, 0, 0);

    // Reset FOV basierend auf aktuellem Aspect Ratio
    const aspect = window.innerWidth / window.innerHeight;
    const baseFOV = 60;

    if (aspect < 1) {
      // Portrait: Adjust FOV
      const baseFOVRad = (baseFOV * Math.PI) / 180;
      const newFOVRad = 2 * Math.atan(Math.tan(baseFOVRad / 2) / aspect);
      this.camera.fov = (newFOVRad * 180) / Math.PI;
    } else {
      // Landscape: Base FOV
      this.camera.fov = baseFOV;
    }

    this.camera.updateProjectionMatrix();
    this.controls.update();

    console.log('📷 Camera reset: position=(0,0,5), FOV=', this.camera.fov.toFixed(1));
  }

  /**
   * Get current cube depth value (in meters)
   */
  getCubeDepth(): number {
    return this.currentCubeDepth * 0.1; // Convert slider units back to meters
  }

  /**
   * Get camera
   */
  getCamera(): THREE.PerspectiveCamera {
    return this.camera;
  }

  /**
   * Get renderer
   */
  getRenderer(): THREE.WebGLRenderer {
    return this.renderer;
  }

  /**
   * Get scene
   */
  getScene(): THREE.Scene {
    return this.scene;
  }

  /**
   * Dispose resources
   */
  dispose(): void {
    this.clearScene();
    this.renderer.dispose();
    this.controls.dispose();
  }

  /**
   * Debug: Dump scene state to console
   */
  dumpSceneState(): void {
    console.group('🔍 Scene State Debug');
    console.log('Draw Mode:', this.drawMode);
    console.log('Ball Meshes in Map:', this.ballMeshes.size);
    console.log('Scene Children:', this.scene.children.length);
    console.log('Wall Group:', this.wallGroup ? 'exists' : 'null');
    console.log('Scene Children Details:');
    this.scene.children.forEach((child, i) => {
      console.log(`  [${i}] Type: ${child.type}, Visible: ${child.visible}, Name: ${child.name || '(unnamed)'}`);
      if (child instanceof THREE.Mesh || child instanceof THREE.Points) {
        console.log(`      Position:`, child.position);
        console.log(`      Has Geometry:`, !!child.geometry);
        console.log(`      Has Material:`, !!child.material);
      }
    });
    console.groupEnd();
  }

  /**
   * Create and display grid visualization
   */
  createGridVisualization(segments: THREE.Vector3, origin: THREE.Vector3, extent: THREE.Vector3): void {
    // Remove existing grid
    if (this.gridLines) {
      this.scene.remove(this.gridLines);
      this.gridLines.geometry.dispose();
      (this.gridLines.material as THREE.Material).dispose();
      this.gridLines = null;
    }

    const size = new THREE.Vector3().subVectors(extent, origin);
    const cellSize = new THREE.Vector3(
      size.x / segments.x,
      size.y / segments.y,
      size.z / segments.z
    );

    const geometry = new THREE.BufferGeometry();
    const vertices: number[] = [];

    // X-direction lines
    for (let z = 0; z <= segments.z; z++) {
      for (let y = 0; y <= segments.y; y++) {
        const yPos = origin.y + y * cellSize.y;
        const zPos = origin.z + z * cellSize.z;
        vertices.push(origin.x, yPos, zPos);
        vertices.push(extent.x, yPos, zPos);
      }
    }

    // Y-direction lines
    for (let z = 0; z <= segments.z; z++) {
      for (let x = 0; x <= segments.x; x++) {
        const xPos = origin.x + x * cellSize.x;
        const zPos = origin.z + z * cellSize.z;
        vertices.push(xPos, origin.y, zPos);
        vertices.push(xPos, extent.y, zPos);
      }
    }

    // Z-direction lines
    for (let y = 0; y <= segments.y; y++) {
      for (let x = 0; x <= segments.x; x++) {
        const xPos = origin.x + x * cellSize.x;
        const yPos = origin.y + y * cellSize.y;
        vertices.push(xPos, yPos, origin.z);
        vertices.push(xPos, yPos, extent.z);
      }
    }

    geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));

    const material = new THREE.LineBasicMaterial({
      color: 0x00ff00, // Green
      opacity: 0.3,
      transparent: true
    });

    this.gridLines = new THREE.LineSegments(geometry, material);
    this.gridLines.visible = this.showGrid;
    this.scene.add(this.gridLines);

    console.log('🔲 Grid visualization created:', segments);
  }

  /**
   * Clear grid visualization completely
   */
  clearGridVisualization(): void {
    if (this.gridLines) {
      this.scene.remove(this.gridLines);
      this.gridLines.geometry.dispose();
      (this.gridLines.material as THREE.Material).dispose();
      this.gridLines = null;
      console.log('🔲 Grid visualization cleared');
    }

    // Also clear occupied voxels (Group of LineSegments)
    if (this.occupiedVoxels) {
      this.occupiedVoxels.traverse((child) => {
        if (child instanceof THREE.LineSegments) {
          child.geometry.dispose();
          (child.material as THREE.Material).dispose();
        }
      });
      this.scene.remove(this.occupiedVoxels);
      this.occupiedVoxels = null;
    }

    // Clear collision checks
    if (this.collisionChecksLines) {
      this.scene.remove(this.collisionChecksLines);
      this.collisionChecksLines.geometry.dispose();
      (this.collisionChecksLines.material as THREE.Material).dispose();
      this.collisionChecksLines = null;
    }
  }

  /**
   * Update occupied voxels visualization
   * Shows voxel edges as colored lines (ball color, or blended if multiple balls)
   */
  updateOccupiedVoxels(occupiedCells: Array<{
    indices: THREE.Vector3;
    center: THREE.Vector3;
    ballIds: number[];
    cellSize: THREE.Vector3;
  }>, ballSet: any): void {
    // Remove existing voxels
    if (this.occupiedVoxels) {
      this.scene.remove(this.occupiedVoxels);
      this.occupiedVoxels.children.forEach(child => {
        if (child instanceof THREE.LineSegments) {
          child.geometry.dispose();
          (child.material as THREE.Material).dispose();
        }
      });
      this.occupiedVoxels = null;
    }

    if (!this.showOccupiedVoxels || occupiedCells.length === 0) {
      return;
    }

    this.occupiedVoxels = new THREE.Group();

    for (const cell of occupiedCells) {
      // Get ball color (if multiple balls, use first one's color)
      let ballColor = 0xffffff; // Default white
      if (cell.ballIds.length > 0) {
        const firstBall = ballSet.get(cell.ballIds[0]);
        if (firstBall) {
          ballColor = firstBall.color;
        }
      }

      // Calculate voxel corners
      const halfSize = new THREE.Vector3(
        cell.cellSize.x / 2,
        cell.cellSize.y / 2,
        cell.cellSize.z / 2
      );

      const min = new THREE.Vector3().subVectors(cell.center, halfSize);
      const max = new THREE.Vector3().addVectors(cell.center, halfSize);

      // Create voxel edge lines (12 edges of a box)
      const vertices: number[] = [];

      // Bottom face (4 edges)
      vertices.push(min.x, min.y, min.z,  max.x, min.y, min.z); // Front
      vertices.push(max.x, min.y, min.z,  max.x, max.y, min.z); // Right
      vertices.push(max.x, max.y, min.z,  min.x, max.y, min.z); // Back
      vertices.push(min.x, max.y, min.z,  min.x, min.y, min.z); // Left

      // Top face (4 edges)
      vertices.push(min.x, min.y, max.z,  max.x, min.y, max.z); // Front
      vertices.push(max.x, min.y, max.z,  max.x, max.y, max.z); // Right
      vertices.push(max.x, max.y, max.z,  min.x, max.y, max.z); // Back
      vertices.push(min.x, max.y, max.z,  min.x, min.y, max.z); // Left

      // Vertical edges (4 edges)
      vertices.push(min.x, min.y, min.z,  min.x, min.y, max.z); // Front-left
      vertices.push(max.x, min.y, min.z,  max.x, min.y, max.z); // Front-right
      vertices.push(max.x, max.y, min.z,  max.x, max.y, max.z); // Back-right
      vertices.push(min.x, max.y, min.z,  min.x, max.y, max.z); // Back-left

      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));

      const material = new THREE.LineBasicMaterial({
        color: ballColor,
        opacity: 0.8,
        transparent: true,
        linewidth: 2
      });

      const lines = new THREE.LineSegments(geometry, material);
      this.occupiedVoxels.add(lines);
    }

    this.scene.add(this.occupiedVoxels);
  }

  /**
   * Toggle grid visualization
   */
  setShowGrid(show: boolean): void {
    this.showGrid = show;
    if (this.gridLines) {
      this.gridLines.visible = show;
    }
    console.log('🔲 Show Grid:', show);
  }

  /**
   * Check if grid visualization exists
   */
  hasGridVisualization(): boolean {
    return this.gridLines !== null;
  }

  /**
   * Toggle occupied voxels visualization
   */
  setShowOccupiedVoxels(show: boolean): void {
    this.showOccupiedVoxels = show;
    if (this.occupiedVoxels) {
      this.occupiedVoxels.visible = show;
    }
    console.log('🔲 Show Occupied Voxels:', show);
  }

  /**
   * Toggle collision checks visualization
   */
  setShowCollisionChecks(show: boolean): void {
    this.showCollisionChecks = show;
    if (!show && this.collisionChecksLines) {
      this.scene.remove(this.collisionChecksLines);
      this.collisionChecksLines.geometry.dispose();
      (this.collisionChecksLines.material as THREE.Material).dispose();
      this.collisionChecksLines = null;
    }
    console.log('🔲 Show Collision Checks:', show);
  }

  /**
   * Toggle coordinate axes visualization
   */
  toggleAxes(): void {
    this.showAxes = !this.showAxes;

    if (this.showAxes) {
      // Create axes helper if it doesn't exist
      if (!this.axesHelper) {
        // Size 2.0 to make axes visible beyond the cube (cube radius = 1.518)
        this.axesHelper = new THREE.AxesHelper(2.5);
        // Axes colors: X=red, Y=green, Z=blue (Three.js default)
      }
      this.scene.add(this.axesHelper);
      console.log('📐 Coordinate axes: ON (X=red, Y=green, Z=blue)');
    } else {
      // Remove axes from scene
      if (this.axesHelper) {
        this.scene.remove(this.axesHelper);
      }
      console.log('📐 Coordinate axes: OFF');
    }
  }

  /**
   * Get axes visibility state
   */
  getShowAxes(): boolean {
    return this.showAxes;
  }

  /**
   * Update collision checks visualization
   * Shows white lines between balls being checked for collision
   */
  updateCollisionChecks(checks: Array<{ ballIdA: number; ballIdB: number }>, ballSet: any): void {
    // Remove existing lines
    if (this.collisionChecksLines) {
      this.scene.remove(this.collisionChecksLines);
      this.collisionChecksLines.geometry.dispose();
      (this.collisionChecksLines.material as THREE.Material).dispose();
      this.collisionChecksLines = null;
    }

    if (!this.showCollisionChecks || checks.length === 0) {
      return;
    }

    const vertices: number[] = [];

    // Create lines between checked ball pairs
    for (const check of checks) {
      const ballA = ballSet.get(check.ballIdA);
      const ballB = ballSet.get(check.ballIdB);

      if (ballA && ballB) {
        // Line from center to center
        vertices.push(
          ballA.position.x, ballA.position.y, ballA.position.z,
          ballB.position.x, ballB.position.y, ballB.position.z
        );
      }
    }

    if (vertices.length > 0) {
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));

      const material = new THREE.LineBasicMaterial({
        color: 0xffffff, // White
        opacity: 0.4,
        transparent: true,
        linewidth: 2
      });

      this.collisionChecksLines = new THREE.LineSegments(geometry, material);
      this.scene.add(this.collisionChecksLines);
    }
  }

  /**
   * Get grid visualization state
   */
  getGridVisualizationState() {
    return {
      showGrid: this.showGrid,
      showOccupiedVoxels: this.showOccupiedVoxels,
      showCollisionChecks: this.showCollisionChecks
    };
  }
}

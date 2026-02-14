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

  private drawMode: DrawMode = DrawMode.LIGHTED;
  private sphereSegments: number = 16;
  private stereoMode: StereoMode = StereoMode.OFF;
  private cubeDepth: number = 0; // Kamera-Distanz-Offset für 3D-Stereo-Effekt
  private initialCameraDistance: number = 0; // Initiale Distanz von Kamera zu Target

  constructor(canvas: HTMLCanvasElement) {
    // Scene
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x666666); // Grau wie im Original IRIX

    // Camera (Z-Up coordinate system like original IRIX)
    this.camera = new THREE.PerspectiveCamera(
      60, // fov
      window.innerWidth / window.innerHeight, // aspect
      0.1, // near
      100 // far
    );
    // Position camera for frontal view: looking from front (negative Y direction)
    // so that front/back faces are parallel to screen
    this.camera.position.set(0, -5, 0.5); // Leicht erhöht (Z=0.5) für besseren Blickwinkel
    this.camera.up.set(0, 0, 1); // Z-axis points up (like IRIX)
    this.camera.lookAt(0, 0, 0);

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
   * Create ball mesh
   */
  private createBallMesh(ball: Ball): THREE.Mesh | THREE.Points {
    console.log('🔨 createBallMesh - DrawMode:', this.drawMode, 'Ball pos:', ball.position, 'Radius:', ball.radius, 'Color:', ball.color.toString(16));

    let material: THREE.Material;
    let mesh: THREE.Mesh | THREE.Points;

    switch (this.drawMode) {
      case DrawMode.WIREFRAME:
        const wireframeGeometry = new THREE.SphereGeometry(
          ball.radius,
          this.sphereSegments,
          this.sphereSegments
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
    }

    console.log('✅ createBallMesh created:', mesh.type, 'Has geometry:', !!mesh.geometry, 'Has material:', !!mesh.material);
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

    const material = new THREE.MeshPhongMaterial({
      color: wall.color,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.3,
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

    console.log('✅ Added', addedBalls, 'ball meshes to scene');
    console.log('📊 Scene children count:', this.scene.children.length);
    console.log('📊 Ball meshes in map:', this.ballMeshes.size);

    // List all scene children for debugging
    console.log('📋 Scene children types:', this.scene.children.map(c => c.type).join(', '));
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
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);

    // Update Anaglyph Render-Targets
    if (this.renderTargetL && this.renderTargetR) {
      this.renderTargetL.setSize(window.innerWidth, window.innerHeight);
      this.renderTargetR.setSize(window.innerWidth, window.innerHeight);
    }
  }

  /**
   * Set draw mode
   */
  setDrawMode(mode: DrawMode): void {
    this.drawMode = mode;
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
      }
    }
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
    this.cubeDepth = depth;

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

    console.log('📦 Cube depth set to:', depth.toFixed(1), '(Distance:', newDistance.toFixed(2), ')');
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
}


/**
 * Scene Manager - Three.js scene setup and management
 */

import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { AnaglyphEffect } from 'three/examples/jsm/effects/AnaglyphEffect.js';
import { Ball } from '../core/Ball';
import { BallSet } from '../core/BallSet';
import { Parallelogram } from '../core/Parallelogram';
import { DrawMode } from '../core/Constants';

export class SceneManager {
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private renderer: THREE.WebGLRenderer;
  private anaglyphEffect: AnaglyphEffect | null = null;
  private controls: OrbitControls;

  private ballMeshes: Map<number, THREE.Mesh | THREE.Points> = new Map();
  private wallMeshes: THREE.Mesh[] = [];
  private wallGroup: THREE.Group | null = null;

  private drawMode: DrawMode = DrawMode.LIGHTED;
  private sphereSegments: number = 16;
  private anaglyphEnabled: boolean = false;

  constructor(canvas: HTMLCanvasElement) {
    // Scene
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x000000);

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

    // Anaglyph Effect - konfiguriert für Rot-Blau Brille (links rot, rechts blau)
    this.anaglyphEffect = new AnaglyphEffect(this.renderer);
    this.anaglyphEffect.setSize(window.innerWidth, window.innerHeight);

    // Setze initiale Eye-Separation (80mm = User's Augenabstand)
    // AnaglyphEffect verwendet intern eine StereoCamera
    const stereoCamera = (this.anaglyphEffect as any)._stereo;
    if (stereoCamera) {
      stereoCamera.eyeSep = 0.080;
      console.log('🕶️ Initial Eye-Separation set to:', stereoCamera.eyeSep, 'meters');
    }

    // Passe Farbmatrizen für Rot-Blau an
    // "True Color" Anaglyph Methode für Rot-Blau
    // Links behält volle Farbinfo, Rechts nur Blau-Komponente

    // Matrix3 Format: Output = Matrix × Input
    // Zeile 1 = R_out, Zeile 2 = G_out, Zeile 3 = B_out
    // Spalte 1 = R_in, Spalte 2 = G_in, Spalte 3 = B_in

    // Links: Volle Farbe aber nur Rot-Ausgabe (für rotes Brillenglas)
    this.anaglyphEffect.colorMatrixLeft.fromArray([
      1.0,  0.0,  0.0,   // R_out = Rot durchlassen
      0.0,  1.0,  0.0,   // G_out = Grün durchlassen
      0.0,  0.0,  1.0    // B_out = Blau durchlassen
    ]);

    // Rechts: Verschiebe alles nach Blau (für blaues Brillenglas)
    this.anaglyphEffect.colorMatrixRight.fromArray([
      0.0,  0.0,  0.0,   // R_out = kein Rot
      0.0,  0.0,  0.0,   // G_out = kein Grün
      0.299, 0.587, 0.114 // B_out = Luminanz (alle Farben sichtbar als Blau)
    ]);

    console.log('🕶️ Anaglyph Effect initialized - Eye Sep:', (this.anaglyphEffect as any).eyeSep);
    console.log('🕶️ Color Matrix Left (Full Color):', this.anaglyphEffect.colorMatrixLeft.elements);
    console.log('🕶️ Color Matrix Right (Luminanz → Blue):', this.anaglyphEffect.colorMatrixRight.elements);

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

    if (this.anaglyphEnabled && this.anaglyphEffect) {
      this.anaglyphEffect.render(this.scene, this.camera);
    } else {
      this.renderer.render(this.scene, this.camera);
    }
  }

  /**
   * Debug: Test anaglyph effect
   */
  debugAnaglyph(): void {
    console.group('🔍 Anaglyph Debug');
    console.log('Anaglyph Enabled:', this.anaglyphEnabled);
    console.log('Anaglyph Effect exists:', !!this.anaglyphEffect);
    if (this.anaglyphEffect) {
      const stereoCamera = (this.anaglyphEffect as any)._stereo;
      console.log('StereoCamera exists:', !!stereoCamera);
      if (stereoCamera) {
        console.log('Eye Separation (StereoCamera):', stereoCamera.eyeSep, 'meters');
        console.log('Aspect:', stereoCamera.aspect);
      }
      console.log('Color Matrix Left (Full Color):', this.anaglyphEffect.colorMatrixLeft.elements);
      console.log('Color Matrix Right (Luminanz → Blue):', this.anaglyphEffect.colorMatrixRight.elements);
      console.log('Expected Left: [1, 0, 0, 0, 1, 0, 0, 0, 1] - Identity (Full Color)');
      console.log('Expected Right: [0, 0, 0, 0, 0, 0, 0.299, 0.587, 0.114] - Luminanz → Blue');
    }
    console.groupEnd();
  }

  /**
   * Handle window resize
   */
  private onWindowResize(): void {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);

    if (this.anaglyphEffect) {
      this.anaglyphEffect.setSize(window.innerWidth, window.innerHeight);
    }
  }

  /**
   * Set draw mode
   */
  setDrawMode(mode: DrawMode): void {
    this.drawMode = mode;
  }

  /**
   * Enable/Disable Anaglyph Stereo
   */
  setAnaglyphEnabled(enabled: boolean): void {
    this.anaglyphEnabled = enabled;
    console.log('🕶️ Anaglyph Stereo:', enabled ? 'ON' : 'OFF');
    if (enabled && this.anaglyphEffect) {
      console.log('🕶️ Eye separation:', (this.anaglyphEffect as any).eyeSep, 'meters');
      console.log('🕶️ Rendering mit Red-Blue Anaglyph');
    }
  }

  /**
   * Set stereo eye separation (Augenabstand) for optimal 3D effect
   * Default is 0.064 (64mm - average human eye distance)
   */
  setEyeSeparation(separation: number): void {
    if (this.anaglyphEffect) {
      // AnaglyphEffect verwendet intern eine StereoCamera (_stereo)
      // Wir müssen auf die StereoCamera zugreifen um eyeSep zu setzen
      const stereoCamera = (this.anaglyphEffect as any)._stereo;
      if (stereoCamera) {
        stereoCamera.eyeSep = separation;
        console.log('👁️ Eye separation set to:', separation.toFixed(3), 'meters');
        console.log('👁️ StereoCamera eyeSep:', stereoCamera.eyeSep);
      } else {
        console.warn('⚠️ StereoCamera not found in AnaglyphEffect');
      }
    } else {
      console.warn('⚠️ Cannot set eye separation - anaglyphEffect not initialized');
    }
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


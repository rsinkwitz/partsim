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
    // Position camera: X=front-right, Y=back-right, Z=up
    this.camera.position.set(3, 3, 3);
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

    // Anaglyph Effect
    this.anaglyphEffect = new AnaglyphEffect(this.renderer);
    this.anaglyphEffect.setSize(window.innerWidth, window.innerHeight);

    // Lighting
    this.setupLighting();

    // Handle window resize
    window.addEventListener('resize', () => this.onWindowResize());
  }

  /**
   * Setup lighting (port from light.cpp)
   */
  private setupLighting(): void {
    // Ambient light
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.4);
    this.scene.add(ambientLight);

    // Directional light 1 (from above in Z-Up system)
    const dirLight1 = new THREE.DirectionalLight(0xffffff, 0.6);
    dirLight1.position.set(5, 5, 10); // Above and to the side
    this.scene.add(dirLight1);

    // Directional light 2 (from below for fill)
    const dirLight2 = new THREE.DirectionalLight(0xffffff, 0.3);
    dirLight2.position.set(-5, -5, -5);
    this.scene.add(dirLight2);
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
        material = new THREE.MeshPhongMaterial({
          color: ball.color,
          shininess: 30,
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

    // Rotate cube: 10° around X-axis (tilt forward to lift front edge)
    // No Z-rotation to keep vertical edges vertical
    this.wallGroup.rotation.x = THREE.MathUtils.degToRad(10);
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


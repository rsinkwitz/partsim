# PaDIPS Portierungs-Spezifikation: IRIX C++ → TypeScript/Three.js

**Ziel**: Portierung der PaDIPS (Parallel Dynamic Interactive Particle Simulation) von IRIX/C++ (1993) zu TypeScript/Three.js als Web-App für React Native Expo

**Datum**: Februar 2026  
**Original-System**: Silicon Graphics Workstation, IRIX, 1993

---

## 1. Übersicht der Original-Architektur

### 1.1 Hauptkomponenten

| Modul | Datei(en) | Funktion | Status für Portierung |
|-------|-----------|----------|----------------------|
| **Simulation Core** | `model.cpp/h` | Physik-Engine: Ball-Bewegung, Kollisionserkennung | ✅ Portieren |
| **3D-Vektoren** | `vec3f.cpp/h` | 3D-Vektor-Mathematik | ✅ Portieren (Three.js Vector3) |
| **Ball-Definitionen** | `sball.cpp/h` | Ball-Datenstrukturen (Position, Geschwindigkeit, Radius) | ✅ Portieren |
| **Grid-System** | `grid.cpp/h` | Räumliche Unterteilung für effiziente Kollisionserkennung | ✅ Portieren (opt-in) |
| **Event-Queue** | `equeue.cpp/h`, `mainqu.cpp/h` | Event-basierte Simulation, Ergebnis-Queue | ✅ Portieren |
| **UI-System** | `ui.cpp/h`, `dps_ui.cpp/h` | XView Panel-UI | ⚠️ Neu entwickeln (React/HTML) |
| **Rendering** | `main.cpp` (GL-Teile) | IRIS-GL 3D-Rendering | ⚠️ Portieren zu Three.js |
| **IPC** | `dpsipc.cpp/h` | Shared Memory, Semaphoren | ⚠️ Web Workers (opt-in) |
| **PVM Parallelisierung** | `message.cpp/h`, `master.cpp/h`, `dpsdmain.cpp` | Verteilte Berechnung via PVM | ❌ Opt-out (Standard) |
| **Stereo-Display** | `stereo.c/h` | 3D-Stereo-Rendering | ❌ Opt-out (Standard) |
| **Licht-System** | `light.cpp/h` | OpenGL-Beleuchtung | ✅ Portieren (Three.js Lights) |
| **Bild-Speichern** | `imgsave.cpp/h` | Screenshot-Funktionalität | ✅ Portieren (Canvas/WebGL) |

### 1.2 Datenfluss (Original)

```
┌─────────────┐         ┌──────────────┐         ┌─────────────┐
│  UI Process │◄───IPC──►│ Calc Process │◄───PVM──►│  Daemons    │
│  (XView)    │         │ (Simulation) │         │ (Remote)    │
└──────┬──────┘         └──────┬───────┘         └─────────────┘
       │                       │
       │    Shared Memory      │
       │    (BQueue)          │
       └───────────────────────┘
              ▼
       ┌─────────────┐
       │  Rendering  │
       │  (IRIS-GL)  │
       └─────────────┘
```

### 1.3 Parallelisierung (Original)

1. **Zwei-Prozess-Modell** (Shared Memory IPC):
   - Main Process: UI + Rendering
   - Calc Process: Physik-Simulation
   - Kommunikation via Semaphoren & Shared Memory Queue

2. **PVM-Verteilung** (optional):
   - Master verteilt Balls auf N Remote-Daemons
   - Jeder Daemon berechnet Teilmenge der Balls
   - Ergebnisse werden zurückgesammelt (partial results queue)

---

## 2. Kern-Physik-Modell

### 2.1 Datenstrukturen

#### Ball (model.h, Zeilen 44-67)
```cpp
class Ball {
    vec3f position;        // Position [m]
    vec3f velocity;        // Geschwindigkeit [m/s]
    vec3f force;           // Kraft [N]
    float radius;          // Radius [m]
    float mass;            // Masse [kg]
    float density;         // Dichte [kg/m³]
    float elasticity;      // Elastizität [0..1]
    float field;           // Elektrisches Feld
    int color;             // Farbe (RGB)
    float time;            // Zeit im Zeitschritt
};
```

#### Parallelogramm (Würfel-Wände) (model.h, Zeilen 69-89)
```cpp
class Prlgrm {
    vec3f v0, v1, v2, v3;  // 4 Eckpunkte
    vec3f normal;          // Flächennormale
    float elasticity;      // Elastizität [0..1]
    int color;             // Farbe
};
```

#### Global (model.h, Zeilen 91-103)
```cpp
class Global {
    vec3f acceleration;    // Gravitation [g = 9.81 m/s²]
    float elasticity;      // Globale Elastizität
};
```

### 2.2 Physik-Algorithmen

#### 2.2.1 Ball-Ball-Kollision (model.cpp, Zeilen 221-250)
**Elastischer Stoß mit Reibung**:
1. Prüfung: Abstand < (r1 + r2) UND Balls konvergieren
2. Geschwindigkeiten in Normal- und Tangentialkomponenten zerlegen
3. Neue Geschwindigkeiten berechnen:
   ```
   newV_a_normal = ((k - el)*v_a + (1 + el)*v_b) / (1 + k)
   newV_b_normal = ((1 + el)*k*v_a + (1 - k*el)*v_b) / (1 + k)
   wobei k = m_a / m_b
   ```
4. Tangentialkomponenten bleiben unverändert

#### 2.2.2 Ball-Wand-Kollision (model.cpp, Zeilen 282-300)
1. Projektion auf Flächennormale
2. Prüfung: Abstand < Radius UND Ball bewegt sich zur Wand
3. Geschwindigkeit spiegeln und mit Elastizität skalieren:
   ```
   v_new = v_tangential - el * v_normal
   ```

#### 2.2.3 Bewegungs-Integration (model.cpp, Zeilen 199-219)
**Euler-Verfahren**:
```cpp
position += velocity * dt;
velocity += (force / mass) * dt;
```

### 2.3 Berechnungsmethoden

#### Methode 1: Event-basiert (CM_EVENT)
- Sequentielle Kollisionsprüfung aller Ball-Paare
- O(n²) Komplexität
- Einfach aber langsam für viele Balls

#### Methode 2: Grid-basiert (CM_INTRU, grid.cpp)
**Räumliche Unterteilung**:
1. Raum in 3D-Grid unterteilt (z.B. 10×10×10 Voxel)
2. Jeder Ball in 1-8 Voxel eingetragen (je nach Größe)
3. Event-Queue für Grid-Crossings
4. Kollisionsprüfung nur innerhalb Voxel → O(n)

**Grid-Events** (grid.h, Zeilen 148+):
- `GRID_ENTER_POS_x/y/z`: Ball betritt Voxel in positive Richtung
- `GRID_EXIT_POS_x/y/z`: Ball verlässt Voxel in positive Richtung
- `GRID_ENTER_NEG_x/y/z`: Ball betritt Voxel in negative Richtung
- `GRID_EXIT_NEG_x/y/z`: Ball verlässt Voxel in negative Richtung

#### Methode 3: Distributed Grid (CM_INTRU_DISTR)
- Wie Methode 2, aber verteilt auf PVM-Daemons
- ❌ Wird nicht portiert (Opt-out)

---

## 3. Rendering-System

### 3.1 Original (IRIS-GL)

#### Draw-Modi (model.h, Zeilen 31-32)
- `WIREFRAME`: Drahtgitter-Kugeln
- `CIRCLE`: Billboards (2D-Kreise)
- `LIGHTED`: Beleuchtete Polygone (SPH_MESH)
- `POINTS`: Punkte
- `TEXTURED`: Textur-Billboards

#### Kamera-System (ui.h, main.cpp)
- `fovy`: Field of View [Grad]
- `azim`: Azimut (Drehung um Z-Achse) [Grad]
- `inc`: Inklination (Neigung) [Grad]
- `twist`: Verdrehung [Grad]
- `dist`: Kamera-Abstand vom Ursprung

#### Beleuchtung (light.cpp)
- Mehrere Lichtquellen (IRIS-GL lights)
- Material-Eigenschaften (ambient, diffuse, specular)

### 3.2 Portierung zu Three.js

#### Geometrien
- **Kugeln**: `THREE.SphereGeometry` (Standardfall)
- **Billboards**: `THREE.Sprite` (Performance-Modus)
- **Würfel-Wände**: `THREE.PlaneGeometry` mit Doppelseitigkeit

#### Materialien
- **Lighted**: `THREE.MeshStandardMaterial` oder `THREE.MeshPhongMaterial`
- **Wireframe**: `material.wireframe = true`
- **Points**: `THREE.Points` mit `THREE.PointsMaterial`

#### Kamera
- `THREE.PerspectiveCamera`
- Polar-Koordinaten → Kartesisch via:
  ```ts
  camera.position.x = dist * sin(inc) * cos(azim)
  camera.position.y = dist * sin(inc) * sin(azim)
  camera.position.z = dist * cos(inc)
  camera.lookAt(0, 0, 0)
  ```

#### Beleuchtung
- `THREE.AmbientLight`: Umgebungslicht
- `THREE.DirectionalLight`: Gerichtetes Licht (2-3 Quellen)
- `THREE.HemisphereLight`: Hemisphären-Licht (optional)

---

## 4. TypeScript-Architektur

### 4.1 Modulstruktur

```
src/
├── core/
│   ├── Vector3.ts              // vec3f → THREE.Vector3 Wrapper
│   ├── Ball.ts                 // Ball-Klasse
│   ├── Parallelogram.ts        // Prlgrm-Klasse
│   ├── Global.ts               // Global-Parameter
│   ├── BallSet.ts              // BallSet-Container
│   └── Constants.ts            // Konstanten (CBR, ACC_G, etc.)
│
├── simulation/
│   ├── PhysicsEngine.ts        // Haupt-Simulations-Loop
│   ├── CollisionDetector.ts    // Kollisionserkennung
│   ├── EventQueue.ts           // Event-Queue (opt-in)
│   ├── Grid.ts                 // Grid-System (opt-in)
│   └── SimulationWorker.ts     // Web Worker (opt-in)
│
├── rendering/
│   ├── Renderer.ts             // Three.js Renderer-Setup
│   ├── SceneManager.ts         // Three.js Scene-Management
│   ├── CameraController.ts     // Kamera-Steuerung
│   ├── BallRenderer.ts         // Ball-Geometrie & Material
│   └── LightingSetup.ts        // Beleuchtung
│
├── ui/
│   ├── ControlPanel.tsx        // React UI (ersetzt XView)
│   ├── ViewControls.tsx        // Kamera-Steuerung
│   ├── SimulationControls.tsx  // Run/Stop/Step
│   ├── BallControls.tsx        // Ball-Parameter
│   └── GlobalControls.tsx      // Gravitation, Elastizität
│
├── workers/
│   └── simulation.worker.ts    // Web Worker für Simulation (opt-in)
│
├── utils/
│   ├── Queue.ts                // BQueue-Implementierung
│   ├── Timer.ts                // Timing & FPS
│   └── ImageSaver.ts           // Screenshot-Funktionalität
│
└── App.tsx                     // Haupt-App-Komponente
```

### 4.2 Klassen-Definitionen (TypeScript)

#### Ball.ts
```typescript
export class Ball {
  // Position & Dynamik
  position: THREE.Vector3;
  velocity: THREE.Vector3;
  force: THREE.Vector3;
  oldPosition: THREE.Vector3;
  
  // Physikalische Eigenschaften
  radius: number;
  mass: number;
  density: number;
  elasticity: number;
  field: number;
  
  // Rendering
  color: number;  // 0xRRGGBB
  
  // Zeitintegration
  time: number;
  
  // Methoden
  stepInit(): void;
  proceedPartialTo(time: number): void;
  stepFinish(time: number): void;
  proceedFullStep(dt: number): void;
  communicate(other: Ball): void;
}
```

#### PhysicsEngine.ts
```typescript
export class PhysicsEngine {
  private ballSet: BallSet;
  private prlgrmSet: ParallelogramSet;
  private global: Global;
  private grid?: Grid;  // Optional
  
  // Konfiguration
  private calcMethod: CalculationMethod;
  private timeStep: number;
  private calcFactor: number;
  private collisionsEnabled: boolean;
  
  // Statistiken
  numChecks: number;
  numCollisions: number;
  
  // Methoden
  calculate(dt: number): void;
  private checkCollisionsBruteForce(): void;
  private checkCollisionsGrid(): void;
  private integrateBalls(dt: number): void;
}

export enum CalculationMethod {
  EVENT = 'EVENT',        // Brute-Force O(n²)
  GRID = 'GRID',          // Spatial Grid O(n)
}
```

#### Grid.ts (opt-in)
```typescript
export class Grid {
  private voxels: IdList[][][];  // 3D-Array von Ball-IDs
  private eventQueue: EventQueue;
  
  // Grid-Parameter
  private origin: THREE.Vector3;
  private extent: THREE.Vector3;
  private numSegments: THREE.Vector3;
  private voxelSize: THREE.Vector3;
  
  // Methoden
  insertBall(id: number, ball: Ball): void;
  removeBall(id: number): void;
  checkCollisionsInVoxel(voxel: [number, number, number]): void;
  updateBallVoxels(id: number, ball: Ball): void;
}
```

### 4.3 Rendering-Loop

```typescript
class Renderer {
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private renderer: THREE.WebGLRenderer;
  
  private ballMeshes: THREE.Mesh[] = [];
  private wallMeshes: THREE.Mesh[] = [];
  
  // Animationsloop
  animate(): void {
    requestAnimationFrame(() => this.animate());
    
    // Simulation-Update (aus Queue oder direkt)
    if (this.newSimulationDataAvailable()) {
      this.updateBallPositions();
    }
    
    // Render
    this.renderer.render(this.scene, this.camera);
  }
  
  // Sync mit Simulation
  updateBallPositions(): void {
    for (let i = 0; i < this.ballSet.num; i++) {
      this.ballMeshes[i].position.copy(this.ballSet.balls[i].position);
    }
  }
}
```

---

## 5. Feature-Portierung: Opt-in/Opt-out

### 5.1 Core Features (Immer aktiv)

| Feature | Beschreibung | Aufwand |
|---------|-------------|---------|
| **Ball-Bewegung** | Euler-Integration, Gravitation | ⭐⭐ (mittel) |
| **Ball-Ball-Kollision** | Elastischer Stoß | ⭐⭐⭐ (hoch) |
| **Ball-Wand-Kollision** | Würfel-Begrenzung | ⭐⭐ (mittel) |
| **3D-Rendering** | Three.js Kugeln & Würfel | ⭐⭐ (mittel) |
| **Kamera-Steuerung** | Polar-Koordinaten | ⭐ (niedrig) |
| **UI-Kontrollen** | React-basiert | ⭐⭐⭐ (hoch) |
| **Ball-Erstellung** | Dynamisch Balls erzeugen | ⭐ (niedrig) |

### 5.2 Opt-In Features

#### 5.2.1 Grid-basierte Kollision (Empfohlen)
**Aktivierung**: `simulationConfig.collisionMethod = 'GRID'`

**Vorteil**: 
- O(n) statt O(n²) Komplexität
- Erlaubt 1000+ Balls in Echtzeit

**Aufwand**: ⭐⭐⭐⭐ (sehr hoch)

**Implementierung**:
- 3D-Grid mit einstellbarer Segmentierung (z.B. 10×10×10)
- Voxel-basierte Kollisionsprüfung
- Event-Queue für Grid-Crossings

#### 5.2.2 Separate Simulation-Worker (Empfohlen)
**Aktivierung**: `simulationConfig.useWorker = true`

**Vorteil**:
- Simulation blockiert nicht Rendering
- Flüssigere Darstellung (60 FPS)

**Aufwand**: ⭐⭐⭐ (hoch)

**Implementierung**:
- Web Worker für Physik-Berechnungen
- Shared Array Buffer oder Structured Clone für Datenaustausch
- Message-basierte Kommunikation

**Einschränkung**: 
- Three.js-Objekte nicht im Worker (nur Daten)
- Kein DOM-Zugriff im Worker

#### 5.2.3 Multi-Threading (Experimentell)
**Aktivierung**: `simulationConfig.numWorkers = 4`

**Vorteil**:
- Mehrere Balls parallel berechnen
- Ähnlich wie Original PVM, aber lokal

**Aufwand**: ⭐⭐⭐⭐⭐ (extrem hoch)

**Implementierung**:
- Mehrere Web Workers
- Ball-Set-Aufteilung (z.B. Ball 0-250 → Worker 1, etc.)
- Result-Queue wie Original (BQueue)
- Synchronisations-Overhead beachten

**Herausforderung**:
- Race Conditions bei Ball-Ball-Kollisionen über Worker-Grenzen
- Komplexe Merge-Logik

#### 5.2.4 Advanced Rendering
**Instanced Rendering** (viele identische Balls):
```typescript
instancedMesh = new THREE.InstancedMesh(
  geometry, material, ballCount
);
// Update via matrix für jede Ball-Position
```

**Shader-basierte Effekte**:
- Custom Vertex/Fragment Shader
- Glow-Effekte
- Motion Blur

**Aufwand**: ⭐⭐⭐ (hoch pro Effekt)

#### 5.2.5 Image Saving (Screenshot)
**Aktivierung**: `ui.enableImageSave = true`

**Implementierung**:
```typescript
const dataURL = renderer.domElement.toDataURL('image/png');
// Download oder Upload
```

**Aufwand**: ⭐ (niedrig)

#### 5.2.6 Time-Based Features
- **calcFactor**: Mehrere Simulationsschritte pro Frame
- **Frame-Timer**: Einstellbare FPS (Original: 10-100 fps)

**Aufwand**: ⭐ (niedrig)

### 5.3 Opt-Out Features (Standard deaktiviert)

#### 5.3.1 PVM Parallelisierung ❌
**Grund**: 
- Nicht im Web-Kontext umsetzbar
- Ersetzt durch Web Workers (opt-in)

**Entfernte Module**:
- `message.cpp/h`
- `master.cpp/h`
- `dpsdmain.cpp`
- `pvmuser.h`

#### 5.3.2 3D-Stereo Display ❌
**Grund**:
- Spezielle Hardware erforderlich
- Kaum noch relevant
- WebXR/WebVR wären moderne Alternative (separate Implementierung)

**Entfernte Module**:
- `stereo.c/h`
- Stereo-UI-Elemente

**Alternative** (falls gewünscht):
- WebXR API für VR-Headsets
- Anaglyph-Stereo (rot/cyan)

---

## 6. UI-Portierung: XView → React

### 6.1 Original XView-Panels

#### Base Window (dps.G)
- **Main Canvas**: OpenGL-Zeichenfläche
- **Control Panel**: Run/Stop/Step-Buttons
- **Menu Bar**: File, View, Options

#### Popup-Fenster
1. **View Properties**: Kamera, Draw-Mode, Sphere-Detail
2. **Run Properties**: Frame-Time, Calc-Method, Calc-Factor
3. **Ball Properties**: Anzahl, Größe, Geschwindigkeit, Elastizität
4. **Global Properties**: Gravitation (X/Y/Z), Globale Elastizität
5. **Workstation Panel**: PVM-Konfiguration (❌ nicht portiert)

### 6.2 React-Komponenten-Mapping

#### App.tsx (Hauptansicht)
```tsx
<div className="app">
  <Canvas3D />  {/* Three.js Canvas */}
  <ControlPanel>
    <SimulationControls />
    <ViewControls />
    <BallControls />
    <GlobalControls />
  </ControlPanel>
  <StatusBar />
</div>
```

#### SimulationControls.tsx
```tsx
- [Start] [Stop] [Step] Buttons
- Frame Time: Slider (10-100 ms)
- Calc Method: Dropdown (EVENT, GRID)
- Calc Factor: Spinner (1-100)
- Collisions: Checkbox
- Stats: numChecks, numCollisions, FPS
```

#### ViewControls.tsx
```tsx
- Draw Mode: Dropdown (Wireframe, Circle, Lighted, Points)
- Camera:
  - Azimuth: Slider (0-360°)
  - Inclination: Slider (0-180°)
  - Distance: Slider (2-10)
  - FOV: Slider (30-120°)
- Sphere Detail: Slider (für SphereGeometry segments)
- Show Grid: Checkbox
- Show Numbers: Checkbox (Ball-IDs anzeigen)
```

#### BallControls.tsx
```tsx
- Number of Balls: Spinner (1-1000)
- Ball Size: Min/Max Sliders (0.01-0.5)
- Velocity: Slider (0-1000 cm/s)
- Elasticity: Slider (0-100%)
- [New Balls] Button
- Auto Grid-Adjust: Checkbox
```

#### GlobalControls.tsx
```tsx
- Acceleration Preset: Dropdown (Zero, Down, Up, Left, Right, Front, Rear)
- Acceleration: Slider (0-200% von g)
- Direction:
  - X: Slider (-100 to 100)
  - Y: Slider (-100 to 100)
  - Z: Slider (-100 to 100)
- Global Elasticity: Slider (0-100%)
```

#### StatusBar.tsx
```tsx
- FPS: XX fps
- Draw Time: XX ms
- Calc Time: XX ms
- Balls: XX
- Generation: XX
- Checks: XXXX
- Collisions: XXX
```

### 6.3 Styling

**Optionen**:
1. **Tailwind CSS**: Modern, Utility-first
2. **Material-UI**: Vorgefertigte Komponenten
3. **Custom CSS**: Ähnlich Original-Look

**Empfehlung**: Material-UI für schnelle Entwicklung

---

## 7. React Native Expo Integration

### 7.1 Three.js in React Native

**Library**: `expo-gl` + `expo-three`

```typescript
import { GLView } from 'expo-gl';
import { Renderer } from 'expo-three';

<GLView
  style={{ flex: 1 }}
  onContextCreate={async (gl) => {
    const renderer = new Renderer({ gl });
    const scene = new THREE.Scene();
    // ... Setup wie Web
  }}
/>
```

### 7.2 Web Workers in Expo

**Problematik**: 
- Expo unterstützt keine Web Workers direkt
- Alternative: **Hermes** Engine mit JSI

**Lösungen**:
1. **Simulation im Main-Thread** (einfach, aber blockierend)
2. **React Native Workers** (Community-Package)
3. **Native Module** (C++/Swift/Kotlin) für Physik

**Empfehlung**: 
- Für Prototyp: Main-Thread
- Für Production: Native Module oder warten auf Hermes-Threading

### 7.3 UI in React Native

**Komponenten-Mapping**:
- `<View>` statt `<div>`
- `<Text>` statt `<span>`
- `<TouchableOpacity>` statt `<button>`
- `<Slider>` aus `@react-native-community/slider`

**Beispiel**:
```tsx
<View style={styles.controlPanel}>
  <Text>Simulation Controls</Text>
  <TouchableOpacity onPress={handleStart}>
    <Text>Start</Text>
  </TouchableOpacity>
  <Slider
    value={frameTime}
    onValueChange={setFrameTime}
    minimumValue={10}
    maximumValue={100}
  />
</View>
```

### 7.4 Performance-Überlegungen

**Mobile vs. Desktop**:
- Weniger Balls (100-500 statt 1000+)
- Niedrigere Sphere-Geometrie (16 statt 32 Segmente)
- Vereinfachte Beleuchtung
- Niedriger Draw-Mode (CIRCLE statt LIGHTED)

**Optimierungen**:
- `THREE.LOD` (Level of Detail)
- Frustum Culling
- Object Pooling (Balls recyclen)

---

## 8. Implementierungsplan

### Phase 1: Kern-Portierung (MVP)
**Ziel**: Einfache Ball-Simulation im Browser

**Aufgaben**:
1. ✅ TypeScript-Projekt-Setup (Vite/Create-React-App)
2. ✅ Three.js-Scene mit Kamera & Beleuchtung
3. ✅ Ball-Klasse mit Physik (Euler-Integration)
4. ✅ Ball-Ball-Kollision (Brute-Force)
5. ✅ Ball-Wand-Kollision (Würfel)
6. ✅ Einfaches React-UI (Start/Stop, Ball-Anzahl)
7. ✅ Rendering-Loop mit Sync

**Aufwand**: 2-3 Wochen (1 Entwickler)

**Auslieferung**: 
- Web-App unter `http://localhost:3000`
- 10-50 Balls @ 60 FPS

### Phase 2: UI & Konfiguration
**Ziel**: Vollständige UI-Kontrollen

**Aufgaben**:
1. ✅ Alle UI-Panels (View, Run, Ball, Global)
2. ✅ Kamera-Steuerung (Polar-Koordinaten)
3. ✅ Draw-Mode-Wechsel (Wireframe, Lighted, etc.)
4. ✅ Parameter-Persistenz (LocalStorage)
5. ✅ Statistik-Anzeige (FPS, Checks, Collisions)
6. ✅ Preset-System (Gravitations-Richtungen)

**Aufwand**: 2 Wochen

**Auslieferung**:
- Feature-Parität mit Original-UI (ohne PVM/Stereo)

### Phase 3: Grid-Optimierung (Opt-in)
**Ziel**: 1000+ Balls in Echtzeit

**Aufgaben**:
1. ✅ Grid-Klasse (3D-Voxel-Array)
2. ✅ Voxel-Zuordnung für Balls
3. ✅ Grid-Event-Queue
4. ✅ Kollisionsprüfung innerhalb Voxel
5. ✅ Grid-Visualisierung (Debug-Modus)
6. ✅ UI-Option: Collision-Method (EVENT/GRID)

**Aufwand**: 3-4 Wochen

**Auslieferung**:
- 500-1000 Balls @ 60 FPS (Desktop)
- 100-300 Balls @ 30-60 FPS (Mobile)

### Phase 4: Worker-Parallelisierung (Opt-in)
**Ziel**: Simulation & Rendering entkoppelt

**Aufgaben**:
1. ✅ Web Worker für Simulation
2. ✅ Message-Passing (BallSet-Daten)
3. ✅ Queue-System (ähnlich BQueue)
4. ✅ Sync-Mechanismus (Generation-Counter)
5. ✅ UI-Option: Use Worker (on/off)

**Aufwand**: 2-3 Wochen

**Auslieferung**:
- Flüssigeres Rendering
- Höhere Simulation-Frequenz (100+ FPS intern)

### Phase 5: React Native Expo
**Ziel**: Mobile App

**Aufgaben**:
1. ✅ Expo-Projekt-Setup
2. ✅ `expo-gl` + `expo-three` Integration
3. ✅ React Native UI (Native Components)
4. ✅ Touch-Gesten (Kamera-Steuerung)
5. ✅ Performance-Optimierungen (LOD, niedrigere Poly-Counts)
6. ⚠️ Simulation-Threading (falls verfügbar)

**Aufwand**: 3-4 Wochen

**Auslieferung**:
- iOS/Android-App via Expo
- 50-200 Balls @ 30 FPS

### Phase 6: Advanced Features (Optional)
**Ziel**: Zusätzliche Features

**Aufgaben**:
1. ⭐ Image/Video Export
2. ⭐ Instanced Rendering (Tausende Balls)
3. ⭐ Custom Shader-Effekte
4. ⭐ Multi-Worker-Parallelisierung
5. ⭐ WebXR/VR-Support (Stereo-Ersatz)
6. ⭐ Ball-Texturen & Trails

**Aufwand**: Je 1-2 Wochen pro Feature

---

## 9. Technologie-Stack

### 9.1 Entwicklung

| Komponente | Technologie | Version |
|------------|-------------|---------|
| **Sprache** | TypeScript | 5.x |
| **Build-Tool** | Vite | 5.x |
| **Framework** | React | 18.x |
| **3D-Engine** | Three.js | 0.160+ |
| **UI-Library** | Material-UI (MUI) | 5.x |
| **State-Management** | Zustand / Context API | - |
| **Worker** | Comlink (für typsichere Worker) | 4.x |

### 9.2 React Native

| Komponente | Technologie | Version |
|------------|-------------|---------|
| **Framework** | React Native | 0.73+ |
| **Expo SDK** | Expo | 50+ |
| **3D-Engine** | expo-three | 7.x |
| **GL-Context** | expo-gl | 14.x |
| **UI-Components** | React Native Paper | 5.x |

### 9.3 Development Tools

- **Linting**: ESLint + Prettier
- **Testing**: Jest + React Testing Library
- **Bundler**: Webpack (CRA) oder Vite
- **Package-Manager**: npm oder pnpm

---

## 10. Konfigurationsdatei (JSON)

**config.json** (Beispiel):
```json
{
  "simulation": {
    "collisionMethod": "EVENT",
    "useWorker": false,
    "numWorkers": 1,
    "calcFactor": 10,
    "timeStep": 0.01,
    "collisionsEnabled": true,
    "gridSegments": [10, 10, 10]
  },
  "rendering": {
    "drawMode": "LIGHTED",
    "sphereSegments": 16,
    "instancedRendering": false,
    "showGrid": false,
    "showNumbers": false,
    "antialias": true,
    "shadows": false
  },
  "camera": {
    "fov": 60,
    "azimuth": 45,
    "inclination": 30,
    "distance": 5,
    "near": 0.1,
    "far": 100
  },
  "physics": {
    "cubeRadius": 1.0,
    "gravity": 9.81,
    "globalElasticity": 0.9
  },
  "balls": {
    "count": 30,
    "minRadius": 0.05,
    "maxRadius": 0.15,
    "maxVelocity": 4.0,
    "elasticity": 0.9,
    "density": 1000
  },
  "performance": {
    "targetFPS": 60,
    "frameTime": 16,
    "maxBalls": 1000
  },
  "features": {
    "gridOptimization": true,
    "workerSimulation": false,
    "multiWorker": false,
    "imageSave": true,
    "stereo": false,
    "pvmDistributed": false
  }
}
```

---

## 11. Testing-Strategie

### 11.1 Unit-Tests

**Physik-Tests**:
```typescript
describe('Ball', () => {
  test('elastic collision conserves momentum', () => {
    const ball1 = new Ball({ mass: 1, velocity: [1, 0, 0] });
    const ball2 = new Ball({ mass: 1, velocity: [-1, 0, 0] });
    
    const momentumBefore = ball1.momentum.add(ball2.momentum);
    ball1.communicate(ball2);
    const momentumAfter = ball1.momentum.add(ball2.momentum);
    
    expect(momentumAfter).toBeCloseTo(momentumBefore);
  });
  
  test('wall collision reflects velocity', () => {
    const ball = new Ball({ velocity: [1, 0, 0] });
    const wall = new Parallelogram(/* rechte Wand */);
    
    ball.communicate(wall);
    
    expect(ball.velocity.x).toBeLessThan(0); // Reflektiert
  });
});
```

**Grid-Tests**:
```typescript
describe('Grid', () => {
  test('ball inserted into correct voxels', () => {
    const grid = new Grid({ segments: [10, 10, 10] });
    const ball = new Ball({ position: [0.5, 0.5, 0.5], radius: 0.1 });
    
    grid.insertBall(0, ball);
    
    expect(grid.getBallVoxels(0).length).toBeGreaterThan(0);
  });
});
```

### 11.2 Integration-Tests

- Simulation-Loop (100 Frames ohne Crash)
- Rendering-Update (Mesh-Positionen synchron mit Balls)
- Worker-Kommunikation (Daten-Integrität)

### 11.3 Performance-Tests

**Benchmarks**:
- 10 Balls @ ? FPS
- 100 Balls @ ? FPS
- 500 Balls @ ? FPS (Grid erforderlich)
- 1000 Balls @ ? FPS (Grid + Worker)

**Ziele**:
- Desktop: 60 FPS bis 500 Balls (Grid)
- Mobile: 30 FPS bis 100 Balls

---

## 12. Dokumentation

### 12.1 README.md
- Installation & Setup
- Entwicklungs-Commands (`npm start`, `npm test`)
- Deployment (`npm build`)
- Feature-Flags (config.json)

### 12.2 API-Dokumentation (TSDoc)
- Alle öffentlichen Klassen & Methoden
- Generiert via TypeDoc

### 12.3 User-Guide
- UI-Erklärung (Screenshots)
- Physik-Parameter (was bedeuten sie?)
- Performance-Tipps
- Troubleshooting

---

## 13. Migration-Mapping (C++ → TypeScript)

| C++ Original | TypeScript Port | Notizen |
|--------------|-----------------|---------|
| `vec3f` | `THREE.Vector3` | Native Three.js |
| `Ball` | `Ball` class | Identische Struktur |
| `BallSet` | `BallSet` class | Array-Wrapper |
| `Prlgrm` | `Parallelogram` class | Umbenennung |
| `Global` | `GlobalParams` class | - |
| `calculate()` | `PhysicsEngine.calculate()` | - |
| `Grid` | `Grid` class | Komplexe Portierung |
| `BQueue` | `ResultQueue` class | Message-basiert (Worker) |
| `dpsipc.h` Semaphores | `Promise` / `async/await` | Web-APIs |
| `waitMessage` | Event-basiert | - |
| IRIS-GL `sphere()` | `THREE.SphereGeometry` | - |
| IRIS-GL `polarview()` | `camera.position.set()` | Manuelle Berechnung |
| IRIS-GL `cpack()` | `material.color.set()` | - |
| XView Panels | React Components | Vollständiger Rewrite |
| PVM Messages | Web Worker `postMessage()` | (opt-in) |
| `fork()` | `new Worker()` | (opt-in) |
| Shared Memory | `SharedArrayBuffer` | (opt-in, limitiert) |

---

## 14. Risiken & Einschränkungen

### 14.1 Performance

**Risiko**: TypeScript/JavaScript langsamer als C++

**Mitigation**:
- Grid-Optimierung (Phase 3)
- WebAssembly für Physik-Kern (falls nötig)
- Instanced Rendering
- LOD-System

**Erwartung**: 
- 50-80% der Original-Performance (Desktop)
- 30-50% (Mobile)

### 14.2 Threading

**Risiko**: Web Workers != Unix Processes

**Einschränkungen**:
- Kein Shared Memory (außer SharedArrayBuffer mit COOP/COEP-Headers)
- Structured Clone Overhead
- Kein direkter Objekt-Sharing (nur Daten)

**Mitigation**:
- Single-Worker-Modell (Phase 4)
- Multi-Worker erst nach Profiling

### 14.3 React Native

**Risiko**: `expo-three` weniger performant als Web

**Mitigation**:
- Niedrigere Ball-Counts
- Einfachere Geometrien
- Native Module (C++) für Physik (Advanced)

### 14.4 Kompatibilität

**Browser-Support**:
- Modern Browsers (Chrome 90+, Firefox 88+, Safari 15+)
- WebGL 2.0 erforderlich

**Mobile**:
- iOS 14+
- Android 10+ (Expo-Unterstützung)

---

## 15. Opt-In Feature-Matrix

| Feature | Standard | Opt-In Config | Performance-Impact | Entwicklungsaufwand |
|---------|----------|---------------|-------------------|---------------------|
| **Ball-Ball-Kollision** | ✅ Ja | - | Hoch (O(n²)) | ⭐⭐⭐ |
| **Grid-Kollision** | ❌ Nein | `collisionMethod: "GRID"` | Niedrig (O(n)) | ⭐⭐⭐⭐ |
| **Worker-Simulation** | ❌ Nein | `useWorker: true` | Overhead +10% | ⭐⭐⭐ |
| **Multi-Worker** | ❌ Nein | `numWorkers: 4` | Sync-Overhead | ⭐⭐⭐⭐⭐ |
| **Instanced Rendering** | ❌ Nein | `instancedRendering: true` | GPU +50% | ⭐⭐⭐ |
| **Image Save** | ✅ Ja | - | Minimal | ⭐ |
| **Grid-Visualisierung** | ❌ Nein | `showGrid: true` | Niedrig | ⭐ |
| **Ball-Nummern** | ❌ Nein | `showNumbers: true` | Niedrig | ⭐ |
| **Schatten** | ❌ Nein | `shadows: true` | Hoch | ⭐⭐ |
| **Antialiasing** | ✅ Ja | `antialias: false` | GPU +20% | - |
| **PVM-Distributed** | ❌ Nein | ❌ Nicht portiert | - | - |
| **Stereo-Display** | ❌ Nein | ❌ Nicht portiert | - | - |

---

## 16. Zusammenfassung

### Was wird portiert?

✅ **Kern-Physik**: Ball-Bewegung, Kollisionen, Gravitation  
✅ **3D-Rendering**: Three.js mit Kugeln, Würfel, Beleuchtung  
✅ **UI**: React-basierte Kontrollen (ersetzt XView)  
✅ **Kamera**: Polar-Koordinaten-Steuerung  
✅ **Konfiguration**: Alle Original-Parameter (Balls, Physik, View)  
⚠️ **Grid-Optimierung**: Als Opt-in (empfohlen für >100 Balls)  
⚠️ **Worker-Parallelisierung**: Als Opt-in (moderne Alternative zu PVM)  

### Was wird NICHT portiert?

❌ **PVM-Verteilung**: Kein Remote-Daemon-System  
❌ **3D-Stereo**: Keine CrystalEyes-Hardware-Unterstützung  
❌ **XView-UI**: Vollständiger Rewrite in React  
❌ **IRIS-GL spezifische Features**: (z.B. spezielle GL-Modi)  

### Empfohlene Konfiguration

**Desktop (High-End)**:
```json
{
  "collisionMethod": "GRID",
  "useWorker": true,
  "drawMode": "LIGHTED",
  "balls": { "count": 500 },
  "sphereSegments": 32
}
```

**Desktop (Standard)**:
```json
{
  "collisionMethod": "EVENT",
  "useWorker": false,
  "drawMode": "LIGHTED",
  "balls": { "count": 50 },
  "sphereSegments": 16
}
```

**Mobile**:
```json
{
  "collisionMethod": "EVENT",
  "useWorker": false,
  "drawMode": "CIRCLE",
  "balls": { "count": 30 },
  "sphereSegments": 8
}
```

---

## 17. Nächste Schritte

1. **Review dieser Spezifikation** → Feedback & Anpassungen
2. **Phase 1 starten** → MVP-Implementierung (2-3 Wochen)
3. **Testing** → Funktionale & Performance-Tests
4. **Phase 2-6** → Iterative Feature-Erweiterung
5. **Deployment** → Web + React Native Expo

**Geschätzter Gesamt-Aufwand**: 12-16 Wochen (1 Vollzeit-Entwickler)

---

**Ende der Spezifikation**


# PaDIPS - Interactive Particle Simulation

[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-blue.svg)](https://www.typescriptlang.org/)
[![Three.js](https://img.shields.io/badge/Three.js-0.160+-green.svg)](https://threejs.org/)
[![Vite](https://img.shields.io/badge/Vite-5.x-purple.svg)](https://vitejs.dev/)

**A modern web port of the 1993 IRIX particle simulation system**

Originally developed as part of a Ph.D. thesis at the **University of Zurich** under **Prof. Dr. P. Stucki**:  
*"Interaktive Partikelsimulationen unter Echtzeitbedingungen parallel verteilt auf einem Verbund von Arbeitsplatzrechnern"*  
*(Interactive Particle Simulations under Real-Time Constraints Distributed in Parallel on a Network of Workstations)*

Now modernized and running in your browser with WebGL acceleration.

![PaDIPS Screenshot](https://via.placeholder.com/800x450.png?text=PaDIPS+3D+Ball+Simulation)

---

## 🎯 Features

- **⚡ Real-time Physics**: Elastic ball collisions with gravity and wall bouncing
- **🎨 3D Graphics**: Powered by Three.js with multiple rendering modes
- **🕶️ Anaglyph Stereo**: Red-Blue 3D viewing with adjustable eye separation
- **🎮 Interactive Controls**: Mouse-driven camera (rotate/zoom) + full parameter control
- **📊 Performance**: 400 balls @ 26 FPS on modern hardware (without grid optimization)
- **🖥️ Retro Aesthetics**: Original IRIX-1993 color scheme (cyan edges, gray background)

---

## 🚀 Quick Start

### Installation

```bash
cd padips-web
npm install
```

### Development

```bash
npm run dev
```

Open [http://localhost:5173](http://localhost:5173) in your browser.

### Build

```bash
npm run build
npm run preview
```

---

## 🎮 Controls

### Mouse
- **Left Drag**: Rotate scene (OrbitControls)
- **Scroll**: Zoom in/out
- **Right Drag**: Pan camera

### UI Panel
- **Start/Stop**: Control simulation
- **New**: Generate new balls with current parameters
- **Draw Mode**: Switch between Lighted/Wireframe/Points
- **Anaglyph Stereo**: Enable 3D viewing (requires red-blue glasses)

### Simulation Controls
- **Ball Count**: 5-1000 balls (slider: 5-100, direct input: up to 1000)
- **Calc Factor**: Simulation steps per frame (1-50)
- **Physics**: Gravity presets, elasticity, velocity
- **3D Stereo**: Eye separation (2-20cm), Cube depth (-2 to +2m)

---

## 📐 Architecture

### Core Modules

```
padips-web/
├── src/
│   ├── core/           # Physics engine (Ball, Parallelogram, GlobalParams)
│   ├── simulation/     # PhysicsEngine (collision detection)
│   ├── rendering/      # Three.js SceneManager
│   ├── utils/          # BallGenerator, helpers
│   └── main.ts         # App entry & UI controls
├── index.html          # UI layout
└── package.json
```

### Technology Stack

- **Language**: TypeScript 5.x
- **3D Engine**: Three.js 0.160+
- **Build Tool**: Vite 5.x
- **Physics**: Custom Euler integration + elastic collision detection

---

## 🎨 Original vs. Port

| Feature | Original (1993) | Web Port (2026) |
|---------|-----------------|-----------------|
| **Platform** | SGI Workstation, IRIX | Modern browsers (Chrome/Firefox/Safari) |
| **Graphics** | IRIS-GL | Three.js / WebGL |
| **UI** | XView panels | HTML + CSS controls |
| **Parallelization** | PVM + Shared Memory | Single-threaded (Web Workers opt-in) |
| **Stereo** | CrystalEyes hardware | Anaglyph (Red-Blue glasses) |
| **Performance** | ~100 balls @ 60 FPS | 400 balls @ 26 FPS (without grid) |

---

## 🔧 Configuration

Initial settings can be modified in:
- **Ball count**: `src/utils/BallGenerator.ts` → `DEFAULT_BALL_PARAMS.count` (default: 10)
- **Cube size**: `src/core/Constants.ts` → `CBR` (default: 1.0)
- **Gravity**: `src/core/Constants.ts` → `ACC_G` (default: 9.81 m/s²)

---

## 📊 Performance Benchmarks

Tested on modern hardware (2026):

| Balls | FPS | Calc Factor | Notes |
|-------|-----|-------------|-------|
| 10 | 60 | 10 | Smooth (start config) |
| 100 | 60 | 10 | Smooth |
| 400 | 26 | 1 | Playable (brute-force O(n²)) |
| 1000 | ? | 1 | Grid optimization required |

**Note**: Performance scales with O(n²) for collision detection. Grid-based optimization (Phase 3) can achieve O(n) for 1000+ balls.

---

## 🕶️ 3D Stereo Viewing

### Requirements
- Red-Blue anaglyph glasses (left eye: red, right eye: blue)

### Usage
1. Enable "Anaglyph Stereo" checkbox
2. Adjust "Eye Separation" slider (8cm = average human eye distance)
3. Adjust "Cube Depth" slider (negative = objects pop out of screen)
4. Put on red-blue glasses and enjoy 3D!

### Tips
- **For dramatic pop-out**: Eye Sep = 12-15cm, Cube Depth = -15 to -20
- **For comfortable viewing**: Eye Sep = 8cm, Cube Depth = -5 to -10
- Rotate the scene while in stereo mode - 3D works from any angle!

---

## 📝 Development Status

### ✅ Phase 1 (MVP) - COMPLETED
- Core physics simulation (Euler integration)
- Ball-ball & ball-wall collisions
- Three.js rendering with multiple draw modes
- Full UI controls (HTML-based)
- OrbitControls mouse interaction
- Anaglyph stereo 3D
- Original IRIX color scheme

### 🔜 Phase 2 (Planned)
- React UI migration
- Material-UI components
- LocalStorage persistence

### 🔜 Phase 3 (Planned)
- Grid-based collision optimization (O(n))
- 1000+ balls @ 60 FPS

### 🔜 Phase 4 (Planned)
- Web Workers for parallel simulation
- React Native Expo mobile app

---

## 📚 Documentation

- **Porting Specification**: [PORTING_SPECIFICATION.md](./PORTING_SPECIFICATION.md)
- **Original Code**: [old-irix-1993/](./old-irix-1993/) (C++/IRIS-GL)
- **Implementation Notes**: 
  - [IMPLEMENTATION.md](./padips-web/IMPLEMENTATION.md)
  - [FIXES.md](./padips-web/FIXES.md)

---

## 🎓 Educational Value

PaDIPS demonstrates:
- **Classical Mechanics**: Elastic collisions, momentum conservation
- **Numerical Integration**: Euler method for ODE solving
- **3D Graphics**: WebGL/Three.js scene graph, lighting, stereo rendering
- **Algorithm Optimization**: O(n²) brute-force vs. O(n) spatial partitioning
- **Software Archaeology**: Porting 1990s SGI code to modern web technologies

Perfect for physics simulations, computer graphics courses, or retro computing enthusiasts!

---

## 🤝 Contributing

This is a historical preservation and modernization project. Contributions welcome:
- Performance optimizations
- React UI improvements
- Grid optimization implementation
- Mobile/touch controls
- Bug fixes and documentation

---

## 📜 License

Original PaDIPS (1993): © Rainer Sinkwitz  
Web Port (2026): © Rainer Sinkwitz

Educational and non-commercial use permitted.

---

## 🙏 Acknowledgments

- Original PaDIPS developed by **Rainer Sinkwitz** as part of Ph.D. research (1993)
- **University of Zurich**, Computer Science Department
- Supervised by **Prof. Dr. Peter Stucki**
- Ph.D. Thesis: *"Interaktive Partikelsimulationen unter Echtzeitbedingungen parallel verteilt auf einem Verbund von Arbeitsplatzrechnern"* (Interactive Particle Simulations under Real-Time Constraints Distributed in Parallel on a Network of Workstations)
- Silicon Graphics workstations for the original implementation
- Three.js community for excellent WebGL framework
- Dubois anaglyph matrices for color-correct stereo viewing

---

## 🔗 Links

- **Three.js**: https://threejs.org/
- **TypeScript**: https://www.typescriptlang.org/
- **Vite**: https://vitejs.dev/
- **Original IRIX**: https://en.wikipedia.org/wiki/IRIX

---

**Enjoy the retro-futuristic ball simulation!** 🎱✨

*From Silicon Graphics (1993) to your browser (2026)* 🖥️→🌐



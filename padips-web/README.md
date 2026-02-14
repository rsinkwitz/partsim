# PaDIPS Web - Phase 1 MVP

**Parallel Dynamic Interactive Particle Simulation** - TypeScript/Three.js Port

> Portierung der originalen PaDIPS-Simulation (1993, Silicon Graphics IRIX) zu modernem Web.

## 🎯 Phase 1 Features

✅ **Kern-Physik**
- 30 Balls bei Start
- Euler-Integration
- Ball-Ball-Kollision (elastischer Stoß)
- Ball-Wand-Kollision (6 Würfelwände)
- Gravitation (einstellbar)

✅ **3D-Rendering**
- Three.js mit WebGL
- Beleuchtete Kugeln (Phong-Shading)
- Transparente Würfelwände
- 60 FPS

✅ **Interaktion**
- OrbitControls (Maus-Rotation & Zoom)
- Start/Stop/Reset Buttons
- Echtzeit-Statistiken

## 🚀 Quick Start

```bash
# Install dependencies
npm install

# Start dev server
npm run dev

# Open browser
# http://localhost:5173
```

## 🎮 Steuerung

- **Maus links ziehen**: Kamera rotieren
- **Maus-Scroll**: Zoom
- **▶ Start**: Simulation starten
- **⏸ Stop**: Simulation pausieren
- **🔄 Reset**: Neue Balls generieren

## 📊 Statistiken

Die UI zeigt in Echtzeit:
- **FPS**: Frames pro Sekunde
- **Balls**: Anzahl der Balls
- **Generation**: Simulationsschritte
- **Checks**: Anzahl Kollisionsprüfungen
- **Collisions**: Anzahl erkannter Kollisionen
- **Calc Time**: Berechnungszeit pro Frame

## 🏗️ Architektur

```
src/
├── core/               # Kern-Datenstrukturen
│   ├── Ball.ts        # Ball-Klasse (Physik)
│   ├── BallSet.ts     # Ball-Container
│   ├── Parallelogram.ts  # Würfelwände
│   ├── GlobalParams.ts   # Globale Parameter
│   └── Constants.ts   # Konstanten
│
├── simulation/        # Physik-Engine
│   └── PhysicsEngine.ts  # Kollision & Integration
│
├── rendering/         # 3D-Rendering
│   └── SceneManager.ts   # Three.js Scene
│
├── utils/            # Hilfsfunktionen
│   └── BallGenerator.ts  # Ball-Generierung
│
└── main.ts           # Haupt-App
```

## 🔧 Technologie-Stack

- **TypeScript 5.x**: Typsichere Entwicklung
- **Vite 7.x**: Schneller Build-Tool
- **Three.js 0.160+**: 3D-Rendering
- **OrbitControls**: Kamera-Steuerung
- **Vanilla HTML/CSS**: UI (keine Framework-Dependencies)

## 📝 Original-Referenzen

Portiert von:
- `model.cpp/h`: Physik-Algorithmen
- `ui.cpp/h`: UI-Parameter
- `main.cpp`: Haupt-Loop

## 🎨 Features für nächste Phasen

**Phase 2**: React-UI mit Material-UI
**Phase 3**: Grid-Optimierung (O(n) Kollision)
**Phase 4**: Web Worker-Parallelisierung
**Phase 5**: React Native Expo
**Phase 6**: Advanced Features (Stereo, Instancing, etc.)

## 📄 Lizenz

Original PaDIPS © 1993
Web-Port © 2026

## 🐛 Debugging

Öffne Browser-Konsole und nutze:
```javascript
window.padips  // Zugriff auf App-Instanz
```

## 🚧 Bekannte Einschränkungen (MVP)

- Nur Brute-Force-Kollision (O(n²))
- Keine Grid-Optimierung
- Keine Worker-Parallelisierung
- Keine React-UI
- Max. ~50 Balls für 60 FPS

---

**Nächster Schritt**: Phase 2 - React-UI Migration


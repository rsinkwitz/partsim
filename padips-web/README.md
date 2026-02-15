# PaDIPS Web - Phase 1 MVP

**Parallel Dynamic Interactive Particle Simulation** - TypeScript/Three.js Port

> Portierung der originalen PaDIPS-Simulation (1993, Silicon Graphics IRIX) zu modernem Web.

## 🎯 Phase 1 Features

✅ **Kern-Physik**
- 30 Balls bei Start (bis zu 1000 möglich)
- Euler-Integration
- Ball-Ball-Kollision (elastischer Stoß)
- Ball-Wand-Kollision (6 Würfelwände)
- Gravitation (einstellbar)
- **Grid-System**: O(n) Kollisionserkennung (opt-in)
  - **1000 Bälle @ 36 FPS** mit Grid 8×8×8
  - Ohne Grid: <1 FPS bei 1000 Bällen

✅ **3D-Rendering**
- Three.js mit WebGL
- Beleuchtete Kugeln (Phong-Shading)
- Wireframe & Point-Modus
- Transparente Würfelwände mit gelben Kanten
- **3D-Stereo**: Anaglyph (Rot-Blau) & Top-Bottom
- 166 FPS @ 30 Bälle, 36 FPS @ 1000 Bälle (mit Grid)

✅ **Interaktion**
- OrbitControls (Maus-Rotation & Zoom)
- Start/Stop/Reset Buttons
- **Keyboard-Shortcuts**: [S] Start/Stop, [N] New, [J/K] Balls ±50, etc.
- **F1**: Keyboard-Help-Overlay
- Echtzeit-Statistiken

## 🚀 Quick Start

```bash
# Install dependencies
npm install

# Start dev server
npm run dev

# Build for production
npm run build

# Open browser
# http://localhost:5173
```

## 🎮 Steuerung

### Maus
- **Links ziehen**: Kamera rotieren
- **Scroll**: Zoom
- **Rechts ziehen**: Pan

### Buttons
- **▶ Start**: Simulation starten
- **⏸ Stop**: Simulation pausieren (Rendering läuft weiter)
- **🔄 New**: Neue Ball-Konfiguration generieren

### Tastatur
Drücke **[F1]** für vollständige Keyboard-Shortcuts oder siehe [KEYBOARD_SHORTCUTS.md](KEYBOARD_SHORTCUTS.md)

**Wichtigste Shortcuts:**
- **[S]** oder **[Space]** - Start/Stop
- **[N]** - New (Reset)
- **[G]** - Gravity Toggle (Down ↔ Zero)
- **[K]/[J]** - +50/-50 Bälle (vi-style)
- **[3]** - Top-Bottom 3D Stereo
- **[A]** - Anaglyph 3D Stereo
- **[W]** - Wireframe Mode
- **[T]** - Turn Mode (Auto-Rotation)

## 📊 Statistiken

Die UI zeigt in Echtzeit:
- **FPS**: Frames pro Sekunde
- **Balls**: Anzahl der Bälle
- **Generation**: Simulationsschritte
- **Checks**: Anzahl Kollisionsprüfungen (zeigt Grid-Optimierung)
- **Collisions**: Anzahl erkannter Kollisionen
- **Calc Time**: Berechnungszeit pro Frame (ms)

## 🔲 Grid-System (Performance-Feature)

Das optionale Grid-System reduziert die Kollisionserkennung von O(n²) auf O(n):

### Aktivierung
1. **Checkbox** "Fast Grid-based Collision Checking" aktivieren
2. **Grid Segments** wählen (Standard: 8)
3. **⚡ Apply Grid** klicken

### Visualisierungen
- **Show World Grid**: Grüne Linien zeigen Voxel-Struktur
- **Show Occupied Grid Voxels**: Farbige Voxel-Kanten (Ball-Farben)
- **Show Collision Checks**: Weiße Linien zwischen geprüften Ball-Paaren

### Performance
- 10 Bälle: 166 FPS
- 100 Bälle: 60+ FPS
- 400 Bälle: 26 FPS
- **1000 Bälle: 36 FPS** (ohne Grid: <1 FPS!)

Details: [GRID_SYSTEM.md](GRID_SYSTEM.md)

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
│   ├── PhysicsEngine.ts  # Kollision & Integration
│   └── Grid.ts        # Grid-System (O(n) Optimierung)
│
├── rendering/         # 3D-Rendering
│   └── SceneManager.ts   # Three.js Scene & Visualisierung
│
├── utils/            # Hilfsfunktionen
│   └── BallGenerator.ts  # Ball-Generierung
│
└── main.ts           # Haupt-App & UI-Controller
```

## 🔧 Technologie-Stack

- **TypeScript 5.x**: Typsichere Entwicklung
- **Vite 7.x**: Schneller Build-Tool
- **Three.js 0.160+**: 3D-Rendering
- **OrbitControls**: Kamera-Steuerung
- **Vanilla HTML/CSS**: UI (keine Framework-Dependencies)

## 📝 Original-Referenzen

**Original PaDIPS (1993):**
- Plattform: Silicon Graphics IRIX
- Sprache: C++
- Rendering: IRIS-GL
- UI: Sun OpenWindows XView
- Parallelisierung: PVM (Parallel Virtual Machine)

**Dissertation:**
"Interaktive Partikelsimulationen unter Echtzeitbedingungen parallel verteilt auf einem Verbund von Arbeitsplatzrechnern"
/ "Interactive Particle Simulations under Real-Time Conditions Distributed in Parallel on a Network of Workstations"

**Autor:** Rainer Sinkwitz  
**Betreuer:** Prof. Dr. P. Stucki, University of Zurich

**Portiert von:**
- `model.cpp/h`: Physik-Algorithmen & Grid-System
- `grid.cpp/h`: Grid-Optimierung (Voxel-basiert)
- `ui.cpp/h`: UI-Parameter
- `main.cpp`: Haupt-Loop & Rendering

## 🎨 Dokumentation

- **[KEYBOARD_SHORTCUTS.md](KEYBOARD_SHORTCUTS.md)**: Alle Tastatur-Shortcuts
- **[GRID_SYSTEM.md](GRID_SYSTEM.md)**: Grid-System für O(n) Kollisionserkennung
- **[README.md](README.md)**: Dieses Dokument

## 🚧 Roadmap

**Phase 1** ✅ **COMPLETED**
- ✅ Kern-Physik & Rendering
- ✅ Grid-System-Optimierung (O(n) Kollisionserkennung)
- ✅ 3D-Stereo (Anaglyph & Top-Bottom)
- ✅ Keyboard-Shortcuts & F1-Help
- ✅ Web-App mit HTML/CSS UI
- ✅ 1000 Bälle @ 36 FPS Performance

**Phase 2** (Future)
- React Native Expo Integration
- Web Worker-Parallelisierung
- Advanced Features (Texturen, Schatten, etc.)

## 📄 Lizenz

Original PaDIPS © 1993 Rainer Sinkwitz  
Web-Port © 2026

## 🐛 Debugging

Öffne Browser-Konsole für Debug-Ausgaben:
```
🔲 Grid-System-Logs
🎱 Ball-Generation-Logs
⌨️ Keyboard-Shortcut-Logs
🎬 Scene-Initialization-Logs
```

---

**Status**: Phase 1 MVP vollständig implementiert! 🎉


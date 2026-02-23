# PaDIPS - React Native Expo

**Parallel Dynamic Interactive Particle Simulation**

Cross-platform app (iOS, Android, Web) with Three.js WebView/iframe integration.

> Port of the original 1993 IRIX C++ application to modern React Native + Expo.

---

## 🏗️ Architecture: Hybrid WebView + React Native

```
┌─────────────────────────────────────┐
│   React Native App (App.js)        │
│   - UI Controls (future)           │
│   - Platform: iOS, Android, Web    │
└──────────────┬──────────────────────┘
               │ WebView (Mobile)
               │ iframe (Web)
               ↓
┌─────────────────────────────────────┐
│   Three.js Web App (webpack)       │
│   - padips-web/ (Phase 1 ✅)       │
│   - Particle Physics + Grid System │
│   - 1000 balls @ 36 FPS            │
└─────────────────────────────────────┘
```

---

## 🎯 Features

✅ **Kern-Physik**
- 30 Bälle bei Start (bis zu 5000 möglich)
- Euler-Integration
- Ball-Ball-Kollision (elastischer Stoß)
- Ball-Wand-Kollision (6 Würfelwände)
- Gravitation (einstellbar)
- **Grid-System**: O(n) Kollisionserkennung
  - **5000 Bälle @ 24 FPS** auf Mac M3 (4-6cm, Calc-Faktor 1) 🚀
  - **2000 Bälle @ 80 FPS** auf Mac M3 (5-7cm, Calc-Faktor 1, ~26.000 Checks)
  - **100.000 Checks @ 27 FPS** erreicht (höhere Dichte/Calc-Faktor)
  - Ohne Grid: <1 FPS bei 1000 Bällen (499.500 Checks!)
  - **Performance-Grenze**: Jetzt **Grafik-Rendering** statt Kollisionsberechnung
    - Bei SGI (1993): Grafik war Hauptbegrenzung
    - Heute (2026): Grid-System so effizient, dass wieder Grafik limitiert!

✅ **3D-Rendering**
- Three.js mit WebGL
- Beleuchtete Kugeln (Phong-Shading)
- **Silver Material**: Metallic Reflections mit HDR Environment Map (praktisch kein Performance-Overhead!)
- Wireframe & Point-Modus
- Transparente Würfelwände mit gelben Kanten
- **3D-Stereo**: Anaglyph (Rot-Blau), Top-Bottom & **Side-by-Side (VR)**
- **Rendering Performance** (Mac M3):
  - 2000 Bälle gestoppt: ~120 FPS (Lighted & Silver vergleichbar)
  - **5000 Bälle**: 49 FPS gestoppt, **24 FPS mit Simulation** 🎊
  - **Verhältnis**: ~51% Performance für Physik, ~49% für Rendering
- **Grafik-Performance**: Hauptlimitierung bei hohen Ballzahlen

✅ **Cross-Platform**
- **Web**: iframe → webpack-gebaute App
- **iOS/Android**: WebView → assets
- **Single Source**: Eine Three.js Codebase

✅ **Mobile UI** 📱
- **Portrait**: Stats + Square WebView + Scrollable Controls
- **Landscape**: Sidebar (left) + Large WebView (right)
- **VR Cardboard**: Auto-activates with Side-by-Side stereo
  - Fullscreen immersive view
  - Tap indicators (fade after 3s)
  - Overlay menu (semi-transparent)
- **Responsive**: Auto-detects orientation
- **Stereo modes adapt**: Based on orientation (Portrait/Landscape/VR)

---

## 🚀 Quick Start

### Install

```bash
# Root dependencies
npm install

# Web app dependencies
cd padips-web && npm install && cd ..
```

### Build & Run

```bash
# Build Three.js app (webpack)
npm run build

# Run Web (Browser)
npm run web
# → http://localhost:8081

# Run iOS
npm run ios

# Run Android
npm run android

# Start (choose platform)
npm start
```

---

## 🎨 Icon Generation

The app uses a custom icon with a 3D wireframe cube and colorful balls.

### Generate Icons

```bash
# Generate all icon sizes (requires librsvg)
node generate-icon.js
```

**Generates:**
- Android Mipmaps: `mipmap-{m,h,xh,xxh,xxxh}dpi/ic_launcher.png` (48-192px)
- Expo Icons: `assets/{icon,adaptive-icon,favicon}.png`
- Splash Screen: `assets/splash.png`

**Requirements:**
```bash
# Install librsvg (better SVG rendering than ImageMagick)
brew install librsvg
```

**Source:** `assets/icon-source.svg`
- Blue-gray background (#546E7A)
- Green wireframe cube (20px lines)
- Three animated balls (red, blue, yellow)

---

## 📦 Build Pipeline

```bash
# Clean public/ directory
npm run clean

# Build padips-web + deploy
npm run build
```

**What happens:**
1. `padips-web/` builds with webpack → `dist/`
2. Copies to `assets/webapp/` (for Mobile WebView)
3. Copies to `public/cube.html` (for Expo Web iframe)

**Output:**
- `public/cube.html` (16 KB) - webpack-built HTML
- `public/renderer.bundle.js` (2.58 MB) - Three.js + Physics

---

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

Details: [doc/GRID_SYSTEM.md](doc/GRID_SYSTEM.md)

---

## 🏗️ Monorepo Struktur

```
padips/
├── App.js                    # React Native entry point
├── package.json              # Root: Expo + React Native
├── app.json                  # Expo configuration
│
├── padips-web/               # Three.js Web App (webpack)
│   ├── src/
│   │   ├── renderer.ts       # Main TypeScript entry
│   │   ├── core/             # Ball, BallSet, Physics
│   │   ├── simulation/       # PhysicsEngine, Grid
│   │   └── rendering/        # SceneManager (Three.js)
│   ├── index.html            # HTML with UI controls
│   ├── webpack.config.js     # Build configuration
│   ├── package.json          # Dependencies: three, typescript
│   └── dist/                 # Build output (gitignored)
│       ├── index.html
│       └── renderer.bundle.js (2.58 MB)
│
├── assets/webapp/            # Deployed for Mobile WebView
│   ├── index.html
│   ├── renderer.bundle.js
│   └── renderer.bundle.js.txt  # Metro bundler workaround
│
├── public/                   # Deployed for Expo Web (gitignored)
│   ├── cube.html             # Webpack-built app
│   └── renderer.bundle.js
│
├── scripts/
│   └── build-and-deploy.sh   # Build pipeline
│
└── doc/                      # Documentation
    ├── GRID_SYSTEM.md
    ├── KEYBOARD_SHORTCUTS.md
    └── IMPLEMENTATION.md
```

---

## 🔧 Technologie-Stack

### Root (React Native + Expo)
- **Expo 54**: Cross-platform framework
- **React Native 0.81**: Mobile UI
- **react-native-webview**: WebView for iOS/Android
- **react-native-web**: Web support

### padips-web/ (Three.js App)
- **TypeScript 5.x**: Type-safe development
- **Webpack 5**: Module bundler
- **Three.js 0.164**: 3D rendering
- **OrbitControls**: Camera manipulation

---

## 📝 Scripts Reference

| Command | Description |
|---------|-------------|
| `npm run clean` | Delete `public/` directory |
| `npm run build` | Build padips-web + deploy to assets & public |
| `npm run web` | Build + start Expo Web |
| `npm start` | Start Expo (choose platform) |
| `npm run ios` | Build + run on iOS simulator |
| `npm run android` | Build + run on Android emulator |

---

## 🐛 Troubleshooting

### "Cannot find renderer.bundle.js"

```bash
npm run build
```

### "public/ is missing"

```bash
npm run build
```

This creates:
- `public/cube.html`
- `public/renderer.bundle.js`

### Metro bundler errors on mobile

Ensure `.txt` file exists:

```bash
ls -la assets/webapp/
# Should show: renderer.bundle.js.txt
```

---

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

---

## 📚 Dokumentation

- **[doc/KEYBOARD_SHORTCUTS.md](doc/KEYBOARD_SHORTCUTS.md)**: Alle Tastatur-Shortcuts
- **[doc/GRID_SYSTEM.md](doc/GRID_SYSTEM.md)**: Grid-System für O(n) Kollisionserkennung
- **[doc/IMPLEMENTATION.md](doc/IMPLEMENTATION.md)**: Technische Details
- **[PORTING_SPECIFICATION.md](PORTING_SPECIFICATION.md)**: Original → Modern Port

---

## 🎯 Roadmap

### Phase 1 ✅ (Completed)
- ✅ Three.js Web App (padips-web/)
- ✅ Grid-System optimization (O(n) collision)
- ✅ 3D Stereo (Anaglyph, Top-Bottom)
- ✅ Keyboard shortcuts & F1 help
- ✅ 1000 balls @ 36 FPS performance

### Phase 2A ✅ (Completed)
- ✅ React Native + Expo setup
- ✅ Webpack build pipeline
- ✅ WebView/iframe integration
- ✅ **Web platform working**
- ✅ Single source (monorepo)

### Phase 2B (Current - Testing)
- [ ] Test on iOS simulator
- [ ] Test on Android emulator
- [ ] Fix mobile-specific issues

### Phase 2C (Future)
- [ ] UI Migration: HTML → React Native components
- [ ] PostMessage: RN ↔ WebView communication
- [ ] Native controls (buttons, sliders)
- [ ] Cardboard VR support (WebXR)

---

## 📄 Lizenz

Original PaDIPS © 1993 Rainer Sinkwitz  
Modern Port © 2026

---

## 🐛 Debugging

### Browser Console (Web)

```
🔲 Grid-System-Logs
🎱 Ball-Generation-Logs
⌨️ Keyboard-Shortcut-Logs
🎬 Scene-Initialization-Logs
```

### React Native (Mobile)

```bash
# View logs
npx expo start
# Press 'j' to open debugger
```

---

**Status:** Phase 2A complete - Web working! Ready for mobile testing. 🚀


# PaDIPS UI Controls - Complete Hierarchical Overview

**Date:** February 21, 2026  
**Purpose:** Comprehensive listing of all UI controls across all platforms/modes for harmonization

---

## 1. WEB UI (Desktop Browser - iframe sidebar)

### 1.1 Main Controls (Top)
- **▶ Start** (Button, disabled when running)
- **⏸ Stop** (Button, disabled when stopped)
- **✨ New** (Button, always enabled)

### 1.2 Stats Section
- **FPS** (Display only)
- **Balls** (Display only)
- **Gen** (Display only)
- **Checks** (Display only)

### 1.3 Balls Section
Header: "🎱 Balls - click 'New' to apply"
- **Number of Balls** (Slider: 5-1000, step 5)
- **Min Radius** (Slider: 2-30 cm, step 1)
- **Max Radius** (Slider: 2-30 cm, step 1)
- **Max Velocity** (Slider: 0.5-10.0 m/s, step 0.5)
- **Elasticity** (Slider: 0-100, step 5)

### 1.4 Simulation Section
Header: "⚙️ Simulation"
- **Calc Factor** (Slider: 1-50, step 1)
- **Collisions Enabled** (Toggle/Switch)
- **Show Collision Checks** (Toggle/Switch)

### 1.5 Grid System Section
Header: "🔲 Grid System"
- **Grid-based Collision** (Toggle/Switch)
- **Grid Segments** (Slider: 2-25, step 1) - only when Grid enabled
- **Show World Grid** (Toggle/Switch) - only when Grid enabled
- **Show Occupied Voxels** (Toggle/Switch) - only when Grid enabled

### 1.6 Physics Section
Header: "🌍 Physics"
- **Gravity Preset** (Dropdown: ZERO, DOWN, UP, LEFT, RIGHT, FRONT, REAR)
- **Gravity Magnitude** (Slider: 0-20 m/s², step 0.5)
- **Global Elasticity** (Slider: 0-100, step 5)

### 1.7 Rendering Section
Header: "🎨 Rendering"
- **Draw Mode** (Dropdown: LIGHTED, WIREFRAME, POINTS, SILVER)
- **Wireframe Density** (Slider: 4-32, step 2)

### 1.8 3D Stereo Section
Header: "🕶️ 3D Stereo"
- **Stereo Mode** (Radio buttons: Off, Anaglyph, Top-Bottom)
- **Eye Separation** (Slider: 2-20 cm, step 0.2)
- **Cube Depth** (Slider: -20 to +20, step 1, with center marker at 0)
- **Turn Speed** (Slider: 0-4, step 1)

### 1.9 Keyboard Shortcuts Section
Header: "⌨️ Shortcuts"
- Info text: "Press [F1] for full help"

---

## 2. MOBILE UI - Portrait Mode

### 2.1 Stats Panel (Top, 2x2 Grid)
- **FPS** (Display)
- **Balls** (Display)
- **Gen** (Display)
- **Checks** (Display)

### 2.2 Main Controls (Below Stats)
- **▶** (Play button icon only, dimmed when running)
- **⏸** (Pause button icon only, dimmed when stopped)
- **✨ New** (Button with text)
- **🔄** (Reset button icon only)

### 2.3 WebView Container
- Square, centered display area

### 2.4 Scrollable Controls Panel (Below WebView)
Uses ControlsPanel.js component:

#### 2.4.1 Balls Section
Header: "🎱 Balls - click 'New' to apply"
- **Number of Balls** (Slider: 5-1000, step 5)
- **Min Radius** (Slider: 2-30 cm, step 1)
- **Max Radius** (Slider: 2-30 cm, step 1)

#### 2.4.2 Physics Section
Header: "⚙️ Physics"
- **Collisions Enabled** (Toggle)
- **Gravity** (Radio: Zero, Down)

#### 2.4.3 Simulation Section
Header: "🔬 Simulation"
- **Calc Factor** (Slider: 1-20, step 1)
- **Show Collision Checks** (Toggle)

#### 2.4.4 Grid System Section
Header: "🔲 Grid System"
- **Fast Grid Collision** (Toggle)
- **Grid Segments** (Slider: 2-25, step 1) - only when enabled
- **Show World Grid** (Toggle) - only when enabled
- **Show Occupied Voxels** (Toggle) - only when enabled

#### 2.4.5 Rendering Section
Header: "🎨 Rendering"
- **Draw Mode** (Radio: Lighted, Wireframe, Points, Silver)
- **Wireframe Segments** (Slider: 4-32, step 2) - only when Wireframe mode

#### 2.4.6 3D Stereo Section
Header: "🕶️ 3D Stereo"
- **Stereo Mode** (Radio: Off, Anaglyph)
  - Note: Side-by-Side NOT shown in Portrait
- **Eye Separation** (Slider: 4-12 cm, step 0.1) - only when stereo active
- **Cube Depth** (Slider: -2 to +2 m, step 0.1) - only when stereo active
- **Turn Speed** (Slider: 0-4, step 1) - always visible

#### 2.4.7 Keyboard Shortcuts Section
Header: "⌨️ Shortcuts"
- Info text: "Desktop only - Press [F1] for full help"

---

## 3. MOBILE UI - Landscape Mode

### 3.1 Sidebar (Left, 30% width)

#### 3.1.1 Stats Panel (2x2 Grid)
- **FPS** (Display)
- **Balls** (Display)
- **Gen** (Display)
- **Checks** (Display)

#### 3.1.2 Main Controls
- **▶** (Play icon, dimmed when running)
- **⏸** (Pause icon, dimmed when stopped)
- **✨ New** (with text)
- **🔄** (Reset icon)

#### 3.1.3 Scrollable Controls
Uses same ControlsPanel.js as Portrait, BUT:
- **Stereo Mode** includes: Off, Anaglyph, **Side-by-Side (VR)**
  - Side-by-Side activates VR mode automatically

### 3.2 WebView (Right, 70% width)
- Full height display area

---

## 4. MOBILE UI - VR Mode (Cardboard)

### 4.1 Fullscreen WebView
- Side-by-side stereo rendering
- Takes entire screen

### 4.2 VR Tap Indicators (Initial, fades after 3s)
- **Left indicator**: "👆 Tap for menu"
- **Right indicator**: "👆 Tap for menu"

### 4.3 Hidden Tap Zones (Always active when menu closed)
- Left tap zone
- Right tap zone

### 4.4 VR Menu Overlay (Left 50% of screen)

#### 4.4.1 Stats Panel (2x2 Grid)
- **FPS** (Display)
- **Balls** (Display)
- **Gen** (Display)
- **Checks** (Display)

#### 4.4.2 Main Controls
- **▶** (Play, dimmed when running)
- **⏸** (Pause, dimmed when stopped)
- **✨ New**
- **🔄** (Reset)

#### 4.4.3 Compact Toggle Controls (2-column layout)

**Row 1:**
- **✨ Silver** (Toggle: SILVER/LIGHTED mode)
- **🌍 Gravity** (Toggle: DOWN/ZERO)

**Row 2:**
- **🔲 Grid** (Toggle: on/off)
- **🔍 Checks** (Toggle: Show Collision Checks)

**Row 3:**
- **📦 Voxels** (Toggle: Show Occupied Voxels)
- (empty)

#### 4.4.4 Ball Count Controls
- **Label**: "🎱 Balls: {count}"
- **-50** (Button)
- **+50** (Button)

#### 4.4.5 Eye Separation Slider
- **Label**: "👁️ Eye Sep: {value} cm"
- **Slider**: 5-15 cm, step 0.2

#### 4.4.6 Turn Speed Slider
- **Label**: "🔄 Turn: OFF / {speed}x"
- **Slider**: 0-4, step 1

#### 4.4.7 Menu Buttons
- **✖ Close** (Close menu, stay in VR)
- **🔙 Exit VR** (Exit VR mode completely)

---

## 5. KEYBOARD SHORTCUTS (All Platforms)

Displayed in F1 help panel:

### 5.1 Simulation Control
- **s** - Start/Stop toggle
- **n** - New (regenerate balls)
- **Space** - Start/Stop toggle

### 5.2 3D Stereo
- **3** - Toggle Top-Bottom stereo
- **a** - Toggle Anaglyph stereo
- **4** - Toggle Side-by-Side stereo (Left/Right)

### 5.3 Rendering
- **w** - Toggle Wireframe (repeat: back to shaded)
- **p** - Toggle Points/Pixels (repeat: back to shaded)
- **s** (with stereo active) - Toggle LIGHTED/SILVER

### 5.4 Rotation
- **t** - Cycle turn speed (0→1→2→3→4→0)

### 5.5 Ball Count
- **+** or **j** - Add 50 balls
- **-** or **k** - Remove 50 balls
- **Shift + +/-** - Change wireframe density

### 5.6 Physics
- **g** - Toggle gravity (ZERO ↔ DOWN)

### 5.7 Camera
- **Ctrl + +** - Increase cube depth (move away)
- **Ctrl + -** - Decrease cube depth (move closer)

### 5.8 Help
- **F1** - Toggle keyboard shortcuts help

---

## 6. DIFFERENCES SUMMARY

### 6.1 Controls ONLY in Web UI
- Max Velocity slider
- Ball Elasticity slider
- Full Gravity direction selection (7 options)
- Gravity Magnitude slider
- Global Elasticity slider
- Wireframe Density slider (on Web it's always visible)

### 6.2 Controls ONLY in Mobile Portrait/Landscape
- Reset button (🔄)
- Simplified Gravity (only Zero/Down)
- Wireframe Segments only shown when Wireframe mode active

### 6.3 Controls ONLY in VR Mode
- Silver toggle (quick switch LIGHTED/SILVER)
- Gravity toggle (quick switch ZERO/DOWN)
- Grid toggle (quick on/off)
- Voxels toggle (direct access)
- Ball count ±50 buttons
- Exit VR button

### 6.4 Settings NOT in VR Mode
- Ball generation parameters (count, min/max radius)
- Calc Factor
- Grid Segments adjustment
- Draw mode selection (locked to toggle)
- Wireframe settings
- Detailed physics settings

---

## 7. PARAMETER RANGES COMPARISON

| Parameter | Web | Mobile | VR | Notes |
|-----------|-----|--------|-----|-------|
| Number of Balls | 5-1000 | 5-1000 | ±50 buttons | Max 1000 everywhere |
| Min Radius | 2-30 cm | 2-30 cm | - | Not in VR |
| Max Radius | 2-30 cm | 2-30 cm | - | Not in VR |
| Calc Factor | 1-50 | 1-20 | - | Different max! |
| Grid Segments | 2-25 | 2-25 | - | Same |
| Wireframe Segments/Density | 4-32 | 4-32 | - | Same |
| Eye Separation | 2-20 cm | 4-12 cm | 5-15 cm | Different ranges! |
| Cube Depth | -20 to +20 | -2 to +2 m | - | Different scales! |
| Turn Speed | 0-4 | 0-4 | 0-4 | Same |

---

## 8. HARMONIZATION OPPORTUNITIES

### 8.1 Critical Inconsistencies
1. **Calc Factor max**: Web has 50, Mobile has 20
2. **Eye Separation range**: Varies across platforms
3. **Cube Depth range/scale**: Different units and ranges
4. **Gravity options**: Web has 7, Mobile has 2
5. **Reset button**: Missing in Web UI

### 8.2 Missing Features
- **Web**: No Reset button
- **Mobile**: No Max Velocity, Ball Elasticity, Gravity Magnitude, Global Elasticity
- **VR**: No fine-tuning of ball generation, calc factor, grid segments

### 8.3 Recommended Standardization
1. Unified parameter ranges across all platforms
2. Common subset of physics controls everywhere
3. VR quick-access for most-used settings
4. Consistent terminology (Segments vs Density)
5. Same gravity presets everywhere (or at least ZERO/DOWN/UP/LEFT/RIGHT/FRONT/REAR)

---

## 9. CONTROL ORGANIZATION PATTERNS

### Web UI Pattern
- Grouped by function (Balls, Simulation, Grid, Physics, Rendering, Stereo)
- All controls always visible (scroll)
- Heavy use of sliders
- Dropdowns for mode selection

### Mobile Portrait/Landscape Pattern
- Stats at top
- Action buttons below stats
- WebView in middle
- Scrollable detailed controls below
- Radio buttons instead of dropdowns
- Conditional visibility (Grid options, Wireframe segments, Stereo options)

### VR Pattern
- Minimal UI
- 2-column toggle layout
- Quick-access only
- Buttons for ball count (no slider)
- Only essential sliders (Eye Sep, Turn)
- No ball generation parameters


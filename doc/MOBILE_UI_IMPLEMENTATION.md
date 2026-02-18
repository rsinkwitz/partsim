# Mobile UI Implementation

**Date:** February 17, 2026  
**Status:** ✅ Implemented

## Overview

PaDIPS now has a fully responsive mobile UI with three distinct layouts:
- **Portrait Mode** - Stats + Square WebView + Scrollable Controls
- **Landscape Mode** - Sidebar (left) + Large WebView (right)
- **VR Cardboard Mode** - Fullscreen Side-by-Side Stereo with Overlay Menu

## Architecture

### New Components

#### 1. **MobileUI.js**
Reusable UI components for mobile:
- `StatsPanel` - 2x2 grid showing FPS, Balls, Generation, Checks
- `MainControls` - Start/Stop/New buttons with state-aware styling
- `VRIndicators` - Semi-transparent tap indicators (fade after 3s)
- `VRMenuOverlay` - Semi-transparent menu overlay (left half only)

#### 2. **ControlsPanel.js**
Complete scrollable controls panel with all simulation parameters:
- Ball parameters (count, min/max radius)
- Physics (gravity, collisions)
- Simulation (calc factor, collision checks)
- Grid system (toggle, segments, visualizations)
- Rendering (draw mode, wireframe segments)
- 3D Stereo (mode selection, eye separation, cube depth)

**Responsive Features:**
- Hides Top/Bottom stereo in Portrait mode
- Shows Side-by-Side stereo only in Landscape mode
- All controls send updates directly to WebView via `sendToWebView()`

### Layout Modes

#### Portrait Mode
```
┌─────────────────────┐
│  📊 Stats (2x2)     │ ← Compact header
├─────────────────────┤
│ ▶ Start ⏸ Stop ✨New│ ← Sticky controls
├─────────────────────┤
│                     │
│   ┌─────────────┐   │
│   │   WebView   │   │ ← Square, centered
│   │   (Cube)    │   │   aspect ratio 1:1
│   └─────────────┘   │   max 500px width
│                     │
├─────────────────────┤
│  [Full Controls]    │ ← Scrollable panel
│  🎱 Balls           │
│  ⚙️ Physics         │
│  🔬 Simulation      │
│  🔲 Grid            │
│  🎨 Rendering       │
│  🕶️ 3D Stereo      │
│     ⋮               │
└─────────────────────┘
```

**Characteristics:**
- Stats at top (always visible)
- Main controls sticky below stats
- WebView square and centered (optimal for cube visualization)
- Full controls scrollable below
- **Stereo modes:** Off, Anaglyph only (no Top/Bottom, no Side-by-Side)

#### Landscape Mode
```
┌──────────┬──────────────────────────┐
│📊 Stats  │                          │
├──────────┤      WebView             │
│▶ ⏸ ✨   │      (Cube)              │
├──────────┤                          │
│          │                          │
│  Full    │                          │
│Controls  │                          │
│(scroll)  │                          │
│    ⋮     │                          │
└──────────┴──────────────────────────┘
    280px        Rest of screen
```

**Characteristics:**
- Sidebar on left (280px width)
- WebView fills remaining space
- UI naturally readable (no rotation needed - system handles it)
- **Stereo modes:** Off, Anaglyph, Top/Bottom, **Side-by-Side (activates VR)**

#### VR Cardboard Mode
**Activation:** Automatic when Side-by-Side stereo + Landscape orientation

**Initial View (3 seconds):**
```
┌────────────────────────────────────┐
│  [L Eye]      │      [R Eye]       │
│               │                    │
│    Cube       │       Cube         │
│   (stereo)    │     (stereo)       │
│               │                    │
│  👆           │                 👆 │
└────────────────────────────────────┘
    "Tap for menu" (fades after 3s)
```

**Menu Active:**
```
┌────────────────────────────────────┐
│╔══════════╗  │      [R Eye]       │
│║ Stats    ║  │                    │
│║ Controls ║  │       Cube         │
│║ ▶ ⏸ ✨  ║  │     (stereo)       │
│║          ║  │                    │
│║ ✖ Close  ║  │                    │
│╚══════════╝  │                    │
└────────────────────────────────────┘
     Left eye only (semi-transparent)
```

**Characteristics:**
- Fullscreen Side-by-Side rendering
- Small tap indicators (bottom left/right corners)
- Indicators fade after 3 seconds
- Tap opens overlay menu (left half only, semi-transparent)
- Right eye stays clear for 3D immersion
- **Stereo mode:** Side-by-Side only (Anaglyph disabled)

## Stereo Mode Matrix

| Mode | Portrait | Landscape | Landscape + SBS |
|------|----------|-----------|-----------------|
| Off | ✅ | ✅ | ✅ |
| Anaglyph | ✅ | ✅ | ❌ (VR active) |
| Top/Bottom | ❌ | ✅ | ❌ (VR active) |
| Side-by-Side | ❌ | ✅ → VR | ✅ (VR mode) |

## New Stereo Mode: Side-by-Side

### Implementation

**Constants.ts:**
```typescript
export enum StereoMode {
  OFF = 'off',
  ANAGLYPH = 'anaglyph',
  TOP_BOTTOM = 'topbottom',
  SIDE_BY_SIDE = 'sidebyside',  // NEW
}
```

**SceneManager.ts - render():**
```typescript
} else if (this.stereoMode === StereoMode.SIDE_BY_SIDE && this.stereoCamera) {
  // Update StereoCamera
  this.stereoCamera.update(this.camera);

  const width = window.innerWidth;
  const height = window.innerHeight;
  const halfWidth = width / 2;

  // Left eye (left half)
  this.renderer.setViewport(0, 0, halfWidth, height);
  this.renderer.setScissor(0, 0, halfWidth, height);
  this.renderer.setScissorTest(true);
  this.renderer.render(this.scene, this.stereoCamera.cameraL);

  // Right eye (right half)
  this.renderer.setViewport(halfWidth, 0, halfWidth, height);
  this.renderer.setScissor(halfWidth, 0, halfWidth, height);
  this.renderer.render(this.scene, this.stereoCamera.cameraR);

  // Reset
  this.renderer.setScissorTest(false);
  this.renderer.setViewport(0, 0, width, height);
}
```

## State Management

### Orientation Detection
```javascript
useEffect(() => {
  if (Platform.OS !== "web") {
    const updateOrientation = () => {
      const { width, height } = Dimensions.get('window');
      const portrait = height > width;
      setIsPortrait(portrait);
    };

    updateOrientation();
    const subscription = Dimensions.addEventListener('change', updateOrientation);
    return () => subscription?.remove();
  }
}, []);
```

### Auto VR Mode Activation
```javascript
useEffect(() => {
  if (Platform.OS !== "web") {
    const shouldBeVR = stereoMode === 'sidebyside' && !isPortrait;
    if (shouldBeVR !== isVRMode) {
      setIsVRMode(shouldBeVR);
      if (shouldBeVR) {
        setShowVRIndicators(true);
        setTimeout(() => setShowVRIndicators(false), 3000);
      }
    }
  }
}, [stereoMode, isPortrait]);
```

## Styles

### Key Style Definitions

**Portrait:**
```javascript
webViewContainerPortrait: {
  aspectRatio: 1,      // Square
  width: '100%',
  maxWidth: 500,       // Max size for tablets
  alignSelf: 'center',
  backgroundColor: '#000',
}
```

**Landscape:**
```javascript
containerLandscape: {
  flex: 1,
  flexDirection: 'row',
  backgroundColor: '#fff',
}
sidebarLandscape: {
  width: 280,
  borderRightWidth: 1,
  borderRightColor: '#ddd',
  backgroundColor: '#f9f9f9',
}
```

**VR:**
```javascript
vrContainer: {
  flex: 1,
  backgroundColor: '#000',
}
vrWebView: {
  flex: 1,
}
```

## User Experience

### Portrait
✅ Optimized for one-handed use  
✅ Square WebView preserves cube proportions  
✅ Full controls accessible via scrolling  
✅ Stats always visible at top  

### Landscape
✅ Desktop-like layout  
✅ Maximum screen real estate for 3D view  
✅ All controls accessible in sidebar  
✅ Natural orientation (no manual rotation needed)  

### VR Cardboard
✅ Fullscreen immersive experience  
✅ Non-intrusive tap indicators  
✅ Quick access to controls via overlay  
✅ Right eye stays clear for 3D depth  
✅ Auto-activates when Side-by-Side + Landscape  

## Testing Checklist

- [ ] Web: All layouts work as before
- [ ] Portrait: Stats visible, WebView square, controls scrollable
- [ ] Landscape: Sidebar + WebView layout
- [ ] Orientation change: Smooth transition between layouts
- [ ] Side-by-Side stereo: Activates VR mode in landscape
- [ ] VR indicators: Show for 3s, fade out
- [ ] VR menu: Opens on tap, closes properly
- [ ] All controls: Send updates to WebView correctly
- [ ] Stereo modes: Available based on orientation
- [ ] Safe areas: Respect notches/home indicators

## Known Limitations

1. **No UI rotation:** System handles orientation, not manual CSS rotation
2. **VR keyboard shortcuts:** Not available in fullscreen VR mode
3. **Side-by-Side in portrait:** Disabled (would make each eye too narrow)
4. **Top/Bottom in portrait:** Disabled (would make each eye too short)

## Future Enhancements

- [ ] Gyroscope support for VR head tracking
- [ ] Gaze-based menu activation
- [ ] Voice control for VR mode
- [ ] Preset save/load
- [ ] Gesture controls (pinch zoom, rotate)

## Files Modified

### New Files
- `MobileUI.js` - Mobile-specific UI components
- `ControlsPanel.js` - Complete scrollable controls panel
- `doc/MOBILE_UI_IMPLEMENTATION.md` - This file

### Modified Files
- `App.js` - Complete mobile layout system
- `padips-web/src/core/Constants.ts` - Added SIDE_BY_SIDE mode
- `padips-web/src/rendering/SceneManager.ts` - Side-by-Side rendering

## Build & Deploy

```bash
# Build WebApp with new stereo mode
npm run build

# Start Web version
npm run web

# Start Android
npm run android

# Start iOS
npm run ios
```

---

**Implementation Complete! 🎉**
Mobile UI supports Portrait, Landscape, and VR Cardboard modes with automatic layout switching and VR activation.


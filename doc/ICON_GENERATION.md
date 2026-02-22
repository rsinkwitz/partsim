# Icon Generation Guide

## Overview

PaDIPS uses a custom SVG icon that is converted to multiple PNG sizes for different platforms.

**Icon Design:**
- Blue-gray background (#546E7A)
- Green wireframe 3D cube (isometric view)
- Three colorful balls (red, blue, yellow) with highlights
- Clean, modern look suitable for all screen sizes

---

## Quick Start

```bash
# Generate all icon sizes
node generate-icon.js
```

This creates:
- **Android Mipmaps**: 5 sizes (48px to 192px)
- **Expo Icons**: icon.png (1024px), adaptive-icon.png (1024px), favicon.png (48px)
- **Splash Screen**: splash.png (1284x2778)

---

## Requirements

### librsvg (Required)

```bash
# Install on macOS
brew install librsvg

# Verify installation
which rsvg-convert
# Should output: /opt/homebrew/bin/rsvg-convert
```

**Why librsvg?**
- Superior SVG rendering compared to ImageMagick
- Preserves fine details (thin lines, overlapping elements)
- Accurate color and size rendering

---

## Generated Files

### Android Icons
```
android/app/src/main/res/
├── mipmap-mdpi/
│   ├── ic_launcher.png (48x48)
│   └── ic_launcher_round.png (48x48)
├── mipmap-hdpi/
│   ├── ic_launcher.png (72x72)
│   └── ic_launcher_round.png (72x72)
├── mipmap-xhdpi/
│   ├── ic_launcher.png (96x96)
│   └── ic_launcher_round.png (96x96)
├── mipmap-xxhdpi/
│   ├── ic_launcher.png (144x144)
│   └── ic_launcher_round.png (144x144)
└── mipmap-xxxhdpi/
    ├── ic_launcher.png (192x192)
    └── ic_launcher_round.png (192x192)
```

### Expo/Web Icons
```
assets/
├── icon.png (1024x1024) - Main app icon
├── adaptive-icon.png (1024x1024) - Android adaptive icon
├── favicon.png (48x48) - Web favicon
└── splash.png (1284x2778) - Splash screen
```

---

## Manual Icon Editing

### Source File
```
assets/icon-source.svg
```

**Edit with:**
- Any SVG editor (Figma, Inkscape, Adobe Illustrator)
- Or text editor (it's XML)

**After editing:**
```bash
node generate-icon.js  # Regenerate all sizes
npm run bundle        # Update assets
```

---

## Technical Details

### SVG Structure
```svg
<svg width="1024" height="1024">
  <rect fill="#546E7A"/>  <!-- Background -->
  <g stroke="#66FF66" stroke-width="20">  <!-- Cube -->
    <rect .../> <rect .../> <line .../>
  </g>
  <circle fill="#FF5252" r="126"/>  <!-- Red ball -->
  <circle fill="#2196F3" r="160"/>  <!-- Blue ball -->
  <circle fill="#FFC107" r="155"/>  <!-- Yellow ball -->
</svg>
```

### Conversion Command
```bash
rsvg-convert -w SIZE -h SIZE "assets/icon-source.svg" -o "output.png"
```

### Key Settings
- **Line width**: 20px (visible even at 48px)
- **Ball sizes**: 126px (red), 160px (blue), 155px (yellow)
- **Color**: Bright green (#66FF66) for visibility

---

## Troubleshooting

### Icons not showing after build

**Cause:** Android caches icons aggressively

**Solution:**
```bash
# Uninstall old app
adb uninstall com.rsinkwitz.padips

# Rebuild and reinstall
npm run bundle
cd android && ./gradlew assembleRelease
adb install app/build/outputs/apk/release/padips-release.apk
```

### Green lines not visible in PNG

**Cause:** Lines too thin or ImageMagick being used

**Solution:**
1. Check line width in SVG (should be 20px)
2. Verify librsvg is installed: `which rsvg-convert`
3. Regenerate: `node generate-icon.js`

### Colors look different

**Cause:** Color profile or rendering issues

**Solution:**
1. Check hex colors in `assets/icon-source.svg`
2. Use `rsvg-convert` instead of other tools
3. Verify generated PNGs in Finder/Preview

---

## Integration

### Android

Icons referenced in:
```xml
<!-- AndroidManifest.xml -->
<application 
  android:icon="@mipmap/ic_launcher"
  android:roundIcon="@mipmap/ic_launcher_round"
  .../>
```

### iOS

Icons configured in:
```json
// app.json
{
  "expo": {
    "icon": "./assets/icon.png",
    "ios": {
      "icon": "./assets/icon.png"
    }
  }
}
```

### Web

Favicon added in:
```html
<!-- index.html -->
<link rel="icon" type="image/png" href="/assets/favicon.png" />
```

---

## Color Palette

```
Background:    #546E7A (Blue-gray)
Cube:          #66FF66 (Bright green)
Ball 1 (Red):  #FF5252
Ball 2 (Blue): #2196F3
Ball 3 (Yellow): #FFC107
Highlights:    #FF8A80, #64B5F6, #FFD54F
```

---

## Build Integration

Icons are automatically included in:
```bash
npm run bundle  # Copies icons to assets/webapp/
npm run build   # Includes in final build
```

**Note:** After regenerating icons, always run:
```bash
npm run bundle
cd android && ./gradlew assembleRelease
```

---

## Author

Rainer Sinkwitz  
Part of Ph.D. work (1993): "Interaktive Partikelsimulationen unter Echtzeitbedingungen parallel verteilt auf einem Verbund von Arbeitsplatzrechnern"  
University of Zurich, Prof. Dr. P. Stucki

Modern port: 2026


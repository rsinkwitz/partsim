# Keyboard Shortcuts

PaDIPS supports the following keyboard shortcuts for quick access to features:

## Simulation Control
- **[S]** or **[Space]** - Start/Stop simulation (toggle)
- **[N]** - New simulation (reset with current parameters)
- **[G]** - Toggle Gravity between Down and Zero

## 3D Stereo Modes
- **[3]** - Toggle Top-Bottom 3D stereo mode (repeat to turn off)
  - For projectors with active shutter glasses
  - UI automatically restricted to top half of screen
- **[A]** - Toggle Anaglyph stereo mode (repeat to turn off)
  - For red-blue anaglyph glasses

## Camera & View
- **[T]** - Toggle Turn mode (auto-rotation about vertical axis)
  - Gentle counter-clockwise rotation as seen from top
  - Continues even when simulation is paused

## Rendering Modes
- **[W]** - Toggle Wireframe mode (repeat to return to shaded)
- **[P]** - Toggle Points/Pixels mode (repeat to return to shaded)
- **[Shift] + [+/-]** or **[Shift] + [K/J]** - Increase/Decrease wireframe density (4-32 segments)
  - Works with main keyboard, numpad, and vi-style keys

## Ball Count
- **[+] / [-]** - Add / Remove 50 balls (max 1000, min 5)
  - Main keyboard: Layout-aware (DE: `+` key, US: `=` key)
  - Numpad: Always works
- **[K] / [J]** - Vi-style shortcuts (K = more/up, J = less/down)
  - Always available regardless of keyboard layout
  - Changes are applied immediately with automatic reset

## 3D Depth Control
- **[Ctrl] + [+/-]** - Increase/Decrease cube depth
  - Move scene away (push into screen) or closer (pop out of screen)
  - Works with main keyboard AND numpad
  - Useful for adjusting 3D stereo effect depth

## Help
- **[F1]** - Toggle keyboard help overlay on/off

## Mouse Controls
- **Left-drag** - Rotate view (OrbitControls)
- **Scroll wheel** - Zoom in/out
- **Right-drag** - Pan camera

## Notes
- Keyboard shortcuts are disabled when typing in input fields
- All shortcuts work regardless of simulation state (running/stopped)
- Visual changes (wireframe, stereo mode) can be changed while simulation is paused
- Wireframe density changes are immediately visible in wireframe mode
- Gravity toggle switches between "Down" preset and "Zero" with current magnitude

## Keyboard Layout Support

### Hybrid Approach (Best of Both Worlds!)
PaDIPS uses a **hybrid approach** to support different keyboard layouts:

1. **Main Keyboard +/- Keys**: Uses `e.key` (layout-aware)
   - **German (DE)**: `+` key produces `+` character
   - **US/UK (EN)**: `=` key produces `=` character (Shift gives `+`)
   - **French (FR)**: Different layout, but character is recognized
   - Browser handles the translation automatically!

2. **Numpad +/- Keys**: Uses `e.code` (position-based)
   - Always works the same on all keyboards
   - Physical key position, not character

3. **Vi-Style J/K Keys**: Uses `e.key` (universal)
   - `J` and `K` are the same on all Latin keyboards
   - Perfect fallback for any layout!

### Why This Works
This is the **same approach modern browsers use for Ctrl-+/- zoom**:
- They check `e.key` to see what character the keyboard produces
- Layout-aware, works automatically on any keyboard
- No need to detect keyboard layout manually!

### Recommendation
- **If +/- works on your keyboard**: Great! Use them naturally
- **If +/- doesn't work or feels awkward**: Use **J/K** (vi-style)
- **Numpad users**: Always works perfectly!

All three methods work simultaneously, pick what feels natural! 🎮


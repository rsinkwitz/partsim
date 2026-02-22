# Harmonized Value Ranges - Implementation Guide

## Changes to Apply

### 1. Eye Separation
**OLD (inconsistent):**
- Web: 2-20 cm
- Mobile: 4-12 cm  
- VR: 5-15 cm

**NEW (harmonized):**
- **ALL platforms: 5-15 cm, step 0.2**

**Files to update:**
- `App.js` - Web UI slider
- `ControlsPanel.js` - Mobile UI slider
- `UnifiedUI.js` - Already set to 5-15

### 2. Cube Depth
**OLD (inconsistent):**
- Web: -20 to +20 (then *0.1 = -2 to +2m)
- Mobile: -2 to +2 m directly

**NEW (harmonized):**
- **ALL platforms: -2 to +2 m, step 0.1**

**Files to update:**
- `App.js` - Web UI slider (remove *0.1 scaling)
- `ControlsPanel.js` - Mobile UI slider
- `UnifiedUI.js` - Already set to -2 to +2

### 3. Calc Factor
**OLD (inconsistent):**
- Web: 1-50
- Mobile: 1-20

**NEW (harmonized):**
- **ALL platforms: 1-20, step 1**

**Files to update:**
- `App.js` - Web UI slider
- `ControlsPanel.js` - Mobile UI slider (already correct)
- `UnifiedUI.js` - Already set to 1-20

---

## Implementation Checklist

- [x] UnifiedUI.js - Already correct
- [ ] App.js - Web UI
  - [ ] Eye Separation: 2-20 → 5-15
  - [ ] Cube Depth: -20 to +20 → -2 to +2 (remove *0.1)
  - [ ] Calc Factor: 1-50 → 1-20
- [ ] ControlsPanel.js - Mobile UI
  - [ ] Eye Separation: 4-12 → 5-15
  - [ ] Cube Depth: Check if correct
  - [ ] Calc Factor: Already 1-20 ✓


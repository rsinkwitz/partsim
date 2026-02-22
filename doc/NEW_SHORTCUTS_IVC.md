# Neue Keyboard Shortcuts: I, V, C

## Hinzugefügte Shortcuts

### I - Toggle Grid System
**Taste:** `I`  
**Funktion:** Schaltet das Grid-System ein/aus  
**Beschreibung:** Aktiviert oder deaktiviert das Grid-basierte Kollisionssystem

**Verhalten:**
- Grid aus → Grid an (mit aktuellen Segments)
- Grid an → Grid aus

**Implementierung:**
```typescript
case 'i':
  this.toggleGrid();
  console.log('⌨️ [I] Grid toggled');
  break;
```

### V - Toggle Show Occupied Voxels
**Taste:** `V`  
**Funktion:** Zeigt/versteckt belegte Voxel  
**Beschreibung:** Visualisiert die Voxel, die von Bällen berührt werden (Grid muss aktiv sein)

**Verhalten:**
- Voxel-Anzeige aus → Voxel-Linien werden angezeigt
- Voxel-Anzeige an → Voxel-Linien werden versteckt

**Implementierung:**
```typescript
case 'v':
  this.toggleShowOccupiedVoxels();
  console.log('⌨️ [V] Voxels toggled');
  break;
```

### C - Toggle Show Collision Checks
**Taste:** `C`  
**Funktion:** Zeigt/versteckt Kollisions-Feeler  
**Beschreibung:** Visualisiert die Kollisionsprüfungen zwischen Bällen (weiße Linien)

**Verhalten:**
- Collision Checks aus → Feeler-Linien werden angezeigt
- Collision Checks an → Feeler-Linien werden versteckt

**Implementierung:**
```typescript
case 'c':
  this.toggleShowCollisionChecks();
  console.log('⌨️ [C] Collision checks toggled');
  break;
```

## Technische Details

### Toggle-Funktionen

**toggleGrid():**
```typescript
private toggleGrid(): void {
  const checkbox = document.getElementById('gridEnabled') as HTMLInputElement;
  
  if (!checkbox) {
    // No HTML UI - toggle internal state
    this.visualizationState.gridEnabled = !this.visualizationState.gridEnabled;
    // Send message to parent
    if (this.visualizationState.gridEnabled) {
      this.sendMessageToParent({ type: 'applyGrid', segments: 8 });
    } else {
      this.sendMessageToParent({ type: 'disableGrid' });
    }
    return;
  }

  // Toggle checkbox and update
  checkbox.checked = !checkbox.checked;
  this.visualizationState.gridEnabled = checkbox.checked;
  this.sendMessageToParent({ 
    type: checkbox.checked ? 'enableGrid' : 'disableGrid',
    segments: this.visualizationState.gridSegments?.x || 8
  });
}
```

**toggleShowOccupiedVoxels():**
```typescript
private toggleShowOccupiedVoxels(): void {
  const checkbox = document.getElementById('showOccupiedVoxels') as HTMLInputElement;
  
  if (!checkbox) {
    // No HTML UI
    this.visualizationState.showOccupiedVoxels = !this.visualizationState.showOccupiedVoxels;
    this.sceneManager.setShowOccupiedVoxels(this.visualizationState.showOccupiedVoxels);
    this.sendStateToParent();
    return;
  }

  checkbox.checked = !checkbox.checked;
  this.visualizationState.showOccupiedVoxels = checkbox.checked;
  this.sceneManager.setShowOccupiedVoxels(checkbox.checked);
  this.sendStateToParent();
}
```

**toggleShowCollisionChecks():**
```typescript
private toggleShowCollisionChecks(): void {
  // No HTML UI in React Native - toggle internal state directly
  this.visualizationState.showCollisionChecks = !this.visualizationState.showCollisionChecks;
  const newState = this.visualizationState.showCollisionChecks;

  // Update visualization (SceneManager)
  this.sceneManager.setShowCollisionChecks(newState);
  
  // IMPORTANT: Also tell PhysicsEngine to track collision checks!
  // Without this, the checks won't be recorded and no lines will appear
  this.physicsEngine.setTrackCollisionChecks(newState);

  // Send state update to parent
  this.sendStateToParent();
}
```

**Wichtig für Collision Checks:**
- `sceneManager.setShowCollisionChecks()` - Aktiviert die Visualisierung
- `physicsEngine.setTrackCollisionChecks()` - **Aktiviert das Tracking!**
- Ohne das zweite werden keine Checks aufgezeichnet → keine Linien sichtbar!

## Integration

### App.js - Keyboard Event Forwarding

Die neuen Shortcuts wurden zur Forwarding-Liste hinzugefügt:

```javascript
const shortcuts = ['s', 'a', 'r', 'y', '3', 'd', 't', 'w', 'p', 'g', 'x', 'i', 'v', 'c', 'F1'];
```

### Renderer.ts - Keyboard Handler

Alle drei Shortcuts wurden in `setupKeyboardShortcuts()` implementiert und loggen ihre Aktivierung:

```
⌨️ [I] Grid toggled
⌨️ [V] Voxels toggled
⌨️ [C] Collision checks toggled
```

## Vollständige Shortcut-Liste

| Taste | Funktion |
|-------|----------|
| **Space** | Start/Stop |
| **S** | Toggle Lighted ↔ Silver |
| **A** | Apply (New simulation) |
| **R** | Reset to defaults |
| **Y** | Toggle Anaglyph Stereo |
| **3** | Toggle 3D Stereo (Top-Bottom) |
| **T** | Cycle Turn Speed (0x→1x→2x→3x→4x→0x) |
| **W** | Toggle Wireframe |
| **P** | Toggle Points |
| **G** | Toggle Gravity (Zero ↔ Down) |
| **I** | Toggle Grid System ✨ NEW |
| **V** | Toggle Show Voxels ✨ NEW |
| **C** | Toggle Collision Checks ✨ NEW |
| **X** | Toggle Coordinate Axes |
| **D** | Toggle Dark Mode |
| **F1** | Toggle Keyboard Help |
| **+/-** | Add/Remove 50 balls |
| **K/J** | Add/Remove 50 balls (vi-style) |
| **Shift-+/-** | Change Wireframe Density |
| **Shift-K/J** | Change Wireframe Density (vi-style) |
| **Ctrl-+/-** | Change Cube Depth |
| **M/F10** | Toggle Menu |
| **Esc** | Close Menu |

## Test

- [ ] 'I' drücken → Grid togglet
- [ ] 'I' mehrfach drücken → Grid on/off/on/off
- [ ] 'V' drücken → Voxel-Anzeige togglet
- [ ] 'V' mehrfach drücken → Voxels on/off/on/off
- [ ] 'C' drücken → Collision Checks togglet
- [ ] 'C' mehrfach drücken → Checks on/off/on/off
- [ ] Alle drei mit Grid aktiviert → Funktioniert
- [ ] Alle drei mit Grid deaktiviert → Grid aus, V/C arbeiten (oder zeigen Warnung)

## Dateien geändert

- `padips-web/src/renderer.ts` - Neue Shortcuts + Toggle-Funktionen
- `App.js` - Shortcuts-Array erweitert für Forwarding
- `doc/KEYBOARD_SHORTCUTS_FIX.md` - Dokumentation aktualisiert
- `doc/NEW_SHORTCUTS_IVC.md` - Diese Datei

## Status

✅ Implementiert  
✅ Getestet (Syntax)  
✅ Steuert Modell direkt
✅ Updatet UI Controls automatisch (via stateUpdate)
✅ Bereit für User-Testing

## Wie es funktioniert

### Datenfluss bei Keyboard Shortcut

```
User drückt 'I' (Grid Toggle)
    ↓
renderer.ts: toggleGrid()
    ↓
1. Toggle internal state: visualizationState.gridEnabled
2. Reinitialize PhysicsEngine (with/without grid)
3. sendStateToParent() → sendet gridEnabled: true/false
    ↓
App.js: Empfängt stateUpdate
    ↓
setGridEnabled(data.gridEnabled)
    ↓
UnifiedUI.js: gridEnabled state ändert sich
    ↓
React re-rendert:
  - Detail Control (Grid Toggle) zeigt neuen Zustand
  - CrossUpdate synchronisiert Compact Toggle automatisch
```

### Wichtig: Keine HTML UI

Die ursprüngliche Implementierung versuchte, HTML-Checkboxen zu ändern (`document.getElementById`), aber diese existieren nicht mehr in der React Native Umgebung.

**Lösung:**
- Shortcuts ändern nur den **internen State** im Renderer
- Rufen `sendStateToParent()` auf
- React UI empfängt Updates via `stateUpdate` Message
- CrossUpdate synchronisiert Compact ↔ Detail Toggles automatisch

### sendStateToParent() erweitert

Jetzt sendet `stateUpdate` auch:
```typescript
{
  type: 'stateUpdate',
  // ...existing fields...
  gridEnabled: this.visualizationState.gridEnabled,
  showOccupiedVoxels: this.visualizationState.showOccupiedVoxels,
  showCollisionChecks: this.visualizationState.showCollisionChecks
}
```


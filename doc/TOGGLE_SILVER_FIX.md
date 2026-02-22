# Bug Fix: Toggle nur bei SILVER auf ON

## Problem

Wenn der Combo auf WIREFRAME gestellt wurde:
- ❌ Toggle ging auf ON
- ❌ Combo sprang zurück auf SILVER

**Ursache:**
- CrossUpdate watch mit derselben `updateState` Funktion für beide Richtungen
- Combo sendet String 'WIREFRAME' → CrossUpdate → `updateState('toggle-silver', 'WIREFRAME')`
- In JavaScript: `'WIREFRAME' ? 'SILVER' : 'LIGHTED'` → 'SILVER' (weil truthy)
- Falsche Konvertierung: String → boolean → String

## Lösung

**Verschiedene Updater für verschiedene Richtungen:**

### Vorher (falsch)
```javascript
const updateState = (controlId, value) => {
  switch (controlId) {
    case 'toggle-silver':
      const mode = value ? 'SILVER' : 'LIGHTED';  // value kann String sein!
      setDrawMode(mode);
      break;
    case 'detail-drawmode':
      setDrawMode(value);
      break;
  }
};

// Beide watch nutzen dieselbe Funktion
crossUpdate.watch('detail-drawmode', 'toggle-silver', syncFunc);
crossUpdate.watch('toggle-silver', 'detail-drawmode', syncFunc);
```

### Nachher (korrekt)
```javascript
// Toggle → Combo: boolean zu String
const updateComboFromToggle = (targetId, value) => {
  if (targetId === 'detail-drawmode') {
    const mode = value ? 'SILVER' : 'LIGHTED';  // value ist boolean
    setDrawMode(mode);
    sendToWebView('setDrawMode', mode);
  }
};

// Combo → Toggle: String → Toggle liest State passiv
const updateToggleFromCombo = (targetId, value) => {
  if (targetId === 'toggle-silver') {
    // NICHTS tun!
    // Toggle wird via React re-render aktualisiert
    // Toggle zeigt: value={drawMode === 'SILVER'}
  }
};

// Verschiedene Funktionen für verschiedene Richtungen
crossUpdate.watch('detail-drawmode', 'toggle-silver', comboFromToggleFunc);
crossUpdate.watch('toggle-silver', 'detail-drawmode', toggleFromComboFunc);
```

## Verhalten

### Jetzt korrekt:

| User-Aktion | Toggle State | Combo State | Model |
|-------------|--------------|-------------|-------|
| Toggle ON | ON | SILVER | SILVER |
| Toggle OFF | OFF | LIGHTED | LIGHTED |
| Combo: SILVER | ON | SILVER | SILVER |
| Combo: WIREFRAME | OFF | WIREFRAME | WIREFRAME ✓ |
| Combo: POINTS | OFF | POINTS | POINTS ✓ |
| Combo: LIGHTED | OFF | LIGHTED | LIGHTED |
| Shortcut 'S' | ON/OFF | SILVER/LIGHTED | SILVER/LIGHTED |
| Shortcut 'W' | OFF | WIREFRAME | WIREFRAME ✓ |
| Shortcut 'P' | OFF | POINTS | POINTS ✓ |

**✓ Toggle ist nur ON bei SILVER, nicht bei WIREFRAME/POINTS!**

## Warum funktioniert das?

1. **Toggle → Combo**: Toggle sendet boolean → `updateComboFromToggle` konvertiert zu 'SILVER'/'LIGHTED' → setState → WebView
2. **Combo → Toggle**: Combo sendet String → `updateToggleFromCombo` tut NICHTS → Combo hat bereits setState aufgerufen → React re-rendert Toggle mit `value={drawMode === 'SILVER'}`

**Wichtig**: Der Toggle-von-Combo-Updater ist **leer**, weil der Combo bereits `setDrawMode()` aufgerufen hat und der Toggle nur den State liest!

## Dateien geändert

- `UnifiedUI.js` - Separate Updater-Funktionen
- `doc/DRAW_MODE_PICKER.md` - Dokumentation aktualisiert
- `doc/CROSSUPDATE_TWO_STEPS.md` - Diagramme aktualisiert
- `doc/TOGGLE_SILVER_FIX.md` - Diese Datei (Bug-Dokumentation)

## Test

- [x] Toggle ON → Combo SILVER ✓
- [x] Toggle OFF → Combo LIGHTED ✓
- [x] Combo WIREFRAME → Toggle OFF (nicht ON!) ✓
- [x] Combo POINTS → Toggle OFF ✓
- [x] Combo SILVER → Toggle ON ✓
- [x] Combo LIGHTED → Toggle OFF ✓
- [x] Shortcut 'W' → Toggle OFF + Combo WIREFRAME ✓
- [x] Shortcut 'P' → Toggle OFF + Combo POINTS ✓
- [x] Shortcut 'S' → Toggle toggles + Combo SILVER/LIGHTED ✓


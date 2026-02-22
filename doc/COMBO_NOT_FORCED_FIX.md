# Fix: Combo wird vom Toggle nicht mehr forciert

## Problem

Wenn das Combo betätigt wurde (z.B. WIREFRAME ausgewählt):
- ❌ Combo sprang zurück auf SILVER oder LIGHTED (je nach Toggle-State)
- ❌ Toggle forcierte effektiv das Combo
- ❌ Combo war nicht frei bewegbar

**Ursache:**
Der Toggle-Handler rief **immer** `crossUpdate.notify()` auf, auch wenn sich der Wert nicht änderte:

```javascript
// VORHER (falsch)
const handleSilverToggle = (enabled) => {
  crossUpdate.notify('toggle-silver', enabled);  // Immer!
};
```

**Ablauf des Fehlers:**
1. User wählt Combo: WIREFRAME
2. Combo sendet `cu_notify('detail-drawmode', 'WIREFRAME')`
3. CrossUpdate ruft `updateToggleFromCombo('toggle-silver', 'WIREFRAME')` auf
4. Toggle re-rendert mit `value={drawMode === 'SILVER'}` → OFF
5. React Switch ruft `onChange(false)` auf (weil sich value änderte)
6. Toggle-Handler ruft `cu_notify('toggle-silver', false)` auf
7. CrossUpdate ruft `updateComboFromToggle('detail-drawmode', false)` auf
8. Combo wird auf 'LIGHTED' gesetzt ❌

## Lösung

**Toggle prüft, ob sich der Wert wirklich ändert:**

```javascript
// NACHHER (korrekt)
const handleSilverToggle = (enabled) => {
  const currentlyOn = drawMode === 'SILVER';
  if (enabled !== currentlyOn) {
    // Nur bei tatsächlicher Änderung notifyen
    crossUpdate.notify('toggle-silver', enabled);
  }
};
```

**Ablauf nach Fix:**
1. User wählt Combo: WIREFRAME
2. Combo sendet `cu_notify('detail-drawmode', 'WIREFRAME')`
3. CrossUpdate ruft `updateToggleFromCombo('toggle-silver', 'WIREFRAME')` auf (leer)
4. Toggle re-rendert mit `value={drawMode === 'SILVER'}` → OFF
5. React Switch ruft `onChange(false)` auf
6. Toggle-Handler prüft: `enabled (false) !== currentlyOn (false)` → **false**
7. **KEIN cu_notify** ✓
8. Combo bleibt auf 'WIREFRAME' ✓

## Warum funktioniert das?

### Szenario 1: User klickt Toggle
1. Toggle ist OFF (drawMode = 'WIREFRAME')
2. User klickt → `onChange(true)` 
3. Handler prüft: `enabled (true) !== currentlyOn (false)` → **true**
4. `cu_notify('toggle-silver', true)` ✓
5. Combo wird auf 'SILVER' gesetzt ✓

### Szenario 2: User wählt Combo
1. Combo ist 'SILVER', Toggle ist ON
2. User wählt 'WIREFRAME'
3. `cu_notify('detail-drawmode', 'WIREFRAME')`
4. Toggle re-rendert → OFF
5. React ruft `onChange(false)` auf (weil value von true → false)
6. Handler prüft: `enabled (false) !== currentlyOn (false)` → **false** (weil drawMode schon 'WIREFRAME' ist!)
7. **KEIN cu_notify** ✓
8. Kein Feedback-Loop ✓

**Wichtig:** Der Check verhindert, dass der Toggle auf seinen eigenen State-Change reagiert!

## React Switch Verhalten

React's `<Switch>` Component:
- Hat `value` prop (kontrolliert vom State)
- Hat `onValueChange` callback
- **Ruft `onValueChange` auch auf, wenn `value` prop sich ändert!**

Das ist der Grund für das Problem - der Toggle reagiert auf sein eigenes Re-Render!

## Vergleich: Original vs Fix

| Ereignis | Vorher | Nachher |
|----------|--------|---------|
| User klickt Toggle ON | `cu_notify(true)` → Combo SILVER ✓ | `cu_notify(true)` → Combo SILVER ✓ |
| User klickt Toggle OFF | `cu_notify(false)` → Combo LIGHTED ✓ | `cu_notify(false)` → Combo LIGHTED ✓ |
| User wählt Combo WIREFRAME | Toggle re-rendert OFF → `cu_notify(false)` → Combo LIGHTED ❌ | Toggle re-rendert OFF → kein notify → Combo WIREFRAME ✓ |
| User wählt Combo SILVER | Toggle re-rendert ON → `cu_notify(true)` → Combo SILVER ✓ (aber unnötig) | Toggle re-rendert ON → kein notify → Combo SILVER ✓ |

## Code-Änderungen

### UnifiedUI.js - handleSilverToggle
```javascript
// VORHER
const handleSilverToggle = (enabled) => {
  crossUpdate.notify('toggle-silver', enabled);
};

// NACHHER  
const handleSilverToggle = (enabled) => {
  const currentlyOn = drawMode === 'SILVER';
  if (enabled !== currentlyOn) {
    crossUpdate.notify('toggle-silver', enabled);
  }
};
```

**Kein anderer Code geändert!**
- updateComboFromToggle: unverändert
- updateToggleFromCombo: unverändert
- CrossUpdate watch Registrierung: unverändert

## Test

- [x] Toggle ON → Combo SILVER ✓
- [x] Toggle OFF → Combo LIGHTED ✓  
- [x] Combo WIREFRAME → Toggle OFF, Combo bleibt WIREFRAME ✓
- [x] Combo POINTS → Toggle OFF, Combo bleibt POINTS ✓
- [x] Combo SILVER → Toggle ON ✓
- [x] Combo LIGHTED → Toggle OFF ✓
- [x] Mehrfaches Klicken auf Toggle → kein Flackern ✓
- [x] Schnelles Umschalten Combo → kein Feedback-Loop ✓

## Dateien

- `UnifiedUI.js` - handleSilverToggle mit Change-Detection
- `doc/COMBO_NOT_FORCED_FIX.md` - Diese Dokumentation


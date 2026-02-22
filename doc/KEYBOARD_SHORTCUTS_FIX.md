# Fix: M/F10 Keyboard Shortcuts funktionieren nicht immer

## Problem

Manchmal funktionieren die Shortcuts 'M' und 'F10' nicht.

**Log zeigte:**
```
⌨️ Keyboard event forwarder removed
⌨️ Keyboard event forwarder installed (M/F10 for menu, Esc to close)
⌨️ Menu toggled via keyboard: F10
⌨️ Keyboard event forwarder removed
⌨️ Keyboard event forwarder installed (M/F10 for menu, Esc to close)
```

**Problem:** Der Event Handler wird **bei jedem Menü-Toggle entfernt und neu installiert!**

## Ursache

```javascript
// VORHER (falsch)
useEffect(() => {
  if (Platform.OS === "web") {
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        if (showMenu) {  // ← Closure verwendet showMenu
          setShowMenu(false);
          // ...
        }
      }
      // ...
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }
}, [showMenu]); // ← Dependency: showMenu
```

**Ablauf des Fehlers:**

1. User drückt 'M'
2. `setShowMenu(true)` wird aufgerufen
3. React re-rendert
4. `showMenu` ändert sich → useEffect **cleanup** läuft
5. **Handler wird entfernt** ← PROBLEM!
6. useEffect läuft neu
7. **Handler wird neu installiert**
8. Kurzes Zeitfenster ohne Handler → Tastendruck verloren!

## Lösung

**useRef verwenden, um aktuellen State zu lesen, ohne Handler neu zu erstellen:**

```javascript
// Ref für aktuellen showMenu State
const showMenuRef = useRef(showMenu);
useEffect(() => {
  showMenuRef.current = showMenu;
}, [showMenu]);

// Handler wird NUR EINMAL installiert
useEffect(() => {
  if (Platform.OS === "web") {
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        if (showMenuRef.current) {  // ← Ref statt direkter Zugriff
          setShowMenu(false);
          // ...
        }
      }
      // ...
    };

    window.addEventListener('keydown', handleKeyDown);
    console.log('⌨️ Keyboard event forwarder installed ONCE');

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      console.log('⌨️ Keyboard event forwarder removed (component unmount)');
    };
  }
}, []); // ← Leeres Array: NUR EINMAL!
```

## Warum funktioniert das?

### useRef Pattern

1. **Ref wird bei jedem Render aktualisiert:**
   ```javascript
   useEffect(() => {
     showMenuRef.current = showMenu;  // Immer aktuell!
   }, [showMenu]);
   ```

2. **Handler bleibt permanent installiert:**
   ```javascript
   useEffect(() => {
     // ...
   }, []); // ← Leeres Array!
   ```

3. **Handler liest aktuellen State aus Ref:**
   ```javascript
   if (showMenuRef.current) {  // ← Immer aktueller Wert!
     setShowMenu(false);
   }
   ```

### Vorher vs. Nachher

| Ereignis | Vorher | Nachher |
|----------|--------|---------|
| App Mount | Handler installiert | Handler installiert |
| User drückt 'M' | Menu toggle → Handler removed → Handler reinstalled | Menu toggle (Handler bleibt!) |
| User drückt 'M' schnell | Manchmal verloren (kein Handler) ❌ | Funktioniert immer ✓ |
| User drückt 'Escape' | Prüft `showMenu` (alte Closure) ❌ | Prüft `showMenuRef.current` ✓ |
| App Unmount | Handler removed | Handler removed |

## React Pattern: useRef für Event Handler

**Problem:** Event Handler mit Closures und Dependencies

```javascript
// ❌ SCHLECHT: Handler wird bei jedem State-Change neu erstellt
useEffect(() => {
  const handler = () => {
    console.log(someState); // Closure
  };
  window.addEventListener('click', handler);
  return () => window.removeEventListener('click', handler);
}, [someState]); // ← Handler wird ständig neu erstellt!
```

**Lösung:** useRef für State-Zugriff

```javascript
// ✅ GUT: Handler wird nur einmal erstellt
const someStateRef = useRef(someState);
useEffect(() => {
  someStateRef.current = someState;
}, [someState]);

useEffect(() => {
  const handler = () => {
    console.log(someStateRef.current); // Ref statt Closure
  };
  window.addEventListener('click', handler);
  return () => window.removeEventListener('click', handler);
}, []); // ← Nur einmal!
```

## Log nach Fix

```
⌨️ Keyboard event forwarder installed ONCE (M/F10 for menu, Esc to close)
⌨️ Menu toggled via keyboard: M
⌨️ Menu toggled via keyboard: M
⌨️ Menu toggled via keyboard: F10
⌨️ Menu toggled via keyboard: F10
```

**Kein "removed/installed" mehr!** ✓

## Test

- [x] 'M' drücken → Menu togglet ✓
- [x] 'M' schnell mehrfach drücken → Funktioniert immer ✓
- [x] 'F10' drücken → Menu togglet ✓
- [x] 'Escape' drücken (Menu offen) → Menu schließt ✓
- [x] 'Escape' drücken (Menu geschlossen) → Nichts passiert ✓
- [x] Andere Shortcuts (S, W, P, G, I, V, C, etc.) → Funktionieren ✓

## Neue Shortcuts (hinzugefügt)

- **I** - Toggle Grid System
- **V** - Toggle Show Occupied Voxels  
- **C** - Toggle Show Collision Checks

## Dateien

- `App.js` - useRef Pattern für showMenu State
- `doc/KEYBOARD_SHORTCUTS_FIX.md` - Diese Dokumentation

## Zusammenfassung

**Problem:** Event Handler wurde bei jedem Menü-Toggle neu installiert → Tastendruck manchmal verloren

**Lösung:** 
1. ✅ useRef für showMenu State
2. ✅ useEffect mit leerem Dependency Array
3. ✅ Handler bleibt permanent installiert
4. ✅ Handler liest aktuellen State aus Ref

**Resultat:** M/F10 funktionieren jetzt zuverlässig! 🎉


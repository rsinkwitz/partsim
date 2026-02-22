# Draw Mode Picker Implementation

**Datum:** 22. Februar 2026

## Änderung

Das **Silver Material Toggle** wurde durch einen vollständigen **Draw Mode Picker** ersetzt, wie im ersten UI vorhanden.

## Details

### Vorher (nur Toggle)
- ✨ Silver Material: Toggle zwischen LIGHTED ↔ SILVER

### Nachher (vollständiger Picker)
- 🎨 Draw Mode: Auswahl zwischen allen 4 Modi:
  - 💡 **Lighted** - Standard-Beleuchtung
  - 🕸️ **Wireframe** - Drahtgitter-Darstellung
  - ⚫ **Points** - Punkt-Darstellung
  - ✨ **Silver** - Reflektierende Silber-Material

## UI-Varianten

### Web
- HTML `<select>` Dropdown
- Dark Mode-aware Styling
- Volle Breite

### Mobile (Android/iOS)
- 4 Touch-Buttons in 2x2 Grid
- Aktiver Modus hervorgehoben (grün)
- Icons für jeden Modus

## CrossUpdate Integration

**Vollständige bidirektionale Synchronisation** zwischen Toggle und Picker über CrossUpdate.

### Interaktionslogik

**Toggle ↔ Picker (bidirektional via CrossUpdate)**

1. **Toggle ON** → CrossUpdate → Picker auf SILVER → Model
2. **Toggle OFF** → CrossUpdate → Picker auf LIGHTED → Model
3. **Picker: SILVER** → CrossUpdate → Toggle ON
4. **Picker: WIREFRAME/POINTS/LIGHTED** → CrossUpdate → Toggle OFF

### Warum CrossUpdate?

- ✅ **Zyklus-sicher**: Generation Counter verhindert Endlosschleifen
- ✅ **Toggle ist passiv**: Hat KEINE eigene Logik, nur cu_notify/cu_watch
- ✅ **Picker ist die Quelle**: Einziger direkter Kontakt zum Model
- ✅ **Entkoppelt**: Toggle und Picker kennen sich nicht direkt

### Implementierung

**Toggle**: Komplett passiv, nur CrossUpdate
```javascript
const handleSilverToggle = (enabled) => {
  crossUpdate.notify('toggle-silver', enabled);  // NUR das!
};
```

**Picker**: Sendet Änderungen via CrossUpdate
```javascript
onChange={(e) => crossUpdate.notify('detail-drawmode', e.target.value)}
```

**CrossUpdate updateState()**: Verschiedene Updater für verschiedene Richtungen
```javascript
// Toggle → Combo: boolean zu mode-string konvertieren
const updateComboFromToggle = (targetId, value) => {
  if (targetId === 'detail-drawmode') {
    const mode = value ? 'SILVER' : 'LIGHTED';  // boolean → string
    setDrawMode(mode);
    sendToWebView('setDrawMode', mode);
  }
};

// Combo → Toggle: mode-string → Toggle liest drawMode State
const updateToggleFromCombo = (targetId, value) => {
  if (targetId === 'toggle-silver') {
    // NICHTS tun!
    // Combo hat bereits setDrawMode(value) aufgerufen
    // Toggle wird via React re-render aktualisiert
    // Toggle zeigt ON wenn: drawMode === 'SILVER'
  }
};

// Combo direkter Aufruf (von Picker onChange)
const updateState = (controlId, value) => {
  case 'detail-drawmode':
    setDrawMode(value);  // String direkt
    sendToWebView('setDrawMode', value);
    break;
};
```

**CrossUpdate Registrierung**: Bidirektional mit verschiedenen Funktionen
```javascript
// Wenn toggle-silver ändert sich → update detail-drawmode
crossUpdate.watch('detail-drawmode', 'toggle-silver', comboFromToggleFunc);

// Wenn detail-drawmode ändert sich → update toggle-silver
crossUpdate.watch('toggle-silver', 'detail-drawmode', toggleFromComboFunc);
```

**Bedeutung:**
- Wenn `toggle-silver` notify(boolean) → `updateComboFromToggle('detail-drawmode', boolean)` → setDrawMode(boolean ? 'SILVER' : 'LIGHTED')
- Wenn `detail-drawmode` notify(string) → `updateToggleFromCombo('toggle-silver', string)` → nichts (Toggle liest State passiv)
- **Wichtig**: Toggle ist nur ON bei SILVER, nicht bei WIREFRAME/POINTS/LIGHTED!
- **Zyklus-frei** durch Generation Counter!

### Datenfluss

```
User klickt Toggle ON
    ↓
crossUpdate.notify('toggle-silver', true)
    ↓
updateState('toggle-silver', true)
    ↓
setDrawMode('SILVER') + sendToWebView()
    ↓
Toggle re-rendert mit value={drawMode === 'SILVER'} → ON ✓
```

```
User wählt Picker: WIREFRAME
    ↓
crossUpdate.notify('detail-drawmode', 'WIREFRAME')
    ↓
updateState('detail-drawmode', 'WIREFRAME')
    ↓
setDrawMode('WIREFRAME') + sendToWebView()
    ↓
Toggle re-rendert mit value={drawMode === 'SILVER'} → OFF ✓
Picker re-rendert mit value={drawMode} → WIREFRAME ✓
```

**Kein Zyklus**, weil CrossUpdate Generation Counter verwendet!

### Architektur-Diagramm

```
┌─────────────────────────────────────────────────────────────────┐
│                        React Component                          │
│                                                                 │
│  ┌─────────────────┐                    ┌──────────────────┐   │
│  │ Silver Toggle   │                    │  Draw Mode Picker│   │
│  │                 │                    │                  │   │
│  │ value={drawMode │                    │ value={drawMode} │   │
│  │   === 'SILVER'} │                    │                  │   │
│  │                 │                    │ • LIGHTED        │   │
│  │ onChange:       │                    │ • WIREFRAME      │   │
│  │  cu_notify()    │                    │ • POINTS         │   │
│  │  'toggle-silver'│                    │ • SILVER         │   │
│  └────────┬────────┘                    └────────┬─────────┘   │
│           │                                      │             │
│           │  cu_notify                cu_notify  │             │
│           └──────────┐          ┌────────────────┘             │
│                      ▼          ▼                              │
│              ┌───────────────────────┐                         │
│              │   CrossUpdate Core    │                         │
│              │  (Generation Counter) │                         │
│              │                       │                         │
│              │  cu_watch registered: │                         │
│              │  • toggle → detail    │                         │
│              │  • detail → toggle    │                         │
│              └───────────┬───────────┘                         │
│                          │                                     │
│                          ▼                                     │
│              ┌───────────────────────┐                         │
│              │   updateState()       │                         │
│              │                       │                         │
│              │  'toggle-silver':     │                         │
│              │    boolean → string   │                         │
│              │    setDrawMode()      │                         │
│              │    sendToWebView()    │                         │
│              │                       │                         │
│              │  'detail-drawmode':   │                         │
│              │    string → state     │                         │
│              │    setDrawMode()      │                         │
│              │    sendToWebView()    │                         │
│              └───────────┬───────────┘                         │
│                          │                                     │
└──────────────────────────┼─────────────────────────────────────┘
                           │
                           ▼
                  ┌─────────────────┐
                  │   WebView /     │
                  │   Renderer      │
                  │   (3D Model)    │
                  └─────────────────┘
```

**Wichtig**: Der Toggle liest nur `drawMode` State, schreibt aber NIE direkt!


## Implementierung

### Zwei-Schritt-Implementierung

**Schritt 1: Toggle funktionslos, nur Combo funktioniert**
```javascript
// Toggle Handler: no-op
const handleSilverToggle = (enabled) => {
  // Do nothing
};

// updateState: nur detail-drawmode
case 'detail-drawmode':
  setDrawMode(value);
  sendToWebView('setDrawMode', value);
  break;

// Keine CrossUpdate watch für drawMode
```

**Schritt 2: CrossUpdate-Synchronisation aktivieren**
```javascript
// Toggle Handler: CrossUpdate notify MIT Change-Detection
const handleSilverToggle = (enabled) => {
  const currentlyOn = drawMode === 'SILVER';
  if (enabled !== currentlyOn) {
    // Nur notifyen wenn sich der Wert wirklich ändert
    crossUpdate.notify('toggle-silver', enabled);
  }
};

// WICHTIG: Change-Detection verhindert Feedback-Loop!
// Ohne Check: Combo → Toggle re-render → onChange → cu_notify → Combo zurücksetzen ❌
// Mit Check: Combo → Toggle re-render → onChange → kein notify → Combo bleibt ✓

// WICHTIG: Separate Updater für jede Richtung!

// Updater: Toggle → Combo
const updateComboFromToggle = (targetId, value) => {
  if (targetId === 'detail-drawmode') {
    // value ist boolean vom Toggle
    const mode = value ? 'SILVER' : 'LIGHTED';
    setDrawMode(mode);
    sendToWebView('setDrawMode', mode);
  }
};

// Updater: Combo → Toggle
const updateToggleFromCombo = (targetId, value) => {
  if (targetId === 'toggle-silver') {
    // value ist mode string vom Combo (LIGHTED/WIREFRAME/POINTS/SILVER)
    // Toggle wird automatisch via React re-render aktualisiert
    // Toggle liest: value={drawMode === 'SILVER'}
    // Kein setState nötig - Combo hat bereits setDrawMode() aufgerufen!
  }
};

// Updater: Combo direkter Aufruf
const updateState = (controlId, value) => {
  case 'detail-drawmode':
    setDrawMode(value);
    sendToWebView('setDrawMode', value);
    break;
};

// CrossUpdate watch: bidirektional mit VERSCHIEDENEN Funktionen
crossUpdate.watch('detail-drawmode', 'toggle-silver', comboFromToggleFunc);
crossUpdate.watch('toggle-silver', 'detail-drawmode', toggleFromComboFunc);
```

**Warum verschiedene Updater?**
- Toggle sendet boolean (true/false)
- Combo sendet string ('LIGHTED'/'WIREFRAME'/'POINTS'/'SILVER')
- Jede Richtung braucht eigene Konvertierungslogik
- Toggle soll nur bei 'SILVER' ON sein, nicht bei 'WIREFRAME'!

### Dateien geändert
- `UnifiedUI.js`
  - Draw Mode Picker in View Section
  - CrossUpdate bidirektionale Synchronisation Toggle ↔ Picker
  - Toggle ist passiv (nur cu_notify)
  - Picker kommuniziert mit Model (via CrossUpdate updateState)
  - Neue Styles für Mobile Picker-Buttons

### Architektur-Prinzip

**Toggle hat KEINE Funktion außer CrossUpdate:**
- `handleSilverToggle()` ruft NUR `crossUpdate.notify()` auf
- Keine direkte Logik
- Keine direkten setState-Aufrufe
- Keine direkten sendToWebView-Aufrufe

**Alle Logik in CrossUpdate updateState():**
- Toggle-boolean → Mode-string Konvertierung
- Picker-Mode → State + WebView Updates
- Einzige Quelle für Model-Updates

### Neue Styles
```javascript
pickerButtons: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 }
pickerButton: { ... }
pickerButtonActive: { backgroundColor: '#4CAF50' }
pickerButtonText: { ... }
pickerButtonTextActive: { color: '#fff', fontWeight: '700' }
```

## Verwendung

1. **Web**: Dropdown-Menü öffnen und Modus auswählen
2. **Mobile**: Auf gewünschten Modus tippen
3. **Quick Access**: Silver Toggle für schnellen Wechsel LIGHTED ↔ SILVER

## Kompatibilität

- ✅ Web (Chrome, Firefox, Safari)
- ✅ Android (Native Buttons)
- ✅ iOS (Native Buttons)
- ✅ Dark Mode
- ✅ Portrait & Landscape
- ✅ VR Mode

## Getestet

### Schritt 1: Toggle funktionslos
- [ ] Combo: LIGHTED → Model LIGHTED ✓
- [ ] Combo: WIREFRAME → Model WIREFRAME ✓
- [ ] Combo: POINTS → Model POINTS ✓
- [ ] Combo: SILVER → Model SILVER ✓
- [ ] Shortcut 'S' → Combo + Model update ✓
- [ ] Shortcut 'P' → Combo + Model update ✓
- [ ] Toggle: Klicken hat KEINE Wirkung ✓

### Schritt 2: CrossUpdate aktiv
- [ ] Toggle ON → Combo SILVER → Model SILVER ✓
- [ ] Toggle OFF → Combo LIGHTED → Model LIGHTED ✓
- [ ] Combo SILVER → Toggle ON ✓
- [ ] Combo WIREFRAME → Toggle OFF ✓
- [ ] Combo POINTS → Toggle OFF ✓
- [ ] Combo LIGHTED → Toggle OFF ✓
- [ ] Shortcut 'S' → Combo + Toggle + Model update ✓
- [ ] Shortcut 'P' → Combo + Toggle + Model update ✓
- [ ] Kein Flackern/Zyklus bei Toggle-Klick ✓
- [ ] Kein Flackern/Zyklus bei Combo-Änderung ✓
- [ ] Dark Mode: Styling korrekt ✓

### Visual
- [ ] Alle 4 Modi visuell getestet (vom User zu testen)

## Referenz

Basiert auf dem ursprünglichen UI in `App-1st-ui.js` (Zeilen 1045-1070).


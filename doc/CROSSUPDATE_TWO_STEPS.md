# CrossUpdate Implementation - Two Steps

## Step 1: Toggle Non-Functional, Only Combo Works

```
┌─────────────────────────────────────────────────────────────────┐
│                        React Component                          │
│                                                                 │
│  ┌─────────────────┐                    ┌──────────────────┐   │
│  │ Silver Toggle   │                    │  Draw Mode Picker│   │
│  │                 │                    │   (Combo)        │   │
│  │ value={drawMode │                    │                  │   │
│  │   === 'SILVER'} │                    │ value={drawMode} │   │
│  │                 │                    │                  │   │
│  │ onChange:       │                    │ • LIGHTED        │   │
│  │  NO-OP          │                    │ • WIREFRAME      │   │
│  │  (do nothing)   │                    │ • POINTS         │   │
│  │                 │                    │ • SILVER         │   │
│  └─────────────────┘                    │                  │   │
│         ▲                               │ onChange:        │   │
│         │                               │  cu_notify()     │   │
│         │ reads state                   │  'detail-        │   │
│         │ (passive)                     │   drawmode'      │   │
│         │                               └────────┬─────────┘   │
│         │                                        │             │
│         │                           cu_notify    │             │
│         │                                        ▼             │
│         │                        ┌───────────────────────┐    │
│         │                        │   CrossUpdate Core    │    │
│         │                        │  (Generation Counter) │    │
│         │                        │                       │    │
│         │                        │  cu_watch: NONE       │    │
│         │                        │  (no registration)    │    │
│         │                        └───────────┬───────────┘    │
│         │                                    │                │
│         │                                    ▼                │
│         │                        ┌───────────────────────┐    │
│         │                        │   updateState()       │    │
│         │                        │                       │    │
│         │                        │  'detail-drawmode':   │    │
│         │                        │    setDrawMode()      │    │
│         │                        │    sendToWebView()    │    │
│         │                        └───────────┬───────────┘    │
│         │                                    │                │
│         └────────────────────────────────────┤                │
│                   React re-render            │                │
│                   (Toggle reads state)       │                │
│                                              │                │
└──────────────────────────────────────────────┼────────────────┘
                                               │
                                               ▼
                                      ┌─────────────────┐
                                      │   WebView /     │
                                      │   Renderer      │
                                      │   (3D Model)    │
                                      └─────────────────┘

✓ Combo funktioniert
✓ Model wird upgedatet
✓ Toggle zeigt aktuellen State (passiv)
✓ Toggle-Klick hat KEINE Wirkung
✓ Shortcuts 'S'/'P' updaten Combo + Model
```

## Step 2: CrossUpdate Bidirectional Sync Active

```
┌─────────────────────────────────────────────────────────────────┐
│                        React Component                          │
│                                                                 │
│  ┌─────────────────┐                    ┌──────────────────┐   │
│  │ Silver Toggle   │◄───────────────────┤  Draw Mode Picker│   │
│  │                 │                    │   (Combo)        │   │
│  │ value={drawMode │                    │                  │   │
│  │   === 'SILVER'} │                    │ value={drawMode} │   │
│  │                 │                    │                  │   │
│  │ onChange:       │                    │ • LIGHTED        │   │
│  │  cu_notify()    ├───────────────────►│ • WIREFRAME      │   │
│  │  'toggle-silver'│                    │ • POINTS         │   │
│  │                 │                    │ • SILVER         │   │
│  └────────┬────────┘                    │                  │   │
│           │                             │ onChange:        │   │
│           │                             │  cu_notify()     │   │
│           │  cu_notify       cu_notify  │  'detail-        │   │
│           └──────────┐          ┌───────┤   drawmode'      │   │
│                      ▼          ▼       └──────────────────┘   │
│              ┌───────────────────────┐                         │
│              │   CrossUpdate Core    │                         │
│              │  (Generation Counter) │                         │
│              │                       │                         │
│              │  cu_watch registered: │                         │
│              │  ┌─────────────────┐  │                         │
│              │  │ detail-drawmode │  │                         │
│              │  │    watches      │  │                         │
│              │  │ toggle-silver   │  │                         │
│              │  │ → comboFrom     │  │                         │
│              │  │   ToggleFunc    │  │                         │
│              │  └─────────────────┘  │                         │
│              │  ┌─────────────────┐  │                         │
│              │  │ toggle-silver   │  │                         │
│              │  │    watches      │  │                         │
│              │  │ detail-drawmode │  │                         │
│              │  │ → toggleFrom    │  │                         │
│              │  │   ComboFunc     │  │                         │
│              │  └─────────────────┘  │                         │
│              └───────────┬───────────┘                         │
│                          │                                     │
│                          ▼                                     │
│              ┌───────────────────────┐                         │
│              │   Updater Functions   │                         │
│              │                       │                         │
│              │  comboFromToggle():   │                         │
│              │    boolean → string   │                         │
│              │    setDrawMode()      │                         │
│              │    sendToWebView()    │                         │
│              │                       │                         │
│              │  toggleFromCombo():   │                         │
│              │    (no-op)            │                         │
│              │    Toggle reads State │                         │
│              │    ON if === SILVER   │                         │
│              │                       │                         │
│              │  updateState():       │                         │
│              │    direct notify      │                         │
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

✓ Toggle steuert Combo (via CrossUpdate)
✓ Combo steuert Toggle (via CrossUpdate)
✓ Beide updaten Model
✓ Shortcuts 'S'/'P' updaten beide + Model
✓ KEIN Zyklus (Generation Counter)
```

## Key Differences

| Aspect | Step 1 | Step 2 |
|--------|--------|--------|
| Toggle Handler | `// Do nothing` | `cu_notify('toggle-silver', enabled)` |
| Updater Functions | Only `updateState('detail-drawmode')` | Three functions: `comboFromToggleFunc`, `toggleFromComboFunc`, `updateState` |
| CrossUpdate watch | None | `watch('detail-drawmode', 'toggle-silver', comboFromToggleFunc)` + `watch('toggle-silver', 'detail-drawmode', toggleFromComboFunc)` |
| Toggle → Combo | NO | YES (boolean → 'SILVER'/'LIGHTED') |
| Combo → Toggle | NO (passive read) | YES (Toggle reads: `drawMode === 'SILVER'`) |
| Model Update | Only from Combo | From both (Combo direct, Toggle via comboFromToggle) |
| Toggle ON when | Never (passive) | Only when drawMode === 'SILVER' |

## Testing Flow

### Step 1
1. Click Toggle → Nothing happens ✓
2. Select Combo → Model updates ✓
3. Press 'S' → Combo + Model update ✓
4. Toggle shows state passively ✓

### Step 2
1. Click Toggle ON → Combo shows SILVER → Model SILVER ✓
2. Click Toggle OFF → Combo shows LIGHTED → Model LIGHTED ✓
3. Select Combo WIREFRAME → Toggle OFF → Model WIREFRAME ✓
4. Press 'S' → Combo + Toggle + Model all update ✓
5. No flickering/cycles ✓


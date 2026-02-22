# Build-System Dokumentation

## Übersicht

PaDIPS verwendet ein **einheitliches Build-System** basierend auf `build-and-deploy.sh`.

## Build-Prozess

```
┌─────────────────────────────────────────────────────────┐
│  npm run web / npm run build                            │
│  (beide rufen build-and-deploy.sh auf)                  │
└───────────────────────┬─────────────────────────────────┘
                        │
                        ↓
┌─────────────────────────────────────────────────────────┐
│  scripts/build-and-deploy.sh                            │
│                                                          │
│  1. cd padips-web/                                       │
│  2. npm run build (webpack)                             │
│     → dist/renderer.bundle.js                           │
│     → dist/index.html                                   │
│     → dist/textures/*.hdr                               │
│                                                          │
│  3. Kopiere nach assets/webapp/                         │
│     - index.html                                        │
│     - renderer.bundle.js                                │
│     - renderer.bundle.js.txt (mit Cache-Busting)        │
│     - textures/*.hdr                                    │
│                                                          │
│  4. Kopiere nach public/ (für Expo Web)                 │
│     - cube.html (von index.html umbenannt)              │
│     - renderer.bundle.js                                │
│     - textures/*.hdr                                    │
└─────────────────────────────────────────────────────────┘
```

## Verzeichnisstruktur nach Build

```
padips/
├── assets/webapp/          # Für React Native Mobile (WebView)
│   ├── index.html
│   ├── renderer.bundle.js
│   ├── renderer.bundle.js.txt  # Mit Cache-Busting für Metro
│   └── textures/
│       └── rosendal_plains_2_1k-rot.hdr
│
├── public/                 # Für Expo Web (iframe)
│   ├── cube.html          # Von index.html umbenannt
│   ├── renderer.bundle.js
│   └── textures/
│       └── rosendal_plains_2_1k-rot.hdr
│
└── padips-web/dist/       # Webpack Build-Output (temporär)
    ├── index.html
    ├── renderer.bundle.js
    └── textures/
```

## NPM Scripts

| Command | Beschreibung |
|---------|--------------|
| `npm run web` | **Haupt-Command**: Build + Start Expo Web |
| `npm run build` | Build ohne Start (ruft `build-and-deploy.sh`) |
| `npm run clean` | Löscht `public/` |
| `npm run android` | Build + Start Android |
| `npm run ios` | Build + Start iOS |

## Plattform-spezifische Unterschiede

### Web (Expo)
- Lädt `public/cube.html` als iframe
- Direkter Zugriff auf `renderer.bundle.js`
- Texturen von `public/textures/`

### Mobile (iOS/Android)
- Kopiert Dateien aus `assets/webapp/` in Cache
- Verwendet `renderer.bundle.js.txt` (Metro-Workaround)
- WebView lädt aus `file://` Cache
- Cache-Busting via Timestamp-Kommentar

## Cache-Busting für Mobile

Das Script `scripts/cache-bust.py` fügt einen Timestamp-Kommentar am Anfang von `renderer.bundle.js.txt` hinzu:

```javascript
// Cache bust: 2026-02-22T15:30:45.123456
(function() { ... })();
```

Dies zwingt Metro, die Datei neu zu laden, selbst wenn der Inhalt identisch ist.

**Hinweis:** Cache-Busting benötigt `python3`. Falls nicht verfügbar, wird die Datei ohne Cache-Busting kopiert (mit Warnung). In diesem Fall kann Metro ggf. eine gecachte Version verwenden.

```bash
# Cache-Busting prüfen
python3 --version  # Sollte Python 3.x anzeigen

# Falls nicht installiert (optional):
# macOS: brew install python3
# Linux: apt install python3 / yum install python3
```

## Troubleshooting

### Build schlägt fehl
```bash
# Prüfe ob webpack installiert ist
cd padips-web
npm install

# Dann zurück zum Root und erneut builden
cd ..
npm run build
```

### "public/ is missing"
```bash
npm run build
```

### Mobile zeigt alten Code
```bash
# Expo Cache löschen
npx expo start -c
```

## Historie

- **Vor Feb 2026**: Zwei Build-Systeme (`bundle-html.js` + `build-and-deploy.sh`)
- **Ab Feb 2026**: Nur noch `build-and-deploy.sh` (einheitlich, vollständig)

`bundle-html.js` wurde entfernt, da es:
- Nicht nach `public/` kopierte (Web funktionierte nicht)
- Keine `.txt` Version erstellte (Mobile Cache-Probleme)
- Keine Texturen nach `public/` kopierte


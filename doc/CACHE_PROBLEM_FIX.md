# Cache Problem Fix

**Problem:** "Old code in bundle" - App lädt alte Version trotz neuem Build

## 🚀 Schnelle Lösung

### Methode 1: Clean-Start Script (Empfohlen)
```bash
npm run clean-start
```

Das Script:
1. ✅ Stoppt alle Expo-Prozesse
2. ✅ Löscht `node_modules/.cache`
3. ✅ Löscht `.expo` Cache
4. ✅ Löscht Metro Cache
5. ✅ Baut WebApp neu
6. ✅ Startet Expo mit `-c` Flag

### Methode 2: Manuell
```bash
# 1. Stop Expo
Ctrl+C

# 2. Clean caches
rm -rf node_modules/.cache
rm -rf .expo
rm -rf /tmp/metro-*

# 3. Rebuild WebApp
npm run build

# 4. Start with clear cache
npx expo start -c
```

### Methode 3: Auf dem Gerät
1. **App komplett schließen** (aus Recent Apps entfernen)
2. **Expo Dev Menu öffnen:** Shake device oder `adb shell input keyevent 82`
3. **"Reload"** antippen
4. Wenn das nicht hilft: **App deinstallieren** und `npx expo run:android` neu ausführen

## 📋 Wann tritt das Problem auf?

### Cache-Probleme entstehen wenn:
- WebApp (`renderer.bundle.js`) wird neu gebaut
- Aber Expo/Metro hat alte Version im Cache
- Asset-Loading lädt gecachte `.txt` Datei

### Symptome:
```
LOG  ⚠️ OLD code in bundle - need to restart Expo!
LOG  Run: npx expo start -c
```

## 🔍 Verifizierung

### Nach dem Fix sollte erscheinen:
```
LOG  ✓ NEW code found in bundle!
```

### Prüfen welcher Code geladen wird:
```javascript
// In padips-web/src/renderer.ts (bereits eingebaut)
console.log('INIT: Cube created', this.cube ? 'SUCCESS' : 'FAILED');
```

Wenn diese Zeile im Log erscheint → **Neuer Code** ✅

## 🛠️ Development Workflow

### Best Practice:
```bash
# Nach Änderungen an padips-web/
npm run clean-start
```

### Normales Development (nur React Native UI):
```bash
# Keine WebApp-Änderungen → normaler Start OK
npm start
```

### Production Build:
```bash
# Clean everything
npm run clean
npm run build

# Android Release
cd android
./gradlew clean
./gradlew assembleRelease
```

## 📝 Cache-Hierarchie

```
1. Metro Bundler Cache     → /tmp/metro-*
2. Node Modules Cache      → node_modules/.cache
3. Expo Cache              → .expo
4. Android Build Cache     → android/build/
5. WebApp Webpack Cache    → padips-web/dist/
```

### Wann welchen Cache löschen?

| Problem | Cache löschen |
|---------|---------------|
| WebApp-Änderungen nicht sichtbar | 1, 2, 3 |
| React Native UI-Änderungen nicht sichtbar | 1, 2 |
| Android Build-Fehler | 4 |
| Webpack Build-Fehler | 5 |

## 🎯 Automatisierung

### Git Hook (Optional)
```bash
# .git/hooks/post-merge
#!/bin/bash
echo "🔄 Running clean-start after git pull..."
npm run clean-start
```

### Makefile (Optional)
```makefile
.PHONY: clean-start
clean-start:
	@bash scripts/clean-and-start.sh

.PHONY: full-clean
full-clean:
	rm -rf node_modules/.cache
	rm -rf .expo
	rm -rf /tmp/metro-*
	cd android && ./gradlew clean
	cd padips-web && rm -rf dist node_modules/.cache
```

## ❓ FAQ

**Q: Warum nicht immer `npx expo start -c`?**  
A: Das `-c` Flag ist langsamer (löscht bei jedem Start). Nur nötig nach WebApp-Änderungen.

**Q: Reicht `npm run build` nicht?**  
A: Nein, weil Metro/Expo bereits gecachte Assets hat. Build aktualisiert nur `assets/webapp/`.

**Q: Warum `.txt` Dateiendung?**  
A: Metro würde `.js` Dateien selbst bundlen. `.txt` wird als Asset behandelt und unverändert kopiert.

**Q: Kann ich den Check automatisieren?**  
A: Ja! Siehe `loadWebApp()` in App.js:
```javascript
if (jsContent.includes('INIT: Cube created')) {
  console.log("✓ NEW code found in bundle!");
} else {
  console.log("⚠️ OLD code in bundle - need to restart Expo!");
}
```

---

**Zusammenfassung:** Bei "OLD code" Warnung → `npm run clean-start` 🚀


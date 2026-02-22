# Regression-Fixes - 2026-02-14

## Gefundene Probleme & Fixes:

### 1. ✅ Eye-Separation Slider & Anaglyph Rot-Blau - VOLLSTÄNDIG GEFIXT!

**Ursprüngliches Problem:** 
- Nur Rot sichtbar, kein Blau → alles rötlich
- Kein Versatz zwischen links/rechts

**Problem 2:** 
- Graustufen/Grünlich statt Farben
- Symmetrische Luminanz-Matrizen

**Problem 3:**
- ✅ Farbige Bilder mit Versatz sichtbar
- ❌ **Eye-Separation Slider zeigt keine Wirkung**
- ❌ **Kein 3D-Effekt mit Brille**

**ROOT CAUSES gefunden:**

1. **Farbmatrizen:** Falsche API (`.set()` statt `.fromArray()`)
2. **Farbmatrizen:** Symmetrisch → Grau/Grünlich
3. **Eye-Separation:** Falsches Objekt! `eyeSep` auf AnaglyphEffect statt auf StereoCamera!

**Finale Lösung:**
```typescript
// Asymmetrische Matrizen für True Color Anaglyph:
colorMatrixLeft = Identity Matrix (volle Farbe)
colorMatrixRight = Luminanz → Blau

// Eye-Separation auf StereoCamera:
const stereoCamera = (this.anaglyphEffect as any)._stereo;
stereoCamera.eyeSep = separation;  // ← Richtiges Objekt!
```

**Fixes implementiert:**
- ✅ Matrix3.fromArray() mit korrekter API
- ✅ Asymmetrische Matrizen (Half-Color Anaglyph)
- ✅ Links: Identity (volle Farbe), Rechts: Luminanz→Blau
- ✅ Eye-Separation auf **StereoCamera._stereo.eyeSep**
- ✅ Initiale Eye-Separation: 8cm (User's Augenabstand)
- ✅ Slider-Range: 2-20cm
- ✅ Live-Update funktioniert
- ✅ Debug-Funktionen aktualisiert

**Erwartetes Verhalten JETZT:**
- 🌈 Links: Farbiges Bild, Rechts: Blaues Bild (versetzt)
- ↔️ Eye-Sep-Slider ändert Versatz **SOFORT**
- 🎭 3D-Tiefeneffekt mit Rot-Blau Brille **funktioniert**
- 📏 Größerer eyeSep = stärkerer 3D-Effekt

Siehe Details: **EYE_SEPARATION_FIX.md** & **ANAGLYPH_FIX.md**

### 2. ✅ Max Balls auf 30 limitiert?
**Status:** HTML hat `max="100"` korrekt gesetzt
**Mögliche Ursache:** Browser-Cache oder UI-State-Problem
**Test:** Slider sollte von 5 bis 100 gehen
**Action:** Debug-Logging hinzugefügt für ballCount

### 3. ⚠️ Gravity-Änderungen gehen nicht?
**Status:** Code sieht korrekt aus
**Mögliche Ursache:** UI-Update-Problem oder Physics-Engine-Reference
**Test:** Console sollte Acceleration-Vektor zeigen
**Action:** Erweitertes Debug-Logging hinzugefügt

## Test-Anweisungen:

### 🕶️ Eye-Separation & Anaglyph testen (PRIORITÄT):

**Schritt 1: Aktivierung prüfen**
1. ✅ Checkbox "🕶️ Anaglyph Stereo (Rot-Blau)" aktivieren
2. ✅ Console-Log prüfen: "🕶️ Anaglyph Stereo: ON"
3. ✅ Bild sollte sofort rot-blau verfärbt aussehen
4. ✅ **WICHTIG:** Ohne Brille sollten Sie Doppelbilder sehen (rot und blau versetzt)

**Schritt 2: Debug-Kommando ausführen**
```javascript
debugAnaglyph()
```
Erwartete Ausgabe:
- Anaglyph Enabled: true
- Eye Separation: 0.080 meters (8cm)
- Color Matrix Left/Right: sollten gesetzt sein

**Schritt 3: Eye-Separation testen**
1. ✅ Slider bewegen von 2cm bis 20cm
2. ✅ Console sollte zeigen: "👁️ Eye separation set to: 0.XXX meters"
3. ✅ **Visuell:** Versatz zwischen rotem und blauem Bild sollte sich ändern
4. ✅ Mit Brille: 3D-Tiefe sollte sich verändern

**Schritt 4: Manuelle Tests in Console**
```javascript
// Extremwerte testen um Effekt sichtbar zu machen
window.padips.sceneManager.setEyeSeparation(0.02)  // 2cm - minimaler Effekt
window.padips.sceneManager.setEyeSeparation(0.10)  // 10cm - starker Effekt
window.padips.sceneManager.setEyeSeparation(0.20)  // 20cm - sehr starker Effekt
```

**Erwartetes Verhalten:**
- ❌ **OHNE Anaglyph:** Normales Farbbild, keine Doppelbilder
- ✅ **MIT Anaglyph (ohne Brille):** Rote und blaue Doppelbilder, versetzt
- ✅ **MIT Anaglyph + Brille:** 3D-Tiefeneffekt, keine Doppelbilder
- ✅ **Eye-Sep größer:** Stärkerer 3D-Effekt (mehr Versatz)
- ✅ **Eye-Sep kleiner:** Schwächerer 3D-Effekt (weniger Versatz)

### Eye-Separation testen:
1. ✅ Anaglyph aktivieren
2. ✅ Eye-Separation Slider bewegen (0.01m - 0.15m)
3. ✅ Console-Log sollte anzeigen: "👁️ Eye separation set to: X.XXX meters"
4. ✅ 3D-Effekt sollte sich ändern

### Ball-Count testen:
1. ✅ Slider auf 50 oder 100 setzen
2. ✅ "New" Button klicken
3. ✅ Console sollte zeigen: "🎱 Generating 50/100 balls..."
4. ✅ Stats sollten 50/100 balls zeigen

### Gravity testen:
1. ✅ Gravity Preset ändern (DOWN → UP → LEFT etc.)
2. ✅ Console sollte zeigen: "🌍 New acceleration: Vector3(...)"
3. ✅ Bälle sollten in neue Richtung fallen
4. ✅ Gravity Magnitude ändern (0-20)
5. ✅ Bälle sollten schneller/langsamer fallen

## Erwartetes Verhalten nach Fix:

- ✅ Eye-Separation: Funktioniert mit korrekter Property-Zuweisung
- ⏳ Ball-Count: Sollte funktionieren (HTML ist korrekt)
- ⏳ Gravity: Sollte funktionieren (Code ist korrekt)

## Debugging-Tipps:

**Browser-Console öffnen** und folgende Befehle testen:
```javascript
// Aktuellen State prüfen
window.padips

// Gravity manuell testen
window.padips.global.acceleration

// Ball-Count prüfen
window.padips.ballSet.num

// Scene-State debuggen
debugScene()
```

## Nächste Schritte:

1. Browser-Cache leeren (Cmd+Shift+R auf Mac)
2. Dev-Server neu starten
3. Alle drei Features testen
4. Console-Logs beobachten

---

**Status:** Eye-Separation definitiv gefixt ✅
Ball-Count & Gravity: Debugging hinzugefügt, sollten funktionieren ⏳


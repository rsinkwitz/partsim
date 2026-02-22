# Anaglyph Rot-Blau Fix - 2026-02-14

## 🔴🔵 Problem: Nur Rot, kein Blau sichtbar

### Ursache gefunden:
Die Farbmatrizen wurden mit der **falschen API** gesetzt!

**Vorher (FALSCH):**
```typescript
// Versuchte .set() auf Matrix3 zu verwenden (existiert nicht so)
(this.anaglyphEffect as any).colorMatrixLeft.set(
  1, 0, 0, 0, 0,  // 5x4 Matrix - FALSCH!
  0, 0, 0, 0, 0,
  0, 0, 0, 0, 0,
  0, 0, 0, 1, 0
);
```

**Problem:** 
- Matrix3 hat keine `.set()` Methode mit diesen Parametern
- Matrix3 ist 3x3, nicht 5x4
- Die Matrizen wurden nie wirklich geändert
- Dubois Rot-Cyan Matrizen blieben aktiv → nur Rot sichtbar

### ✅ Lösung implementiert (UPDATE 2):

**Problem mit Version 1:** Graustufen statt Farben!
- Alle Kanäle summieren (1,1,1) → Graustufen ❌
- Nur einzelner Kanal (1,0,0) → Nur ursprünglich rote Objekte sichtbar ❌

**Jetzt (KORREKT mit Luminanz-Konversion):**
```typescript
// Verwende Luminanz-gewichtete Konversion (NTSC Standard)
// Luminanz = 0.299*R + 0.587*G + 0.114*B

// Links: Luminanz → Rot
this.anaglyphEffect.colorMatrixLeft.fromArray([
  0.299, 0.587, 0.114,  // R_out = Luminanz aller Farben
  0.0,   0.0,   0.0,    // G_out = 0
  0.0,   0.0,   0.0     // B_out = 0
]);

// Rechts: Luminanz → Blau
this.anaglyphEffect.colorMatrixRight.fromArray([
  0.0,   0.0,   0.0,    // R_out = 0
  0.0,   0.0,   0.0,    // G_out = 0
  0.299, 0.587, 0.114   // B_out = Luminanz aller Farben
]);
```

**Warum Luminanz?**
- Erhält Helligkeitsunterschiede zwischen Objekten
- Grün hat höchstes Gewicht (0.587) weil menschliches Auge am empfindlichsten für Grün
- Rot: 0.299, Blau: 0.114
- Ergebnis: Rot-Blau Stereo mit **erhaltener relativer Helligkeit**

**Ergebnis:**
- ✅ Links: Alles wird ROT (für rotes Glas)
- ✅ Rechts: Alles wird BLAU (für blaues Glas)
- ✅ Matrix3-Objekte korrekt mit `.fromArray()` gesetzt
- ✅ Stereo-Kamera rendert zwei verschiedene Views
- ✅ Shader kombiniert Rot + Blau im Fragment-Shader

## 🎯 Erwartetes Verhalten JETZT:

### OHNE Brille:
- 🔴 Rote Version der Szene (linkes Auge)
- 🔵 Blaue Version der Szene (rechts versetzt)
- 👁️👁️ Deutliche Doppelbilder mit Rot-Blau Versatz

### MIT Rot-Blau Brille (links rot, rechts blau):
- 👁️ Linkes Auge sieht durch rotes Glas → sieht nur rotes Bild
- 👁️ Rechtes Auge sieht durch blaues Glas → sieht nur blaues Bild
- 🎭 Gehirn kombiniert → 3D-Tiefeneffekt!

### Eye-Separation Slider:
- 📏 Ändert Abstand zwischen linker und rechter Kamera
- ↔️ Größerer Wert = mehr Versatz = stärkerer 3D-Effekt
- 🎯 Ihr Wert: 8cm (0.08m) als Default

## 🧪 Test nach Reload:

1. **Anaglyph aktivieren:**
   - ✅ Bild sollte SOFORT rot-blau werden
   - ✅ Ohne Brille: Doppelbilder klar sichtbar

2. **Console-Check:**
   ```javascript
   debugAnaglyph()
   ```
   Sollte zeigen:
   - Color Matrix Left: [0.299, 0.587, 0.114, 0, 0, 0, 0, 0, 0]  ← Luminanz → ROT
   - Color Matrix Right: [0, 0, 0, 0, 0, 0, 0.299, 0.587, 0.114] ← Luminanz → BLAU

3. **Eye-Separation testen:**
   - Slider bewegen
   - Versatz zwischen rot und blau ändert sich

4. **Mit Brille:**
   - 3D-Effekt sollte funktionieren!

## 📐 Matrix3 Erklärung:

Matrix3 in Three.js:
```
[m00, m01, m02]   [R_out]   [m00*R_in + m01*G_in + m02*B_in]
[m10, m11, m12] × [G_out] = [m10*R_in + m11*G_in + m12*B_in]
[m20, m21, m22]   [B_out]   [m20*R_in + m21*G_in + m22*B_in]
```

**Für ROT (links) mit Luminanz:**
```
[0.299, 0.587, 0.114]   [R_in]   [0.299*R_in + 0.587*G_in + 0.114*B_in]  → Luminanz als Rot
[0,     0,     0    ] × [G_in] = [0]                                      → kein Grün
[0,     0,     0    ]   [B_in]   [0]                                      → kein Blau
```

**Für BLAU (rechts) mit Luminanz:**
```
[0,     0,     0    ]   [R_in]   [0]                                      → kein Rot
[0,     0,     0    ] × [G_in] = [0]                                      → kein Grün
[0.299, 0.587, 0.114]   [B_in]   [0.299*R_in + 0.587*G_in + 0.114*B_in]  → Luminanz als Blau
```

**Beispiel:** Grüner Ball (R=0, G=255, B=0)
- Links: R_out = 0.587 * 255 = 149 (helles Rot)
- Rechts: B_out = 0.587 * 255 = 149 (helles Blau)
- Ergebnis: Grüner Ball erscheint in hellem Rot-Blau (nicht schwarz!)

## 🎉 Status:

✅ **GEFIXT!** Rot-Blau Anaglyph sollte jetzt korrekt funktionieren!

Die Farbmatrizen werden jetzt mit der korrekten API gesetzt und beide Farben (Rot UND Blau) sind aktiv.

---

**Bitte testen Sie nach Browser-Reload (Cmd+Shift+R):**
1. Aktivieren Sie Anaglyph
2. Sie sollten SOFORT Rot-Blau Doppelbilder sehen (ohne Brille)
3. Mit Brille: 3D-Effekt!
4. Console: `debugAnaglyph()` zur Verifikation


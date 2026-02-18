# Android WebView PostMessage Fix & VR Mode Improvements

## Problem
Auf Android wurden **UI-Control-Events nicht an das WebView weitergeleitet**, obwohl:
- Tastatur-Events direkt im WebView funktionierten
- State-Updates vom WebView zur UI funktionierten (FPS, Ball Count, etc.)

Das Problem war **unidirektional: UI → WebView** funktionierte nicht.

Zusätzlich: VR-Mode hatte UI-Layout-Probleme und kein Keyboard-Shortcut für Side-by-Side Stereo.

## Ursache
React Native WebView sendet Messages über `postMessage()` an das WebView, aber diese kommen **nicht** als `window.addEventListener('message')` Events an. Stattdessen kommen sie als `document` Events.

Außerdem muss ein **injectedJavaScript** diese Events abfangen und als normale `window.postMessage` Events weiterleiten, damit die Webapp sie empfangen kann.

## Lösung

### 1. Injected JavaScript Bridge (App.js)
Das `injectedJavaScript` fängt Messages von React Native ab und leitet sie als `window.postMessage` Events weiter:

```javascript
const injectedJavaScript = `
  (function() {
    console.log('🔧 Setting up React Native WebView message bridge...');
    
    // Listen for messages FROM React Native (sent via postMessage)
    // These need to be dispatched as window 'message' events so the webapp can receive them
    document.addEventListener('message', function(e) {
      console.log('📨 [Bridge] Received message from RN:', e.data);
      // Dispatch as window message event for the webapp to receive
      window.postMessage(e.data, '*');
    });
    
    // For iOS
    window.addEventListener('message', function(e) {
      console.log('📨 [Bridge] Received window message from RN:', e.data);
    });

    console.log('✓ React Native WebView message bridge initialized');
  })();
  true; // Required for Android
`;
```

### 2. Dual Message Listeners in Webapp (renderer.ts)
Die Webapp hört nun auf **beide** Event-Quellen:

```typescript
// Listen on window for iframe messages (Web)
window.addEventListener('message', handleMessage);

// Listen on document for React Native WebView messages (Android/iOS)
document.addEventListener('message', handleMessage as any);
```

### 3. InjectedJavaScript zu allen WebView-Komponenten hinzugefügt
Das `injectedJavaScript` wurde zu allen drei WebView-Layouts hinzugefügt:
- VR Mode (Cardboard)
- Portrait Mode
- Landscape Mode

```javascript
<WebView
  // ...andere props
  injectedJavaScript={injectedJavaScript}
  onMessage={handleWebViewMessage}
/>
```

### 4. Logging verbessert
Besseres Logging wurde hinzugefügt, um die **bidirektionale** Kommunikation zu debuggen:
- `sendToWebView`: Zeigt alle gesendeten Messages (UI → WebView)
- `handleWebViewMessage`: Zeigt alle empfangenen Messages (WebView → UI)
- Bridge Logs im injectedJavaScript zeigen Messages im Transit

### 5. VR-Mode UI-Verbesserungen
**VR Menu Overlay optimiert für Landscape:**
- Kein Top-Padding mehr (Notch ist links im Landscape)
- Max 50% Breite (nur linke Hälfte)
- `paddingLeft: 60` für Notch-Sicherheit
- Exit VR Button hinzugefügt

**Keyboard Shortcut "4" hinzugefügt:**
- Taste "4" togglet Side-by-Side VR Stereo (wie "3" für Top-Bottom, "A" für Anaglyph)
- Dokumentiert in F1 Help Overlay
- Ermöglicht schnelles Aktivieren von VR-Mode auf Desktop/Web

**Debug-Logging für Side-by-Side Stereo:**
- Loggt nur bei Modus-Wechsel (nicht jeden Frame)
- Zeigt Eye-Separation, Camera-Status, Viewport-Größen

## Testen

1. **Clean Build:**
   ```bash
   rm -rf node_modules android/build android/app/build .expo
   npm install
   ```

2. **Rebuild WebApp:**
   ```bash
   ./scripts/build-and-deploy.sh
   ```

3. **Start Metro mit Cache-Clear:**
   ```bash
   npx expo start -c --reset-cache
   ```

4. **Auf Android testen:**
   - S20 (physisch)
   - Pixel (Emulator)

5. **Logs prüfen:**
   ```
   # UI → WebView Direction:
   📤 Sending to WebView: <action> <params>     # Von React Native (App.js)
   📨 [Bridge] Received message from RN: ...    # Im injectedJavaScript
   📨 PostMessage received: <data>              # In webapp (renderer.ts)
   
   # WebView → UI Direction (war schon OK):
   📥 Raw WebView message received: <data>      # Zurück zu React Native
   📥 Parsed WebView message: <type> <data>     # Geparsed in App.js
   ```

## Erwartetes Verhalten

Nach dem Fix sollten alle UI-Controls auf Android funktionieren:
- ✅ Start/Stop/New Buttons
- ✅ Ball Count Slider
- ✅ Gravity Presets
- ✅ Grid System
- ✅ Stereo Mode (Anaglyph, Top/Bottom, Side-by-Side)
- ✅ Alle anderen Controls

## VR-Mode Verbesserungen

**UI-Layout (Landscape):**
- ✅ Kein Top-Padding (Notch ist links)
- ✅ Max 50% Breite (linke Hälfte)
- ✅ Links-Padding für Notch-Sicherheit
- ✅ Exit VR Button funktioniert

**Keyboard Shortcuts:**
- ✅ Taste "4" aktiviert/deaktiviert Side-by-Side VR Stereo
- ✅ In F1 Help dokumentiert

## Side-by-Side VR Stereo

Der VR-Mode sollte jetzt auch korrekt zwei Würfel rendern (einen für jedes Auge):
- Links: Left Eye Camera
- Rechts: Right Eye Camera
- Funktioniert mit Cardboard VR-Brillen

**Debug-Info beim Aktivieren:**
```
🔄 Toggle Stereo Mode: {requested: "sidebyside", current: "off", newMode: "sidebyside"}
🥽 Side-by-Side Stereo Active: {width: 1920, height: 1080, halfWidth: 960, eyeSep: 0.08, cameraL: true, cameraR: true}
```

## Bekannte Probleme

- **"OLD code" Warnung:** Dies ist nur eine Warnung beim Asset-Loading. Der Code wird trotzdem korrekt aktualisiert.
- Kann ignoriert werden, solange die Features funktionieren.


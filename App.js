import React, { useState, useEffect, useRef } from "react";
import { StyleSheet, Platform, ActivityIndicator, View, Text, TouchableOpacity, ScrollView } from "react-native";
import { WebView } from "react-native-webview";
import { SafeAreaView, SafeAreaProvider } from "react-native-safe-area-context";
import * as FileSystem from "expo-file-system/legacy";
import { Asset } from "expo-asset";

export default function App() {
  const [webAppUri, setWebAppUri] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const webViewRef = useRef(null);

  // Wrap everything in SafeAreaProvider
  return (
    <SafeAreaProvider>
      <AppContent
        webAppUri={webAppUri}
        setWebAppUri={setWebAppUri}
        loading={loading}
        setLoading={setLoading}
        error={error}
        setError={setError}
        webViewRef={webViewRef}
      />
    </SafeAreaProvider>
  );
}

function AppContent({ webAppUri, setWebAppUri, loading, setLoading, error, setError, webViewRef }) {

  useEffect(() => {
    loadWebApp();
  }, []);

  // Hilfsfunktion um Aktionen an die WebView zu senden
  const sendToWebView = (action, params) => {
    if (webViewRef.current) {
      const message = JSON.stringify({ action, params });
      webViewRef.current.postMessage(message);
    }
  };

  const copyAssetToLocal = async (assetModule, filename) => {
    try {
      const asset = Asset.fromModule(assetModule);
      await asset.downloadAsync();

      const targetPath = `${FileSystem.documentDirectory}webapp/${filename}`;

      // Kopiere die Datei mit der Legacy API
      await FileSystem.copyAsync({
        from: asset.localUri,
        to: targetPath
      });

      return true;
    } catch (err) {
      console.warn(`Could not copy ${filename}:`, err.message);
      return false;
    }
  };

  const loadWebApp = async () => {
    try {
      if (Platform.OS === "web") {
        // Auf Web laden wir die Cube-HTML aus dem public-Ordner
        setWebAppUri("/cube.html");
        setLoading(false);
      } else {
        // Auf Native: Kopiere HTML und JS in ein temporäres Verzeichnis
        const tempDir = `${FileSystem.cacheDirectory}webapp/`;

        // Lösche das alte Verzeichnis, um sicherzustellen, dass wir die neueste Version haben
        const dirInfo = await FileSystem.getInfoAsync(tempDir);
        if (dirInfo.exists) {
          await FileSystem.deleteAsync(tempDir, { idempotent: true });
          console.log("🗑️ Cleared old cache");
        }

        // Erstelle Verzeichnis neu
        await FileSystem.makeDirectoryAsync(tempDir, { intermediates: true });

        // Lade HTML-Asset
        const htmlAsset = Asset.fromModule(require("./assets/webapp/index.html"));
        await htmlAsset.downloadAsync();

        // Kopiere HTML
        await FileSystem.copyAsync({
          from: htmlAsset.localUri,
          to: `${tempDir}index.html`
        });
        console.log("✓ Copied: index.html");

        // Lade JS-Bundle (als .txt um Metro zu umgehen)
        console.log("Loading JS bundle asset...");
        const jsAsset = Asset.fromModule(require("./assets/webapp/renderer.bundle.js.txt"));
        console.log("JS Asset URI:", jsAsset.localUri || "not downloaded yet");
        await jsAsset.downloadAsync();
        console.log("JS Asset downloaded, URI:", jsAsset.localUri);

        // Lese den Inhalt und schreibe als .js
        const jsContent = await FileSystem.readAsStringAsync(jsAsset.localUri);
        const jsSize = jsContent.length;
        console.log("JS Content size:", Math.round(jsSize/1024), "KB");

        await FileSystem.writeAsStringAsync(
          `${tempDir}renderer.bundle.js`,
          jsContent
        );
        console.log("✓ Copied: renderer.bundle.js (" + Math.round(jsSize/1024) + " KB)");

        // Check if new code is in bundle
        if (jsContent.includes('INIT: Cube created')) {
          console.log("✓ NEW code found in bundle!");
        } else {
          console.log("⚠️ OLD code in bundle - need to restart Expo!");
          console.log("Run: npx expo start -c");
        }

        const indexPath = `${tempDir}index.html`;
        console.log("Loading webapp from:", indexPath);
        setWebAppUri(indexPath);
        setLoading(false);
      }
    } catch (error) {
      console.error("Error loading web app:", error);
      setError(error.message);
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={['top', 'bottom', 'left', 'right']}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#3d81f6" />
          <Text style={styles.loadingText}>Loading Web App...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (error) {
    return (
      <SafeAreaView style={styles.container} edges={['top', 'bottom', 'left', 'right']}>
        <View style={styles.loadingContainer}>
          <Text style={styles.errorText}>Error: {error}</Text>
          <Text style={styles.errorDetails}>{error}</Text>
        </View>
      </SafeAreaView>
    );
  }

  // Hilfsfunktion um Aktionen an iframe zu senden (für Web)
  const sendToIframe = (action, params) => {
    if (webViewRef.current && webViewRef.current.contentWindow) {
      const message = JSON.stringify({ action, params });
      webViewRef.current.contentWindow.postMessage(message, '*');
    }
  };

  // Auf Web verwenden wir einen iframe statt WebView für bessere Kompatibilität
  if (Platform.OS === "web") {
    return (
      <View style={styles.container}>
        {/* Control Buttons - EINE Zeile auf Web: Shapes dann Actions */}
        <View style={styles.controlsContainer}>
          <View style={styles.buttonRowSingle}>
            <TouchableOpacity style={styles.button} onPress={() => sendToIframe('morph', 0)}>
              <Text style={styles.buttonText}>3x3</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.button} onPress={() => sendToIframe('morph', 1)}>
              <Text style={styles.buttonText}>2x2</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.button} onPress={() => sendToIframe('morph', 3)}>
              <Text style={styles.buttonText}>Pyra</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.button} onPress={() => sendToIframe('mirror')}>
              <Text style={styles.buttonText}>🪞 Mirror</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.button} onPress={() => sendToIframe('undo')}>
              <Text style={styles.buttonText}>↶ Undo</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.button} onPress={() => sendToIframe('redo')}>
              <Text style={styles.buttonText}>↷ Redo</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.button} onPress={() => sendToIframe('shuffle', 10)}>
              <Text style={styles.buttonText}>🎲 Shuffle</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* iframe für Web */}
        <iframe
          ref={webViewRef}
          src={webAppUri}
          style={{
            width: "100%",
            flex: 1,
            border: "none",
          }}
          title="Rubik's Cube Simulator"
        />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      {/* Control Buttons - ZWEI Zeilen auf Mobile: Shapes oben, Actions unten */}
      <View style={styles.controlsContainer}>
        <View style={styles.buttonRow}>
          <TouchableOpacity style={styles.button} onPress={() => sendToWebView('morph', 0)}>
            <Text style={styles.buttonText}>3x3</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.button} onPress={() => sendToWebView('morph', 1)}>
            <Text style={styles.buttonText}>2x2</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.button} onPress={() => sendToWebView('morph', 3)}>
            <Text style={styles.buttonText}>Pyra</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.button} onPress={() => sendToWebView('mirror')}>
            <Text style={styles.buttonText}>🪞 Mirror</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.buttonRow}>
          <TouchableOpacity style={styles.button} onPress={() => sendToWebView('undo')}>
            <Text style={styles.buttonText}>↶ Undo</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.button} onPress={() => sendToWebView('redo')}>
            <Text style={styles.buttonText}>↷ Redo</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.button} onPress={() => sendToWebView('shuffle', 10)}>
            <Text style={styles.buttonText}>🎲 Shuffle</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* WebView */}
      <WebView
        ref={webViewRef}
        source={{ uri: webAppUri }}
        style={styles.webview}
        originWhitelist={['*', 'file://', 'http://', 'https://']}
        javaScriptEnabled={true}
        domStorageEnabled={true}
        allowsInlineMediaPlayback={true}
        mediaPlaybackRequiresUserAction={false}
        allowFileAccess={true}
        allowUniversalAccessFromFileURLs={true}
        allowFileAccessFromFileURLs={true}
        mixedContentMode="always"
        onError={(syntheticEvent) => {
          const { nativeEvent } = syntheticEvent;
          console.error("WebView error: ", nativeEvent);
        }}
        onHttpError={(syntheticEvent) => {
          const { nativeEvent } = syntheticEvent;
          console.error("WebView HTTP error: ", nativeEvent);
        }}
        onLoadEnd={() => {
          console.log("WebView loaded successfully");
        }}
        onConsoleMessage={(event) => {
          console.log("WebView console:", event.nativeEvent.message);
        }}
        onMessage={(event) => {
          // This enables two-way communication
          console.log("Message from WebView:", event.nativeEvent.data);
        }}
        injectedJavaScript={`
          // Ensure document and window are available before any script loads
          console.log('=== WebView Init ===');
          console.log('document:', typeof document);
          console.log('window:', typeof window);
          console.log('document.readyState:', document.readyState);

          if (typeof document === 'undefined') {
            console.error('CRITICAL: document is undefined in WebView');
          }
          if (typeof window === 'undefined') {
            console.error('CRITICAL: window is undefined in WebView');
          }

          // Check if script tags are present
          setTimeout(() => {
            const scripts = document.getElementsByTagName('script');
            console.log('Number of script tags:', scripts.length);
            for (let i = 0; i < scripts.length; i++) {
              console.log('Script', i, ':', scripts[i].src || 'inline');
            }
          }, 100);

          // Leite console.log an React Native weiter
          const originalLog = console.log;
          console.log = function(...args) {
            // Rufe original console.log auf
            originalLog.apply(console, args);
            // Sende an React Native
            try {
              const message = args.map(arg =>
                typeof arg === 'object' ? JSON.stringify(arg) : String(arg)
              ).join(' ');
              window.ReactNativeWebView.postMessage(JSON.stringify({
                type: 'log',
                message: message
              }));
            } catch (e) {
              // Ignoriere Fehler beim Weiterleiten
            }
          };

          // Fange alle Fehler ab
          window.onerror = function(message, source, lineno, colno, error) {
            window.ReactNativeWebView.postMessage(JSON.stringify({
              type: 'error',
              message: message,
              source: source,
              lineno: lineno,
              colno: colno,
              stack: error ? error.stack : null
            }));
            return false;
          };

          // Fange unbehandelte Promise-Fehler ab
          window.addEventListener('unhandledrejection', function(event) {
            window.ReactNativeWebView.postMessage(JSON.stringify({
              type: 'unhandledrejection',
              reason: String(event.reason)
            }));
          });

          console.log('WebView error handler initialized');

          // Debugging: Prüfe DOM und Three.js nach dem Laden
          setTimeout(function() {
            var containerEl = document.getElementById('container');
            var containerHTML = containerEl ? containerEl.innerHTML : 'not found';
            var debug = {
              container: containerEl ? 'exists' : 'not found',
              canvas: document.querySelector('canvas') ? 'exists' : 'not found',
              THREE: typeof THREE !== 'undefined',
              cube: typeof cube !== 'undefined',
              containerHTML: containerHTML.substring(0, 100) + '...'
            };
            console.log('DEBUG INFO:', JSON.stringify(debug, null, 2));
            window.ReactNativeWebView.postMessage(JSON.stringify({
              type: 'debug',
              data: debug
            }));
          }, 2000);

          true;
        `}
        onMessage={(event) => {
          try {
            const data = JSON.parse(event.nativeEvent.data);
            if (data.type === 'error' || data.type === 'unhandledrejection') {
              console.error("❌ WebView JS Error:", JSON.stringify(data, null, 2));
            } else if (data.type === 'debug') {
              console.log("🔍 DEBUG INFO:", JSON.stringify(data.data, null, 2));
            } else if (data.type === 'log') {
              // Leite console.log aus dem WebView weiter
              console.log("📱 WebView:", data.message);
            } else {
              console.log("WebView message:", JSON.stringify(data, null, 2));
            }
          } catch (e) {
            console.log("WebView message:", event.nativeEvent.data);
          }
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Platform.OS === 'ios' ? "#f5f5f5" : "#fff",
  },
  controlsContainer: {
    backgroundColor: "#f5f5f5",
    paddingTop: 8,
    paddingBottom: 8,
    paddingHorizontal: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#ddd",
  },
  buttonRow: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    marginVertical: 4,
  },
  buttonRowSingle: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    flexWrap: "wrap",
    marginVertical: 4,
  },
  button: {
    backgroundColor: "#3d81f6",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    marginHorizontal: 4,
    elevation: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  buttonText: {
    color: "white",
    fontSize: 16,
    fontWeight: "bold",
  },
  webview: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: "#666",
  },
  errorText: {
    fontSize: 18,
    fontWeight: "bold",
    color: "red",
    textAlign: "center",
    padding: 20,
  },
  errorDetails: {
    fontSize: 14,
    color: "#666",
    textAlign: "center",
    padding: 10,
  },
});

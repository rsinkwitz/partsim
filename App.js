import React, { useState, useEffect, useRef } from "react";
import { StyleSheet, Platform, ActivityIndicator, View, Text, TouchableOpacity, ScrollView, Switch } from "react-native";
import { WebView } from "react-native-webview";
import { SafeAreaView, SafeAreaProvider } from "react-native-safe-area-context";
import * as FileSystem from "expo-file-system/legacy";
import { Asset } from "expo-asset";
import Slider from '@react-native-community/slider';

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
  // UI State
  const [ballCount, setBallCount] = useState(30);
  const [calcFactor, setCalcFactor] = useState(10);
  const [gridEnabled, setGridEnabled] = useState(false);
  const [gridSegments, setGridSegments] = useState(8);
  const [showWorldGrid, setShowWorldGrid] = useState(false);
  const [showOccupiedVoxels, setShowOccupiedVoxels] = useState(false);
  const [showCollisionChecks, setShowCollisionChecks] = useState(false);

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
      <View style={styles.containerWeb}>
        {/* PaDIPS Control Panel - Links wie im Original */}
        <ScrollView style={styles.sidebarWeb} contentContainerStyle={styles.sidebarContent}>
          <Text style={styles.title}>🎱 PaDIPS</Text>

          {/* Main Controls */}
          <View style={styles.section}>
            <View style={styles.buttonRow}>
              <TouchableOpacity style={styles.startButton} onPress={() => sendToIframe('start')}>
                <Text style={styles.buttonText}>▶ Start</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.stopButton} onPress={() => sendToIframe('stop')}>
                <Text style={styles.buttonText}>⏸ Stop</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.newButton} onPress={() => sendToIframe('new')}>
                <Text style={styles.buttonText}>✨ New</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Stats */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>📊 Stats</Text>
            <Text style={styles.statText}>FPS: --</Text>
            <Text style={styles.statText}>Balls: {ballCount}</Text>
            <Text style={styles.statText}>Generation: 0</Text>
          </View>

          {/* Balls Section */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>🎱 Balls</Text>
            <View style={styles.sliderContainer}>
              <Text style={styles.label}>Number of Balls: {ballCount}</Text>
              <Slider
                style={styles.slider}
                minimumValue={5}
                maximumValue={1000}
                step={5}
                value={ballCount}
                onValueChange={setBallCount}
                onSlidingComplete={(value) => {
                  sendToIframe('setBallCount', value);
                }}
                minimumTrackTintColor="#4CAF50"
                maximumTrackTintColor="#ddd"
              />
            </View>
          </View>

          {/* Simulation Section */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>⚙️ Simulation</Text>
            <View style={styles.sliderContainer}>
              <Text style={styles.label}>Calc Factor: {calcFactor}</Text>
              <Slider
                style={styles.slider}
                minimumValue={1}
                maximumValue={50}
                step={1}
                value={calcFactor}
                onValueChange={setCalcFactor}
                onSlidingComplete={(value) => {
                  sendToIframe('setCalcFactor', value);
                }}
                minimumTrackTintColor="#FF9800"
                maximumTrackTintColor="#ddd"
              />
            </View>
          </View>

          {/* Grid System */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>🔲 Grid System</Text>
            <View style={styles.toggleContainer}>
              <Text style={styles.label}>Grid-based Collision</Text>
              <Switch
                value={gridEnabled}
                onValueChange={(value) => {
                  setGridEnabled(value);
                  sendToIframe('setGridEnabled', value);
                }}
                trackColor={{ false: "#ddd", true: "#4CAF50" }}
              />
            </View>

            {gridEnabled && (
              <>
                <View style={styles.sliderContainer}>
                  <Text style={styles.label}>Grid Segments: {gridSegments}</Text>
                  <Slider
                    style={styles.slider}
                    minimumValue={2}
                    maximumValue={25}
                    step={1}
                    value={gridSegments}
                    onValueChange={setGridSegments}
                    minimumTrackTintColor="#4CAF50"
                    maximumTrackTintColor="#ddd"
                  />
                </View>

                <TouchableOpacity
                  style={styles.applyButton}
                  onPress={() => sendToIframe('applyGrid', { segments: gridSegments })}
                >
                  <Text style={styles.buttonText}>⚡ Apply Grid</Text>
                </TouchableOpacity>

                <View style={styles.toggleContainer}>
                  <Text style={styles.smallLabel}>Show World Grid</Text>
                  <Switch
                    value={showWorldGrid}
                    onValueChange={(value) => {
                      setShowWorldGrid(value);
                      sendToIframe('setShowWorldGrid', value);
                    }}
                    trackColor={{ false: "#ddd", true: "#4CAF50" }}
                  />
                </View>

                <View style={styles.toggleContainer}>
                  <Text style={styles.smallLabel}>Show Occupied Voxels</Text>
                  <Switch
                    value={showOccupiedVoxels}
                    onValueChange={(value) => {
                      setShowOccupiedVoxels(value);
                      sendToIframe('setShowOccupiedVoxels', value);
                    }}
                    trackColor={{ false: "#ddd", true: "#4CAF50" }}
                  />
                </View>

                <View style={styles.toggleContainer}>
                  <Text style={styles.smallLabel}>Show Collision Checks</Text>
                  <Switch
                    value={showCollisionChecks}
                    onValueChange={(value) => {
                      setShowCollisionChecks(value);
                      sendToIframe('setShowCollisionChecks', value);
                    }}
                    trackColor={{ false: "#ddd", true: "#4CAF50" }}
                  />
                </View>
              </>
            )}
          </View>

          {/* Physics Section */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>🌍 Physics</Text>
            <Text style={styles.label}>Gravity: Down</Text>
            <Text style={styles.smallText}>Press [G] to toggle</Text>
          </View>

          {/* Rendering Section */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>🎨 Rendering</Text>
            <Text style={styles.label}>Draw Mode: Lighted</Text>
            <Text style={styles.smallText}>Press [W] for Wireframe, [P] for Points</Text>
          </View>

          {/* Stereo Section */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>🕶️ 3D Stereo</Text>
            <Text style={styles.smallText}>Press [3] for Top-Bottom</Text>
            <Text style={styles.smallText}>Press [A] for Anaglyph</Text>
          </View>

          {/* Keyboard Shortcuts */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>⌨️ Shortcuts</Text>
            <Text style={styles.smallText}>Press [F1] for full help</Text>
          </View>
        </ScrollView>

        {/* iframe für Web - Nimmt restlichen Platz */}
        <iframe
          ref={webViewRef}
          src={webAppUri}
          style={{
            flex: 1,
            border: "none",
          }}
          title="PaDIPS Simulation"
        />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      {/* PaDIPS Control Panel - Oben auf Mobile */}
      <View style={styles.controlsContainer}>
        <View style={styles.buttonRow}>
          <TouchableOpacity style={styles.startButton} onPress={() => sendToWebView('start')}>
            <Text style={styles.buttonText}>▶ Start</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.stopButton} onPress={() => sendToWebView('stop')}>
            <Text style={styles.buttonText}>⏸ Stop</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.newButton} onPress={() => sendToWebView('new')}>
            <Text style={styles.buttonText}>✨ New</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.label}>🎱 Balls: 30 | 🌍 Gravity: Down | ⌨️ Press [F1] for help</Text>
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
  containerWeb: {
    flex: 1,
    flexDirection: "row", // Sidebar links, Canvas rechts
    backgroundColor: "#fff",
  },
  sidebarWeb: {
    width: 280,
    minWidth: 280,
    maxWidth: 280,
    flexShrink: 0,
    backgroundColor: "rgba(255, 255, 255, 0.95)",
    borderRightWidth: 1,
    borderRightColor: "#ddd",
    shadowColor: "#000",
    shadowOffset: { width: 2, height: 0 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  sidebarContent: {
    padding: 20,
  },
  title: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#333",
    marginBottom: 15,
  },
  section: {
    marginBottom: 20,
    paddingBottom: 15,
    borderBottomWidth: 1,
    borderBottomColor: "#eee",
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: "#555",
    marginBottom: 8,
  },
  statText: {
    fontSize: 12,
    color: "#666",
    marginBottom: 4,
  },
  label: {
    fontSize: 13,
    color: "#666",
    marginBottom: 4,
  },
  smallText: {
    fontSize: 11,
    color: "#999",
    fontStyle: "italic",
    marginTop: 4,
  },
  smallLabel: {
    fontSize: 12,
    color: "#666",
  },
  sliderContainer: {
    marginTop: 8,
    marginBottom: 8,
  },
  slider: {
    width: "100%",
    height: 40,
  },
  toggleContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 8,
    marginBottom: 8,
  },
  applyButton: {
    backgroundColor: "#FF9800",
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 6,
    marginTop: 8,
    marginBottom: 8,
    alignItems: "center",
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
  startButton: {
    backgroundColor: "#4CAF50",
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 6,
    marginHorizontal: 2,
    minWidth: 70,
    elevation: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  stopButton: {
    backgroundColor: "#f44336",
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 6,
    marginHorizontal: 2,
    minWidth: 70,
    elevation: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  newButton: {
    backgroundColor: "#2196F3",
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 6,
    marginHorizontal: 2,
    minWidth: 70,
    elevation: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  buttonText: {
    color: "white",
    fontSize: 14,
    fontWeight: "bold",
    textAlign: "center",
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

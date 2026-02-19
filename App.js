import React, { useState, useEffect, useRef } from "react";
import { StyleSheet, Platform, ActivityIndicator, View, Text, TouchableOpacity, ScrollView, Switch, Dimensions, StatusBar } from "react-native";
import { WebView } from "react-native-webview";
import { SafeAreaView, SafeAreaProvider } from "react-native-safe-area-context";
import * as FileSystem from "expo-file-system/legacy";
import { Asset } from "expo-asset";
import Slider from '@react-native-community/slider';
import { StatsPanel, MainControls, VRIndicators, VRMenuOverlay } from './MobileUI';
import ControlsPanel from './ControlsPanel';

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
  // UI State - Balls
  const [ballCount, setBallCount] = useState(30);
  const [minRadius, setMinRadius] = useState(5); // in cm (stored as slider value)
  const [maxRadius, setMaxRadius] = useState(15); // in cm (stored as slider value)
  const [maxVelocity, setMaxVelocity] = useState(2.0);
  const [elasticity, setElasticity] = useState(90); // 0-100

  // UI State - Physics
  const [gravityPreset, setGravityPreset] = useState('ZERO');
  const [gravityMagnitude, setGravityMagnitude] = useState(9.81);
  const [globalElasticity, setGlobalElasticity] = useState(90); // 0-100

  // UI State - Simulation
  const [calcFactor, setCalcFactor] = useState(10);
  const [collisionsEnabled, setCollisionsEnabled] = useState(true);

  // UI State - Grid
  const [gridEnabled, setGridEnabled] = useState(false);
  const [gridSegments, setGridSegments] = useState(8);
  const [showWorldGrid, setShowWorldGrid] = useState(false);
  const [showOccupiedVoxels, setShowOccupiedVoxels] = useState(false);
  const [showCollisionChecks, setShowCollisionChecks] = useState(false);

  // UI State - Rendering
  const [drawMode, setDrawMode] = useState('LIGHTED');
  const [wireframeSegments, setWireframeSegments] = useState(8);
  const [stereoMode, setStereoMode] = useState('off');
  const [eyeSeparation, setEyeSeparation] = useState(8.0); // in cm
  // Start with 0.01 instead of 0 to work around React Native Web Slider rendering bug
  const [cubeDepth, setCubeDepth] = useState(0.01);
  const [turnSpeed, setTurnSpeed] = useState(0); // Auto-rotation speed: 0=off, 1-4=speed multiplier

  // WebView loaded state for initial cube depth fix
  const [webViewLoaded, setWebViewLoaded] = useState(false);

  // Mobile-specific state
  const [isPortrait, setIsPortrait] = useState(true);
  const [isVRMode, setIsVRMode] = useState(false);
  const [showVRMenu, setShowVRMenu] = useState(false);
  const [showVRIndicators, setShowVRIndicators] = useState(true);

  // Stats from WebView
  const [fps, setFps] = useState(0);
  const [actualBallCount, setActualBallCount] = useState(30);
  const [generation, setGeneration] = useState(0);
  const [isRunning, setIsRunning] = useState(true);
  const [checks, setChecks] = useState(0);

  useEffect(() => {
    loadWebApp();
  }, []);

  // Handle messages from WebView/iframe
  useEffect(() => {
    if (Platform.OS === "web") {
      // Listen for messages from iframe
      const handleMessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === 'stateUpdate') {
            setFps(data.fps || 0);
            const newBallCount = data.ballCount || 30;
            setGeneration(data.generation || 0);
            setIsRunning(data.isRunning !== undefined ? data.isRunning : true);
            setChecks(data.checks || 0);

            // Update slider NUR wenn sich die tatsächliche Ball-Anzahl geändert hat
            // (z.B. durch Keyboard +/- oder "New" button - aber NACH der Generierung!)
            // NICHT bei kurzen Zwischenwerten während reset()
            setActualBallCount(prevActual => {
              // Nur updaten wenn es eine signifikante Änderung ist
              // UND nicht nur ein kurzer Dip (z.B. 30 während reset)
              if (newBallCount !== prevActual) {
                // Prüfe ob die neue Anzahl mit dem Slider-Wert übereinstimmt
                // Wenn ja, dann ist das die finale Anzahl nach "New"
                // Wenn nein, dann ist es wahrscheinlich eine +/- Key Änderung
                if (newBallCount === ballCount || Math.abs(newBallCount - prevActual) >= 50) {
                  // Entweder: Finale Anzahl nach "New" (newBallCount === ballCount)
                  // Oder: Große Änderung durch +/- Keys (±50 Bälle)
                  setBallCount(newBallCount);
                }
                // Sonst: Ignoriere kleine/kurze Änderungen (z.B. während reset)
              }
              return newBallCount;
            });

            // Update ball parameters NUR bei Grid-Constraints
            // (wenn WebView die Parameter aktiv verkleinert hat)
            // Normale Slider-Bewegungen werden NICHT überschrieben
            if (data.minRadius !== undefined) {
              const newMinRadius = Math.round(data.minRadius * 100);
              // Nur updaten wenn explizit kleiner (Grid-Constraint oder max<min Korrektur)
              if (newMinRadius < minRadius) {
                console.log('📏 Min radius updated:', minRadius, '→', newMinRadius);
                setMinRadius(newMinRadius);
              }
            }
            if (data.maxRadius !== undefined) {
              const newMaxRadius = Math.round(data.maxRadius * 100);
              // Nur updaten wenn explizit kleiner (Grid-Constraint)
              if (newMaxRadius < maxRadius) {
                console.log('📏 Max radius updated:', maxRadius, '→', newMaxRadius);
                setMaxRadius(newMaxRadius);
              }
            }

            // Update draw mode if changed (e.g., via keyboard shortcut [W])
            if (data.drawMode !== undefined) {
              setDrawMode(data.drawMode);
            }

            // Update gravity preset if changed (e.g., via keyboard shortcut [G])
            if (data.gravityPreset !== undefined) {
              setGravityPreset(data.gravityPreset);
            }
          } else if (data.type === 'cubeDepthUpdate') {
            // Update cube depth slider (e.g., via keyboard shortcuts Ctrl+/-)
            if (data.cubeDepth !== undefined) {
              setCubeDepth(data.cubeDepth);
              console.log('📦 UI: Cube depth updated to:', data.cubeDepth);
            }
          } else if (data.type === 'stereoModeUpdate') {
            // Update stereo mode (e.g., via keyboard shortcut [3] or [A])
            if (data.stereoMode !== undefined) {
              setStereoMode(data.stereoMode);
              console.log('🕶️ UI: Stereo mode updated to:', data.stereoMode);
            }
          } else if (data.type === 'turnSpeedUpdate') {
            // Update turn speed (e.g., via keyboard shortcut [T])
            if (data.turnSpeed !== undefined) {
              console.log('📥 Received immediate turnSpeed update:', data.turnSpeed);
              setTurnSpeed(prev => {
                console.log('  Previous turnSpeed:', prev, '→ New:', data.turnSpeed);
                return data.turnSpeed;
              });
            }
          }
        } catch (e) {
          // Ignore non-JSON messages
        }
      };

      window.addEventListener('message', handleMessage);
      return () => window.removeEventListener('message', handleMessage);
    }
  }, []);

  // Forward keyboard events to iframe (for shortcuts to work always on Web)
  useEffect(() => {
    if (Platform.OS === "web") {
      const handleKeyDown = (event) => {
        // Check if iframe is loaded and has contentWindow
        if (webViewRef.current && webViewRef.current.contentWindow) {
          // Forward the keyboard event to the iframe
          // Create a new KeyboardEvent with the same properties
          const iframeWindow = webViewRef.current.contentWindow;

          // Send as a message instead of trying to dispatch event directly
          // (cross-origin restrictions prevent direct event dispatching)
          iframeWindow.postMessage(JSON.stringify({
            action: 'keydown',
            params: {
              key: event.key,
              code: event.code,
              ctrlKey: event.ctrlKey,
              shiftKey: event.shiftKey,
              altKey: event.altKey,
              metaKey: event.metaKey
            }
          }), '*');

          // Prevent default for known shortcuts
          const shortcuts = ['s', 'n', '3', 'a', 't', 'w', 'p', 'g', 'F1'];
          if (shortcuts.includes(event.key) ||
              event.key === '+' || event.key === '-' ||
              event.key === 'j' || event.key === 'k' ||
              event.key === ' ') {
            event.preventDefault();
          }

          console.log('⌨️ Forwarded key to iframe:', event.key);
        }
      };

      window.addEventListener('keydown', handleKeyDown);
      console.log('⌨️ Keyboard event forwarder installed');

      return () => {
        window.removeEventListener('keydown', handleKeyDown);
        console.log('⌨️ Keyboard event forwarder removed');
      };
    }
  }, []);

  // Orientation detection (Mobile only)
  useEffect(() => {
    if (Platform.OS !== "web") {
      const updateOrientation = () => {
        const { width, height } = require('react-native').Dimensions.get('window');
        const portrait = height > width;
        setIsPortrait(portrait);
        console.log('📱 Orientation:', portrait ? 'Portrait' : 'Landscape');
      };

      // Initial check
      updateOrientation();

      // Listen to dimension changes
      const subscription = require('react-native').Dimensions.addEventListener('change', updateOrientation);

      return () => {
        if (subscription && subscription.remove) {
          subscription.remove();
        }
      };
    }
  }, []);

  // Auto-activate VR mode when Side-by-Side Stereo + Landscape (Mobile only)
  useEffect(() => {
    if (Platform.OS !== "web") {
      const shouldBeVR = stereoMode === 'sidebyside' && !isPortrait;

      if (shouldBeVR !== isVRMode) {
        setIsVRMode(shouldBeVR);
        if (shouldBeVR) {
          console.log('🥽 VR Mode activated (Side-by-Side + Landscape)');
          // Ensure Side-by-Side is active in WebView (with small delay for WebView readiness)
          setTimeout(() => {
            sendToWebView('setStereoMode', 'sidebyside');
          }, 100);
          setShowVRIndicators(true);
          // Hide indicators after 3 seconds
          setTimeout(() => setShowVRIndicators(false), 3000);
        } else {
          console.log('📱 VR Mode deactivated');
          setShowVRMenu(false);
          // Turn off stereo when leaving VR
          if (stereoMode === 'sidebyside') {
            setStereoMode('off');
            sendToWebView('setStereoMode', 'off');
          }
        }
      }
    }
  }, [stereoMode, isPortrait, isVRMode]);

  // Note: Volume button control for eye separation is not available in Expo
  // Eye separation can be adjusted via the slider in the VR menu

  // Fix: Reset cube depth to exact 0 after initial render
  // This fixes React Native Web Slider bug where initial value 0 renders at left
  // Must be here (before any conditional returns) to comply with Rules of Hooks
  useEffect(() => {
    if (Platform.OS === "web") {
      // Short delay to ensure slider is mounted, then set to exact 0
      const timer = setTimeout(() => {
        console.log('📦 Resetting cube depth to exact 0');
        setCubeDepth(0);
      }, 50);
      return () => clearTimeout(timer);
    }
  }, []); // Run once on mount

  // Hilfsfunktion um Aktionen an die WebView zu senden
  const sendToWebView = (action, params) => {
    if (webViewRef.current) {
      const message = JSON.stringify({ action, params });
      // Log UI→WebView messages to debug which controls work
      if (action !== 'setCalcFactor') { // CalcFactor spammt bei Slider-Bewegung
        console.log('📤 UI→WebView:', action, params);
      }
      webViewRef.current.postMessage(message);
    }
  };

  // Injected JavaScript to setup message bridge
  const injectedJavaScript = `
    (function() {
      console.log('🔧 Setting up React Native WebView message bridge...');

      // Listen for messages FROM React Native (sent via postMessage)
      // These need to be dispatched as window 'message' events so the webapp can receive them
      document.addEventListener('message', function(e) {
        // Only log non-routine messages (not stateUpdate responses)
        // Dispatch as window message event for the webapp to receive
        window.postMessage(e.data, '*');
      });

      // For iOS
      window.addEventListener('message', function(e) {
        // Messages dispatched by the bridge above - no need to log
      });

      console.log('✓ React Native WebView message bridge initialized');
    })();
    true; // Required for Android
  `;

  // Handle "New" button with parameter validation
  const handleNew = () => {
    let finalMinRadius = minRadius;
    let finalMaxRadius = maxRadius;

    // If max < min, adjust min to max
    if (finalMaxRadius < finalMinRadius) {
      console.log('📏 Correcting min to match max:', finalMinRadius, '→', finalMaxRadius);
      finalMinRadius = finalMaxRadius;
      setMinRadius(finalMaxRadius);
    }

    // Send all parameters before reset
    sendToWebView('setBallCount', ballCount);
    sendToWebView('setMinRadius', finalMinRadius / 100); // Convert cm to m
    sendToWebView('setMaxRadius', finalMaxRadius / 100);
    sendToWebView('setMaxVelocity', maxVelocity);
    sendToWebView('setElasticity', elasticity / 100);

    // Then reset with new parameters
    sendToWebView('new');
  };

  // Handle "Reset" button - reset all parameters to defaults
  const handleReset = () => {
    console.log('🔄 Reset to defaults');

    // Reset all UI state to defaults
    setBallCount(100);
    setMinRadius(5);
    setMaxRadius(15);
    setMaxVelocity(2.0);
    setElasticity(90);
    setGravityPreset('ZERO');
    setCalcFactor(10);
    setCollisionsEnabled(true);
    setGridEnabled(false);
    setGridSegments(8);
    setShowWorldGrid(false);
    setShowOccupiedVoxels(false);
    setShowCollisionChecks(false);
    setDrawMode('LIGHTED');
    setWireframeSegments(8);
    setStereoMode('off');
    setEyeSeparation(8);
    setCubeDepth(0);
    setTurnSpeed(0);

    // Send default values to WebView
    sendToWebView('setBallCount', 100);
    sendToWebView('setMinRadius', 0.05); // 5cm in meters
    sendToWebView('setMaxRadius', 0.15); // 15cm in meters
    sendToWebView('setMaxVelocity', 2.0);
    sendToWebView('setElasticity', 0.9);
    sendToWebView('setGravityPreset', { preset: 'ZERO', magnitude: 9.81 });
    sendToWebView('setCalcFactor', 10);
    sendToWebView('setCollisionsEnabled', true);
    sendToWebView('disableGrid');
    sendToWebView('setShowWorldGrid', false);
    sendToWebView('setShowOccupiedVoxels', false);
    sendToWebView('setShowCollisionChecks', false);
    sendToWebView('setDrawMode', 'LIGHTED');
    sendToWebView('setWireframeSegments', 8);
    sendToWebView('setStereoMode', 'off');
    sendToWebView('setEyeSeparation', 0.08);
    sendToWebView('setCubeDepth', 0);
    sendToWebView('setAutoRotation', { enabled: false });

    // Generate new balls with default parameters
    sendToWebView('new');
  };

  // Handle messages from WebView
  const handleWebViewMessage = (event) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);

      // Only log non-stateUpdate messages to reduce spam
      if (data.type !== 'stateUpdate') {
        console.log('📥 WebView message:', data.type, data);
      }

      if (data.type === 'stateUpdate') {
        setFps(data.fps || 0);
        setGeneration(data.generation || 0);
        setIsRunning(data.isRunning !== undefined ? data.isRunning : true);
        setChecks(data.checks || 0);

        // Update turnSpeed from keyboard shortcut 't'
        if (data.turnSpeed !== undefined) {
          console.log('📥 Received turnSpeed update:', data.turnSpeed);
          setTurnSpeed(data.turnSpeed);
        }

        const newBallCount = data.ballCount || 30;
        setActualBallCount(prevActual => {
          if (newBallCount !== prevActual && newBallCount === ballCount) {
            return newBallCount;
          }
          if (newBallCount !== 30 && newBallCount !== prevActual) {
            return newBallCount;
          }
          return prevActual;
        });
      }

      // Immediate turnSpeed update from 't' keyboard shortcut
      if (data.type === 'turnSpeedUpdate') {
        console.log('📥 Received immediate turnSpeed update:', data.turnSpeed);
        // Force update using callback to ensure React applies the change
        setTurnSpeed(prev => {
          console.log('  Previous turnSpeed:', prev, '→ New:', data.turnSpeed);
          return data.turnSpeed;
        });
      }

      if (data.type === 'error' || data.type === 'unhandledrejection') {
        console.error("❌ WebView JS Error:", JSON.stringify(data, null, 2));
      }

      if (data.type === 'log') {
        console.log("📱 WebView:", data.message);
      }
    } catch (e) {
      console.warn('⚠️ Failed to parse WebView message:', e.message);
      // Ignore non-JSON messages
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

        // Kopiere Texturen
        const texturesDir = `${tempDir}textures/`;
        const texturesDirInfo = await FileSystem.getInfoAsync(texturesDir);
        if (!texturesDirInfo.exists) {
          await FileSystem.makeDirectoryAsync(texturesDir, { intermediates: true });
        }

        try {
          const texture2 = Asset.fromModule(require("./assets/webapp/textures/rosendal_plains_2_1k-rot.hdr"));
          await texture2.downloadAsync();
          await FileSystem.copyAsync({
            from: texture2.localUri,
            to: `${texturesDir}rosendal_plains_2_1k-rot.hdr`
          });
          console.log("✓ Copied: rosendal_plains_2_1k-rot.hdr");
        } catch (err) {
          console.warn("Could not copy texture:", err.message);
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

  // ===== PERSISTENT WEBVIEW (rendered once, positioned differently per mode) =====
  // Only for Mobile (not Web - Web uses iframe)
  const renderPersistentWebView = () => (
    <WebView
      ref={webViewRef}
      source={{ uri: webAppUri }}
      style={{ flex: 1 }}
      originWhitelist={['*', 'file://', 'http://', 'https://']}
      javaScriptEnabled={true}
      domStorageEnabled={true}
      allowsInlineMediaPlayback={true}
      mediaPlaybackRequiresUserAction={false}
      allowFileAccess={true}
      allowUniversalAccessFromFileURLs={true}
      allowFileAccessFromFileURLs={true}
      mixedContentMode="always"
      injectedJavaScript={injectedJavaScript}
      onMessage={handleWebViewMessage}
    />
  );

  // Auf Web verwenden wir einen iframe statt WebView für bessere Kompatibilität
  if (Platform.OS === "web") {
    // Dynamische Styles für Top/Bottom Stereo
    const isTopBottomStereo = stereoMode === 'topbottom';
    const containerStyle = isTopBottomStereo
      ? [styles.containerWeb, styles.containerTopBottomStereo]
      : styles.containerWeb;
    const sidebarStyle = isTopBottomStereo
      ? [styles.sidebarWeb, styles.sidebarTopBottomStereo]
      : styles.sidebarWeb;

    return (
      <View style={containerStyle}>
        {/* PaDIPS Control Panel - Links wie im Original */}
        <ScrollView style={sidebarStyle} contentContainerStyle={styles.sidebarContent}>
          <Text style={styles.title}>🎱 PaDIPS</Text>

          {/* Main Controls */}
          <View style={styles.section}>
            <View style={styles.buttonRow}>
              <TouchableOpacity
                style={[styles.startButton, isRunning && styles.buttonDisabled]}
                onPress={() => sendToIframe('start')}
                disabled={isRunning}
              >
                <Text style={styles.buttonText}>▶ Start</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.stopButton, !isRunning && styles.buttonDisabled]}
                onPress={() => sendToIframe('stop')}
                disabled={!isRunning}
              >
                <Text style={styles.buttonText}>⏸ Stop</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.newButton}
                onPress={() => {
                  // Validate and correct parameters locally first
                  let finalMinRadius = minRadius;
                  let finalMaxRadius = maxRadius;

                  // If max < min, adjust min to max (same logic as WebView)
                  if (finalMaxRadius < finalMinRadius) {
                    console.log('📏 Correcting min to match max locally:', finalMinRadius, '→', finalMaxRadius);
                    finalMinRadius = finalMaxRadius;
                    setMinRadius(finalMinRadius); // Update UI immediately
                  }

                  // Sende alle Ball-Parameter VOR dem Reset
                  sendToIframe('setBallCount', ballCount);
                  sendToIframe('setMinRadius', finalMinRadius / 100); // Convert cm to m
                  sendToIframe('setMaxRadius', finalMaxRadius / 100);
                  sendToIframe('setMaxVelocity', maxVelocity);
                  sendToIframe('setElasticity', elasticity / 100);
                  // Dann Reset mit neuen Parametern
                  sendToIframe('new');
                }}
              >
                <Text style={styles.buttonText}>✨ New</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Stats */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>📊 Stats</Text>
            <View style={styles.statsGrid}>
              <View style={styles.statsRow}>
                <Text style={styles.statText}>FPS: {fps}</Text>
                <Text style={styles.statText}>Balls: {actualBallCount}</Text>
              </View>
              <View style={styles.statsRow}>
                <Text style={styles.statText}>Gen: {generation}</Text>
                <Text style={styles.statText}>Checks: {checks}</Text>
              </View>
            </View>
          </View>

          {/* Balls Section */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>🎱 Balls - click "New" to apply</Text>

            <View style={styles.sliderContainer}>
              <Text style={styles.label}>Number of Balls: {ballCount}</Text>
              <Slider
                style={styles.slider}
                minimumValue={5}
                maximumValue={1000}
                step={5}
                value={ballCount}
                onValueChange={setBallCount}
                minimumTrackTintColor="#4CAF50"
                maximumTrackTintColor="#ddd"
              />
            </View>

            <View style={styles.sliderContainer}>
              <Text style={styles.label}>Min Radius: {(minRadius / 100).toFixed(2)} m</Text>
              <Slider
                style={styles.slider}
                minimumValue={2}
                maximumValue={30}
                step={1}
                value={minRadius}
                onValueChange={setMinRadius}
                minimumTrackTintColor="#4CAF50"
                maximumTrackTintColor="#ddd"
              />
            </View>

            <View style={styles.sliderContainer}>
              <Text style={styles.label}>Max Radius: {(maxRadius / 100).toFixed(2)} m</Text>
              <Slider
                style={styles.slider}
                minimumValue={2}
                maximumValue={30}
                step={1}
                value={maxRadius}
                onValueChange={setMaxRadius}
                minimumTrackTintColor="#4CAF50"
                maximumTrackTintColor="#ddd"
              />
            </View>

            <View style={styles.sliderContainer}>
              <Text style={styles.label}>Max Velocity: {maxVelocity.toFixed(1)} m/s</Text>
              <Slider
                style={styles.slider}
                minimumValue={0.5}
                maximumValue={10.0}
                step={0.5}
                value={maxVelocity}
                onValueChange={setMaxVelocity}
                minimumTrackTintColor="#4CAF50"
                maximumTrackTintColor="#ddd"
              />
            </View>

            <View style={styles.sliderContainer}>
              <Text style={styles.label}>Elasticity: {(elasticity / 100).toFixed(2)}</Text>
              <Slider
                style={styles.slider}
                minimumValue={0}
                maximumValue={100}
                step={5}
                value={elasticity}
                onValueChange={setElasticity}
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

            <View style={styles.toggleContainer}>
              <Text style={styles.label}>Collisions Enabled</Text>
              <Switch
                value={collisionsEnabled}
                onValueChange={(value) => {
                  setCollisionsEnabled(value);
                  sendToIframe('setCollisionsEnabled', value);
                }}
                trackColor={{ false: "#ddd", true: "#4CAF50" }}
              />
            </View>

            <View style={styles.toggleContainer}>
              <Text style={styles.label}>Show Collision Checks</Text>
              <Switch
                value={showCollisionChecks}
                onValueChange={(value) => {
                  setShowCollisionChecks(value);
                  sendToIframe('setShowCollisionChecks', value);
                }}
                trackColor={{ false: "#ddd", true: "#4CAF50" }}
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
                  if (value) {
                    // Aktivieren: Apply Grid mit aktuellen Segments
                    sendToIframe('applyGrid', { segments: gridSegments });
                  } else {
                    // Deaktivieren: Grid ausschalten
                    sendToIframe('disableGrid');
                  }
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
                    onSlidingComplete={(value) => {
                      // Direkt anwenden beim Loslassen
                      sendToIframe('applyGrid', { segments: value });
                    }}
                    minimumTrackTintColor="#4CAF50"
                    maximumTrackTintColor="#ddd"
                  />
                </View>


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
              </>
            )}
          </View>

          {/* Physics Section */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>🌍 Physics</Text>

            <View style={styles.pickerContainer}>
              <Text style={styles.label}>Gravity Preset</Text>
              <select
                value={gravityPreset}
                onChange={(e) => {
                  const preset = e.target.value;
                  setGravityPreset(preset);
                  sendToIframe('setGravityPreset', { preset, magnitude: gravityMagnitude });
                }}
                style={{
                  padding: '8px',
                  borderRadius: '4px',
                  border: '1px solid #ddd',
                  backgroundColor: 'white',
                  fontSize: '13px',
                  width: '100%',
                  marginTop: '4px'
                }}
              >
                <option value="ZERO">🚫 Zero</option>
                <option value="DOWN">⬇️ Down</option>
                <option value="UP">⬆️ Up</option>
                <option value="LEFT">⬅️ Left</option>
                <option value="RIGHT">➡️ Right</option>
                <option value="FRONT">🔽 Front</option>
                <option value="REAR">🔼 Rear</option>
              </select>
            </View>

            <View style={styles.sliderContainer}>
              <Text style={styles.label}>Gravity Magnitude: {gravityMagnitude.toFixed(1)} m/s²</Text>
              <Slider
                style={styles.slider}
                minimumValue={0}
                maximumValue={20}
                step={0.5}
                value={gravityMagnitude}
                onValueChange={setGravityMagnitude}
                onSlidingComplete={(value) => {
                  sendToIframe('setGravityPreset', { preset: gravityPreset, magnitude: value });
                }}
                minimumTrackTintColor="#2196F3"
                maximumTrackTintColor="#ddd"
              />
            </View>

            <View style={styles.sliderContainer}>
              <Text style={styles.label}>Global Elasticity: {(globalElasticity / 100).toFixed(2)}</Text>
              <Slider
                style={styles.slider}
                minimumValue={0}
                maximumValue={100}
                step={5}
                value={globalElasticity}
                onValueChange={setGlobalElasticity}
                onSlidingComplete={(value) => {
                  sendToIframe('setGlobalElasticity', value / 100);
                }}
                minimumTrackTintColor="#2196F3"
                maximumTrackTintColor="#ddd"
              />
            </View>
          </View>

          {/* Rendering Section */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>🎨 Rendering</Text>

            <View style={styles.pickerContainer}>
              <Text style={styles.label}>Draw Mode</Text>
              <select
                value={drawMode}
                onChange={(e) => {
                  const mode = e.target.value;
                  setDrawMode(mode);
                  sendToIframe('setDrawMode', mode);
                }}
                style={{
                  padding: '8px',
                  borderRadius: '4px',
                  border: '1px solid #ddd',
                  backgroundColor: 'white',
                  fontSize: '13px',
                  width: '100%',
                  marginTop: '4px'
                }}
              >
                <option value="LIGHTED">Lighted</option>
                <option value="WIREFRAME">Wireframe</option>
                <option value="POINTS">Points</option>
                <option value="SILVER">Silver</option>
              </select>
            </View>

            <View style={styles.sliderContainer}>
              <Text style={styles.label}>Wireframe Density: {wireframeSegments}</Text>
              <Slider
                style={styles.slider}
                minimumValue={4}
                maximumValue={32}
                step={2}
                value={wireframeSegments}
                onValueChange={setWireframeSegments}
                onSlidingComplete={(value) => {
                  sendToIframe('setWireframeSegments', value);
                }}
                minimumTrackTintColor="#9C27B0"
                maximumTrackTintColor="#ddd"
              />
            </View>
          </View>

          {/* Stereo Section */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>🕶️ 3D Stereo</Text>

            <View style={styles.radioGroup}>
              <Text style={styles.label}>Stereo Mode</Text>

              <TouchableOpacity
                style={styles.radioOption}
                onPress={() => {
                  setStereoMode('off');
                  sendToIframe('setStereoMode', 'off');
                }}
              >
                <View style={[styles.radioCircle, stereoMode === 'off' && styles.radioCircleSelected]}>
                  {stereoMode === 'off' && <View style={styles.radioCircleInner} />}
                </View>
                <Text style={styles.radioLabel}>❌ Off</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.radioOption}
                onPress={() => {
                  setStereoMode('anaglyph');
                  sendToIframe('setStereoMode', 'anaglyph');
                }}
              >
                <View style={[styles.radioCircle, stereoMode === 'anaglyph' && styles.radioCircleSelected]}>
                  {stereoMode === 'anaglyph' && <View style={styles.radioCircleInner} />}
                </View>
                <Text style={styles.radioLabel}>🕶️ Anaglyph (Red-Blue)</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.radioOption}
                onPress={() => {
                  setStereoMode('topbottom');
                  sendToIframe('setStereoMode', 'topbottom');
                }}
              >
                <View style={[styles.radioCircle, stereoMode === 'topbottom' && styles.radioCircleSelected]}>
                  {stereoMode === 'topbottom' && <View style={styles.radioCircleInner} />}
                </View>
                <Text style={styles.radioLabel}>📺 Top-Bottom Split</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.sliderContainer}>
              <Text style={styles.label}>Eye Separation: {(eyeSeparation / 100).toFixed(3)} m</Text>
              <Slider
                style={styles.slider}
                minimumValue={2}
                maximumValue={20}
                step={0.2}
                value={eyeSeparation}
                onValueChange={setEyeSeparation}
                onSlidingComplete={(value) => {
                  sendToIframe('setEyeSeparation', value / 100);
                }}
                minimumTrackTintColor="#E91E63"
                maximumTrackTintColor="#ddd"
              />
            </View>

            <View style={styles.sliderContainer}>
              <Text style={styles.label}>Cube Depth: {(cubeDepth * 0.1).toFixed(1)} m</Text>
              <View style={styles.cubeDepthSliderWrapper}>
                {/* Visual center marker */}
                <View style={styles.cubeDepthCenterMarker} />
                <Slider
                  style={styles.slider}
                  minimumValue={-20}
                  maximumValue={20}
                  step={1}
                  value={cubeDepth}
                  onValueChange={setCubeDepth}
                  onSlidingComplete={(value) => {
                    sendToIframe('setCubeDepth', value * 0.1);
                  }}
                  minimumTrackTintColor={cubeDepth < 0 ? "#2196F3" : "#E91E63"}
                  maximumTrackTintColor={cubeDepth > 0 ? "#2196F3" : "#ddd"}
                  thumbTintColor="#E91E63"
                />
              </View>
              <View style={styles.sliderLabels}>
                <Text style={styles.sliderLabelText}>-2.0m (closer)</Text>
                <Text style={styles.sliderLabelCenter}>0 (default)</Text>
                <Text style={styles.sliderLabelText}>+2.0m (farther)</Text>
              </View>
            </View>

            <View style={styles.sliderContainer}>
              <Text style={styles.label}>Turn Speed: {turnSpeed === 0 ? 'OFF' : `${turnSpeed}x`}</Text>
              <Slider
                style={styles.slider}
                minimumValue={0}
                maximumValue={4}
                step={1}
                value={turnSpeed}
                onValueChange={setTurnSpeed}
                onSlidingComplete={(value) => {
                  if (value === 0) {
                    sendToIframe('setAutoRotation', { enabled: false });
                  } else {
                    sendToIframe('setAutoRotation', { enabled: true, speed: value });
                  }
                }}
                minimumTrackTintColor="#FF9800"
                maximumTrackTintColor="#ddd"
                thumbTintColor="#FF9800"
              />
            </View>
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
          onLoad={() => {
            console.log('📺 iframe loaded');
            setWebViewLoaded(true);
          }}
          style={{
            flex: 1,
            border: "none",
          }}
          title="PaDIPS Simulation"
        />

        {/* Schwarzer Bereich für untere Hälfte im Top/Bottom Stereo */}
        {isTopBottomStereo && (
          <View style={styles.bottomHalfBlack} />
        )}
      </View>
    );
  }

  // === MOBILE LAYOUTS ===

  // VR Mode (Cardboard) - Fullscreen with optional overlay
  if (isVRMode) {
    return (
      <SafeAreaView style={styles.vrContainer} edges={[]}>
        <StatusBar barStyle="light-content" backgroundColor="#000" />
        {/* Fullscreen WebView - using persistent WebView */}
        {renderPersistentWebView()}

        {/* VR Tap Indicators (fade after 3s) - only shown initially */}
        <VRIndicators
          visible={showVRIndicators}
          onLeftTap={() => {
            setShowVRMenu(true);
            setShowVRIndicators(false);
          }}
          onRightTap={() => {
            setShowVRMenu(true);
            setShowVRIndicators(false);
          }}
        />

        {/* Tap zones to open menu directly (always active when menu is closed) */}
        {!showVRMenu && (
          <>
            <TouchableOpacity
              style={styles.vrHiddenTapZoneLeft}
              onPress={() => {
                setShowVRMenu(true);
                setShowVRIndicators(false);
              }}
            />
            <TouchableOpacity
              style={styles.vrHiddenTapZoneRight}
              onPress={() => {
                setShowVRMenu(true);
                setShowVRIndicators(false);
              }}
            />
          </>
        )}

        {/* VR Menu Overlay */}
        <VRMenuOverlay
          visible={showVRMenu}
          onClose={() => setShowVRMenu(false)}
          onExitVR={() => {
            // Turn off stereo mode to exit VR
            setStereoMode('off');
            sendToWebView('setStereoMode', 'off');
            setShowVRMenu(false);
          }}
        >
          <StatsPanel fps={fps} ballCount={actualBallCount} generation={generation} checks={checks} />
          <MainControls
            onStart={() => sendToWebView('start')}
            onStop={() => sendToWebView('stop')}
            onNew={() => handleNew()}
            onReset={() => handleReset()}
            isRunning={isRunning}
          />

          {/* Compact VR Controls - 2-column Toggle Layout */}
          <View style={{ padding: 8, backgroundColor: '#f9f9f9', borderRadius: 6, marginTop: 8 }}>
            {/* Row 1: Silver & Gravity */}
            <View style={styles.vrToggleRow}>
              <View style={styles.vrToggleItem}>
                <Text style={styles.vrToggleLabel}>✨ Silver</Text>
                <Switch
                  value={drawMode === 'SILVER'}
                  onValueChange={(val) => {
                    const newMode = val ? 'SILVER' : 'LIGHTED';
                    setDrawMode(newMode);
                    sendToWebView('setDrawMode', newMode);
                  }}
                  trackColor={{ false: '#ccc', true: '#4CAF50' }}
                  thumbColor={drawMode === 'SILVER' ? '#fff' : '#f4f3f4'}
                />
              </View>

              <View style={styles.vrToggleItem}>
                <Text style={styles.vrToggleLabel}>🌍 Gravity</Text>
                <Switch
                  value={gravityPreset === 'DOWN'}
                  onValueChange={(val) => {
                    const newPreset = val ? 'DOWN' : 'ZERO';
                    setGravityPreset(newPreset);
                    sendToWebView('setGravityPreset', { preset: newPreset, magnitude: gravityMagnitude });
                  }}
                  trackColor={{ false: '#ccc', true: '#4CAF50' }}
                  thumbColor={gravityPreset === 'DOWN' ? '#fff' : '#f4f3f4'}
                />
              </View>
            </View>

            {/* Row 2: Grid & Checks */}
            <View style={styles.vrToggleRow}>
              <View style={styles.vrToggleItem}>
                <Text style={styles.vrToggleLabel}>🔲 Grid</Text>
                <Switch
                  value={gridEnabled}
                  onValueChange={(val) => {
                    setGridEnabled(val);
                    if (val) {
                      sendToWebView('applyGrid', { segments: gridSegments });
                    } else {
                      sendToWebView('disableGrid');
                    }
                  }}
                  trackColor={{ false: '#ccc', true: '#4CAF50' }}
                  thumbColor={gridEnabled ? '#fff' : '#f4f3f4'}
                />
              </View>

              <View style={styles.vrToggleItem}>
                <Text style={styles.vrToggleLabel}>🔍 Checks</Text>
                <Switch
                  value={showCollisionChecks}
                  onValueChange={(val) => {
                    setShowCollisionChecks(val);
                    sendToWebView('setShowCollisionChecks', val);
                  }}
                  trackColor={{ false: '#ccc', true: '#4CAF50' }}
                  thumbColor={showCollisionChecks ? '#fff' : '#f4f3f4'}
                />
              </View>
            </View>

            {/* Row 3: Voxels (single item centered) */}
            <View style={styles.vrToggleRow}>
              <View style={styles.vrToggleItem}>
                <Text style={styles.vrToggleLabel}>📦 Voxels</Text>
                <Switch
                  value={showOccupiedVoxels}
                  onValueChange={(val) => {
                    setShowOccupiedVoxels(val);
                    sendToWebView('setShowOccupiedVoxels', val);
                  }}
                  trackColor={{ false: '#ccc', true: '#4CAF50' }}
                  thumbColor={showOccupiedVoxels ? '#fff' : '#f4f3f4'}
                />
              </View>
            </View>

            {/* Ball Count Buttons */}
            <View style={{ marginTop: 12 }}>
              <Text style={styles.vrToggleLabel}>🎱 Balls: {actualBallCount}</Text>
              <View style={[styles.vrToggleRow, { marginTop: 4 }]}>
                <TouchableOpacity
                  style={[styles.vrBallButton, styles.vrBallButtonMinus]}
                  onPress={() => {
                    const newCount = Math.max(5, ballCount - 50);
                    setBallCount(newCount);
                    sendToWebView('setBallCount', newCount);
                    sendToWebView('new');
                  }}
                >
                  <Text style={styles.vrBallButtonText}>-50</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.vrBallButton, styles.vrBallButtonPlus]}
                  onPress={() => {
                    const newCount = Math.min(1000, ballCount + 50);
                    setBallCount(newCount);
                    sendToWebView('setBallCount', newCount);
                    sendToWebView('new');
                  }}
                >
                  <Text style={styles.vrBallButtonText}>+50</Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Eye Separation Slider */}
            <View style={{ marginTop: 12 }}>
              <Text style={styles.vrToggleLabel}>👁️ Eye Sep: {eyeSeparation.toFixed(1)} cm</Text>
              <Slider
                style={{ width: '100%', height: 30 }}
                minimumValue={5}
                maximumValue={15}
                step={0.2}
                value={eyeSeparation}
                onValueChange={(val) => {
                  setEyeSeparation(val);
                  sendToWebView('setEyeSeparation', val / 100);
                }}
                minimumTrackTintColor="#2196F3"
                maximumTrackTintColor="#ddd"
                thumbTintColor="#2196F3"
              />
            </View>

            {/* Turn Speed Slider */}
            <View style={{ marginTop: 12 }}>
              <Text style={styles.vrToggleLabel}>🔄 Turn: {turnSpeed === 0 ? 'OFF' : `${turnSpeed}x`}</Text>
              <Slider
                style={{ width: '100%', height: 30 }}
                minimumValue={0}
                maximumValue={4}
                step={1}
                value={turnSpeed}
                onValueChange={(val) => {
                  setTurnSpeed(val);
                  if (val === 0) {
                    sendToWebView('setAutoRotation', { enabled: false });
                  } else {
                    sendToWebView('setAutoRotation', { enabled: true, speed: val });
                  }
                }}
                minimumTrackTintColor="#FF9800"
                maximumTrackTintColor="#ddd"
                thumbTintColor="#FF9800"
              />
            </View>
          </View>
        </VRMenuOverlay>
      </SafeAreaView>
    );
  }


  // Portrait Mode - Stats + WebView (square) + Controls (scrollable)
  if (isPortrait) {
    return (
      <SafeAreaView style={styles.containerPortrait} edges={['top', 'left', 'right', 'bottom']}>
        <StatusBar barStyle="dark-content" backgroundColor="#f5f5f5" />
        {/* Stats at top */}
        <StatsPanel fps={fps} ballCount={actualBallCount} generation={generation} checks={checks} />

        {/* Main Controls (sticky) */}
        <MainControls
          onStart={() => sendToWebView('start')}
          onStop={() => sendToWebView('stop')}
          onNew={() => handleNew()}
          onReset={() => handleReset()}
          isRunning={isRunning}
        />

        {/* WebView - Square, centered */}
        <View style={styles.webViewContainerPortrait}>
          {renderPersistentWebView()}
        </View>

        {/* Controls below - scrollable */}
        <ControlsPanel
          ballCount={ballCount}
          setBallCount={setBallCount}
          minRadius={minRadius}
          setMinRadius={setMinRadius}
          maxRadius={maxRadius}
          setMaxRadius={setMaxRadius}
          gravityPreset={gravityPreset}
          setGravityPreset={setGravityPreset}
          gravityMagnitude={gravityMagnitude}
          collisionsEnabled={collisionsEnabled}
          setCollisionsEnabled={setCollisionsEnabled}
          calcFactor={calcFactor}
          setCalcFactor={setCalcFactor}
          gridEnabled={gridEnabled}
          setGridEnabled={setGridEnabled}
          gridSegments={gridSegments}
          setGridSegments={setGridSegments}
          showWorldGrid={showWorldGrid}
          setShowWorldGrid={setShowWorldGrid}
          showOccupiedVoxels={showOccupiedVoxels}
          setShowOccupiedVoxels={setShowOccupiedVoxels}
          showCollisionChecks={showCollisionChecks}
          setShowCollisionChecks={setShowCollisionChecks}
          drawMode={drawMode}
          setDrawMode={setDrawMode}
          wireframeSegments={wireframeSegments}
          setWireframeSegments={setWireframeSegments}
          stereoMode={stereoMode}
          setStereoMode={setStereoMode}
          eyeSeparation={eyeSeparation}
          setEyeSeparation={setEyeSeparation}
          cubeDepth={cubeDepth}
          setCubeDepth={setCubeDepth}
          turnSpeed={turnSpeed}
          setTurnSpeed={setTurnSpeed}
          sendToWebView={sendToWebView}
          isPortrait={true}
        />
      </SafeAreaView>
    );
  }

  // Landscape Mode - Sidebar (left) + WebView (right)
  return (
    <SafeAreaView style={styles.containerLandscape} edges={['left', 'right', 'bottom']}>
      <StatusBar barStyle="light-content" backgroundColor="#000" />
      {/* Sidebar on left */}
      <View style={styles.sidebarLandscape}>
        <StatsPanel fps={fps} ballCount={actualBallCount} generation={generation} checks={checks} />
        <MainControls
          onStart={() => sendToWebView('start')}
          onStop={() => sendToWebView('stop')}
          onNew={() => handleNew()}
          onReset={() => handleReset()}
          isRunning={isRunning}
        />
        <ControlsPanel
          ballCount={ballCount}
          setBallCount={setBallCount}
          minRadius={minRadius}
          setMinRadius={setMinRadius}
          maxRadius={maxRadius}
          setMaxRadius={setMaxRadius}
          gravityPreset={gravityPreset}
          setGravityPreset={setGravityPreset}
          gravityMagnitude={gravityMagnitude}
          collisionsEnabled={collisionsEnabled}
          setCollisionsEnabled={setCollisionsEnabled}
          calcFactor={calcFactor}
          setCalcFactor={setCalcFactor}
          gridEnabled={gridEnabled}
          setGridEnabled={setGridEnabled}
          gridSegments={gridSegments}
          setGridSegments={setGridSegments}
          showWorldGrid={showWorldGrid}
          setShowWorldGrid={setShowWorldGrid}
          showOccupiedVoxels={showOccupiedVoxels}
          setShowOccupiedVoxels={setShowOccupiedVoxels}
          showCollisionChecks={showCollisionChecks}
          setShowCollisionChecks={setShowCollisionChecks}
          drawMode={drawMode}
          setDrawMode={setDrawMode}
          wireframeSegments={wireframeSegments}
          setWireframeSegments={setWireframeSegments}
          stereoMode={stereoMode}
          setStereoMode={setStereoMode}
          eyeSeparation={eyeSeparation}
          setEyeSeparation={setEyeSeparation}
          cubeDepth={cubeDepth}
          setCubeDepth={setCubeDepth}
          turnSpeed={turnSpeed}
          setTurnSpeed={setTurnSpeed}
          sendToWebView={sendToWebView}
          isPortrait={false}
        />
      </View>

      {/* WebView on right - using persistent WebView */}
      <View style={{ flex: 1 }}>
        {renderPersistentWebView()}
      </View>
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
  containerTopBottomStereo: {
    height: "50vh", // Nur obere Hälfte im Top/Bottom Stereo
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
  sidebarTopBottomStereo: {
    maxHeight: "50vh", // Sidebar nur in oberer Hälfte
    overflowY: "auto", // Scrollbar für Sidebar
  },
  bottomHalfBlack: {
    position: "absolute",
    left: 0,
    bottom: 0,
    width: 280, // Gleiche Breite wie Sidebar
    height: "50vh", // Untere Hälfte
    backgroundColor: "#000", // Schwarz
    zIndex: 9999, // Über allem
    pointerEvents: "none", // Kein Blocking von Interaktionen
  },
  sidebarContent: {
    padding: 12,
  },
  title: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#333",
    marginBottom: 8,
  },
  section: {
    marginBottom: 12,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#eee",
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: "600",
    color: "#555",
    marginBottom: 4,
  },
  statText: {
    fontSize: 12,
    color: "#666",
    marginBottom: 2,
    flex: 1,
  },
  statsGrid: {
    marginTop: 4,
  },
  statsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 2,
  },
  label: {
    fontSize: 12,
    color: "#666",
    marginBottom: 2,
  },
  smallText: {
    fontSize: 11,
    color: "#999",
    fontStyle: "italic",
    marginTop: 2,
  },
  smallLabel: {
    fontSize: 11,
    color: "#666",
  },
  sliderContainer: {
    marginTop: 4,
    marginBottom: 4,
  },
  slider: {
    width: "100%",
    height: 40,
  },
  cubeDepthSliderWrapper: {
    position: "relative",
    width: "100%",
  },
  cubeDepthCenterMarker: {
    position: "absolute",
    left: "50%",
    top: 15,
    width: 2,
    height: 10,
    backgroundColor: "#666",
    marginLeft: -1,
    zIndex: 0,
    pointerEvents: "none",
  },
  sliderLabels: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: -8,
    paddingHorizontal: 4,
  },
  sliderLabelText: {
    fontSize: 10,
    color: "#999",
  },
  sliderLabelCenter: {
    fontSize: 10,
    color: "#666",
    fontWeight: "600",
  },
  toggleContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 4,
    marginBottom: 4,
  },
  pickerContainer: {
    marginTop: 4,
    marginBottom: 6,
  },
  radioGroup: {
    marginTop: 4,
    marginBottom: 6,
  },
  radioOption: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 4,
    cursor: "pointer",
  },
  radioCircle: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: "#666",
    marginRight: 8,
    justifyContent: "center",
    alignItems: "center",
  },
  radioCircleSelected: {
    borderColor: "#4CAF50",
  },
  radioCircleInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: "#4CAF50",
  },
  radioLabel: {
    fontSize: 13,
    color: "#666",
  },
  applyButton: {
    backgroundColor: "#FF9800",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    marginTop: 4,
    marginBottom: 4,
    alignItems: "center",
  },
  controlsContainer: {
    backgroundColor: "#f5f5f5",
    paddingTop: 6,
    paddingBottom: 6,
    paddingHorizontal: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#ddd",
  },
  buttonRow: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    marginVertical: 2,
  },
  startButton: {
    backgroundColor: "#4CAF50",
    paddingHorizontal: 10,
    paddingVertical: 6,
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
    paddingVertical: 6,
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
    paddingVertical: 6,
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
  buttonDisabled: {
    backgroundColor: "#ccc",
    opacity: 0.6,
  },
  webview: {
    flex: 1,
  },

  // === MOBILE LAYOUTS ===

  // VR Mode (Cardboard)
  vrContainer: {
    flex: 1,
    backgroundColor: '#000',
  },
  vrWebView: {
    flex: 1,
  },
  vrHiddenTapZoneLeft: {
    position: 'absolute',
    left: 0,
    bottom: 0,
    width: 80,
    height: 80,
    backgroundColor: 'transparent',
  },
  vrHiddenTapZoneRight: {
    position: 'absolute',
    right: 0,
    bottom: 0,
    width: 80,
    height: 80,
    backgroundColor: 'transparent',
  },

  // VR Toggle Rows (2-column layout)
  vrToggleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  vrToggleItem: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 6,
    backgroundColor: '#fff',
    borderRadius: 6,
    marginHorizontal: 4,
  },
  vrToggleLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#333',
  },
  vrBallButton: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 6,
    marginHorizontal: 4,
    alignItems: 'center',
  },
  vrBallButtonMinus: {
    backgroundColor: '#f44336',
  },
  vrBallButtonPlus: {
    backgroundColor: '#4CAF50',
  },
  vrBallButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
  },

  // Portrait Mode
  containerPortrait: {
    flex: 1,
    backgroundColor: '#f5f5f5', // Light gray - matches Stats panel background
  },
  webViewContainerPortrait: {
    aspectRatio: 1, // Square
    width: '100%',
    maxWidth: 500,
    alignSelf: 'center',
    backgroundColor: '#000',
  },
  webViewPortrait: {
    flex: 1,
  },

  // Landscape Mode
  containerLandscape: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: '#000', // Black background so white system icons are visible
  },
  sidebarLandscape: {
    width: 280,
    borderRightWidth: 1,
    borderRightColor: '#ddd',
    backgroundColor: '#f9f9f9',
  },
  webViewLandscape: {
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

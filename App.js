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

  // WebView loaded state for initial cube depth fix
  const [webViewLoaded, setWebViewLoaded] = useState(false);


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
          }
        } catch (e) {
          // Ignore non-JSON messages
        }
      };

      window.addEventListener('message', handleMessage);
      return () => window.removeEventListener('message', handleMessage);
    }
  }, []);

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
            <Text style={styles.statText}>FPS: {fps}</Text>
            <Text style={styles.statText}>Balls: {actualBallCount}</Text>
            <Text style={styles.statText}>Generation: {generation}</Text>
            <Text style={styles.statText}>Checks: {checks}</Text>
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
                minimumTrackTintColor="#4CAF50"
                maximumTrackTintColor="#ddd"
              />
              <Text style={styles.smallText}>Click "New" to apply</Text>
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
    marginTop: 8,
    marginBottom: 8,
  },
  pickerContainer: {
    marginTop: 8,
    marginBottom: 12,
  },
  radioGroup: {
    marginTop: 8,
    marginBottom: 12,
  },
  radioOption: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
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
  buttonDisabled: {
    backgroundColor: "#ccc",
    opacity: 0.6,
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

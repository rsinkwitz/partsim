import React, { useState, useEffect, useRef } from "react";
import { StyleSheet, Platform, ActivityIndicator, View, Text, TouchableOpacity, ScrollView, Switch, Dimensions, StatusBar } from "react-native";
import { WebView } from "react-native-webview";
import { SafeAreaView, SafeAreaProvider } from "react-native-safe-area-context";
import * as FileSystem from "expo-file-system/legacy";
import { Asset } from "expo-asset";
import Slider from '@react-native-community/slider';
import { UnifiedMenuOverlay, TapZones, StatsTapZone, StatsOverlay } from './UnifiedUI';

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

// Persistent WebView Component - using React.memo to prevent unnecessary re-renders
// Supports both Web (iframe) and Mobile (WebView)
const PersistentWebView = React.memo(({ webAppUri, webViewRef, injectedJavaScript, onMessage }) => {
  if (!webAppUri) return null;

  if (Platform.OS === "web") {
    // Web: iframe
    return (
      <iframe
        ref={webViewRef}
        src={webAppUri}
        onLoad={() => console.log('📺 iframe loaded')}
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          border: "none",
        }}
        title="PaDIPS Simulation"
      />
    );
  } else {
    // Mobile: WebView
    return (
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
        onMessage={onMessage}
      />
    );
  }
}, (prevProps, nextProps) => {
  // Only re-render if webAppUri changes (which happens once on load)
  return prevProps.webAppUri === nextProps.webAppUri;
});

function AppContent({ webAppUri, setWebAppUri, loading, setLoading, error, setError, webViewRef }) {
  // UI State - Balls
  const [ballCount, setBallCount] = useState(80);
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
  const [turnSpeed, setTurnSpeed] = useState(1); // Auto-rotation speed: 0=off, 1-4=speed multiplier
  const [isDarkMode, setIsDarkMode] = useState(false); // Dark mode for UI

  // WebView loaded state for initial cube depth fix
  const [webViewLoaded, setWebViewLoaded] = useState(false);

  // Track if we've already initialized (to prevent multiple resets)
  const initializedRef = useRef(false);

  // Mobile-specific state
  const [isPortrait, setIsPortrait] = useState(true);

  // Unified UI state - Menu visibility and tap indicators
  const [showMenu, setShowMenu] = useState(false);
  const [showTapIndicators, setShowTapIndicators] = useState(false); // Start with false
  const [webViewReady, setWebViewReady] = useState(false); // Track WebView readiness

  // Log initial state
  useEffect(() => {
    console.log('🎬 App initialized: showTapIndicators = false (waiting for WebView)');
  }, []);

  // Stats from WebView
  const [fps, setFps] = useState(0);
  const [actualBallCount, setActualBallCount] = useState(80);
  const [generation, setGeneration] = useState(0);
  const [isRunning, setIsRunning] = useState(true);
  const [checks, setChecks] = useState(0);

  // Mobile Stats Overlay (tap zone top-left, like F2 on Web)
  const [showStatsOverlay, setShowStatsOverlay] = useState(false);

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

            // Update grid/visualization states if changed (e.g., via keyboard shortcuts [I][V][O][C])
            if (data.gridEnabled !== undefined) {
              setGridEnabled(data.gridEnabled);
            }
            if (data.showWorldGrid !== undefined) {
              setShowWorldGrid(data.showWorldGrid);
            }
            if (data.showOccupiedVoxels !== undefined) {
              setShowOccupiedVoxels(data.showOccupiedVoxels);
            }
            if (data.showCollisionChecks !== undefined) {
              setShowCollisionChecks(data.showCollisionChecks);
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
          } else if (data.type === 'darkModeChanged') {
            // Update dark mode (e.g., via keyboard shortcut [D])
            if (data.isDarkMode !== undefined) {
              console.log('🌓 UI: Dark mode updated to:', data.isDarkMode ? 'ON' : 'OFF');
              setIsDarkMode(data.isDarkMode);
            }
          } else if (data.type === 'resetRequest') {
            // Reset requested from WebView (e.g., via keyboard shortcut [R])
            console.log('🔄 Reset requested from WebView');
            handleReset();
          } else if (data.type === 'menuToggleRequest') {
            // Menu toggle requested from WebView (e.g., via keyboard shortcut [M] or [F10])
            console.log('📱 Menu toggle requested from WebView');
            setShowMenu(prev => !prev);
          }
        } catch (e) {
          // Ignore non-JSON messages
        }
      };

      window.addEventListener('message', handleMessage);
      return () => window.removeEventListener('message', handleMessage);
    }
  }, []);

  // Ref to access current showMenu state without recreating handler
  const showMenuRef = useRef(showMenu);
  useEffect(() => {
    showMenuRef.current = showMenu;
  }, [showMenu]);

  // Forward keyboard events to iframe (for shortcuts to work always on Web)
  useEffect(() => {
    if (Platform.OS === "web") {
      const handleKeyDown = (event) => {
        // Escape key to close menu (use ref to get current state)
        if (event.key === 'Escape') {
          if (showMenuRef.current) {
            setShowMenu(false);
            event.preventDefault();
            console.log('⌨️ Menu closed via Escape');
            return;
          }
        }

        // M and F10 are now handled in WebView and sent via menuToggleRequest message

        // Fullscreen toggle (F11 or 'f')
        if (event.key === 'F11' || event.key === 'f' || event.key === 'F') {
          event.preventDefault();
          const elem = document.documentElement;
          if (!document.fullscreenElement) {
            // Enter fullscreen
            if (elem.requestFullscreen) {
              elem.requestFullscreen();
            } else if (elem.webkitRequestFullscreen) { // Safari
              elem.webkitRequestFullscreen();
            } else if (elem.mozRequestFullScreen) { // Firefox
              elem.mozRequestFullScreen();
            } else if (elem.msRequestFullscreen) { // IE/Edge
              elem.msRequestFullscreen();
            }
            console.log('🖥️', event.key, ': Entering fullscreen');
          } else {
            // Exit fullscreen
            if (document.exitFullscreen) {
              document.exitFullscreen();
            } else if (document.webkitExitFullscreen) { // Safari
              document.webkitExitFullscreen();
            } else if (document.mozCancelFullScreen) { // Firefox
              document.mozCancelFullScreen();
            } else if (document.msExitFullscreen) { // IE/Edge
              document.msExitFullscreen();
            }
            console.log('🖥️', event.key, ': Exiting fullscreen');
          }
          return;
        }

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

          // Prevent default for known shortcuts (updated list)
          const shortcuts = ['s', 'a', 'r', 'y', '3', 'd', 't', 'w', 'p', 'g', 'x', 'i', 'v', 'o', 'O', 'c', 'f', 'F', 'F1', 'F2', 'F10', 'F11', 'm', 'M'];
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
      console.log('⌨️ Keyboard event forwarder installed ONCE (M/F10 for menu, Esc to close)');

      return () => {
        window.removeEventListener('keydown', handleKeyDown);
        console.log('⌨️ Keyboard event forwarder removed (component unmount)');
      };
    }
  }, []); // Empty dependency array - install ONCE, not on every showMenu change!

  // Orientation detection (Mobile only)
  const previousOrientationRef = useRef(null);

  useEffect(() => {
    if (Platform.OS !== "web") {
      const updateOrientation = () => {
        const { width, height } = require('react-native').Dimensions.get('window');
        const portrait = height > width;
        const wasPortrait = previousOrientationRef.current;

        console.log('📱 Orientation:', portrait ? 'Portrait' : 'Landscape', '(was:', wasPortrait === null ? 'initial' : (wasPortrait ? 'Portrait' : 'Landscape') + ')');

        // Show tap indicators for 3 seconds on orientation change (not on initial load)
        if (wasPortrait !== null && wasPortrait !== portrait) {
          console.log('🔄 Orientation changed, showing tap indicators');
          setShowTapIndicators(true);

          // Notify WebView of orientation change so it can update FOV
          console.log('📱 Notifying WebView of orientation change');
          sendToWebView('orientationChanged', {
            isPortrait: portrait,
            width: width,
            height: height
          });
        }

        // Update refs and state
        previousOrientationRef.current = portrait;
        setIsPortrait(portrait);
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

  // Fade tap indicators after 3 seconds (Web and Mobile)
  useEffect(() => {
    if (showTapIndicators) {
      console.log('⏱️ TapIndicators: Shown, will hide after 3 seconds');
      const timer = setTimeout(() => {
        console.log('⏱️ TapIndicators: 3 seconds elapsed, hiding now');
        setShowTapIndicators(false);
      }, 3000);
      return () => {
        console.log('⏱️ TapIndicators: Timer cleared');
        clearTimeout(timer);
      };
    } else {
      console.log('⏱️ TapIndicators: Hidden');
    }
  }, [showTapIndicators]);


  // Load web app files
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

  // Hilfsfunktion um Aktionen an die WebView zu senden (Platform-aware)
  const sendToWebView = (action, params) => {
    // Log UI→WebView messages to debug which controls work
    if (action !== 'setCalcFactor') { // CalcFactor spammt bei Slider-Bewegung
      if (params === undefined) {
        console.log('📤 UI→WebView:', action);
      } else {
        console.log('📤 UI→WebView:', action, params);
      }
    }

    if (Platform.OS === "web") {
      // Web: iframe
      if (webViewRef.current && webViewRef.current.contentWindow) {
        const message = JSON.stringify({ action, params });
        webViewRef.current.contentWindow.postMessage(message, '*');
      }
    } else {
      // Mobile: WebView
      if (webViewRef.current) {
        const message = JSON.stringify({ action, params });
        webViewRef.current.postMessage(message);
      }
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

  // Handle Play/Pause toggle (single button)
  const handleTogglePlayPause = () => {
    if (isRunning) {
      sendToWebView('stop');
    } else {
      sendToWebView('start');
    }
  };

  // Handle "Reset" button - reset all parameters to defaults
  const handleReset = () => {
    console.log('🔄 Reset to defaults');

    // Reset all UI state to defaults
    setBallCount(80);
    setMinRadius(5);
    setMaxRadius(15);
    setMaxVelocity(2.0);
    setElasticity(90);
    setGravityPreset('ZERO');
    setGravityMagnitude(9.81); // Reset to Earth gravity
    setGlobalElasticity(90); // Reset to 90%
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
    setTurnSpeed(1); // Reset to 1x rotation

    // Send default values to WebView
    sendToWebView('setBallCount', 80);
    sendToWebView('setMinRadius', 0.05); // 5cm in meters
    sendToWebView('setMaxRadius', 0.15); // 15cm in meters
    sendToWebView('setMaxVelocity', 2.0);
    sendToWebView('setElasticity', 0.9);
    sendToWebView('setGravityPreset', { preset: 'ZERO', magnitude: 9.81 });
    sendToWebView('setGlobalElasticity', 0.9); // Reset global elasticity
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
    sendToWebView('setAutoRotation', { enabled: true, speed: 1 }); // Reset to 1x rotation

    // Full reset with camera reset
    sendToWebView('reset');
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

        // NOTE: turnSpeed is NOT in stateUpdate anymore
        // It's sent separately via 'turnSpeedUpdate' when changed

        const newBallCount = data.ballCount || 30;
        // Nur updaten wenn signifikante Änderung (vermeidet Flackern bei kurzen Dips während reset)
        setActualBallCount(prev => {
          if (Math.abs(newBallCount - prev) >= 5) {
            return newBallCount;
          }
          return prev;
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

      // Reset request from 'R' keyboard shortcut
      if (data.type === 'resetRequest') {
        console.log('🔄 Reset requested from WebView');
        handleReset();
      }

      if (data.type === 'error' || data.type === 'unhandledrejection') {
        console.error("❌ WebView JS Error:", JSON.stringify(data, null, 2));
      }

      if (data.type === 'log') {
        console.log("📱 WebView:", data.message);
      }

      // WebView signals it's ready - resend all current settings
      if (data.type === 'initialized') {
        console.log('🎬 WebView initialized - resending settings...');

        // Only process initialization ONCE to prevent reload loop
        if (initializedRef.current) {
          console.log('⏭️ Already initialized, skipping resend');
          return;
        }
        initializedRef.current = true;

        // Mark WebView as ready and show tap indicators
        setWebViewReady(true);
        console.log('✅ WebView ready, showing tap indicators for 3 seconds');
        setShowTapIndicators(true);

        console.log('📊 Current UI state:', {
          ballCount,
          actualBallCount,
          drawMode,
          gridEnabled,
          gridSegments,
          showWorldGrid,
          showOccupiedVoxels,
          showCollisionChecks,
          isRunning,
        });

        // Resend all current UI state to WebView
        // Use longer timeout to ensure WebView is fully ready
        setTimeout(() => {
          // Ball parameters - use UI values, not actualBallCount
          sendToWebView('setBallCount', ballCount);
          sendToWebView('setMinRadius', minRadius / 100);
          sendToWebView('setMaxRadius', maxRadius / 100);
          sendToWebView('setMaxVelocity', maxVelocity);
          sendToWebView('setElasticity', elasticity / 100);

          // Physics
          sendToWebView('setGravityPreset', { preset: gravityPreset, magnitude: gravityMagnitude });
          sendToWebView('setCalcFactor', calcFactor);
          sendToWebView('setCollisionsEnabled', collisionsEnabled);

          // Grid - ALWAYS send grid state, even if disabled
          if (gridEnabled) {
            sendToWebView('applyGrid', { segments: gridSegments });
            if (showWorldGrid) {
              sendToWebView('setShowWorldGrid', true);
            }
            if (showOccupiedVoxels) {
              sendToWebView('setShowOccupiedVoxels', true);
            }
          } else {
            sendToWebView('disableGrid');
          }
          sendToWebView('setShowCollisionChecks', showCollisionChecks);

          // Rendering
          sendToWebView('setDrawMode', drawMode);
          sendToWebView('setWireframeSegments', wireframeSegments);
          sendToWebView('setStereoMode', stereoMode);
          sendToWebView('setEyeSeparation', eyeSeparation / 100);
          sendToWebView('setCubeDepth', cubeDepth);

          // Auto-rotation
          if (turnSpeed > 0) {
            sendToWebView('setAutoRotation', { enabled: true, speed: turnSpeed });
          } else {
            sendToWebView('setAutoRotation', { enabled: false });
          }

          // Generate balls with current settings (AFTER all settings are applied)
          sendToWebView('new');

          // Start if it was running
          if (isRunning) {
            sendToWebView('start');
          }

          console.log('✅ Settings resent to WebView');
        }, 200);
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

  // === UNIFIED UI FOR ALL PLATFORMS ===
  // Fullscreen WebView with tap-to-menu overlay on all platforms

  // Helper to send messages (works for both iframe and WebView)
  const sendMessage = (action, params) => {
    if (Platform.OS === "web") {
      // Web: iframe
      sendToIframe(action, params);
    } else {
      // Mobile: WebView
      if (webViewRef.current) {
        const message = JSON.stringify({ action, params });
        webViewRef.current.postMessage(message);
      }
    }
  };



  return (
    <View style={styles.unifiedContainer}>
      <StatusBar
        hidden={Platform.OS !== 'web' && !isPortrait} // Verstecke in Landscape auf Mobile
        translucent={true} // Erlaube Rendering unter der StatusBar
        barStyle={showMenu ? "light-content" : "dark-content"}
        backgroundColor="transparent"
      />

      {/* WebView Container - Platform/Orientation specific sizing */}
      <View style={[
        styles.webViewContainer,
        Platform.OS !== 'web' && isPortrait && styles.webViewContainerPortrait,
        Platform.OS !== 'web' && !isPortrait && styles.webViewContainerLandscape,
        // In Landscape (NICHT Stereo): WebView schmaler wenn Menu offen
        Platform.OS !== 'web' && !isPortrait && showMenu && stereoMode === 'off' && styles.webViewContainerLandscapeWithMenu,
      ]}>
        <PersistentWebView
          webAppUri={webAppUri}
          webViewRef={webViewRef}
          injectedJavaScript={injectedJavaScript}
          onMessage={handleWebViewMessage}
        />
      </View>

      {/* Stats Overlay - Tap Zone (Web + Mobile) */}
      <StatsTapZone onToggle={() => setShowStatsOverlay(prev => !prev)} />
      <StatsOverlay
        visible={showStatsOverlay}
        fps={fps}
        ballCount={actualBallCount}
        generation={generation}
        checks={checks}
        calcFactor={calcFactor}
        onClose={() => setShowStatsOverlay(false)}
      />

      {/* Tap Zones (bottom corners) */}
      <TapZones
        onTapLeft={() => {
          console.log('👆 Tap Left: Opening menu, hiding indicators');
          setShowMenu(true);
          setShowTapIndicators(false);
        }}
        onTapRight={() => {
          console.log('👆 Tap Right: Opening menu, hiding indicators');
          setShowMenu(true);
          setShowTapIndicators(false);
        }}
        showIndicators={showTapIndicators && !showMenu}
      />

      {/* Menu Overlay */}
      <UnifiedMenuOverlay
        visible={showMenu}
        onClose={() => setShowMenu(false)}
        fps={fps}
        ballCount={ballCount}
        setBallCount={setBallCount}
        actualBallCount={actualBallCount}
        generation={generation}
        checks={checks}
        isRunning={isRunning}
        drawMode={drawMode}
        setDrawMode={setDrawMode}
        gravityPreset={gravityPreset}
        setGravityPreset={setGravityPreset}
        gravityMagnitude={gravityMagnitude}
        setGravityMagnitude={setGravityMagnitude}
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
        stereoMode={stereoMode}
        setStereoMode={setStereoMode}
        eyeSeparation={eyeSeparation}
        setEyeSeparation={setEyeSeparation}
        cubeDepth={cubeDepth}
        setCubeDepth={setCubeDepth}
        turnSpeed={turnSpeed}
        setTurnSpeed={setTurnSpeed}
        minRadius={minRadius}
        setMinRadius={setMinRadius}
        maxRadius={maxRadius}
        setMaxRadius={setMaxRadius}
        maxVelocity={maxVelocity}
        setMaxVelocity={setMaxVelocity}
        elasticity={elasticity}
        setElasticity={setElasticity}
        globalElasticity={globalElasticity}
        setGlobalElasticity={setGlobalElasticity}
        calcFactor={calcFactor}
        setCalcFactor={setCalcFactor}
        collisionsEnabled={collisionsEnabled}
        setCollisionsEnabled={setCollisionsEnabled}
        wireframeSegments={wireframeSegments}
        setWireframeSegments={setWireframeSegments}
        isDarkMode={isDarkMode}
        setIsDarkMode={setIsDarkMode}
        sendToWebView={sendMessage}
        onTogglePlayPause={handleTogglePlayPause}
        onReset={handleReset}
        isPortrait={isPortrait}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  unifiedContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#000', // Schwarz, damit kein weißer Streifen sichtbar ist
  },

  // WebView Container - Clean 100% sizing on all platforms
  webViewContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: '100%',
    height: '100%',
    backgroundColor: '#000',
  },

  // Mobile Portrait: Vollbild
  webViewContainerPortrait: {
    // Nutzt base container (100% x 100%)
  },

  // Mobile Landscape: Vollbild
  webViewContainerLandscape: {
    // Nutzt base container (100% x 100%)
  },

  // Mobile Landscape mit geöffnetem Menu: WebView schmaler (rechts)
  webViewContainerLandscapeWithMenu: {
    width: '55%', // Menu nimmt 45% ein, WebView 55%
    marginLeft: '45%', // Platz für Menu links
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

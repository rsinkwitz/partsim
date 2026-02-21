/**
 * Unified UI for PaDIPS - Works on Web, Mobile Portrait, Mobile Landscape
 * Fullscreen WebView with Tap-to-Menu overlay
 */

import React, { useState } from 'react';
import {
  View, Text, TouchableOpacity, ScrollView, StyleSheet,
  Switch, Platform, Dimensions
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import Slider from '@react-native-community/slider';

/**
 * Button with Tooltip (Web only)
 */
function TooltipButton({ title, onPress, children, style, textStyle }) {
  const [showTooltip, setShowTooltip] = useState(false);

  if (Platform.OS === 'web') {
    return (
      <View style={styles.tooltipWrapper}>
        {showTooltip && (
          <View style={styles.tooltip}>
            <Text style={styles.tooltipText}>{title}</Text>
          </View>
        )}
        <TouchableOpacity
          style={style}
          onPress={onPress}
          onMouseEnter={() => setShowTooltip(true)}
          onMouseLeave={() => setShowTooltip(false)}
        >
          {children}
        </TouchableOpacity>
      </View>
    );
  } else {
    // Mobile: Kein Tooltip
    return (
      <TouchableOpacity style={style} onPress={onPress}>
        {children}
      </TouchableOpacity>
    );
  }
}

/**
 * Stats Panel - 2x2 Grid
 */
function StatsPanel({ fps, ballCount, generation, checks }) {
  return (
    <View style={styles.statsContainer}>
      <View style={styles.statsRow}>
        <Text style={styles.statText}>FPS: {fps}</Text>
        <Text style={styles.statText}>Balls: {ballCount}</Text>
      </View>
      <View style={styles.statsRow}>
        <Text style={styles.statText}>Gen: {generation}</Text>
        <Text style={styles.statText}>Checks: {checks}</Text>
      </View>
    </View>
  );
}

/**
 * Main Controls - Play/Pause (single toggle), Reset, Close
 */
function MainControls({ isRunning, onTogglePlayPause, onReset, onClose }) {
  return (
    <View style={styles.mainControls}>
      <TouchableOpacity
        style={styles.controlButton}
        onPress={onTogglePlayPause}
      >
        <Text style={styles.buttonText}>{isRunning ? '⏸' : '▶'}</Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={styles.controlButton}
        onPress={onReset}
      >
        <Text style={styles.buttonText}>🔄</Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={styles.controlButton}
        onPress={onClose}
      >
        <Text style={styles.buttonText}>✖</Text>
      </TouchableOpacity>
    </View>
  );
}

/**
 * Compact Toggles - 2x3 or 3x2 responsive layout
 * Quick access for most-used settings
 */
function CompactToggles({
  // States
  drawMode,
  setDrawMode,
  gravityPreset,
  setGravityPreset,
  gridEnabled,
  setGridEnabled,
  showCollisionChecks,
  setShowCollisionChecks,
  showOccupiedVoxels,
  setShowOccupiedVoxels,
  stereoMode,
  setStereoMode,
  // Callbacks
  sendToWebView,
  isPortrait,
  gravityMagnitude,
  gridSegments,
}) {
  const { width } = Dimensions.get('window');
  const useWideLayout = width > 400; // 3x2 if enough width

  // Stereo Toggle Handler - Platform-specific
  const handleStereoToggle = (enabled) => {
    if (!enabled) {
      setStereoMode('off');
      sendToWebView('setStereoMode', 'off');
    } else {
      let mode;
      if (Platform.OS === 'web') {
        mode = 'topbottom';
      } else if (isPortrait) {
        mode = 'anaglyph';
      } else {
        mode = 'sidebyside'; // Landscape mobile
      }
      setStereoMode(mode);
      sendToWebView('setStereoMode', mode);
    }
  };

  // Silver Toggle (LIGHTED ↔ SILVER)
  const handleSilverToggle = (enabled) => {
    const mode = enabled ? 'SILVER' : 'LIGHTED';
    setDrawMode(mode);
    sendToWebView('setDrawMode', mode);
  };

  // Gravity Toggle (ZERO ↔ DOWN)
  const handleGravityToggle = (enabled) => {
    const preset = enabled ? 'DOWN' : 'ZERO';
    setGravityPreset(preset);
    sendToWebView('setGravityPreset', { preset, magnitude: gravityMagnitude });
  };

  // Grid Toggle
  const handleGridToggle = (enabled) => {
    setGridEnabled(enabled);
    if (enabled) {
      sendToWebView('applyGrid', { segments: gridSegments });
    } else {
      sendToWebView('disableGrid');
    }
  };

  const toggles = [
    { icon: '✨', label: 'Silver', value: drawMode === 'SILVER', onChange: handleSilverToggle },
    { icon: '🌍', label: 'Gravity', value: gravityPreset === 'DOWN', onChange: handleGravityToggle },
    { icon: '🔲', label: 'Grid', value: gridEnabled, onChange: handleGridToggle },
    { icon: '🔍', label: 'Checks', value: showCollisionChecks, onChange: (val) => {
      setShowCollisionChecks(val);
      sendToWebView('setShowCollisionChecks', val);
    }},
    { icon: '📦', label: 'Voxels', value: showOccupiedVoxels, onChange: (val) => {
      setShowOccupiedVoxels(val);
      sendToWebView('setShowOccupiedVoxels', val);
    }},
    { icon: '🕶️', label: 'Stereo', value: stereoMode !== 'off', onChange: handleStereoToggle },
  ];

  return (
    <View style={styles.compactToggles}>
      <View style={useWideLayout ? styles.toggleGrid3x2 : styles.toggleGrid2x3}>
        {toggles.map((toggle, index) => (
          <View key={index} style={styles.toggleItem}>
            <Text style={styles.toggleLabel}>{toggle.icon} {toggle.label}</Text>
            <Switch
              value={toggle.value}
              onValueChange={toggle.onChange}
              trackColor={{ false: '#ccc', true: '#4CAF50' }}
              thumbColor={toggle.value ? '#fff' : '#f4f3f4'}
            />
          </View>
        ))}
      </View>
    </View>
  );
}

/**
 * Ball Count Controls - ±50 buttons
 */
function BallCountControls({ ballCount, setBallCount, sendToWebView }) {
  const handleMinus = () => {
    const newCount = Math.max(5, ballCount - 50);
    setBallCount(newCount);
    sendToWebView('setBallCount', newCount);
    sendToWebView('new');
  };

  const handlePlus = () => {
    const newCount = Math.min(1000, ballCount + 50);
    setBallCount(newCount);
    sendToWebView('setBallCount', newCount);
    sendToWebView('new');
  };

  return (
    <View style={styles.ballCountControls}>
      <Text style={styles.ballCountLabel}>🎱 Balls: {ballCount}</Text>
      <View style={styles.ballCountButtons}>
        <TouchableOpacity style={styles.ballCountButton} onPress={handleMinus}>
          <Text style={styles.ballCountButtonText}>-50</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.ballCountButton} onPress={handlePlus}>
          <Text style={styles.ballCountButtonText}>+50</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

/**
 * Turn Speed Slider
 */
function TurnSpeedSlider({ turnSpeed, setTurnSpeed, sendToWebView }) {
  const handleChange = (val) => {
    setTurnSpeed(val);
    if (val === 0) {
      sendToWebView('setAutoRotation', { enabled: false });
    } else {
      sendToWebView('setAutoRotation', { enabled: true, speed: val });
    }
  };

  return (
    <View style={styles.sliderContainer}>
      <Text style={styles.sliderLabel}>🔄 Turn: {turnSpeed === 0 ? 'OFF' : `${turnSpeed}x`}</Text>
      <Slider
        style={styles.slider}
        minimumValue={0}
        maximumValue={4}
        step={1}
        value={turnSpeed}
        onValueChange={handleChange}
        minimumTrackTintColor="#FF9800"
        maximumTrackTintColor="#ddd"
        thumbTintColor="#FF9800"
      />
    </View>
  );
}

/**
 * Collapsible Section
 */
function CollapsibleSection({ title, defaultOpen = false, children }) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <View style={styles.section}>
      <TouchableOpacity
        style={styles.sectionHeader}
        onPress={() => setIsOpen(!isOpen)}
      >
        <Text style={styles.sectionTitle}>{isOpen ? '▼' : '▶'} {title}</Text>
      </TouchableOpacity>
      {isOpen && (
        <View style={styles.sectionContent}>
          {children}
        </View>
      )}
    </View>
  );
}

/**
 * Menu Overlay Content
 */
export function UnifiedMenuOverlay({
  // Visibility
  visible,
  onClose,

  // Stats
  fps,
  ballCount,
  generation,
  checks,

  // States
  isRunning,
  drawMode,
  setDrawMode,
  gravityPreset,
  setGravityPreset,
  gravityMagnitude,
  setGravityMagnitude,
  gridEnabled,
  setGridEnabled,
  gridSegments,
  setGridSegments,
  showWorldGrid,
  setShowWorldGrid,
  showOccupiedVoxels,
  setShowOccupiedVoxels,
  showCollisionChecks,
  setShowCollisionChecks,
  stereoMode,
  setStereoMode,
  eyeSeparation,
  setEyeSeparation,
  cubeDepth,
  setCubeDepth,
  turnSpeed,
  setTurnSpeed,

  // Ball parameters
  minRadius,
  setMinRadius,
  maxRadius,
  setMaxRadius,
  maxVelocity,
  setMaxVelocity,
  elasticity,
  setElasticity,

  // Simulation
  calcFactor,
  setCalcFactor,
  collisionsEnabled,
  setCollisionsEnabled,

  // Rendering
  wireframeSegments,
  setWireframeSegments,

  // Callbacks
  sendToWebView,
  onTogglePlayPause,
  onReset,

  // Platform info
  isPortrait,
}) {
  if (!visible) return null;

  const handleApply = () => {
    // Validate and correct parameters
    let finalMinRadius = minRadius;
    let finalMaxRadius = maxRadius;

    if (finalMaxRadius < finalMinRadius) {
      finalMinRadius = finalMaxRadius;
      setMinRadius(finalMinRadius);
    }

    // Send all ball parameters before reset
    sendToWebView('setBallCount', ballCount);
    sendToWebView('setMinRadius', finalMinRadius / 100);
    sendToWebView('setMaxRadius', finalMaxRadius / 100);
    if (maxVelocity !== undefined) sendToWebView('setMaxVelocity', maxVelocity);
    if (elasticity !== undefined) sendToWebView('setElasticity', elasticity / 100);

    // Apply = New with current parameters
    sendToWebView('new');
  };

  // Web Stereo-Mode: Nur obere Hälfte nutzen
  const isWebStereo = Platform.OS === 'web' && (stereoMode === 'topbottom' || stereoMode === 'sidebyside');

  return (
    <View style={styles.overlay}>
      <SafeAreaView
        style={[
          styles.menuContainer,
          isWebStereo && styles.menuContainerWebStereo
        ]}
        edges={Platform.OS === 'web' ? [] : (isPortrait ? ['top', 'left'] : ['left', 'top'])}
      >
        <ScrollView contentContainerStyle={styles.menuContent}>
          {/* KOPF-BEREICH: Stats + Close Button */}
          <View style={styles.headerRow}>
            <View style={styles.statsWrapper}>
              <StatsPanel fps={fps} ballCount={ballCount} generation={generation} checks={checks} />
            </View>
            <TouchableOpacity style={styles.closeButton} onPress={onClose}>
              <Text style={styles.closeButtonText}>✖</Text>
            </TouchableOpacity>
          </View>

          {/* Main Controls: Play/Pause, Apply, Reset */}
          <View style={styles.mainControls}>
            <TooltipButton
              title={isRunning ? 'Pause' : 'Play'}
              style={styles.controlButton}
              onPress={onTogglePlayPause}
            >
              <Text style={styles.buttonText}>{isRunning ? '⏸' : '▶'}</Text>
            </TooltipButton>
            <TooltipButton
              title="Apply"
              style={styles.controlButton}
              onPress={handleApply}
            >
              <Text style={styles.buttonText}>✨</Text>
            </TooltipButton>
            <TooltipButton
              title="Reset"
              style={styles.controlButton}
              onPress={onReset}
            >
              <Text style={styles.buttonText}>🔄</Text>
            </TooltipButton>
          </View>

          <CompactToggles
            drawMode={drawMode}
            setDrawMode={setDrawMode}
            gravityPreset={gravityPreset}
            setGravityPreset={setGravityPreset}
            gridEnabled={gridEnabled}
            setGridEnabled={setGridEnabled}
            showCollisionChecks={showCollisionChecks}
            setShowCollisionChecks={setShowCollisionChecks}
            showOccupiedVoxels={showOccupiedVoxels}
            setShowOccupiedVoxels={setShowOccupiedVoxels}
            stereoMode={stereoMode}
            setStereoMode={setStereoMode}
            sendToWebView={sendToWebView}
            isPortrait={isPortrait}
            gravityMagnitude={gravityMagnitude}
            gridSegments={gridSegments}
          />

          <BallCountControls
            ballCount={ballCount}
            setBallCount={() => {}} // Set via ±50 buttons only
            sendToWebView={sendToWebView}
          />

          <TurnSpeedSlider
            turnSpeed={turnSpeed}
            setTurnSpeed={setTurnSpeed}
            sendToWebView={sendToWebView}
          />

          {/* KOLLABIERBARE SECTIONS */}

          <CollapsibleSection title="📦 Model" defaultOpen={false}>
            {/* Balls */}
            <View style={styles.sliderContainer}>
              <Text style={styles.label}>Number of Balls: {ballCount}</Text>
              <Text style={styles.smallText}>Use ±50 buttons above or slider below</Text>
              <Slider
                style={styles.slider}
                minimumValue={5}
                maximumValue={1000}
                step={5}
                value={ballCount}
                onValueChange={() => {}} // Read-only display, use ±50 buttons
                minimumTrackTintColor="#4CAF50"
                maximumTrackTintColor="#ddd"
                disabled={true}
              />
            </View>

            <View style={styles.sliderContainer}>
              <Text style={styles.label}>Min Radius: {minRadius} cm</Text>
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
              <Text style={styles.label}>Max Radius: {maxRadius} cm</Text>
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

            {Platform.OS === 'web' && (
              <>
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
              </>
            )}

            <TouchableOpacity style={styles.applyButton} onPress={handleApply}>
              <Text style={styles.applyButtonText}>✨ Apply</Text>
            </TouchableOpacity>

            {/* Physics */}
            <View style={styles.divider} />
            <Text style={styles.subsectionTitle}>Physics</Text>

            <View style={styles.toggleContainer}>
              <Text style={styles.label}>Collisions Enabled</Text>
              <Switch
                value={collisionsEnabled}
                onValueChange={(val) => {
                  setCollisionsEnabled(val);
                  sendToWebView('setCollisionsEnabled', val);
                }}
                trackColor={{ false: '#ddd', true: '#4CAF50' }}
              />
            </View>

            {/* Gravity - matches Quick Toggle */}
            <View style={styles.toggleContainer}>
              <Text style={styles.label}>Gravity (matches toggle above)</Text>
              <Text style={styles.smallText}>Currently: {gravityPreset}</Text>
            </View>
          </CollapsibleSection>

          <CollapsibleSection title="👁️ View" defaultOpen={false}>
            {/* Rendering */}
            <Text style={styles.subsectionTitle}>Rendering</Text>

            {/* Draw Mode - matches Silver Toggle */}
            <View style={styles.pickerContainer}>
              <Text style={styles.label}>Draw Mode (Silver toggle sets LIGHTED/SILVER)</Text>
              <Text style={styles.smallText}>Currently: {drawMode}</Text>
            </View>

            <View style={styles.sliderContainer}>
              <Text style={styles.label}>Wireframe Segments: {wireframeSegments}</Text>
              <Slider
                style={styles.slider}
                minimumValue={4}
                maximumValue={32}
                step={2}
                value={wireframeSegments}
                onValueChange={(val) => {
                  setWireframeSegments(val);
                  sendToWebView('setWireframeSegments', val);
                }}
                minimumTrackTintColor="#9C27B0"
                maximumTrackTintColor="#ddd"
              />
            </View>

            {/* Stereo */}
            <View style={styles.divider} />
            <Text style={styles.subsectionTitle}>3D Stereo</Text>

            <View style={styles.toggleContainer}>
              <Text style={styles.label}>Stereo Mode (toggle controls this)</Text>
              <Text style={styles.smallText}>Currently: {stereoMode}</Text>
            </View>

            {stereoMode !== 'off' && (
              <>
                <View style={styles.sliderContainer}>
                  <Text style={styles.label}>Eye Separation: {eyeSeparation.toFixed(1)} cm</Text>
                  <Slider
                    style={styles.slider}
                    minimumValue={5}
                    maximumValue={15}
                    step={0.2}
                    value={eyeSeparation}
                    onValueChange={(val) => {
                      setEyeSeparation(val);
                      sendToWebView('setEyeSeparation', val / 100);
                    }}
                    minimumTrackTintColor="#E91E63"
                    maximumTrackTintColor="#ddd"
                  />
                </View>

                <View style={styles.sliderContainer}>
                  <Text style={styles.label}>Cube Depth: {cubeDepth.toFixed(1)} m</Text>
                  <Slider
                    style={styles.slider}
                    minimumValue={-2}
                    maximumValue={2}
                    step={0.1}
                    value={cubeDepth}
                    onValueChange={(val) => {
                      setCubeDepth(val);
                      sendToWebView('setCubeDepth', val);
                    }}
                    minimumTrackTintColor="#E91E63"
                    maximumTrackTintColor="#ddd"
                  />
                </View>
              </>
            )}
          </CollapsibleSection>

          <CollapsibleSection title="⚙️ Simulation & System" defaultOpen={false}>
            {/* Simulation */}
            <Text style={styles.subsectionTitle}>Simulation</Text>

            <View style={styles.sliderContainer}>
              <Text style={styles.label}>Calc Factor: {calcFactor}</Text>
              <Slider
                style={styles.slider}
                minimumValue={1}
                maximumValue={20}
                step={1}
                value={calcFactor}
                onValueChange={(val) => {
                  setCalcFactor(val);
                  sendToWebView('setCalcFactor', val);
                }}
                minimumTrackTintColor="#FF9800"
                maximumTrackTintColor="#ddd"
              />
            </View>

            <View style={styles.toggleContainer}>
              <Text style={styles.label}>Show Collision Checks (matches toggle)</Text>
              <Text style={styles.smallText}>Currently: {showCollisionChecks ? 'ON' : 'OFF'}</Text>
            </View>

            {/* Grid System */}
            <View style={styles.divider} />
            <Text style={styles.subsectionTitle}>Grid System</Text>

            <View style={styles.toggleContainer}>
              <Text style={styles.label}>Grid-based Collision (matches toggle)</Text>
              <Text style={styles.smallText}>Currently: {gridEnabled ? 'ON' : 'OFF'}</Text>
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
                    onValueChange={(val) => {
                      setGridSegments(val);
                      sendToWebView('applyGrid', { segments: val });
                    }}
                    minimumTrackTintColor="#4CAF50"
                    maximumTrackTintColor="#ddd"
                  />
                </View>

                <View style={styles.toggleContainer}>
                  <Text style={styles.label}>Show World Grid</Text>
                  <Switch
                    value={showWorldGrid}
                    onValueChange={(val) => {
                      setShowWorldGrid(val);
                      sendToWebView('setShowWorldGrid', val);
                    }}
                    trackColor={{ false: '#ddd', true: '#4CAF50' }}
                  />
                </View>

                <View style={styles.toggleContainer}>
                  <Text style={styles.label}>Show Occupied Voxels (matches toggle)</Text>
                  <Text style={styles.smallText}>Currently: {showOccupiedVoxels ? 'ON' : 'OFF'}</Text>
                </View>
              </>
            )}
          </CollapsibleSection>

          {/* Footer */}
          {Platform.OS === 'web' && (
            <View style={styles.footer}>
              <Text style={styles.footerText}>[F1] for help • [M] or [F10] for menu</Text>
            </View>
          )}
        </ScrollView>
      </SafeAreaView>

      {/* Tap to close overlay (right side or outside menu) */}
      <TouchableOpacity
        style={styles.overlayBackground}
        onPress={onClose}
        activeOpacity={1}
      />
    </View>
  );
}

/**
 * Tap Zones (bottom corners)
 */
export function TapZones({ onTapLeft, onTapRight, showIndicators = false }) {
  const insets = useSafeAreaInsets();

  // Calculate bottom position: base (20px) + safe area inset
  const bottomPosition = Platform.OS !== 'web' ? 20 + insets.bottom : 20;

  // Log when showIndicators changes
  React.useEffect(() => {
    console.log('👁️ TapZones: showIndicators =', showIndicators, 'bottomPosition =', bottomPosition);
  }, [showIndicators]);

  return (
    <>
      {/* Left tap zone */}
      <TouchableOpacity
        style={{
          position: 'absolute',
          left: 20,
          bottom: bottomPosition,
          width: 80,
          height: 80,
          justifyContent: 'center',
          alignItems: 'center',
          zIndex: 10000,
        }}
        onPress={onTapLeft}
        activeOpacity={0.7}
      >
        {showIndicators && (
          <View style={styles.tapIndicator}>
            <Text style={styles.tapIndicatorText}>👆 Tap for menu</Text>
          </View>
        )}
      </TouchableOpacity>

      {/* Right tap zone */}
      <TouchableOpacity
        style={{
          position: 'absolute',
          right: 20,
          bottom: bottomPosition,
          width: 80,
          height: 80,
          justifyContent: 'center',
          alignItems: 'center',
          zIndex: 10000,
        }}
        onPress={onTapRight}
        activeOpacity={0.7}
      >
        {showIndicators && (
          <View style={styles.tapIndicator}>
            <Text style={styles.tapIndicatorText}>👆 Tap for menu</Text>
          </View>
        )}
      </TouchableOpacity>
    </>
  );
}

const styles = StyleSheet.create({
  // Overlay
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: 'row',
    zIndex: 9999,
  },
  overlayBackground: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  menuContainer: {
    width: Platform.OS === 'web' ? 320 : '80%',
    maxWidth: 400,
    backgroundColor: 'rgba(255, 255, 255, 0.95)', // Light mode
    borderTopRightRadius: Platform.OS !== 'web' ? 12 : 0,
    borderBottomRightRadius: Platform.OS !== 'web' ? 12 : 0,
    shadowColor: '#000',
    shadowOffset: { width: 2, height: 0 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  menuContainerWebStereo: {
    // Web Stereo-Mode: Nur obere Hälfte
    maxHeight: '50%',
  },
  menuContent: {
    padding: 12,
  },

  // Header Row (Stats + Close Button)
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  statsWrapper: {
    flex: 1,
  },
  closeButton: {
    backgroundColor: '#f44336',
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
  },
  closeButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },

  // Tooltip (Web only)
  tooltipWrapper: {
    position: 'relative',
    alignItems: 'center',
  },
  tooltip: {
    position: 'absolute',
    bottom: '100%',
    marginBottom: 8,
    backgroundColor: 'rgba(0, 0, 0, 0.85)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 4,
    zIndex: 10000,
  },
  tooltipText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '500',
  },

  // Stats
  statsContainer: {
    backgroundColor: 'rgba(0, 0, 0, 0.08)',
    padding: 6, // Kompakter: 8 → 6
    borderRadius: 6,
    marginBottom: 8, // Kompakter: 12 → 8
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 1, // Kompakter: 2 → 1
  },
  statText: {
    color: '#333', // Light mode
    fontSize: 12,
    flex: 1,
  },

  // Main Controls
  mainControls: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 8, // Kompakter: 12 → 8
  },
  controlButton: {
    backgroundColor: '#e0e0e0',
    paddingHorizontal: 16, // Kompakter: 20 → 16
    paddingVertical: 8, // Kompakter: 10 → 8
    borderRadius: 8,
    minWidth: 50, // Kompakter: 60 → 50
  },
  buttonText: {
    color: '#333', // Light mode
    fontSize: 18,
    textAlign: 'center',
  },

  // Compact Toggles
  compactToggles: {
    marginBottom: 8, // Kompakter: 12 → 8
    backgroundColor: 'rgba(0, 0, 0, 0.04)',
    borderRadius: 8,
    padding: 6, // Kompakter: 8 → 6
  },
  toggleGrid2x3: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  toggleGrid3x2: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  toggleItem: {
    width: '50%', // 2 columns for 2x3, overridden for 3x2
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 4, // Kompakter: 6 → 4
    paddingHorizontal: 6, // Kompakter: 8 → 6
  },
  toggleLabel: {
    color: '#333', // Light mode
    fontSize: 13,
  },

  // Ball Count Controls
  ballCountControls: {
    flexDirection: 'row', // Einzeilig
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
    backgroundColor: 'rgba(0, 0, 0, 0.04)',
    borderRadius: 8,
    padding: 8,
  },
  ballCountLabel: {
    color: '#333',
    fontSize: 14,
    flex: 1, // Nimmt verfügbaren Platz
  },
  ballCountButtons: {
    flexDirection: 'row',
    gap: 8, // Abstand zwischen Buttons
  },
  ballCountButton: {
    backgroundColor: '#2196F3',
    paddingHorizontal: 12, // Etwas kleiner für einzeilig
    paddingVertical: 6,
    borderRadius: 6,
    minWidth: 70, // Kompakter: 80 → 70
  },
  ballCountButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
    textAlign: 'center',
  },

  // Sliders
  sliderContainer: {
    marginBottom: 8, // Kompakter: 12 → 8
  },
  slider: {
    width: '100%',
    height: 36, // Kompakter: 40 → 36
  },
  sliderLabel: {
    color: '#333', // Light mode
    fontSize: 13,
    marginBottom: 2, // Kompakter: 4 → 2
  },
  label: {
    color: '#333', // Light mode
    fontSize: 13,
    marginBottom: 2, // Kompakter: 4 → 2
  },
  smallText: {
    color: '#666', // Light mode
    fontSize: 11,
    fontStyle: 'italic',
  },

  // Collapsible Sections
  section: {
    marginBottom: 6, // Kompakter: 8 → 6
    borderTopWidth: 1,
    borderTopColor: 'rgba(0, 0, 0, 0.1)', // Light mode
    paddingTop: 6, // Kompakter: 8 → 6
  },
  sectionHeader: {
    paddingVertical: 6, // Kompakter: 8 → 6
  },
  sectionTitle: {
    color: '#333', // Light mode
    fontSize: 15,
    fontWeight: '600',
  },
  sectionContent: {
    paddingLeft: 12,
    paddingTop: 6, // Kompakter: 8 → 6
  },
  subsectionTitle: {
    color: '#4CAF50',
    fontSize: 13,
    fontWeight: '600',
    marginTop: 6, // Kompakter: 8 → 6
    marginBottom: 6, // Kompakter: 8 → 6
  },

  // Apply Button
  applyButton: {
    backgroundColor: '#2196F3',
    padding: 10, // Kompakter: 12 → 10
    borderRadius: 8,
    marginTop: 8, // Kompakter: 12 → 8
    marginBottom: 8, // Kompakter: 12 → 8
  },
  applyButtonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: 'bold',
    textAlign: 'center',
  },

  // Divider
  divider: {
    height: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.1)', // Light mode
    marginVertical: 8, // Kompakter: 12 → 8
  },

  // Toggle Container
  toggleContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8, // Kompakter: 12 → 8
  },

  // Picker Container
  pickerContainer: {
    marginBottom: 8, // Kompakter: 12 → 8
  },

  // Footer
  footer: {
    marginTop: 12, // Kompakter: 16 → 12
    paddingTop: 8, // Kompakter: 12 → 8
    borderTopWidth: 1,
    borderTopColor: 'rgba(0, 0, 0, 0.1)', // Light mode
  },
  footerText: {
    color: '#666', // Light mode
    fontSize: 11,
    textAlign: 'center',
    fontStyle: 'italic',
  },

  // Tap Zones
  tapZone: {
    position: 'absolute',
    // bottom wird dynamisch gesetzt (nicht hier im Style)
    width: 80,
    height: 80,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000, // Über dem WebView
  },
  tapZoneLeft: {
    left: 20, // Abstand vom linken Rand
  },
  tapZoneRight: {
    right: 20, // Abstand vom rechten Rand
  },
  tapIndicator: {
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 6,
  },
  tapIndicatorText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
});


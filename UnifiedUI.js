/**
 * Unified UI for PaDIPS - Works on Web, Mobile Portrait, Mobile Landscape
 * Fullscreen WebView with Tap-to-Menu overlay
 */

import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, TouchableOpacity, ScrollView, StyleSheet,
  Switch, Platform, Dimensions, TouchableWithoutFeedback, Modal
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import Slider from '@react-native-community/slider';
import { crossUpdate, createSyncFunction } from './src/utils/CrossUpdate';

/**
 * Dropdown Picker for Mobile - Compact dropdown-style selector
 */
function DropdownPicker({ value, options, onChange, getLabel, getIcon, isDarkMode }) {
  const [showModal, setShowModal] = useState(false);

  const currentOption = options.find(opt => opt.value === value) || options[0];
  const bgColor = isDarkMode ? '#2a2a2a' : 'white';
  const textColor = isDarkMode ? '#e0e0e0' : '#333';
  const borderColor = isDarkMode ? '#555' : '#ddd';

  return (
    <>
      {/* Current value button */}
      <TouchableOpacity
        style={{
          padding: 8,
          borderRadius: 4,
          border: `1px solid ${borderColor}`,
          backgroundColor: bgColor,
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginTop: 4,
        }}
        onPress={() => setShowModal(true)}
      >
        <Text style={{ color: textColor, fontSize: 13 }}>
          {getIcon ? getIcon(currentOption.value) + ' ' : ''}
          {getLabel ? getLabel(currentOption.value) : currentOption.label}
        </Text>
        <Text style={{ color: textColor, fontSize: 13 }}>▼</Text>
      </TouchableOpacity>

      {/* Modal with options */}
      <Modal
        visible={showModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowModal(false)}
      >
        <TouchableWithoutFeedback onPress={() => setShowModal(false)}>
          <View style={{
            flex: 1,
            backgroundColor: 'rgba(0,0,0,0.5)',
            justifyContent: 'center',
            alignItems: 'center'
          }}>
            <TouchableWithoutFeedback>
              <View style={{
                backgroundColor: bgColor,
                borderRadius: 8,
                padding: 8,
                minWidth: 200,
                maxWidth: '80%',
              }}>
                <Text style={{
                  color: textColor,
                  fontSize: 14,
                  fontWeight: 'bold',
                  marginBottom: 8,
                  textAlign: 'center'
                }}>
                  Select Option
                </Text>
                {options.map((opt) => (
                  <TouchableOpacity
                    key={opt.value}
                    style={{
                      padding: 12,
                      borderRadius: 4,
                      backgroundColor: value === opt.value
                        ? (isDarkMode ? '#4CAF50' : '#4CAF50')
                        : (isDarkMode ? '#1a1a1a' : '#f5f5f5'),
                      marginBottom: 4,
                    }}
                    onPress={() => {
                      onChange(opt.value);
                      setShowModal(false);
                    }}
                  >
                    <Text style={{
                      color: value === opt.value ? '#fff' : textColor,
                      fontSize: 13,
                      textAlign: 'center'
                    }}>
                      {getIcon ? getIcon(opt.value) + ' ' : ''}
                      {getLabel ? getLabel(opt.value) : opt.label}
                    </Text>
                  </TouchableOpacity>
                ))}
                <TouchableOpacity
                  style={{
                    padding: 12,
                    borderRadius: 4,
                    backgroundColor: isDarkMode ? '#333' : '#ddd',
                    marginTop: 8,
                  }}
                  onPress={() => setShowModal(false)}
                >
                  <Text style={{ color: textColor, fontSize: 13, textAlign: 'center' }}>
                    Cancel
                  </Text>
                </TouchableOpacity>
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>
    </>
  );
}

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
function StatsPanel({ fps, ballCount, generation, checks, isDarkMode = false }) {
  const textColor = isDarkMode ? '#e0e0e0' : '#333';
  return (
    <View style={styles.statsContainer}>
      <View style={styles.statsRow}>
        <Text style={[styles.statLabel, { color: textColor }]}>FPS:</Text>
        <Text style={[styles.statValue, { color: textColor }]}>{fps}</Text>
        <Text style={[styles.statLabel, { color: textColor }]}>Balls:</Text>
        <Text style={[styles.statValue, { color: textColor }]}>{ballCount}</Text>
      </View>
      <View style={styles.statsRow}>
        <Text style={[styles.statLabel, { color: textColor }]}>Gen:</Text>
        <Text style={[styles.statValue, { color: textColor }]}>{generation}</Text>
        <Text style={[styles.statLabel, { color: textColor }]}>Checks:</Text>
        <Text style={[styles.statValue, { color: textColor }]}>{checks.toLocaleString()}</Text>
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
 * Synced with detailed controls using CrossUpdate
 */
function CompactToggles({
  // States
  drawMode,
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
  isDarkMode = false,
}) {
  const { width } = Dimensions.get('window');
  const useWideLayout = width > 400; // 3x2 if enough width
  const textColor = isDarkMode ? '#e0e0e0' : '#333';
  const bgColor = isDarkMode ? 'rgba(255, 255, 255, 0.06)' : 'rgba(0, 0, 0, 0.04)';

  // Toggle handlers use crossUpdate.notify for bi-directional sync

  // Stereo Toggle Handler - Platform-specific
  const handleStereoToggle = (enabled) => {
    crossUpdate.notify('toggle-stereo', enabled);
  };

  // Silver Toggle - Only notify on REAL user click, not on re-render
  const handleSilverToggle = (enabled) => {
    console.log('🎚️ handleSilverToggle called:');
    console.log('  enabled:', enabled);
    console.log('  current drawMode:', drawMode);

    // Check if this is a user action or just a re-render
    const currentlyOn = drawMode === 'SILVER';
    console.log('  currentlyOn:', currentlyOn);
    console.log('  enabled !== currentlyOn:', enabled !== currentlyOn);

    if (enabled !== currentlyOn) {
      console.log('  ✅ NOTIFYING crossUpdate');
      // Real change from user - notify WITHOUT value
      // Updater will read current drawMode state
      crossUpdate.notify('toggle-silver', enabled);
    } else {
      console.log('  ⏭️ SKIPPING notify (no real change)');
    }
  };

  // Gravity Toggle (ZERO ↔ DOWN) - Only notify on real user click
  const handleGravityToggle = (enabled) => {
    console.log('🌍 handleGravityToggle called:');
    console.log('  enabled:', enabled);
    console.log('  current gravityPreset:', gravityPreset);

    const currentlyOn = gravityPreset === 'DOWN';
    console.log('  currentlyOn:', currentlyOn);
    console.log('  enabled !== currentlyOn:', enabled !== currentlyOn);

    if (enabled !== currentlyOn) {
      console.log('  ✅ NOTIFYING crossUpdate');
      crossUpdate.notify('toggle-gravity', enabled);
    } else {
      console.log('  ⏭️ SKIPPING notify (no real change)');
    }
  };

  // Grid Toggle
  const handleGridToggle = (enabled) => {
    crossUpdate.notify('toggle-grid', enabled);
  };

  const toggles = [
    { icon: '✨', label: 'Silver', value: drawMode === 'SILVER', onChange: handleSilverToggle },
    { icon: '🌍', label: 'Gravity', value: gravityPreset === 'DOWN', onChange: handleGravityToggle },
    { icon: '🔲', label: 'Grid', value: gridEnabled, onChange: handleGridToggle },
    { icon: '🔍', label: 'Checks', value: showCollisionChecks, onChange: (val) => {
      crossUpdate.notify('toggle-checks', val);
    }},
    { icon: '📦', label: 'Voxels', value: showOccupiedVoxels, onChange: (val) => {
      crossUpdate.notify('toggle-voxels', val);
    }},
    { icon: '🕶️', label: 'Stereo', value: stereoMode !== 'off', onChange: handleStereoToggle },
  ];

  return (
    <View style={[styles.compactToggles, { backgroundColor: bgColor }]}>
      <View style={useWideLayout ? styles.toggleGrid3x2 : styles.toggleGrid2x3}>
        {toggles.map((toggle, index) => (
          <View key={index} style={styles.toggleItem}>
            <Text style={[styles.toggleLabel, { color: textColor }]}>{toggle.icon} {toggle.label}</Text>
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
function BallCountControls({ ballCount, setBallCount, sendToWebView, isDarkMode = false }) {
  const textColor = isDarkMode ? '#e0e0e0' : '#333';
  const bgColor = isDarkMode ? 'rgba(255, 255, 255, 0.06)' : 'rgba(0, 0, 0, 0.04)';

  const handleHalve = () => {
    // Halve ball count, round to nearest 5, minimum 5
    const newCount = Math.max(5, Math.round((ballCount / 2) / 5) * 5);
    setBallCount(newCount);
    sendToWebView('setBallCount', newCount);
    sendToWebView('new');
  };

  const handleDouble = () => {
    // Double ball count, round to nearest 5, maximum 10000
    const newCount = Math.min(10000, Math.round((ballCount * 2) / 5) * 5);
    setBallCount(newCount);
    sendToWebView('setBallCount', newCount);
    sendToWebView('new');
  };

  return (
    <View style={[styles.ballCountControls, { backgroundColor: bgColor }]}>
      <Text style={[styles.ballCountLabel, { color: textColor }]}>🎱 Balls: {ballCount}</Text>
      <View style={styles.ballCountButtons}>
        <TouchableOpacity style={styles.ballCountButton} onPress={handleHalve}>
          <Text style={styles.ballCountButtonText}>½</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.ballCountButton} onPress={handleDouble}>
          <Text style={styles.ballCountButtonText}>×2</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

/**
 * Turn Speed Slider
 */
function TurnSpeedSlider({ turnSpeed, setTurnSpeed, sendToWebView, isDarkMode = false }) {
  const textColor = isDarkMode ? '#e0e0e0' : '#333';

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
      <Text style={[styles.sliderLabel, { color: textColor }]}>🔄 Turn: {turnSpeed === 0 ? 'OFF' : `${turnSpeed}x`}</Text>
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
function CollapsibleSection({ title, defaultOpen = false, children, isDarkMode = false }) {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const textColor = isDarkMode ? '#e0e0e0' : '#333';
  const borderColor = isDarkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)';

  return (
    <View style={[styles.section, { borderTopColor: borderColor }]}>
      <TouchableOpacity
        style={styles.sectionHeader}
        onPress={() => setIsOpen(!isOpen)}
      >
        <Text style={[styles.sectionTitle, { color: textColor }]}>{isOpen ? '▼' : '▶'} {title}</Text>
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
  setBallCount,
  actualBallCount, // Tatsächliche Anzahl im Modell
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
  globalElasticity,
  setGlobalElasticity,

  // Rendering
  wireframeSegments,
  setWireframeSegments,

  // Dark Mode
  isDarkMode,
  setIsDarkMode,

  // Callbacks
  sendToWebView,
  onTogglePlayPause,
  onReset,

  // Platform info
  isPortrait,
}) {
  // Setup CrossUpdate synchronization for compact toggles ↔ detailed controls
  const syncInitialized = useRef(false);

  useEffect(() => {
    if (!syncInitialized.current) {
      syncInitialized.current = true;

      // Create updater function objects (like original crossupdate.js)
      // Since these are only used ONCE (unlike cross-update3.html where
      // comp_unit/comp_total are reused many times), we use simple objects
      // with closures to setDrawMode and sendToWebView

      // When Toggle changes → update Combo
      const comboFromToggleFunc = {
        doFunction: function(target, toggleValue) {
          console.log('🔄 comboFromToggle.doFunction called:');
          console.log('  target:', target);
          console.log('  toggleValue:', toggleValue);
          console.log('  current drawMode:', drawMode);

          // toggleValue is the NEW state from toggle (true/false)
          const newMode = toggleValue ? 'SILVER' : 'LIGHTED';
          console.log('  → setting drawMode to:', newMode);

          setDrawMode(newMode);
          sendToWebView('setDrawMode', newMode);
        }
      };

      // When Combo changes → update Toggle (passively)
      const toggleFromComboFunc = {
        doFunction: function(target, comboValue) {
          console.log('🔄 toggleFromCombo.doFunction called:');
          console.log('  target:', target);
          console.log('  comboValue:', comboValue);
          console.log('  current drawMode:', drawMode);
          console.log('  → doing nothing (Toggle reads state passively)');

          // Do nothing - Toggle reads drawMode via value={drawMode === 'SILVER'}
          // React will re-render automatically when drawMode changes
        }
      };

      // Gravity: When Toggle changes → update Combo
      const gravityComboFromToggleFunc = {
        doFunction: function(target, toggleValue) {
          console.log('🔄 gravityComboFromToggle.doFunction called:');
          console.log('  target:', target);
          console.log('  toggleValue:', toggleValue);
          console.log('  current gravityPreset:', gravityPreset);

          // toggleValue is the NEW state from toggle (true/false)
          const newPreset = toggleValue ? 'DOWN' : 'ZERO';
          console.log('  → setting gravityPreset to:', newPreset);

          setGravityPreset(newPreset);
          sendToWebView('setGravityPreset', { preset: newPreset, magnitude: gravityMagnitude });
        }
      };

      // Gravity: When Combo changes → update Toggle (passively)
      const gravityToggleFromComboFunc = {
        doFunction: function(target, comboValue) {
          console.log('🔄 gravityToggleFromCombo.doFunction called:');
          console.log('  target:', target);
          console.log('  comboValue:', comboValue);
          console.log('  current gravityPreset:', gravityPreset);
          console.log('  → doing nothing (Toggle reads state passively)');

          // Do nothing - Toggle reads gravityPreset via value={gravityPreset === 'DOWN'}
          // React will re-render automatically when gravityPreset changes
        }
      };

      // Generic updater for other controls
      const updateState = (controlId, value) => {
        switch (controlId) {
          // Note: 'detail-drawmode' and 'detail-gravity' are NOT here!
          // Combos set state DIRECTLY, not via updateState
          // Only notify CrossUpdate for Toggle to update

          case 'toggle-grid':
          case 'detail-grid':
            setGridEnabled(value);
            if (value) {
              sendToWebView('applyGrid', { segments: gridSegments });
            } else {
              sendToWebView('disableGrid');
            }
            break;

          case 'toggle-checks':
          case 'detail-checks':
            setShowCollisionChecks(value);
            sendToWebView('setShowCollisionChecks', value);
            break;

          case 'toggle-voxels':
          case 'detail-voxels':
            setShowOccupiedVoxels(value);
            sendToWebView('setShowOccupiedVoxels', value);
            break;

          case 'toggle-stereo':
          case 'detail-stereo':
            if (!value) {
              setStereoMode('off');
              sendToWebView('setStereoMode', 'off');
            } else {
              let mode;
              if (Platform.OS === 'web') {
                mode = 'topbottom';
              } else if (isPortrait) {
                mode = 'anaglyph';
              } else {
                mode = 'sidebyside';
              }
              setStereoMode(mode);
              sendToWebView('setStereoMode', mode);
            }
            break;
        }
      };

      const syncFunc = createSyncFunction(updateState);

      // STEP 2: Bidirectional CrossUpdate sync for drawMode
      // When toggle-silver changes → update detail-drawmode (Combo)
      crossUpdate.watch('detail-drawmode', 'toggle-silver', comboFromToggleFunc);
      // When detail-drawmode changes → update toggle-silver (Toggle)
      crossUpdate.watch('toggle-silver', 'detail-drawmode', toggleFromComboFunc);

      // Bidirectional CrossUpdate sync for gravity (same pattern as drawMode)
      // When toggle-gravity changes → update detail-gravity (Combo)
      crossUpdate.watch('detail-gravity', 'toggle-gravity', gravityComboFromToggleFunc);
      // When detail-gravity changes → update toggle-gravity (Toggle)
      crossUpdate.watch('toggle-gravity', 'detail-gravity', gravityToggleFromComboFunc);

      // Bi-directional sync: Compact Toggle ↔ Detail Control (other controls)

      crossUpdate.watch('toggle-grid', 'detail-grid', syncFunc);
      crossUpdate.watch('detail-grid', 'toggle-grid', syncFunc);

      crossUpdate.watch('toggle-checks', 'detail-checks', syncFunc);
      crossUpdate.watch('detail-checks', 'toggle-checks', syncFunc);

      crossUpdate.watch('toggle-voxels', 'detail-voxels', syncFunc);
      crossUpdate.watch('detail-voxels', 'toggle-voxels', syncFunc);

      crossUpdate.watch('toggle-stereo', 'detail-stereo', syncFunc);
      crossUpdate.watch('detail-stereo', 'toggle-stereo', syncFunc);
    }

    // Cleanup on unmount
    return () => {
      if (syncInitialized.current) {
        crossUpdate.clear();
        syncInitialized.current = false;
      }
    };
  }, [gravityMagnitude, gridSegments, isPortrait]); // Re-setup if these dependencies change

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

  // Dynamic styles based on dark mode
  const dynamicStyles = {
    menuContainer: {
      backgroundColor: isDarkMode ? 'rgba(30, 30, 30, 0.95)' : 'rgba(255, 255, 255, 0.95)',
    },
    text: {
      color: isDarkMode ? '#e0e0e0' : '#333',
    },
    sectionTitle: {
      color: isDarkMode ? '#e0e0e0' : '#333',
    },
    sectionBackground: {
      backgroundColor: isDarkMode ? 'rgba(255, 255, 255, 0.06)' : 'rgba(0, 0, 0, 0.04)',
    },
    divider: {
      backgroundColor: isDarkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
    },
    border: {
      borderTopColor: isDarkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
    },
    footerText: {
      color: isDarkMode ? '#999' : '#666',
    },
  };

  return (
    <View style={styles.overlay}>
      {/* Transparent background - tap to close */}
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={styles.overlayBackground} />
      </TouchableWithoutFeedback>

      {/* Menu content - scrollable, doesn't close on tap */}
      <SafeAreaView
        style={[
          styles.menuContainer,
          dynamicStyles.menuContainer,
          isWebStereo && styles.menuContainerWebStereo
        ]}
        edges={Platform.OS === 'web' ? [] : (isPortrait ? ['top', 'left'] : ['left', 'top'])}
      >
        <ScrollView contentContainerStyle={styles.menuContent}>
          {/* KOPF-BEREICH: Stats + Close Button */}
          <View style={styles.headerRow}>
            <View style={styles.statsWrapper}>
              <StatsPanel fps={fps} ballCount={actualBallCount} generation={generation} checks={checks} isDarkMode={isDarkMode} />
            </View>
            <TouchableOpacity style={styles.closeButton} onPress={onClose}>
              <Text style={styles.closeButtonText}>✖</Text>
            </TouchableOpacity>
          </View>

          {/* Main Controls: Play/Pause, Apply, Reset, Fullscreen */}
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
            {Platform.OS === 'web' && (
              <TooltipButton
                title="Fullscreen"
                style={styles.controlButton}
                onPress={() => {
                  // Request fullscreen on the document element
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
                    console.log('🖥️ Entering fullscreen');
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
                    console.log('🖥️ Exiting fullscreen');
                  }
                }}
              >
                <Text style={styles.buttonText}>⛶</Text>
              </TooltipButton>
            )}
          </View>

          <CompactToggles
            drawMode={drawMode}
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
            isDarkMode={isDarkMode}
          />

          <BallCountControls
            ballCount={actualBallCount}
            setBallCount={() => {}} // Set via ±50 buttons only
            sendToWebView={sendToWebView}
            isDarkMode={isDarkMode}
          />

          <TurnSpeedSlider
            turnSpeed={turnSpeed}
            setTurnSpeed={setTurnSpeed}
            sendToWebView={sendToWebView}
            isDarkMode={isDarkMode}
          />

          {/* KOLLABIERBARE SECTIONS */}

          <CollapsibleSection title="📦 Model" defaultOpen={false} isDarkMode={isDarkMode}>
            {/* Balls - Logarithmic Slider */}
            <View style={styles.sliderContainer}>
              <Text style={[styles.label, { color: dynamicStyles.text.color }]}>Number of Balls: {ballCount}</Text>
              <Slider
                style={styles.slider}
                minimumValue={Math.log(5)}      // log(5) ≈ 1.6
                maximumValue={Math.log(10000)}  // log(10000) ≈ 9.2
                step={0.01}                     // Small steps in log space for smooth control
                value={Math.log(ballCount)}     // Convert current value to log
                onValueChange={(logValue) => {
                  // Convert log value back to linear, round to nearest 5
                  const linearValue = Math.exp(logValue);
                  const roundedValue = Math.round(linearValue / 5) * 5;
                  const clampedValue = Math.max(5, Math.min(10000, roundedValue));
                  setBallCount(clampedValue);
                }}
                minimumTrackTintColor="#4CAF50"
                maximumTrackTintColor="#ddd"
              />
              <Text style={[styles.smallText, { color: dynamicStyles.footerText.color }]}>
                Logarithmic scale: 5 - 10,000 (fine control at low values)
              </Text>
            </View>

            <View style={styles.sliderContainer}>
              <Text style={[styles.label, { color: dynamicStyles.text.color }]}>Min Radius: {minRadius} cm</Text>
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
              <Text style={[styles.label, { color: dynamicStyles.text.color }]}>Max Radius: {maxRadius} cm</Text>
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
              <Text style={[styles.label, { color: dynamicStyles.text.color }]}>Max Velocity: {maxVelocity.toFixed(1)} m/s</Text>
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
              <Text style={[styles.label, { color: dynamicStyles.text.color }]}>Elasticity: {(elasticity / 100).toFixed(2)}</Text>
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

            <TouchableOpacity style={styles.applyButton} onPress={handleApply}>
              <Text style={styles.applyButtonText}>✨ Apply</Text>
            </TouchableOpacity>

            {/* Physics */}
            <View style={[styles.divider, dynamicStyles.divider]} />
            <Text style={styles.subsectionTitle}>Physics</Text>

            <View style={styles.toggleContainer}>
              <Text style={[styles.label, { color: dynamicStyles.text.color }]}>Collisions Enabled</Text>
              <Switch
                value={collisionsEnabled}
                onValueChange={(val) => {
                  setCollisionsEnabled(val);
                  sendToWebView('setCollisionsEnabled', val);
                }}
                trackColor={{ false: '#ddd', true: '#4CAF50' }}
              />
            </View>

            {/* Gravity - Full Picker (like Draw Mode) */}
            <View style={styles.pickerContainer}>
              <Text style={[styles.label, { color: dynamicStyles.text.color }]}>🌍 Gravity Direction</Text>
              <DropdownPicker
                value={gravityPreset}
                options={[
                  { value: 'ZERO', label: '🚫 Zero' },
                  { value: 'DOWN', label: '⬇️ Down' },
                  { value: 'UP', label: '⬆️ Up' },
                  { value: 'LEFT', label: '⬅️ Left' },
                  { value: 'RIGHT', label: '➡️ Right' },
                  { value: 'FRONT', label: '🔽 Front' },
                  { value: 'REAR', label: '🔼 Rear' }
                ]}
                onChange={(preset) => {
                  console.log('📝 Gravity Picker onChange:', preset);
                  setGravityPreset(preset);
                  sendToWebView('setGravityPreset', { preset, magnitude: gravityMagnitude });
                  crossUpdate.notify('detail-gravity', preset);
                }}
                isDarkMode={isDarkMode}
              />
            </View>

            {/* Gravity Magnitude Slider */}
            <View style={styles.sliderContainer}>
              <Text style={[styles.label, { color: dynamicStyles.text.color }]}>Gravity Magnitude: {gravityMagnitude.toFixed(2)} m/s²</Text>
              <Slider
                style={styles.slider}
                minimumValue={0}
                maximumValue={20}
                step={0.1}
                value={gravityMagnitude}
                onValueChange={(val) => {
                  setGravityMagnitude(val);
                  sendToWebView('setGravityPreset', { preset: gravityPreset, magnitude: val });
                }}
                minimumTrackTintColor="#4CAF50"
                maximumTrackTintColor="#ddd"
              />
            </View>

            {/* Global Elasticity Slider */}
            <View style={styles.sliderContainer}>
              <Text style={[styles.label, { color: dynamicStyles.text.color }]}>Global Elasticity: {(globalElasticity / 100).toFixed(2)}</Text>
              <Slider
                style={styles.slider}
                minimumValue={0}
                maximumValue={100}
                step={5}
                value={globalElasticity}
                onValueChange={(val) => {
                  setGlobalElasticity(val);
                  sendToWebView('setGlobalElasticity', val / 100);
                }}
                minimumTrackTintColor="#4CAF50"
                maximumTrackTintColor="#ddd"
              />
            </View>
          </CollapsibleSection>

          <CollapsibleSection title="👁️ View" defaultOpen={false} isDarkMode={isDarkMode}>
            {/* Rendering */}
            <Text style={styles.subsectionTitle}>Rendering</Text>

            {/* Dark Mode Toggle */}
            <View style={styles.toggleContainer}>
              <Text style={[styles.label, { color: dynamicStyles.text.color }]}>🌓 Dark Mode (UI)</Text>
              <Switch
                value={isDarkMode}
                onValueChange={(val) => {
                  setIsDarkMode(val);
                  sendToWebView('setDarkMode', val);
                }}
                trackColor={{ false: '#ddd', true: '#4CAF50' }}
              />
            </View>

            {/* Draw Mode - Full Picker */}
            <View style={styles.pickerContainer}>
              <Text style={[styles.label, { color: dynamicStyles.text.color }]}>🎨 Draw Mode</Text>
              <DropdownPicker
                value={drawMode}
                options={[
                  { value: 'LIGHTED', label: 'Lighted' },
                  { value: 'WIREFRAME', label: 'Wireframe' },
                  { value: 'POINTS', label: 'Points' },
                  { value: 'SILVER', label: 'Silver' },
                ]}
                onChange={(newMode) => {
                  console.log('📝 Draw Mode Picker onChange:', newMode);
                  setDrawMode(newMode);
                  sendToWebView('setDrawMode', newMode);
                  crossUpdate.notify('detail-drawmode', newMode);
                }}
                getIcon={(mode) =>
                  mode === 'LIGHTED' ? '💡' :
                  mode === 'WIREFRAME' ? '🕸️' :
                  mode === 'POINTS' ? '⚫' : '✨'
                }
                getLabel={(mode) => mode.charAt(0) + mode.slice(1).toLowerCase()}
                isDarkMode={isDarkMode}
              />
            </View>

            <View style={styles.sliderContainer}>
              <Text style={[styles.label, { color: dynamicStyles.text.color }]}>Wireframe Segments: {wireframeSegments}</Text>
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
            <View style={[styles.divider, dynamicStyles.divider]} />
            <Text style={styles.subsectionTitle}>3D Stereo</Text>

            {/* Stereo - Synced with Quick Toggle */}
            <View style={styles.toggleContainer}>
              <Text style={[styles.label, { color: dynamicStyles.text.color }]}>🕶️ Stereo Mode</Text>
              <Switch
                value={stereoMode !== 'off'}
                onValueChange={(val) => crossUpdate.notify('detail-stereo', val)}
                trackColor={{ false: '#ccc', true: '#4CAF50' }}
                thumbColor={stereoMode !== 'off' ? '#fff' : '#f4f3f4'}
              />
            </View>

            {stereoMode !== 'off' && (
              <>
                <View style={styles.sliderContainer}>
                  <Text style={[styles.label, { color: dynamicStyles.text.color }]}>Eye Separation: {eyeSeparation.toFixed(1)} cm</Text>
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
                  <Text style={[styles.label, { color: dynamicStyles.text.color }]}>Cube Depth: {cubeDepth.toFixed(1)} m</Text>
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

          <CollapsibleSection title="⚙️ Simulation & System" defaultOpen={false} isDarkMode={isDarkMode}>
            {/* Simulation */}
            <Text style={styles.subsectionTitle}>Simulation</Text>

            <View style={styles.sliderContainer}>
              <Text style={[styles.label, { color: dynamicStyles.text.color }]}>Calc Factor: {calcFactor}</Text>
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

            {/* Collision Checks - Synced with Quick Toggle */}
            <View style={styles.toggleContainer}>
              <Text style={[styles.label, { color: dynamicStyles.text.color }]}>🔍 Show Collision Checks</Text>
              <Switch
                value={showCollisionChecks}
                onValueChange={(val) => crossUpdate.notify('detail-checks', val)}
                trackColor={{ false: '#ddd', true: '#4CAF50' }}
                thumbColor={showCollisionChecks ? '#fff' : '#f4f3f4'}
              />
            </View>

            {/* Grid System */}
            <View style={[styles.divider, dynamicStyles.divider]} />
            <Text style={styles.subsectionTitle}>Grid System</Text>

            {/* Grid-based Collision - Synced with Quick Toggle */}
            <View style={styles.toggleContainer}>
              <Text style={[styles.label, { color: dynamicStyles.text.color }]}>🔲 Grid-based Collision</Text>
              <Switch
                value={gridEnabled}
                onValueChange={(val) => crossUpdate.notify('detail-grid', val)}
                trackColor={{ false: '#ddd', true: '#4CAF50' }}
                thumbColor={gridEnabled ? '#fff' : '#f4f3f4'}
              />
            </View>

            {gridEnabled && (
              <>
                <View style={styles.sliderContainer}>
                  <Text style={[styles.label, { color: dynamicStyles.text.color }]}>Grid Segments: {gridSegments}</Text>
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
                  <Text style={[styles.label, { color: dynamicStyles.text.color }]}>Show World Grid</Text>
                  <Switch
                    value={showWorldGrid}
                    onValueChange={(val) => {
                      setShowWorldGrid(val);
                      sendToWebView('setShowWorldGrid', val);
                    }}
                    trackColor={{ false: '#ddd', true: '#4CAF50' }}
                  />
                </View>

                {/* Show Occupied Voxels - Synced with Quick Toggle */}
                <View style={styles.toggleContainer}>
                  <Text style={[styles.label, { color: dynamicStyles.text.color }]}>📦 Show Occupied Voxels</Text>
                  <Switch
                    value={showOccupiedVoxels}
                    onValueChange={(val) => crossUpdate.notify('detail-voxels', val)}
                    trackColor={{ false: '#ddd', true: '#4CAF50' }}
                    thumbColor={showOccupiedVoxels ? '#fff' : '#f4f3f4'}
                  />
                </View>
              </>
            )}
          </CollapsibleSection>

          {/* Footer */}
          {Platform.OS === 'web' && (
            <View style={[styles.footer, dynamicStyles.border]}>
              <Text style={[styles.footerText, { color: dynamicStyles.footerText.color }]}>[F1] for help • [M] or [F10] for menu</Text>
            </View>
          )}
        </ScrollView>
      </SafeAreaView>
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
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'transparent',
  },
  menuContainer: {
    width: Platform.OS === 'web' ? 280 : '70%',
    maxWidth: 350,
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
    paddingBottom: Platform.OS === 'web' ? 12 : 40, // Extra space on mobile to avoid system icons
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
    alignItems: 'center',
    marginBottom: 1, // Kompakter: 2 → 1
  },
  statLabel: {
    color: '#333', // Light mode
    fontSize: 12,
    width: 50, // Feste Breite für Labels (schmaler)
    textAlign: 'right',
    marginRight: 4,
  },
  statValue: {
    color: '#333', // Light mode
    fontSize: 12,
    flex: 1, // Nimmt restlichen Platz für große Zahlen
    textAlign: 'left',
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
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },

  // Picker Container
  pickerContainer: {
    marginBottom: 8, // Kompakter: 12 → 8
  },
  pickerButtons: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 4,
  },
  pickerButton: {
    flex: 1,
    minWidth: '45%',
    backgroundColor: '#f0f0f0',
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#ddd',
  },
  pickerButtonActive: {
    backgroundColor: '#4CAF50',
    borderColor: '#4CAF50',
  },
  pickerButtonActiveDark: {
    backgroundColor: '#388E3C',
    borderColor: '#388E3C',
  },
  pickerButtonText: {
    color: '#666',
    fontSize: 12,
    fontWeight: '500',
    textAlign: 'center',
  },
  pickerButtonTextActive: {
    color: '#fff',
    fontWeight: '700',
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


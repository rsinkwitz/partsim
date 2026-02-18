/**
 * Mobile UI Components for PaDIPS
 * Supports Portrait, Landscape, and VR Cardboard modes
 */

import React from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet, Dimensions } from 'react-native';
import Slider from '@react-native-community/slider';

/**
 * Stats Component (2x2 Grid)
 */
export function StatsPanel({ fps, ballCount, generation, checks }) {
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
 * Main Control Buttons (Start/Stop/New/Reset)
 */
export function MainControls({ onStart, onStop, onNew, onReset, isRunning }) {
  return (
    <View style={styles.mainControls}>
      <TouchableOpacity
        style={[styles.controlButton, styles.startButton, isRunning && styles.buttonDisabled]}
        onPress={onStart}
        disabled={isRunning}
      >
        <Text style={styles.buttonText}>▶</Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={[styles.controlButton, styles.stopButton, !isRunning && styles.buttonDisabled]}
        onPress={onStop}
        disabled={!isRunning}
      >
        <Text style={styles.buttonText}>⏸</Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={[styles.controlButton, styles.newButton]}
        onPress={onNew}
      >
        <Text style={styles.buttonText}>✨ New</Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={[styles.controlButton, styles.resetButton]}
        onPress={onReset}
      >
        <Text style={styles.buttonText}>🔄</Text>
      </TouchableOpacity>
    </View>
  );
}

/**
 * VR Tap Indicators (fade after 3s)
 */
export function VRIndicators({ visible, onLeftTap, onRightTap }) {
  if (!visible) return null;

  return (
    <>
      {/* Left indicator */}
      <TouchableOpacity
        style={[styles.vrIndicator, styles.vrIndicatorLeft]}
        onPress={onLeftTap}
      >
        <Text style={styles.vrIndicatorText}>👆 Tap for menu</Text>
      </TouchableOpacity>

      {/* Right indicator */}
      <TouchableOpacity
        style={[styles.vrIndicator, styles.vrIndicatorRight]}
        onPress={onRightTap}
      >
        <Text style={styles.vrIndicatorText}>👆 Tap for menu</Text>
      </TouchableOpacity>
    </>
  );
}

/**
 * VR Menu Overlay (semi-transparent, left half only)
 */
export function VRMenuOverlay({ visible, onClose, onExitVR, children }) {
  if (!visible) return null;

  return (
    <View style={styles.vrMenuContainer}>
      <View style={styles.vrMenu}>
        <ScrollView contentContainerStyle={styles.vrMenuContent}>
          {children}

          {/* Close and Exit VR buttons side-by-side */}
          <View style={styles.vrMenuButtonRow}>
            <TouchableOpacity
              style={[styles.controlButton, styles.closeButton, styles.vrMenuButton]}
              onPress={onClose}
            >
              <Text style={styles.buttonText}>✖ Close</Text>
            </TouchableOpacity>

            {onExitVR && (
              <TouchableOpacity
                style={[styles.controlButton, styles.exitVRButton, styles.vrMenuButton]}
                onPress={onExitVR}
              >
                <Text style={styles.buttonText}>🔙 Exit VR</Text>
              </TouchableOpacity>
            )}
          </View>
        </ScrollView>
      </View>
      {/* Right side - tap to close */}
      <TouchableOpacity
        style={styles.vrMenuRightEmpty}
        onPress={onClose}
        activeOpacity={1}
      >
        {/* Transparent but tappable */}
      </TouchableOpacity>
    </View>
  );
}

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

const styles = StyleSheet.create({
  // Stats
  statsContainer: {
    padding: 8,
    backgroundColor: '#f5f5f5',
    borderBottomWidth: 1,
    borderBottomColor: '#ddd',
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 2,
  },
  statText: {
    fontSize: 12,
    color: '#666',
    flex: 1,
  },

  // Main Controls
  mainControls: {
    flexDirection: 'row',
    justifyContent: 'center',
    padding: 8,
    backgroundColor: '#f5f5f5',
    borderBottomWidth: 1,
    borderBottomColor: '#ddd',
  },
  controlButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 6,
    marginHorizontal: 4,
    minWidth: 50, // Reduced for icon-only buttons
  },
  startButton: {
    backgroundColor: '#4CAF50',
  },
  stopButton: {
    backgroundColor: '#f44336',
  },
  newButton: {
    backgroundColor: '#2196F3',
    minWidth: 80, // Wider for text label
  },
  resetButton: {
    backgroundColor: '#FF9800',
    minWidth: 50, // Icon only
  },
  closeButton: {
    backgroundColor: '#FF9800',
    marginTop: 12,
  },
  exitVRButton: {
    backgroundColor: '#9C27B0',
    marginTop: 8,
  },
  buttonDisabled: {
    backgroundColor: '#ccc',
    opacity: 0.6,
  },
  buttonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: 'bold',
    textAlign: 'center',
  },

  // VR Indicators
  vrIndicator: {
    position: 'absolute',
    bottom: 20,
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    borderRadius: 8,
  },
  vrIndicatorLeft: {
    left: 20,
  },
  vrIndicatorRight: {
    right: 20,
  },
  vrIndicatorText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
  },

  // VR Menu Overlay
  vrMenuContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: 'row',
    zIndex: 9999,
  },
  vrMenu: {
    width: '50%', // Max 50% width (left half only)
    maxWidth: '50%',
    backgroundColor: 'rgba(0, 0, 0, 0.85)',
    paddingLeft: 60, // Space for notch on left in landscape
    paddingRight: 16,
  },
  vrMenuContent: {
    paddingTop: 24, // Slightly more top padding
    paddingBottom: 16,
    paddingHorizontal: 8,
  },
  vrMenuRightEmpty: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  vrMenuButtonRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 12,
    gap: 8,
  },
  vrMenuButton: {
    flex: 1,
  },
});


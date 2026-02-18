/**
 * Full Controls Panel for PaDIPS Mobile
 */

import React from 'react';
import { View, Text, TouchableOpacity, ScrollView, Switch, StyleSheet } from 'react-native';
import Slider from '@react-native-community/slider';

export default function ControlsPanel({
  // Ball parameters
  ballCount,
  setBallCount,
  minRadius,
  setMinRadius,
  maxRadius,
  setMaxRadius,

  // Physics
  gravityPreset,
  setGravityPreset,
  gravityMagnitude,
  collisionsEnabled,
  setCollisionsEnabled,

  // Simulation
  calcFactor,
  setCalcFactor,

  // Grid
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

  // Rendering
  drawMode,
  setDrawMode,
  wireframeSegments,
  setWireframeSegments,
  stereoMode,
  setStereoMode,
  eyeSeparation,
  setEyeSeparation,
  cubeDepth,
  setCubeDepth,

  // Callbacks
  sendToWebView,

  // Flags
  isPortrait = true,
  showStereoOptions = true, // Hide top/bottom in portrait, side-by-side only in landscape
}) {
  return (
    <ScrollView style={styles.scrollView} contentContainerStyle={styles.content}>
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
      </View>

      {/* Physics Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>⚙️ Physics</Text>

        <View style={styles.toggleContainer}>
          <Text style={styles.label}>Collisions Enabled</Text>
          <Switch
            value={collisionsEnabled}
            onValueChange={(val) => {
              setCollisionsEnabled(val);
              sendToWebView('setCollisionsEnabled', val);
            }}
          />
        </View>

        <View style={styles.pickerContainer}>
          <Text style={styles.label}>Gravity</Text>
          <View style={styles.radioGroup}>
            {['ZERO', 'DOWN'].map(preset => (
              <TouchableOpacity
                key={preset}
                style={styles.radioOption}
                onPress={() => {
                  setGravityPreset(preset);
                  sendToWebView('setGravityPreset', { preset, magnitude: gravityMagnitude });
                }}
              >
                <View style={[styles.radioCircle, gravityPreset === preset && styles.radioCircleSelected]}>
                  {gravityPreset === preset && <View style={styles.radioCircleInner} />}
                </View>
                <Text style={styles.radioLabel}>{preset === 'ZERO' ? 'Zero' : 'Down'}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </View>

      {/* Simulation Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>🔬 Simulation</Text>

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
            minimumTrackTintColor="#4CAF50"
            maximumTrackTintColor="#ddd"
          />
        </View>

        <View style={styles.toggleContainer}>
          <Text style={styles.label}>Show Collision Checks</Text>
          <Switch
            value={showCollisionChecks}
            onValueChange={(val) => {
              setShowCollisionChecks(val);
              sendToWebView('setShowCollisionChecks', val);
            }}
          />
        </View>
      </View>

      {/* Grid Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>🔲 Grid System</Text>

        <View style={styles.toggleContainer}>
          <Text style={styles.label}>Fast Grid Collision</Text>
          <Switch
            value={gridEnabled}
            onValueChange={(val) => {
              setGridEnabled(val);
              if (val) {
                // Enable: Apply grid with current segments
                sendToWebView('applyGrid', { segments: gridSegments });
              } else {
                // Disable: Turn off grid
                sendToWebView('disableGrid');
              }
            }}
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
                onValueChange={(val) => {
                  setGridSegments(val);
                  sendToWebView('setGridSegments', val);
                }}
                minimumTrackTintColor="#4CAF50"
                maximumTrackTintColor="#ddd"
              />
            </View>

            <View style={styles.toggleContainer}>
              <Text style={styles.smallLabel}>Show World Grid</Text>
              <Switch
                value={showWorldGrid}
                onValueChange={(val) => {
                  setShowWorldGrid(val);
                  sendToWebView('setShowWorldGrid', val);
                }}
              />
            </View>

            <View style={styles.toggleContainer}>
              <Text style={styles.smallLabel}>Show Occupied Voxels</Text>
              <Switch
                value={showOccupiedVoxels}
                onValueChange={(val) => {
                  setShowOccupiedVoxels(val);
                  sendToWebView('setShowOccupiedVoxels', val);
                }}
              />
            </View>
          </>
        )}
      </View>

      {/* Rendering Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>🎨 Rendering</Text>

        <View style={styles.pickerContainer}>
          <Text style={styles.label}>Draw Mode</Text>
          <View style={styles.radioGroup}>
            {['LIGHTED', 'WIREFRAME', 'POINTS', 'SILVER'].map(mode => (
              <TouchableOpacity
                key={mode}
                style={styles.radioOption}
                onPress={() => {
                  setDrawMode(mode);
                  sendToWebView('setDrawMode', mode);
                }}
              >
                <View style={[styles.radioCircle, drawMode === mode && styles.radioCircleSelected]}>
                  {drawMode === mode && <View style={styles.radioCircleInner} />}
                </View>
                <Text style={styles.radioLabel}>{mode.charAt(0) + mode.slice(1).toLowerCase()}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {drawMode === 'WIREFRAME' && (
          <View style={styles.sliderContainer}>
            <Text style={styles.smallLabel}>Wireframe Segments: {wireframeSegments}</Text>
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
              minimumTrackTintColor="#4CAF50"
              maximumTrackTintColor="#ddd"
            />
          </View>
        )}
      </View>

      {/* 3D Stereo Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>🕶️ 3D Stereo</Text>

        <View style={styles.pickerContainer}>
          <Text style={styles.label}>Stereo Mode</Text>
          <View style={styles.radioGroup}>
            <TouchableOpacity
              style={styles.radioOption}
              onPress={() => {
                setStereoMode('off');
                sendToWebView('setStereoMode', 'off');
              }}
            >
              <View style={[styles.radioCircle, stereoMode === 'off' && styles.radioCircleSelected]}>
                {stereoMode === 'off' && <View style={styles.radioCircleInner} />}
              </View>
              <Text style={styles.radioLabel}>Off</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.radioOption}
              onPress={() => {
                setStereoMode('anaglyph');
                sendToWebView('setStereoMode', 'anaglyph');
              }}
            >
              <View style={[styles.radioCircle, stereoMode === 'anaglyph' && styles.radioCircleSelected]}>
                {stereoMode === 'anaglyph' && <View style={styles.radioCircleInner} />}
              </View>
              <Text style={styles.radioLabel}>Anaglyph</Text>
            </TouchableOpacity>

            {/* Side-by-Side only in landscape (activates VR mode) */}
            {!isPortrait && (
              <TouchableOpacity
                style={styles.radioOption}
                onPress={() => {
                  setStereoMode('sidebyside');
                  sendToWebView('setStereoMode', 'sidebyside');
                }}
              >
                <View style={[styles.radioCircle, stereoMode === 'sidebyside' && styles.radioCircleSelected]}>
                  {stereoMode === 'sidebyside' && <View style={styles.radioCircleInner} />}
                </View>
                <Text style={styles.radioLabel}>Side-by-Side (VR)</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>

        {stereoMode !== 'off' && (
          <>
            <View style={styles.sliderContainer}>
              <Text style={styles.label}>Eye Separation: {eyeSeparation.toFixed(1)} cm</Text>
              <Slider
                style={styles.slider}
                minimumValue={4}
                maximumValue={12}
                step={0.1}
                value={eyeSeparation}
                onValueChange={(val) => {
                  setEyeSeparation(val);
                  sendToWebView('setEyeSeparation', val / 100); // Convert to meters
                }}
                minimumTrackTintColor="#4CAF50"
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
                minimumTrackTintColor="#4CAF50"
                maximumTrackTintColor="#ddd"
              />
            </View>
          </>
        )}
      </View>

      {/* Keyboard Shortcuts Info */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>⌨️ Shortcuts</Text>
        <Text style={styles.smallText}>Desktop only - Press [F1] for full help</Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scrollView: {
    flex: 1,
    backgroundColor: '#fff',
  },
  content: {
    padding: 12,
  },
  section: {
    marginBottom: 12,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#555',
    marginBottom: 4,
  },
  label: {
    fontSize: 12,
    color: '#666',
    marginBottom: 2,
  },
  smallLabel: {
    fontSize: 11,
    color: '#666',
  },
  smallText: {
    fontSize: 11,
    color: '#999',
    fontStyle: 'italic',
    marginTop: 2,
  },
  sliderContainer: {
    marginTop: 4,
    marginBottom: 4,
  },
  slider: {
    width: '100%',
    height: 40,
  },
  toggleContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
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
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  radioCircle: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#666',
    marginRight: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  radioCircleSelected: {
    borderColor: '#4CAF50',
  },
  radioCircleInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#4CAF50',
  },
  radioLabel: {
    fontSize: 13,
    color: '#666',
  },
});


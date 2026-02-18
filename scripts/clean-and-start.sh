#!/bin/bash

# Clean and Start Script
# Clears all caches and restarts Expo

echo "🧹 Cleaning all caches..."

# Stop running Expo processes
pkill -f "expo start" || true
pkill -f "react-native start" || true

# Clean npm cache
echo "  - Cleaning node_modules/.cache..."
rm -rf node_modules/.cache

# Clean Expo cache
echo "  - Cleaning .expo cache..."
rm -rf .expo

# Clean Metro cache
echo "  - Cleaning Metro cache..."
rm -rf /tmp/metro-* || true
rm -rf /tmp/haste-map-* || true

# Clean React Native cache
echo "  - Cleaning React Native cache..."
rm -rf $TMPDIR/react-* || true

echo "✅ Cache cleared!"
echo ""
echo "🔨 Building WebApp with cache-busting..."
bash scripts/build-and-deploy.sh

echo ""
echo "🚀 Starting Expo with clear cache..."
echo "   Note: If you still see 'OLD code', please:"
echo "   1. Close the app completely on your device"
echo "   2. Reopen the app"
echo "   3. The new version should load"
echo ""
npx expo start -c



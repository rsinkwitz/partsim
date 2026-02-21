#!/bin/bash
set -e

echo "🚀 Starting build and deploy..."

# Navigate to script directory, then to padips-web
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$SCRIPT_DIR/../padips-web"

echo "🔨 Building with webpack..."
npm run build

if [ -f "dist/renderer.bundle.js" ]; then
  echo "✅ Build successful!"

  # Copy bundle to parent assets
  mkdir -p ../assets/webapp
  cp dist/renderer.bundle.js ../assets/webapp/renderer.bundle.js
  echo "✓ Copied renderer.bundle.js to assets/webapp/"

  # Copy HTML to assets
  cp dist/index.html ../assets/webapp/index.html
  echo "✓ Copied index.html to assets/webapp/"

  # Copy bundle as .txt for Metro bundler (mobile) with CACHE BUSTING
  # Use Python script to add timestamp comment reliably
  python3 ../scripts/cache-bust.py ../assets/webapp/renderer.bundle.js ../assets/webapp/renderer.bundle.js.txt

  # Copy to public for Expo Web (single HTML file as cube.html)
  mkdir -p ../public
  cp dist/index.html ../public/cube.html
  cp dist/renderer.bundle.js ../public/renderer.bundle.js
  echo "✓ Copied to public/ (as cube.html for Expo Web)"

  # Copy textures if they exist
  if [ -d "dist/textures" ]; then
    cp -r dist/textures ../public/
    echo "✓ Copied textures to public/"
  fi

  echo "🎉 Deployment complete!"
  echo "📂 public/ contains: cube.html + renderer.bundle.js"
else
  echo "❌ ERROR: Bundle file not created!"
  exit 1
fi

#!/usr/bin/env node

/**
 * Build-Script für WebView-kompatibles Bundle
 * 1. Führt Webpack-Build in padips-web aus
 * 2. Kopiert das Ergebnis nach assets/webapp/
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('🔨 Building WebView-compatible bundle...\n');

// 1. Build in padips-web
console.log('Step 1: Running webpack build in padips-web/');
try {
  execSync('cd padips-web && npm run build:webview', {
    stdio: 'inherit',
    cwd: path.join(__dirname, '..')
  });
  console.log('✓ Webpack build completed\n');
} catch (error) {
  console.error('❌ Webpack build failed');
  process.exit(1);
}

// 2. Kopiere von padips-web/dist nach assets/webapp
console.log('Step 2: Copying files to assets/webapp/');
const sourceDir = path.join(__dirname, '../padips-web/dist');
const targetDir = path.join(__dirname, '../assets/webapp');

// Erstelle Zielverzeichnis falls nicht vorhanden
if (!fs.existsSync(targetDir)) {
  fs.mkdirSync(targetDir, { recursive: true });
}

// Kopiere index.html
fs.copyFileSync(
  path.join(sourceDir, 'index.html'),
  path.join(targetDir, 'index.html')
);
console.log('  ✓ Copied: index.html');

// Kopiere renderer.bundle.js
fs.copyFileSync(
  path.join(sourceDir, 'renderer.bundle.js'),
  path.join(targetDir, 'renderer.bundle.js')
);
console.log('  ✓ Copied: renderer.bundle.js');

// Kopiere textures-Ordner
const texturesSource = path.join(sourceDir, 'textures');
const texturesTarget = path.join(targetDir, 'textures');

if (fs.existsSync(texturesSource)) {
  // Erstelle textures-Ordner
  if (!fs.existsSync(texturesTarget)) {
    fs.mkdirSync(texturesTarget, { recursive: true });
  }

  // Kopiere alle Dateien
  const textureFiles = fs.readdirSync(texturesSource);
  textureFiles.forEach(file => {
    fs.copyFileSync(
      path.join(texturesSource, file),
      path.join(texturesTarget, file)
    );
  });
  console.log(`  ✓ Copied: ${textureFiles.length} texture file(s)`);
}

console.log('\n✅ Build completed successfully!');
console.log('\nFiles ready in assets/webapp/');
console.log('  - index.html');
console.log('  - renderer.bundle.js');
console.log('  - textures/');


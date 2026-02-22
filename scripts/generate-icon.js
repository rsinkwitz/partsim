#!/usr/bin/env node
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log("📱 Icon Generator - Creating all required sizes");

const sourceSvg = path.join(__dirname, 'assets/icon-source.svg');
const rsvgCmd = 'rsvg-convert';

// Check if rsvg-convert is available
try {
  execSync(`which ${rsvgCmd}`, { stdio: 'ignore' });
  console.log("✅ Using rsvg-convert for high-quality SVG rendering");
} catch (error) {
  console.error("❌ rsvg-convert not found. Install with: brew install librsvg");
  process.exit(1);
}

if (!fs.existsSync(sourceSvg)) {
  console.error("❌ Source SVG not found:", sourceSvg);
  process.exit(1);
}

console.log("📄 Source:", sourceSvg);
console.log("");

// Android Mipmap sizes
const androidSizes = [
  { dir: 'mipmap-mdpi', size: 48 },
  { dir: 'mipmap-hdpi', size: 72 },
  { dir: 'mipmap-xhdpi', size: 96 },
  { dir: 'mipmap-xxhdpi', size: 144 },
  { dir: 'mipmap-xxxhdpi', size: 192 }
];

// Expo/React Native sizes
const expoSizes = [
  { name: 'icon.png', size: 1024 },
  { name: 'adaptive-icon.png', size: 1024 },
  { name: 'favicon.png', size: 48 }
];

// Clean up old WebP files to avoid duplicates
console.log("🧹 Cleaning up old WebP files...");
androidSizes.forEach(({ dir }) => {
  const targetDir = path.join(__dirname, 'android/app/src/main/res', dir);
  if (fs.existsSync(targetDir)) {
    ['ic_launcher.webp', 'ic_launcher_round.webp', 'ic_launcher_foreground.webp'].forEach(file => {
      const filePath = path.join(targetDir, file);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
        console.log(`  ✓ Removed: ${dir}/${file}`);
      }
    });
  }
});
console.log("");

console.log("🤖 Generating Android Mipmaps...");
androidSizes.forEach(({ dir, size }) => {
  const targetDir = path.join(__dirname, 'android/app/src/main/res', dir);
  if (!fs.existsSync(targetDir)) {
    fs.mkdirSync(targetDir, { recursive: true });
  }

  const targetFile = path.join(targetDir, 'ic_launcher.png');
  const targetRound = path.join(targetDir, 'ic_launcher_round.png');

  try {
    // rsvg-convert produces much better quality than ImageMagick for SVG
    execSync(`${rsvgCmd} -w ${size} -h ${size} "${sourceSvg}" -o "${targetFile}"`, { stdio: 'inherit' });
    execSync(`${rsvgCmd} -w ${size} -h ${size} "${sourceSvg}" -o "${targetRound}"`, { stdio: 'inherit' });
    console.log(`  ✓ ${dir}: ${size}x${size}`);
  } catch (error) {
    console.error(`  ❌ Failed to generate ${dir}`);
  }
});

console.log("");
console.log("📱 Generating Expo/React Native icons...");
expoSizes.forEach(({ name, size }) => {
  const targetFile = path.join(__dirname, 'assets', name);

  try {
    execSync(`${rsvgCmd} -w ${size} -h ${size} "${sourceSvg}" -o "${targetFile}"`, { stdio: 'inherit' });
    console.log(`  ✓ ${name}: ${size}x${size}`);
  } catch (error) {
    console.error(`  ❌ Failed to generate ${name}`);
  }
});

console.log("");
console.log("✅ All icons generated successfully!");
console.log("");
console.log("📋 Next steps:");
console.log("  1. Run: npm run bundle");
console.log("  2. Run: npm run android  (or npm run ios)");
console.log("");

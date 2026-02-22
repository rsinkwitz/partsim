# Installation Instructions
## 📱 Android APK Installation
### Method 1: Direct Install (Recommended)
1. **Build the APK:**
   ```bash
   npm run bundle
   cd android && ./gradlew assembleRelease
   ```
2. **Locate the APK:**
   ```
   android/app/build/outputs/apk/release/padips-release.apk
   ```
3. **Transfer to device:**
   - USB: Copy to device's Downloads folder
   - Cloud: Upload to Google Drive / Dropbox
   - ADB: `adb install android/app/build/outputs/apk/release/padips-release.apk`
4. **Install on device:**
   - Enable "Unknown Sources" in Settings → Security
   - Open file manager → Downloads
   - Tap `padips-release.apk`
   - Follow installation prompts
### Method 2: Development Install
```bash
# Connect device via USB (enable USB debugging)
npm run android
```
---
## 🍎 iOS Installation
### Development:
```bash
cd ios && pod install && cd ..
npm run ios
```
### TestFlight / App Store:
Requires Apple Developer Account (not covered here)
---
## 🌐 Web Deployment
### Local:
```bash
npm run web
# → http://localhost:8081
```
### Production:
```bash
npm run build
# Deploy public/ folder to:
# - Netlify, Vercel, GitHub Pages, etc.
```
---
## 🔧 Troubleshooting
### Android Icon not showing after install
**Solution:** Uninstall old version first
```bash
# Via ADB
adb uninstall com.rsinkwitz.padips
# Then reinstall
adb install android/app/build/outputs/apk/release/padips-release.apk
```
### Build fails with "duplicate resources"
**Solution:** Clean build cache
```bash
cd android
./gradlew clean
rm -rf app/build/intermediates
cd ..
npm run bundle
cd android && ./gradlew assembleRelease
```
### Icons look wrong
**Solution:** Regenerate icons
```bash
node generate-icon.js
npm run bundle
cd android && ./gradlew assembleRelease
```
---
## 📋 System Requirements
### Development:
- **Node.js**: 18+
- **npm**: 9+
- **librsvg**: For icon generation (`brew install librsvg`)
### Android:
- **Android Studio**: Latest
- **Android SDK**: API 24+ (Android 7.0+)
- **NDK**: 27.1.12297006
### iOS:
- **Xcode**: 15+
- **macOS**: Required for iOS builds
- **CocoaPods**: `sudo gem install cocoapods`
### Web:
- **Modern browser**: Chrome 90+, Firefox 88+, Safari 14+
- **WebGL 2.0**: Required
---
## ✅ Post-Installation
After successful installation:
1. **Launch the app**
2. **Check the icon** - Should show blue-gray with green cube & balls
3. **Test features:**
   - Tap "New" to generate balls
   - Tap "▶" to start simulation
   - Try 3D stereo modes (Anaglyph, Side-by-Side)
   - Test VR mode in landscape orientation
**Enjoy! 🎉**

const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const config = getDefaultConfig(__dirname);

// Füge zusätzliche Asset-Erweiterungen hinzu
config.resolver.assetExts.push(
  'html',
  'css',
  'txt',
  'hdr',
  'glb',
  'gltf',
  'obj',
  'mtl'
);

// Erstelle eine benutzerdefinierte Resolver-Funktion
// um .js-Dateien im assets/webapp-Ordner als Assets zu behandeln
const originalResolveRequest = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  // Wenn es ein require für eine Datei im assets/webapp-Ordner ist
  if (moduleName.includes('assets/webapp/') && moduleName.endsWith('.js')) {
    // Behandle es als Asset
    const resolvedPath = path.resolve(__dirname, moduleName);
    return {
      type: 'assetFiles',
      filePaths: [resolvedPath],
    };
  }

  // Ansonsten verwende den Standard-Resolver
  if (originalResolveRequest) {
    return originalResolveRequest(context, moduleName, platform);
  }
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;





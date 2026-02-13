const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const config = getDefaultConfig(__dirname);

// Add platform-specific extensions for web
config.resolver.resolverMainFields = ['browser', 'main'];
config.resolver.sourceExts = [...config.resolver.sourceExts, 'web.js', 'web.jsx', 'web.ts', 'web.tsx'];

// Use web mock for react-native-maps on web platform
config.resolver.extraNodeModules = {
  ...config.resolver.extraNodeModules,
  'react-native-maps': path.resolve(__dirname, 'mocks/react-native-maps.web.js'),
};

module.exports = config;

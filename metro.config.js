const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const config = getDefaultConfig(__dirname);

// Prefer native entry points, fall back to browser/main for web.
config.resolver.resolverMainFields = ['react-native', 'browser', 'main'];
config.resolver.sourceExts = [
  ...config.resolver.sourceExts,
  'web.js',
  'web.jsx',
  'web.ts',
  'web.tsx',
];

// Use web mock for react-native-maps on web platform
config.resolver.extraNodeModules = {
  ...config.resolver.extraNodeModules,
  'react-native-maps': path.resolve(__dirname, 'mocks/react-native-maps.web.js'),
};

module.exports = config;

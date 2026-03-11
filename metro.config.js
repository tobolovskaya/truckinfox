const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

config.transformer.babelTransformerPath = require.resolve('react-native-svg-transformer/expo');
config.resolver.assetExts = config.resolver.assetExts.filter(ext => ext !== 'svg');
config.resolver.sourceExts.push('svg');

// Limit parallel workers to reduce peak memory usage during bundling.
// Each Metro worker can consume 200–400 MB; 2 workers keeps total usage
// well under 2 GB on a developer machine while still using parallelism.
config.maxWorkers = 2;

module.exports = config;

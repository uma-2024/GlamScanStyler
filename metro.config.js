const { getDefaultConfig, mergeConfig } = require('@react-native/metro-config');

/**
 * Metro configuration
 * https://reactnative.dev/docs/metro
 *
 * @type {import('@react-native/metro-config').MetroConfig}
 */
const defaultConfig = getDefaultConfig(__dirname);
const { assetExts } = defaultConfig.resolver;

const config = {
  transformer: {
    babelTransformerPath: require.resolve('react-native-svg-transformer'),
  },
  resolver: {
    assetExts: assetExts.filter((ext) => ext !== 'svg'),
    sourceExts: [...defaultConfig.resolver.sourceExts, 'svg'],
    // Block .cxx and build directories from being resolved
    blockList: [
      /.*\/\.cxx\/.*/,
      /.*\/node_modules\/.*\/android\/\.cxx\/.*/,
      /.*\/node_modules\/.*\/android\/build\/.*/,
      /.*\/android\/\.cxx\/.*/,
      /.*\/android\/build\/.*/,
      /.*\/android\/app\/build\/.*/,
    ],
  },
  watchFolders: [],
  server: {
    enhanceMiddleware: (middleware) => {
      return middleware;
    },
  },
};

module.exports = mergeConfig(defaultConfig, config);

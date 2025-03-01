const webpack = require('webpack');
const path = require('path');

module.exports = {
  webpack: {
    configure: (config) => {
      // 1. Ignore source map warnings
      config.ignoreWarnings = [
        { module: /@cosmjs/ },
        { module: /cosmjs-types/ },
        { module: /node_modules/ }
      ];

      // 2. Electron-specific configuration
      config.target = 'electron-renderer';
      config.output.globalObject = 'globalThis';

      // Force Webpack to bundle Node built-ins instead of treating them as externals.
      config.externalsPresets = { node: false };

      config.externals = {
        ...config.externals,
        electron: 'commonjs electron',
        'electron/renderer': 'commonjs electron/renderer',
        'original-fs': 'commonjs original-fs',
        'electron-updater': 'commonjs electron-updater'
      };

      // 3. Node.js core module polyfills and aliases
      config.resolve.fallback = {
        ...config.resolve.fallback,
        crypto: require.resolve('crypto-browserify'),
        "node:crypto": require.resolve('crypto-browserify'),
        stream: require.resolve('stream-browserify'),
        assert: require.resolve('assert/'),
        os: require.resolve('os-browserify/browser'),
        path: require.resolve('path-browserify'),
        fs: false,
        util: require.resolve('util/'),
        buffer: require.resolve('buffer/'),
        http: require.resolve('stream-http'),
        https: require.resolve('https-browserify'),
        vm: require.resolve('vm-browserify'),
        querystring: require.resolve('querystring-es3'),
        zlib: require.resolve('browserify-zlib'),
        events: require.resolve('events/'),
        constants: require.resolve('constants-browserify'),
        process: require.resolve('process/browser'),
      };

      // 4. Plugins configuration: Provide globals and handle "node:" scheme
      config.plugins.push(
        new webpack.ProvidePlugin({
          process: 'process/browser',
          Buffer: ['buffer', 'Buffer']
        }),
        new webpack.DefinePlugin({
          'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV || 'development'),
          'process.env.ELECTRON_DISABLE_SECURITY_WARNINGS': JSON.stringify('true'),
          'process.type': JSON.stringify(process.type),
          'process.version': JSON.stringify(process.version),
          global: 'globalThis'
        }),
        // Replace "node:crypto" imports with "crypto" so that our fallback is used
        new webpack.NormalModuleReplacementPlugin(/^node:crypto$/, (resource) => {
          resource.request = resource.request.replace(/^node:/, '');
        })
      );

      return config;
    }
  },
  // 5. Dev server configuration for Electron
  devServer: (config) => {
    config.hot = false;
    config.liveReload = false;
    return config;
  }
};

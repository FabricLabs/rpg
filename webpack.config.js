// # Fabric Webpack Config
// This file configures `webpack`, a build tool for JavaScript.
//
// We always enable JavaScript's "strict" mode first.
'use strict';

const webpack = require('webpack');
const path = require('path');

const browserCrypto = require.resolve('@fabric/http/functions/browserCrypto');

module.exports = {
  mode: 'development',
  entry: './scripts/rpg.js',
  target: 'web',
  optimization: {
    // process.env.NODE_ENV comes from the DefinePlugin below.
    nodeEnv: false
  },
  output: {
    path: path.resolve(__dirname, 'assets/scripts'),
    filename: 'rpg.min.js'
  },
  resolve: {
    alias: {
      // The legacy web components are not in @fabric/http's package `exports`.
      '@fabric/http/components': path.resolve(__dirname, 'node_modules/@fabric/http/components'),
      'node:crypto': browserCrypto,
      // Server-side only: @fabric/http functions/compose renders pages with jsdom,
      // and @fabric/core loads its native addon when one is built.
      jsdom: false,
      '../build/Release/fabric.node': false
    },
    fallback: {
      assert: false,
      canvas: false,
      crypto: browserCrypto,
      fs: false,
      net: false,
      os: false,
      path: require.resolve('path-browserify'),
      buffer: require.resolve('buffer'),
      querystring: require.resolve('querystring-es3'),
      stream: require.resolve('stream-browserify'),
      process: require.resolve('process/browser.js')
    }
  },
  plugins: [
    new webpack.DefinePlugin({
      'process.env': {
        NODE_ENV: JSON.stringify('production'),
        APP_ENV: JSON.stringify('browser')
      }
    }),
    new webpack.ProvidePlugin({
      Buffer: ['buffer', 'Buffer'],
      process: 'process/browser.js'
    })
  ]
};

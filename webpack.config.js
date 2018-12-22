// # Fabric Webpack Config
const path = require('path');

module.exports = {
  entry: './components/index.js',
  mode: 'development',
  devtool: 'source-map',
  target: 'web',
  devServer: {
    contentBase: './assets',
    watchContentBase: true
  },
  output: {
    filename: 'index.js',
    path: path.resolve(__dirname, 'assets')
  }
};

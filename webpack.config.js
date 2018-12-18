// # Fabric Webpack Config
const path = require('path');

module.exports = {
  entry: './components/index.js',
  mode: 'production',
  output: {
    filename: 'index.js',
    path: path.resolve(__dirname, 'assets')
  },
  target: 'web'
};

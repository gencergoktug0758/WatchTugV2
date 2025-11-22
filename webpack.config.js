const path = require('path');

module.exports = {
  mode: 'production',
  entry: './node_modules/mediasoup-client/lib/index.js',
  output: {
    path: path.resolve(__dirname, 'public/js'),
    filename: 'mediasoup-client.js',
    library: 'mediasoupClient',
    libraryTarget: 'window',
    globalObject: 'this'
  },
  resolve: {
    fallback: {
      "util": false,
      "events": false,
      "stream": false,
      "buffer": false
    }
  },
  optimization: {
    minimize: false
  }
};


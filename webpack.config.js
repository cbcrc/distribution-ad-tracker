const path = require('path');
const webpack = require('webpack');
const Dotenv = require('dotenv-webpack');
const TerserPlugin = require('terser-webpack-plugin');

const fileName = 'lib';
const entry = './lib/browser.js';
const alias = process.env.TARGET !== 'node' ? [] : { './cache-browser': './cache-node' };

let definePluginVars = [
  new Dotenv({
    systemvars: true
  })
];

module.exports = {
  entry,

  target: process.env.TARGET ? `${process.env.TARGET}` : 'web',

  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: `${process.env.TARGET ? `${process.env.TARGET}/` : ''}${fileName}${process.env.NODE_ENV === 'dev' ? '' : ''}.js`,
    library: `${!process.env.LIBRARY ? 'LIBRARY' : process.env.LIBRARY}`,
    libraryTarget: 'umd'
  },

  module: {
    rules: [
      {
        test: /\.js?$/,
        include: [path.resolve(__dirname, 'lib')],
        exclude: [path.resolve(__dirname, 'node_modules')],
        loader: 'babel-loader'
      },

      {
        test: /\.html$/,
        loader: 'html-loader'
      }
    ]
  },

  resolve: {
    modules: ['node_modules'],
    extensions: ['.js', '.json', '.jsx', '.css', '.scss'],
    alias
  },

  optimization: {
    minimize: !!process.env.OPTIMIZE_MINIMIZE,
    minimizer: [new TerserPlugin()]
  },

  devtool: 'source-map',

  context: __dirname,

  plugins: definePluginVars,

  mode: process.env.NODE_ENV,

  externals: {}
};

const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');

/** @type {import('webpack').Configuration} */
module.exports = {
  entry: './src/main.tsx',
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: 'bundle.[contenthash].js',
    clean: true
  },
  resolve: {
    extensions: ['.ts', '.tsx', '.js'],
    alias: {
      '@ui-designer/designer-core': path.resolve(__dirname, '../../packages/designer-core/src/index.ts'),
      '@ui-designer/designer-widgets': path.resolve(__dirname, '../../packages/designer-widgets/src/index.ts'),
      '@ui-designer/webgpu-renderer': path.resolve(__dirname, '../../packages/webgpu-renderer/src/index.ts'),
      '@ui-designer/ui-runtime-web': path.resolve(__dirname, '../../packages/ui-runtime-web/src/index.ts')
    }
  },
  module: {
    rules: [
      {
        test: /\.tsx?$/,
        use: {
          loader: 'ts-loader',
          options: {
            configFile: 'tsconfig.webpack.json'
          }
        },
        exclude: /node_modules/
      },
      {
        test: /\.css$/i,
        use: ['style-loader', 'css-loader']
      },
      {
        test: /\.xaml$/i,
        type: 'asset/source'
      }
    ]
  },
  plugins: [
    new HtmlWebpackPlugin({
      template: './src/index.html'
    })
  ],
  devServer: {
    host: '127.0.0.1',
    port: 'auto',
    hot: true,
    historyApiFallback: true,
    static: {
      directory: path.resolve(__dirname, 'dist')
    }
  },
  devtool: 'source-map'
};

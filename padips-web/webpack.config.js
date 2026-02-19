const path = require('path');
const CopyPlugin = require("copy-webpack-plugin");

module.exports = {
  mode: 'production', // Produktionsmodus für optimiertes Bundle
  entry: {
    renderer: './src/renderer.ts',
  },
  output: {
    filename: '[name].bundle.js',
    path: path.resolve(__dirname, 'dist'),
    publicPath: '', // Empty string for relative paths (important for WebView!)
    // REMOVED library config - we don't want immediate execution
  },
  target: 'web',
  resolve: {
    extensions: ['.js', '.ts'],
    modules: [
      path.resolve(__dirname, 'node_modules')
    ],
  },
  module: {
    rules: [
      {
        test: /\.ts$/,
        exclude: /(node_modules|bower_components|renderer-cubes\.ts)/,
        use: {
          loader: 'ts-loader'
        }
      },
      {
        // JSON files (including typeface.json) should be imported as objects
        test: /\.json$/,
        type: 'json'
      },
      {
        // Other font files use file-loader
        test: /\.(woff(2)?|ttf|eot|svg)(\?v=\d+\.\d+\.\d+)?$/,
        use: [
          {
            loader: 'file-loader',
            options: {
              name: '[name].[ext]',
              outputPath: 'fonts/',
              publicPath: 'fonts/',
            }
          }
        ],
        type: 'javascript/auto',
      }
    ]
  },
  plugins: [
    new CopyPlugin({
      patterns: [
        {
          from: "index.html",
          to: "index.html",
          transform(content) {
            // Ändere den Script-Tag: entferne type="module" und korrigiere Pfad
            let html = content.toString();
            html = html.replace(
              '<script type="module" src="../dist/renderer.bundle.js"></script>',
              '<script src="renderer.bundle.js"></script>'
            );
            return html;
          }
        },
        {
          from: "textures",
          to: "textures",
          noErrorOnMissing: true
        }
      ],
    }),
  ],
  optimization: {
    minimize: false, // Für besseres Debugging
  },
  devtool: false, // Keine source maps für WebView
};

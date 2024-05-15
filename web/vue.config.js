module.exports = {
    publicPath: './',
    devServer: {
      port: 8081,
      disableHostCheck: true,
      proxy: {
        '^/api': {
          target: 'http://localhost:8080',
          ws: true,
          changeOrigin: false
        }
      }
    },
    outputDir: './dist'
  }
  
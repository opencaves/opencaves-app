import path from 'node:path'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import svgrPlugin from 'vite-plugin-svgr'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  build: {
    outDir: 'build',
  },
  envPrefix: ['VITE_', 'REACT_APP_'],
  plugins: [
    react({
      include: /\.(js|jsx|ts|tsx)$/,
      jsxRuntime: 'automatic',
      babel: {
        presets: ['@babel/preset-react']
      }
    }),
    svgrPlugin(),
    VitePWA({
      // The app registers and manages the service worker itself
      // (src/serviceWorkerRegistration.js) - this plugin's only job is to
      // build src/service-worker.js into a real file with the precache
      // manifest injected, since Vite has no built-in equivalent to CRA's
      // workbox-webpack-plugin.
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'service-worker.js',
      injectRegister: false,
      manifest: false,
      injectManifest: {
        // public/ files (favicons, manifest.json, sitemap route, etc.) are
        // served as-is by Hosting and don't need to go through the SW.
        // Fonts are included so the app shell still renders with correct
        // typography offline, not just unstyled/fallback text.
        globPatterns: ['**/*.{js,css,html,woff,woff2}'],
        // The app registers this with a plain (non-module) `register()`
        // call, so it needs to be a classic script, not an ES module -
        // also makes the output land at service-worker.js instead of .mjs.
        rollupFormat: 'iife',
        // This app doesn't code-split, so its main bundle is a few MB;
        // that's a separate problem from "does offline caching work".
        maximumFileSizeToCacheInBytes: 12 * 1024 * 1024,
      },
    })
  ],
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, 'src')
    }
  }
})

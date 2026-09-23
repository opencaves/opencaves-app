import path from 'node:path'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import svgrPlugin from 'vite-plugin-svgr'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  build: {
    outDir: 'build',
    rollupOptions: {
      output: {
        // Split heavy, independently-versioned vendor libraries into their
        // own chunks: they change far less often than the app's own code,
        // so browsers (and this app's precaching service worker) can keep
        // reusing a cached copy across deploys that don't touch them.
        manualChunks(id) {
          if (!id.includes('node_modules')) {
            return
          }
          if (id.includes('/mapbox-gl/') || id.includes('/react-map-gl/')) {
            return 'mapbox'
          }
          if (id.includes('/@mui/') || id.includes('/@emotion/')) {
            return 'mui'
          }
          if (id.includes('/@ionic/')) {
            return 'ionic'
          }
          if (id.includes('/@photo-sphere-viewer/') || id.includes('/react-photo-sphere-viewer/')) {
            return 'photo-sphere-viewer'
          }
          if (id.includes('/firebase/') || id.includes('/@firebase/')) {
            return 'firebase'
          }
          if (id.includes('/swiper/')) {
            return 'swiper'
          }
        },
      },
    },
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
        // Even after splitting, the mapbox/ionic vendor chunks are still a
        // few MB each; raise Workbox's default 2 MiB precache limit rather
        // than exclude them from offline support.
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

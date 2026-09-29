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
        //
        // Rolldown's groups, not the deprecated manualChunks: a group also
        // captures its modules' dependencies, so the order matters - higher
        // priority claims first. React (a dependency of every UI library)
        // goes first, Ionic last: otherwise Ionic's group captured React and
        // other shared code, and every page - desktop included, which never
        // uses Ionic (see src/utils/ionic.js) - depended on its chunk.
        codeSplitting: {
          groups: [
            { name: 'react', test: /node_modules[\\/](react|react-dom|scheduler)[\\/]/, priority: 60 },
            { name: 'mapbox', test: /node_modules[\\/](mapbox-gl|react-map-gl)[\\/]/, priority: 50 },
            { name: 'mui', test: /node_modules[\\/](@mui|@emotion)[\\/]/, priority: 40 },
            { name: 'firebase', test: /node_modules[\\/](firebase|@firebase)[\\/]/, priority: 40 },
            { name: 'photo-sphere-viewer', test: /node_modules[\\/](@photo-sphere-viewer|react-photo-sphere-viewer)[\\/]/, priority: 40 },
            { name: 'swiper', test: /node_modules[\\/]swiper[\\/]/, priority: 40 },
            { name: 'ionic', test: /node_modules[\\/]@ionic[\\/]/, priority: 10 },
          ],
        },
      },
    },
  },
  envPrefix: ['VITE_', 'REACT_APP_'],
  optimizeDeps: {
    // pdf-into-svg resolves its .NET WASM runtime assets at request time via
    // relative import.meta.url paths (see node_modules/pdf-into-svg/dist/index.js).
    // Vite's dependency pre-bundling flattens the package into
    // node_modules/.vite/deps/, which breaks those relative paths since the
    // sibling runtime/ folder doesn't get copied alongside it - excluding it
    // keeps it served straight from node_modules, where the paths resolve.
    exclude: ['pdf-into-svg'],
  },
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

import { existsSync, readFileSync, renameSync } from 'node:fs'
import path from 'node:path'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import svgrPlugin from 'vite-plugin-svgr'
import { VitePWA } from 'vite-plugin-pwa'

// The app's version (About, the console banner): package.json's, passed on
// like the .env variables, in dev and in builds.
process.env.VITE_APP_VERSION = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8')).version

// index.html paints its map shell (a static loading screen) from the HTML
// alone. The tags Vite injects for the app - its stylesheets (which block
// painting) and ~1 MB of preloaded modules - would otherwise all be requested
// before that first paint and compete with it for a slow connection. This
// moves them into a small loader that adds them right after the first paint
// (or shortly anyway, in a background tab where no frame is painted); the
// app waits for its stylesheets before rendering (src/index.jsx). Build only.
// The built page is app.html, not index.html: Firebase Hosting serves a
// static index.html for / before any rewrite, and / is rendered by the
// indexPages function (its content in the HTML, for search engines), which
// uses app.html as its shell - as every other rewrite does (firebase.json).
// Renamed once written (Vite 8 drops a page renamed inside the bundle), before
// the service worker's precache is made, so it lists app.html.
function appShellName() {
  let outDir
  return {
    name: 'oc-app-shell-name',
    apply: 'build',
    enforce: 'post',
    configResolved(config) {
      outDir = path.resolve(config.root, config.build.outDir)
    },
    writeBundle() {
      const page = path.join(outDir, 'index.html')
      if (existsSync(page)) renameSync(page, path.join(outDir, 'app.html'))
    },
  }
}

function loadAppAfterFirstPaint() {
  return {
    name: 'oc-load-app-after-first-paint',
    apply: 'build',
    transformIndexHtml: {
      order: 'post',
      handler(html) {
        const found = { stylesheets: [], preloads: [], entry: null }
        html = html
          .replace(/\s*<script type="module" crossorigin src="([^"]+)"><\/script>/, (_, src) => {
            found.entry = src
            return ''
          })
          .replace(/\s*<link rel="modulepreload" crossorigin href="([^"]+)">/g, (_, href) => {
            found.preloads.push(href)
            return ''
          })
          .replace(/\s*<link rel="stylesheet" crossorigin href="([^"]+)">/g, (_, href) => {
            found.stylesheets.push(href)
            return ''
          })
        if (!found.entry) {
          throw new Error('oc-load-app-after-first-paint: no entry script found in index.html')
        }
        const loader = `<script>
    (function () {
      var stylesheets = ${JSON.stringify(found.stylesheets)}
      var preloads = ${JSON.stringify(found.preloads)}
      var started = false
      function start() {
        if (started) return
        started = true
        var head = document.head
        window.__ocAppStylesheets = Promise.all(stylesheets.map(function (href) {
          return new Promise(function (resolve) {
            var link = document.createElement('link')
            link.rel = 'stylesheet'
            link.crossOrigin = ''
            link.href = href
            link.onload = link.onerror = resolve
            head.appendChild(link)
          })
        }))
        preloads.forEach(function (href) {
          var link = document.createElement('link')
          link.rel = 'modulepreload'
          link.crossOrigin = ''
          link.href = href
          head.appendChild(link)
        })
        var script = document.createElement('script')
        script.type = 'module'
        script.crossOrigin = ''
        script.src = ${JSON.stringify(found.entry)}
        head.appendChild(script)
      }
      requestAnimationFrame(function () { setTimeout(start) })
      setTimeout(start, 300)
    })()
  </script>
</body>`
        return html.replace('</body>', loader)
      },
    },
  }
}

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
            // Not its dependencies: it captured a helper react-i18next shares, and
            // every page then preloaded all of Mapbox (only the map needs it).
            { name: 'mapbox', test: /node_modules[\\/](mapbox-gl|react-map-gl)[\\/]/, priority: 50, includeDependenciesRecursively: false },
            { name: 'mui', test: /node_modules[\\/](@mui|@emotion)[\\/]/, priority: 40 },
            { name: 'firebase', test: /node_modules[\\/](firebase|@firebase)[\\/]/, priority: 40 },
            { name: 'photo-sphere-viewer', test: /node_modules[\\/](@photo-sphere-viewer|react-photo-sphere-viewer)[\\/]/, priority: 40 },
            { name: 'swiper', test: /node_modules[\\/]swiper[\\/]/, priority: 40 },
            // Not its dependencies either (as mapbox): the shared helper would move here.
            { name: 'ionic', test: /node_modules[\\/]@ionic[\\/]/, priority: 10, includeDependenciesRecursively: false },
          ],
        },
      },
    },
  },
  // Only VITE_* variables reach the app (Vite's default; REACT_APP_* was
  // Create React App's). VITE_APP_VERSION is set above, from package.json.
  envPrefix: 'VITE_',
  optimizeDeps: {
    // pdf-into-svg resolves its .NET WASM runtime assets at request time via
    // relative import.meta.url paths (see node_modules/pdf-into-svg/dist/index.js).
    // Vite's dependency pre-bundling flattens the package into
    // node_modules/.vite/deps/, which breaks those relative paths since the
    // sibling runtime/ folder doesn't get copied alongside it - excluding it
    // keeps it served straight from node_modules, where the paths resolve.
    exclude: ['pdf-into-svg'],
    // The Markdown length tag's parser (lengthDirective.js) is only reached
    // from lazily loaded code: found late, its re-optimization left pages
    // asking for outdated deps (504 "Outdated Optimize Dep").
    include: ['micromark-extension-directive', 'mdast-util-directive'],
    // Every source file scanned for dependencies at startup, not only what's
    // reachable from index.html: a lazily loaded page importing one not seen
    // yet (e.g. an @mui/icons-material/<Name> file) made Vite re-optimize and
    // reload the page - clicking Map layers on /dashboard just reloaded it.
    entries: ['index.html', 'src/**/*.{js,jsx}'],
  },
  plugins: [
    appShellName(),
    react({
      include: /\.(js|jsx|ts|tsx)$/,
      jsxRuntime: 'automatic',
      babel: {
        presets: ['@babel/preset-react']
      }
    }),
    svgrPlugin(),
    loadAppAfterFirstPaint(),
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
  },
  // In development, what Firebase Hosting rewrites to functions in production
  // (firebase.json) goes to the functions emulator.
  server: {
    proxy: {
      '/api/address': {
        target: 'http://127.0.0.1:5001',
        rewrite: (url) => url.replace(/^\/api\/address/, '/opencaves/northamerica-northeast1/caveAddress'),
      },
    },
  },
})

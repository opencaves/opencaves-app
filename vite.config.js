import { copyFileSync, existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import svgrPlugin from 'vite-plugin-svgr'
import { VitePWA } from 'vite-plugin-pwa'
import { TITLE_NAME } from './functions/js/constants.js'

// The app's version (About, the console banner): package.json's, passed on
// like the .env variables, in dev and in builds.
process.env.VITE_APP_VERSION = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8')).version

// index.html paints its map shell (a static loading screen) from the HTML
// alone. The tags Vite injects for the app - its stylesheets (which block
// painting) and ~1 MB of preloaded modules - would otherwise all be requested
// before that first paint and compete with it for a slow connection. This
// moves them into a small loader that adds them right after the first
// contentful paint (or a second at most, in a background tab where nothing
// is painted); the
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
      writeStaticPages(outDir)
    },
  }
}

// The pages that aren't rendered on the server but are worth indexing (/map,
// /about, /privacy, /terms; firebase.json serves each its file): the app's
// shell with the page's own title (and description: only the map has one),
// and its h1 and text in #root - which the app replaces when it starts, as
// on the server-rendered pages (functions/js/seo/shared.js) - for search
// engines that don't run the app (Bing reported them without an h1). Their
// texts are the English locale's, which the app sets again in the visitor's
// language. Files, not functions: no cold start.
function writeStaticPages(outDir) {
  const shell = path.join(outDir, 'app.html')
  if (!existsSync(shell)) return
  const { seo, about, legal } = JSON.parse(readFileSync(new URL('./src/locales/en.json', import.meta.url), 'utf8'))
  const escape = (text) => text.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;')
  const html = readFileSync(shell, 'utf8')
  const pages = [
    { file: 'map.html', title: seo.mapTitle, description: seo.mapDescription, heading: seo.mapHeading },
    { file: 'about.html', title: about.title, heading: about.title },
    { file: 'privacy.html', title: legal.privacy.title, heading: legal.privacy.title, body: legal.privacy.body },
    { file: 'terms.html', title: legal.terms.title, heading: legal.terms.title, body: legal.terms.body },
  ]
  for (const { file, title, description, heading, body } of pages) {
    const page = html
      .replace(/<title>[^<]*<\/title>/, () => `<title>${escape(`${title} / ${TITLE_NAME}`)}</title>${description ? `\n  <meta name="description" content="${escape(description)}" />` : ''}`)
      .replace('<div id="root"></div>', () => `<div id="root"><h1>${escape(heading)}</h1>${body ? markdownToHtml(body, escape) : ''}</div>`)
    writeFileSync(path.join(outDir, file), page)
  }
}

// The legal texts' Markdown as plain HTML, for the pages above: headings,
// paragraphs and lists; links as their text, emphasis dropped.
function markdownToHtml(markdown, escape) {
  const inline = (text) => escape(text.replace(/\[([^\]]*)]\([^)]*\)/g, '$1').replace(/[*_]+/g, ''))
  return markdown.split(/\n{2,}/).map((block) => {
    const heading = /^(#{2,6})\s+(.*)$/.exec(block.trim())
    if (heading) return `<h${heading[1].length}>${inline(heading[2])}</h${heading[1].length}>`
    const lines = block.trim().split('\n')
    if (lines.every((line) => /^\s*[-*]\s+/.test(line))) return `<ul>${lines.map((line) => `<li>${inline(line.replace(/^\s*[-*]\s+/, ''))}</li>`).join('')}</ul>`
    return `<p>${inline(lines.join(' '))}</p>`
  }).join('')
}

// The files of src/config/firebase.js's chunk and the chunks it imports, as
// the page names them ('/assets/...'): Firebase is loaded on demand
// (utils/loadFirebase.js), out of the app's own preloads.
function firebaseFiles(bundle) {
  const chunks = Object.values(bundle || {}).filter((chunk) => chunk.type === 'chunk')
  const byFile = new Map(chunks.map((chunk) => [chunk.fileName, chunk]))
  const start = chunks.find((chunk) => chunk.moduleIds.some((id) => path.normalize(id).endsWith(path.normalize('src/config/firebase.js'))))
  const files = new Set()
  const add = (chunk) => {
    if (!chunk || files.has(chunk.fileName)) return
    files.add(chunk.fileName)
    chunk.imports.forEach((file) => add(byFile.get(file)))
  }
  add(start)
  return [...files].map((file) => `/${file}`)
}

function loadAppAfterFirstPaint() {
  return {
    name: 'oc-load-app-after-first-paint',
    apply: 'build',
    transformIndexHtml: {
      order: 'post',
      handler(html, ctx) {
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
        // Firebase: fetched at once beside the app (index.jsx) - except on a
        // page the server rendered, which waits for the person
        // (utils/loadFirebase.js): preloaded with the app's on the others.
        const firebasePreloads = firebaseFiles(ctx.bundle).filter((file) => file !== found.entry && !found.preloads.includes(file))
        const loader = `<script>
    (function () {
      var stylesheets = ${JSON.stringify(found.stylesheets)}
      var preloads = ${JSON.stringify(found.preloads)}
      var firebasePreloads = ${JSON.stringify(firebasePreloads)}
      var serverRendered = document.documentElement.hasAttribute('data-oc-ssr')
      var started = false
      function start() {
        if (started) return
        started = true
        var head = document.head
        window.__ocAppStylesheets = Promise.all(stylesheets.map(function (href) {
          // A page the server rendered has them already (functions/js/seo/ssr.js).
          if (document.querySelector('link[rel="stylesheet"][href="' + href + '"]')) return null
          return new Promise(function (resolve) {
            var link = document.createElement('link')
            link.rel = 'stylesheet'
            link.crossOrigin = ''
            link.href = href
            link.onload = link.onerror = resolve
            head.appendChild(link)
          })
        }))
        // A server-rendered page's own route code (functions/js/seo/ssr.js).
        preloads.concat(window.__ocPagePreloads || [], serverRendered ? [] : firebasePreloads).forEach(function (href) {
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
      // After the page's first contentful paint - the server's content, a
      // cave's text (functions/js/seo/cavePage.js) or the splash: code
      // requested before it competes with it (Lighthouse counts it in its
      // LCP: the first frame came before the paint, the code was asked for
      // at 46ms, the text painted at 131ms) - or a second at most (a
      // background tab paints nothing). No paint timing: after the first
      // frame.
      var observed = false
      if (window.PerformanceObserver) {
        try {
          new PerformanceObserver(function (list, observer) {
            if (list.getEntriesByName('first-contentful-paint').length) {
              observer.disconnect()
              setTimeout(start)
            }
          }).observe({ type: 'paint', buffered: true })
          observed = true
        } catch (e) {}
      }
      if (observed) setTimeout(start, 1000)
      else {
        requestAnimationFrame(function () { setTimeout(start) })
        setTimeout(start, 300)
      }
    })()
  </script>
</body>`
        return html.replace('</body>', loader)
      },
    },
  }
}

// The server build (vite build --ssr src/entry-server.jsx, npm run build),
// which renders the public pages for functions/js/seo/ssr.js: the store and
// Firebase set up for the server instead of the browser.
const SERVER_MODULES = {
  [path.resolve(import.meta.dirname, 'src/redux/store.jsx')]: path.resolve(import.meta.dirname, 'src/redux/store.server.jsx'),
  [path.resolve(import.meta.dirname, 'src/config/firebase.js')]: path.resolve(import.meta.dirname, 'src/ssr/firebase.server.js'),
}

function serverModules() {
  return {
    name: 'oc-server-modules',
    enforce: 'pre',
    async resolveId(source, importer, options) {
      if (!options?.ssr && !this.environment?.config?.build?.ssr) return null
      const resolved = await this.resolve(source, importer, { ...options, skipSelf: true })
      return resolved && SERVER_MODULES[path.normalize(resolved.id)] ? SERVER_MODULES[path.normalize(resolved.id)] : null
    },
  }
}

// The server build takes the client build's page (app.html, its shell) and
// manifest (which files each page needs) along: the function serves them
// together, so the two always match. OC_CLIENT_OUT_DIR: the client build's
// folder, when not build/.
function copyClientBuild() {
  let outDir
  return {
    name: 'oc-copy-client-build',
    apply: 'build',
    configResolved(config) {
      outDir = path.resolve(config.root, config.build.outDir)
    },
    writeBundle() {
      const clientDir = path.resolve(import.meta.dirname, process.env.OC_CLIENT_OUT_DIR || 'build')
      mkdirSync(outDir, { recursive: true })
      copyFileSync(path.join(clientDir, 'app.html'), path.join(outDir, 'app.html'))
      copyFileSync(path.join(clientDir, '.vite', 'manifest.json'), path.join(outDir, 'manifest.json'))
    },
  }
}

export default defineConfig(({ isSsrBuild }) => ({
  // The server build (functions/js/ssr/entry-server.js and its chunks) with
  // every dependency in it - the function's package doesn't list the app's.
  // Split as the app (its lazy routes, chunks of their own): a function
  // instance only loads the public pages' code, not the map's or the admin's.
  ...(isSsrBuild && {
    ssr: { noExternal: true },
    // public/ is the site's (Hosting), not the function's.
    publicDir: false,
  }),
  build: isSsrBuild ? {
    outDir: 'functions/js/ssr',
    emptyOutDir: true,
  } : {
    outDir: 'build',
    // Source maps published with the client's files (Hosting serves them):
    // stack traces and the browser's tools read the real code (Lighthouse's
    // valid-source-maps). Fetched only by those tools - the pages don't load
    // them, and the service worker doesn't precache them (globIgnores).
    // Not the server build's (functions/js/ssr/).
    sourcemap: true,
    // .vite/manifest.json: the files each page needs, for the server-rendered
    // pages' <link>s (functions/js/seo/ssr.js). Not served (Hosting ignores
    // dot folders, firebase.json).
    manifest: true,
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
            // Storage and Functions left out: loaded on first use (config/firebase.js),
            // they get chunks of their own instead of riding with every page.
            { name: 'firebase', test: /node_modules[\\/](firebase|@firebase)[\\/](?!(storage|functions)([\\/]|$))/, priority: 40 },
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
    include: [
      'micromark-extension-directive',
      'mdast-util-directive',
      // The same for the lists editors reorder (components/Reorder/SortableList.jsx,
      // loaded on demand): dnd-kit.
      '@dnd-kit/core',
      '@dnd-kit/sortable',
      '@dnd-kit/utilities',
    ],
    // Every source file scanned for dependencies at startup, not only what's
    // reachable from index.html: a lazily loaded page importing one not seen
    // yet (e.g. an @mui/icons-material/<Name> file) made Vite re-optimize and
    // reload the page - clicking Map layers on /dashboard just reloaded it.
    entries: ['index.html', 'src/**/*.{js,jsx}'],
  },
  plugins: isSsrBuild ? [
    serverModules(),
    react({ include: /\.(js|jsx|ts|tsx)$/, jsxRuntime: 'automatic' }),
    svgrPlugin(),
    copyClientBuild(),
  ] : [
    appShellName(),
    react({
      include: /\.(js|jsx|ts|tsx)$/,
      jsxRuntime: 'automatic',
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
        // And the pages' background photos (the layout's, the dashboard's,
        // the lists', the error pages' - ~1.4 MB): every page, the "You're
        // offline" one included, shows its photo offline, even never seen.
        globPatterns: ['**/*.{js,css,html,woff,woff2}', '**/{error-bg,bg}-*.webp'],
        // The source maps (build.sourcemap): for the browser's tools only.
        globIgnores: ['**/*.map'],
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
      // As Hosting's rewrite: the sitemap function, on the functions emulator
      // (its addresses are the site's, https://opencaves.org/...).
      '/sitemap.xml': {
        target: 'http://127.0.0.1:5001',
        rewrite: () => '/opencaves/northamerica-northeast1/sitemap',
      },
    },
  },
}))

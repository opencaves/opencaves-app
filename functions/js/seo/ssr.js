import { existsSync } from 'node:fs'
import { readFile } from 'node:fs/promises'
import { logger } from 'firebase-functions/v2'
import { db } from '../init.js'
import { CAVES_COLL_NAME } from '../constants.js'
import { renderSsrPage } from './shared.js'

// The public pages rendered by the app itself (src/entry-server.jsx), for
// indexPages.js: the page's HTML as the app draws it, which the app then
// hydrates (takes over) instead of replacing. The server build (npm run
// build: vite build --ssr) is in ../ssr/, with the client build's page
// (app.html, the shell) and manifest - deployed together with the functions,
// so the three always match. No build there (a deploy without it): null,
// and the pages are served as text, as before (indexPages.js).

const SSR_DIR = new URL('../ssr/', import.meta.url)
// The cave data, read once per instance and kept a few minutes (as
// indexData.js): the CDN keeps each page an hour anyway.
const DATA_TTL_MS = 5 * 60 * 1000

let loaded = null

// { render, pageOf, shell, links(kind) } from the server build, or null.
export function loadSsr() {
  if (!existsSync(new URL('entry-server.js', SSR_DIR))) return Promise.resolve(null)
  loaded ||= (async () => {
    const [server, shell, manifest] = await Promise.all([
      import(new URL('entry-server.js', SSR_DIR).href),
      readFile(new URL('app.html', SSR_DIR), 'utf8'),
      readFile(new URL('manifest.json', SSR_DIR), 'utf8').then(JSON.parse),
    ])
    return { render: server.render, pageOf: server.pageOf, shell, links: pageLinks(manifest, server.ROUTE_MODULES) }
  })().catch((error) => {
    loaded = null
    throw error
  })
  return loaded
}

// The <link>s a page needs from the start, by its kind (entry-server.jsx's
// ROUTE_MODULES: its route's source file): the app's stylesheets (render
// blocking: the page shows styled at once - the app's shell otherwise adds
// them after its first paint, vite.config.js) and its route's code, preloaded
// with the app's so hydration doesn't wait for it after the app's own code.
function pageLinks(manifest, routeModules) {
  const cssOf = (key, seen = new Set()) => {
    const chunk = manifest[key]
    if (!chunk || seen.has(key)) return []
    seen.add(key)
    return [...(chunk.css || []), ...(chunk.imports || []).flatMap((imported) => cssOf(imported, seen))]
  }
  const entryCss = cssOf('index.html')
  const cache = new Map()
  return (kind) => {
    if (!cache.has(kind)) {
      const key = routeModules[kind]
      const route = manifest[key]
      const css = [...new Set([...entryCss, ...(route ? cssOf(key) : [])])]
      // The route's code: preloaded with the app's own, after the page's
      // first paint (the shell's loader, vite.config.js: __ocPagePreloads).
      const preloads = route ? [`/${route.file}`, ...(route.imports || []).filter((imported) => imported !== 'index.html' && manifest[imported]).map((imported) => `/${manifest[imported].file}`)] : []
      cache.set(kind, [
        ...css.map((href) => `<link rel="stylesheet" crossorigin href="/${href}">`),
        `<script>window.__ocPagePreloads = ${JSON.stringify(preloads)}</script>`,
      ].join('\n  '))
    }
    return cache.get(kind)
  }
}

// Firestore's values as the browser's SDK gives them in JSON (their
// toJSON): a Timestamp as { seconds, nanoseconds, type } (ssrContext.js
// makes it a Timestamp again).
function plain(value) {
  if (Array.isArray(value)) return value.map(plain)
  if (value && typeof value === 'object') {
    if (typeof value.toDate === 'function' && typeof value.seconds === 'number') return { seconds: value.seconds, nanoseconds: value.nanoseconds, type: 'firestore/timestamp/1.1' }
    if (typeof value.latitude === 'number' && typeof value.longitude === 'number' && value.constructor?.name === 'GeoPoint') return { latitude: value.latitude, longitude: value.longitude, type: 'firestore/geoPoint/1.0' }
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, plain(item)]))
  }
  return value
}

// The collections the app reads (src/services/data-service/firestoreDataReader.js).
const DATA_COLLECTIONS = { caves: CAVES_COLL_NAME, sistemas: 'sistemas', connections: 'connections', accesses: 'accesses', accessibilities: 'accessibilities', sources: 'sources', areas: 'areas', colors: 'colors', languages: 'languages' }

let dataCache = null

// The pages already rendered, by address (renderWithApp): a few dozen at
// most (0.4-0.8 MB each).
const RENDERED_MAX = 40
const rendered = new Map()

async function readData() {
  if (dataCache && Date.now() - dataCache.at < DATA_TTL_MS) return dataCache.data
  const [entries, mapsSnap] = await Promise.all([
    Promise.all(Object.entries(DATA_COLLECTIONS).map(async ([key, name]) => [key, (await db.collection(name).get()).docs.map((doc) => ({ id: doc.id, ...plain(doc.data()) }))])),
    db.collection('maps').get(),
  ])
  const data = { raw: Object.fromEntries(entries), maps: mapsSnap.docs.map((doc) => ({ id: doc.id, data: plain(doc.data()) })) }
  dataCache = { data, at: Date.now() }
  return data
}

// The page at req's address, rendered by the app, as HTML - with meta (the
// page's <head> data: indexPages.js's) - or null when the app can't render
// it (no server build, not one of its pages); throws when rendering fails.
export async function renderWithApp(req, meta) {
  const ssr = await loadSsr()
  if (!ssr) return null
  const page = ssr.pageOf(req.path)
  if (!page) return null
  const { raw, maps } = await readData()
  const assets = page.kind === 'cave'
    ? (await db.collection('cavesAssets').where('caveId', '==', page.id).where('type', '==', 'image').get()).docs.map((doc) => ({ id: doc.id, data: plain(doc.data()) }))
    : []
  // Its host: the emulators' file addresses on localhost (CaveAsset.js).
  const host = req.get('x-forwarded-host') || req.get('host') || 'opencaves.org'
  const url = `https://${host}${req.originalUrl || req.url}`
  // Drawn once per address while the data is the same (the CDN's edges each
  // ask for it): a render takes ~100-300 ms.
  const cached = rendered.get(url)
  if (cached?.raw === raw) return cached.html
  const started = Date.now()
  const result = await ssr.render({ url, raw, maps, assets, title: meta.title })
  if (result.notFound) return null
  logger.debug('[ssr] rendered', { path: req.path, ms: Date.now() - started, ...result.timings })
  const html = renderSsrPage(ssr.shell, meta, result, ssr.links(page.kind))
  rendered.delete(url)
  rendered.set(url, { raw, html })
  // The oldest out past the limit (a Map keeps its insertion order).
  if (rendered.size > RENDERED_MAX) rendered.delete(rendered.keys().next().value)
  return html
}

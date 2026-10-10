import { Timestamp } from 'firebase/firestore'

// What a page rendered on the server (entry-server.jsx) shares with the
// browser rendering it again - hydrating it: the request's host, the cave
// data the page shows (pageState.js) and the Firestore query results the
// server read for it (functions/js/seo/ssr.js), by key ("maps",
// "photos:<caveId>"...). The server sets them around each render
// (synchronous: one page at a time); the browser reads them from
// window.__OC_SSR__ (written in the page) - the query results during
// hydration only, the cave data until the store has its own (useCaveData).
let serverContext = null
let hydrating = false

export function setServerContext(context) {
  serverContext = context
}

/**
 * index.jsx: true while the page is hydrated, false once it is.
 *
 * @param {boolean} value
 */
export function setHydrating(value) {
  hydrating = value
}

export function isHydrating() {
  return hydrating
}

/**
 * The page's hostname: the request's on the server, the browser's otherwise
 * ("localhost": the emulators' file addresses).
 */
export function pageHostname() {
  if (import.meta.env.SSR) return serverContext?.hostname || 'opencaves.org'
  return window.location.hostname
}

/**
 * The cave data the server rendered the page with, { path, data } (data:
 * state.data's shape, with only what that page shows - pageState.js), or
 * null.
 *
 * @returns {{path: string, data: object}|null}
 */
export function ssrPageData() {
  if (import.meta.env.SSR) return serverContext?.data || null
  const ssr = window.__OC_SSR__
  return ssr?.data ? { path: ssr.path, data: ssr.data } : null
}

/**
 * Whether the address pathname is the server-rendered page at path, or one of
 * its galleries over it (/caves/<id>/photos/<mediaId>, .../maps/<mapId>) -
 * the page stays drawn under them. Not its edit forms (.../edit), which need
 * every record.
 *
 * @param {string} path
 * @param {string} pathname
 * @returns {boolean}
 */
export function inSsrPage(path, pathname) {
  if (pathname === path) return true
  if (!/^\/(caves|sistemas)\/[^/]+$/.test(path) || !pathname.startsWith(`${path}/`)) return false
  return /^\/(photos|maps)\/[^/]+$/.test(pathname.slice(path.length))
}

// The server's results for a query, as [{ id, data }], or undefined.
function queryResult(key) {
  if (import.meta.env.SSR) return serverContext?.queries?.[key]
  return hydrating ? window.__OC_SSR__?.queries?.[key] : undefined
}

// Timestamps travel as { seconds, nanoseconds, type } (their toJSON):
// Timestamps again, as Firestore gives them.
function revive(value) {
  if (Array.isArray(value)) return value.map(revive)
  if (value && typeof value === 'object') {
    if (value.type === 'firestore/timestamp/1.1' && typeof value.seconds === 'number') return new Timestamp(value.seconds, value.nanoseconds || 0)
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, revive(item)]))
  }
  return value
}

/**
 * The server's results for a query as a QuerySnapshot's stand-in (docs,
 * size, empty, forEach, metadata; each doc's id, data(), get()), through the
 * query's converter as Firestore would - or undefined.
 *
 * @param {string} key
 * @param {import('firebase/firestore').FirestoreDataConverter} [converter]
 * @returns {object|undefined}
 */
export function ssrQuerySnapshot(key, converter) {
  const result = queryResult(key)
  if (!result) return undefined
  const docs = result.map(({ id, data }) => {
    const raw = revive(data)
    const snapshot = { id, exists: () => true, get: (field) => field.split('.').reduce((value, part) => value?.[part], raw), metadata: { fromCache: false, hasPendingWrites: false } }
    snapshot.data = () => raw
    const converted = converter ? converter.fromFirestore(/** @type {import('firebase/firestore').QueryDocumentSnapshot} */ (/** @type {unknown} */ (snapshot))) : raw
    return { ...snapshot, data: () => converted }
  })
  return { docs, size: docs.length, empty: docs.length === 0, metadata: { fromCache: false, hasPendingWrites: false }, forEach: (callback, thisArg) => docs.forEach(callback, thisArg) }
}

import { Timestamp } from 'firebase/firestore'

// What a page rendered on the server (entry-server.jsx) shares with the
// browser rendering it again - hydrating it: the request's host, and the
// Firestore query results the server read for it (functions/js/seo/ssr.js),
// by key ("maps", "photos:<caveId>"...). The server sets them around each
// render (synchronous: one page at a time); the browser reads them from
// window.__OC_SSR__ (written in the page), during hydration only.
let serverContext = null
let hydrating = false

export function setServerContext(context) {
  serverContext = context
}

// index.jsx: true while the page is hydrated, false once it is.
export function setHydrating(value) {
  hydrating = value
}

export function isHydrating() {
  return hydrating
}

// The page's hostname: the request's on the server, the browser's otherwise
// ("localhost": the emulators' file addresses).
export function pageHostname() {
  if (import.meta.env.SSR) return serverContext?.hostname || 'opencaves.org'
  return window.location.hostname
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

// The server's results for a query as a QuerySnapshot's stand-in (docs,
// size, empty, forEach, metadata; each doc's id, data(), get()), through the
// query's converter as Firestore would - or undefined.
export function ssrQuerySnapshot(key, converter) {
  const result = queryResult(key)
  if (!result) return undefined
  const docs = result.map(({ id, data }) => {
    const raw = revive(data)
    const snapshot = { id, exists: () => true, get: (field) => field.split('.').reduce((value, part) => value?.[part], raw), metadata: { fromCache: false, hasPendingWrites: false } }
    snapshot.data = () => raw
    const converted = converter ? converter.fromFirestore(snapshot) : raw
    return { ...snapshot, data: () => converted }
  })
  return { docs, size: docs.length, empty: docs.length === 0, metadata: { fromCache: false, hasPendingWrites: false }, forEach: (callback, thisArg) => docs.forEach(callback, thisArg) }
}

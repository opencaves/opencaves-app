import CaveAsset from '@/models/CaveAsset.js'
import { createCollectionModel } from '@/models/firestoreCollectionModel.js'
import { getSistemaMapRefs } from '@/utils/sistemaMaps.js'
import { breakpoints } from '@/theme/Theme.jsx'
import { PANE_WIDTH } from '@/config/app.js'

// Offline downloads, kept in caches of their own (no expiry, unlike the
// service worker's browsing caches): the service worker looks in these first
// for storage images and maps (see service-worker.js - keep names in sync).
// Each cache is reconciled against a wanted-URL list, so removing a saved
// cenote or turning previews off frees its files.
export const OFFLINE_SAVED_CAVES_CACHE = 'oc-offline-saved-caves-v1'
export const OFFLINE_PREVIEWS_CACHE = 'oc-offline-previews-v1'

const mapsModel = createCollectionModel('maps')
const DOWNLOAD_CONCURRENCY = 4

export const offlineSupported = typeof window !== 'undefined' && 'caches' in window

// Cellular connections and data-saver mode don't download (where the browser
// exposes them - navigator.connection is Chromium-only); the next sync on a
// better connection picks the downloads up.
export function isMeteredConnection() {
  const connection = navigator.connection
  return !!connection && (connection.saveData || connection.type === 'cellular')
}

export function canDownload() {
  return offlineSupported && navigator.onLine && !isMeteredConnection()
}

// Download status for the UI (useSyncExternalStore), keyed by
// previewsStatusKey / savedCaveStatusKey(caveId):
// { state: 'waiting' | 'downloading' | 'ready' | 'incomplete' | 'removing', done, total, failed }
export const previewsStatusKey = 'previews'
export const savedCaveStatusKey = (caveId) => `savedCave:${caveId}`

const status = {}
const listeners = new Set()

function setStatus(key, next) {
  status[key] = { ...status[key], ...next }
  listeners.forEach((listener) => listener())
}

function clearStatus(key) {
  if (!(key in status)) return
  delete status[key]
  listeners.forEach((listener) => listener())
}

export function subscribeToOfflineStatus(listener) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function getOfflineStatus(key) {
  return status[key]
}

export function getSavedCavesStatuses() {
  return Object.entries(status).filter(([key]) => key.startsWith('savedCave:'))
}

// Cenotes saved during this session: only these get a "now available
// offline" message when their download finishes. A new device downloading
// every earlier save shows its progress on the account page instead of a
// burst of messages.
const justSaved = new Set()

export function markJustSaved(caveId) {
  justSaved.add(caveId)
}

export function consumeJustSaved(caveId) {
  return justSaved.delete(caveId)
}

// Marks downloads as held back (offline, or metered connection) so the UI
// can say so instead of looking done.
export function setWaiting(key) {
  setStatus(key, { state: 'waiting' })
}

// Downloads `urls` into `cache` (CORS mode, like the app's <img crossOrigin>
// requests, so the service worker can serve them back to those), reporting
// progress. Failures are counted, not thrown - they're retried on the next
// sync.
async function downloadInto(cache, urls, { signal, onProgress }) {
  let downloaded = 0
  let failed = 0
  let next = 0

  async function worker() {
    while (next < urls.length && !signal?.aborted) {
      const url = urls[next++]
      try {
        const response = await fetch(url, { mode: 'cors', credentials: 'omit', signal })
        if (!response.ok) throw new Error(`HTTP ${response.status}`)
        await cache.put(url, response)
        downloaded++
      } catch (error) {
        if (signal?.aborted) return
        failed++
        console.warn('[offline] Could not download %s: %o', url, error)
      }
      onProgress?.({ downloaded, failed })
    }
  }

  await Promise.all(Array.from({ length: DOWNLOAD_CONCURRENCY }, worker))
  return { downloaded, failed }
}

async function openAndPrune(cacheName, wanted) {
  const cache = await caches.open(cacheName)
  const cachedRequests = await cache.keys()
  await Promise.all(cachedRequests.filter((request) => !wanted.has(request.url)).map((request) => cache.delete(request)))
  const cachedUrls = new Set(cachedRequests.map((request) => request.url).filter((url) => wanted.has(url)))
  return { cache, cachedUrls }
}

// Makes the previews cache hold exactly `urls`.
export async function syncPreviews(urls, { signal } = {}) {
  if (!offlineSupported) return null
  clearRun++ // stops a removal still running

  const wanted = new Set(urls)
  const { cache, cachedUrls } = await openAndPrune(OFFLINE_PREVIEWS_CACHE, wanted)
  const missing = [...wanted].filter((url) => !cachedUrls.has(url))
  const alreadyDone = wanted.size - missing.length
  setStatus(previewsStatusKey, { state: missing.length > 0 ? 'downloading' : 'ready', done: alreadyDone, total: wanted.size, failed: 0 })

  const result = await downloadInto(cache, missing, {
    signal,
    onProgress: ({ downloaded, failed }) => setStatus(previewsStatusKey, { done: alreadyDone + downloaded, failed }),
  })
  if (signal?.aborted) return null

  setStatus(previewsStatusKey, { state: result.failed > 0 ? 'incomplete' : 'ready' })
  return result
}

// Removes the previews, file by file with its progress (state 'removing':
// done files removed of total), taking at least CLEAR_MIN_MS so the bar can
// be seen deflating. A sync started meanwhile (the option turned back on)
// stops it.
const CLEAR_MIN_MS = 1200
let clearRun = 0

export async function clearPreviews() {
  if (!offlineSupported) return
  const run = ++clearRun
  const cache = await caches.open(OFFLINE_PREVIEWS_CACHE)
  const keys = await cache.keys()
  if (keys.length) {
    const started = Date.now()
    setStatus(previewsStatusKey, { state: 'removing', done: 0, total: keys.length, failed: 0 })
    const batch = Math.max(1, Math.ceil(keys.length / 30))
    for (let i = 0; i < keys.length; i += batch) {
      await Promise.all(keys.slice(i, i + batch).map((request) => cache.delete(request)))
      if (run !== clearRun) return
      const done = Math.min(keys.length, i + batch)
      setStatus(previewsStatusKey, { done })
      const behind = (CLEAR_MIN_MS * done) / keys.length - (Date.now() - started)
      if (behind > 0) await new Promise((resolve) => setTimeout(resolve, behind))
      if (run !== clearRun) return
    }
  }
  await caches.delete(OFFLINE_PREVIEWS_CACHE)
  clearStatus(previewsStatusKey)
}

// Makes the saved-cenotes cache hold exactly the files of `urlsByCave`
// ({ caveId: [urls] }), downloading one cenote at a time (in the given
// order - most recently saved first) so each one becomes fully available as
// soon as possible and gets its own progress. Calls onCaveDone(caveId,
// { downloaded, failed }) after each cenote that needed downloading.
export async function syncSavedCaves(urlsByCave, { signal, onCaveDone } = {}) {
  if (!offlineSupported) return

  const wanted = new Set(Object.values(urlsByCave).flat())
  const { cache, cachedUrls } = await openAndPrune(OFFLINE_SAVED_CAVES_CACHE, wanted)

  // Drop statuses of cenotes that are no longer saved.
  getSavedCavesStatuses().forEach(([key]) => {
    if (!Object.keys(urlsByCave).some((caveId) => savedCaveStatusKey(caveId) === key)) clearStatus(key)
  })

  const plans = Object.entries(urlsByCave).map(([caveId, urls]) => {
    const unique = [...new Set(urls)]
    return { caveId, total: unique.length, missing: unique.filter((url) => !cachedUrls.has(url)) }
  })
  plans.forEach(({ caveId, total, missing }) => {
    setStatus(savedCaveStatusKey(caveId), { state: missing.length > 0 ? 'downloading' : 'ready', done: total - missing.length, total, failed: 0 })
  })

  for (const { caveId, total, missing } of plans) {
    if (signal?.aborted) return
    if (missing.length === 0) continue

    // Files shared with a cenote downloaded earlier in this run (same
    // sistema's maps) are already in the cache by now.
    const stillMissing = []
    for (const url of missing) {
      if (!(await cache.match(url))) stillMissing.push(url)
    }
    const alreadyDone = total - stillMissing.length
    const key = savedCaveStatusKey(caveId)

    const result = await downloadInto(cache, stillMissing, {
      signal,
      onProgress: ({ downloaded, failed }) => setStatus(key, { done: alreadyDone + downloaded, failed }),
    })
    if (signal?.aborted) return

    setStatus(key, { state: result.failed > 0 ? 'incomplete' : 'ready' })
    onCaveDone?.(caveId, result)
  }
}

// Frees everything downloaded for offline use or cached while browsing
// (pictures, maps, map tiles), keeping the app's own precached files
// (Workbox's 'oc-app-...' cache) so the app itself still starts offline.
// Firestore's offline copy of the cave data is left alone too - it's small
// and the app can't show anything without it.
export async function clearOfflineMedia() {
  if (!offlineSupported) return
  const names = await caches.keys()
  await Promise.all(names.filter((name) => !name.startsWith('oc-app-')).map((name) => caches.delete(name)))
  clearStatus(previewsStatusKey)
  getSavedCavesStatuses().forEach(([key]) => clearStatus(key))
}

// The one large size the picture viewers (sizes="(min-width: md)
// calc(100vw - PANE_WIDTH), 100vw", candidates 1024/1536/4k) would request on
// this device - downloading all three would mostly waste space on 4k.
function viewerDimension() {
  const cssWidth = window.innerWidth >= breakpoints.md ? window.innerWidth - PANE_WIDTH : window.innerWidth
  const needed = cssWidth * (window.devicePixelRatio || 1)
  return needed <= 1024 ? '1024' : needed <= 1536 ? '1536' : '4k'
}

// Everything a saved cenote shows: its pictures at the sizes the app displays
// (thumbnails, cover, the viewer size for this device, panoramas' originals),
// and its sistema's and ancestor sistemas' maps (their WebP/SVG viewing
// copies and thumbnails - not the original uploads).
export async function getSavedCaveUrls(caveId, { caves, sistemas, connections }) {
  const urls = []
  const fullSize = viewerDimension()

  for (const asset of await CaveAsset.getImages(caveId)) {
    urls.push(asset.getThumbnailUrl('resultThumbnail'), asset.getThumbnailUrl('mediaThumbnail'), asset.getThumbnailUrl(fullSize))
    if (asset.isCover) urls.push(asset.getThumbnailUrl('coverImage'))
    if (asset.usePanoramaViewer && asset.url) urls.push(asset.url)
  }

  const cave = caves.find((c) => c.id === caveId)
  const mapRefs = getSistemaMapRefs(cave?.sistemaId, sistemas, connections)
  const maps = await Promise.all(mapRefs.map(({ id }) => mapsModel.getById(id)))
  maps.filter(Boolean).forEach((map) => urls.push(...mapUrls(map)))

  return urls.filter(Boolean)
}

// A map's display files: its WebP/SVG viewing copies and thumbnail, not the
// original upload (except image maps from before WebP conversion existed,
// which only have the original).
function mapUrls(map) {
  const urls = []
  if (map.thumbnailUrl) urls.push(map.thumbnailUrl)
  if (map.previewUrls?.length) urls.push(...map.previewUrls)
  else if (map.previewUrl) urls.push(map.previewUrl)
  else if (map.contentType?.startsWith('image/')) urls.push(map.url)
  return urls
}

// The "Offline" setting: every cave's cover thumbnail and every map.
export async function getPreviewUrls() {
  const [covers, maps] = await Promise.all([CaveAsset.getAllCoverImages(), mapsModel.getAll()])
  return [...covers.map((asset) => asset.getThumbnailUrl('coverImage')), ...maps.flatMap(mapUrls)].filter(Boolean)
}

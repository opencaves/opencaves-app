import { gunzipSync, gzipSync } from 'node:zlib'

// How far each unconfirmed cave (a location whose validity isn't 'valid') is
// from the nearest way a person can walk ("path") and the nearest a car can
// drive ("road"), measured on OpenStreetMap's highways: for a field trip to
// confirm its coordinates, the easiest to reach first (/caves?missing=position
// &sort=road). The roads are downloaded from Overpass (one query, around the
// located caves), kept in Storage ({@link ROADS_FILE}), and each cave's
// distances written on it as roadDistance (server-only, like shareImage):
//   { path: {m, kind, name?}|null, road: {m, kind, name?}|null, within,
//     from: {latitude, longitude}, at }
// - null: no such way within `within` metres; from: the coordinates measured
// from (the app shows nothing once the cave has moved); at: the roads'
// download day. Shared by the functions (roads/refreshRoadDistances.js) and
// scripts/road-distances.js: no Firebase import here, the bucket and the
// database are given.

/**
 * The OpenStreetMap highway kinds measured to, by kind of way. road: what a
 * car can use - the classified roads and their links, the streets, service
 * ways (driveways, parking aisles: a cenote's own access often is one) and
 * tracks (dirt roads to a ranch or a cenote, passable by car most of the time
 * in the region). path: what a person can walk - every road, plus the ways
 * for walkers, cyclists and riders. Left out: ways not built (construction,
 * proposed, planned, abandoned), indoor ones (corridor), areas and stops
 * (rest_area, platform...), raceways. A way's access tags (private, no) are
 * not read: a private track to a cenote still shows the way in.
 */
export const HIGHWAY_KINDS = (() => {
  const road = ['motorway', 'motorway_link', 'trunk', 'trunk_link', 'primary', 'primary_link', 'secondary', 'secondary_link', 'tertiary', 'tertiary_link', 'unclassified', 'residential', 'living_street', 'service', 'track', 'road']
  return { road, path: [...road, 'path', 'footway', 'pedestrian', 'steps', 'cycleway', 'bridleway'] }
})()

/** The roads file in Storage: gzip JSON ({@link encodeRoads}). Public, as all of the bucket (OSM data: ODbL). */
export const ROADS_FILE = 'roads/roads.json.gz'

/** How far around the caves the roads are downloaded, and the farthest distance measured (metres). */
export const ROADS_MARGIN_M = 5000

// The located caves are grouped in cells this size (degrees), each cell
// downloaded with the margin around it: the roads near the caves, wherever
// they are - not every road of one box spanning them all.
const CELL_DEGREES = 0.25

/** Overpass API: one query per download. */
export const OVERPASS_URL = 'https://overpass-api.de/api/interpreter'
/** Overpass asks its users to name themselves. */
export const OVERPASS_USER_AGENT = 'OpenCaves road distances (https://opencaves.org; https://github.com/opencaves/opencaves-app)'
// The query's own time limit (seconds) on Overpass's side, and ours.
const OVERPASS_TIMEOUT_S = 600
// Overpass's answers when busy, and the waits before asking again (ms).
const BUSY_STATUSES = [429, 502, 503, 504]
const RETRY_DELAYS_MS = [30000, 60000, 120000]
// A download with far fewer ways than the previous file is taken for a
// partial answer, not kept (the previous file stays).
const MIN_WAYS_RATIO = 0.5

// Metres per degree of latitude (the mean Earth radius's), and of longitude
// at the equator: a local flat projection, fine within a few kilometres.
const METRES_PER_DEGREE = (6371008.8 * Math.PI) / 180
// The spatial index's cells (degrees): ~1 km.
const INDEX_CELL_DEGREES = 0.01

/**
 * Whether a cave gets road distances: located, its position not confirmed.
 *
 * @param {Cave|null|undefined} cave
 * @returns {boolean}
 */
export function needsRoadDistance(cave) {
  const location = cave?.location
  return typeof location?.latitude === 'number' && typeof location?.longitude === 'number' && location.validity !== 'valid'
}

/**
 * The areas the roads are downloaded for: one box per {@link CELL_DEGREES}
 * cell holding a located cave, the margin around it, as [west, south, east,
 * north] - and the box around them all.
 *
 * @param {Cave[]} caves
 * @param {number} [margin=ROADS_MARGIN_M] - Metres.
 * @returns {{boxes: number[][], bbox: number[]|null}}
 */
export function roadBoxes(caves, margin = ROADS_MARGIN_M) {
  const cells = new Map()
  for (const cave of caves) {
    const { latitude, longitude } = cave.location || {}
    if (typeof latitude !== 'number' || typeof longitude !== 'number') continue
    const x = Math.floor(longitude / CELL_DEGREES)
    const y = Math.floor(latitude / CELL_DEGREES)
    cells.set(`${x},${y}`, [x, y])
  }
  const round = (value) => Math.round(value * 1e5) / 1e5
  const boxes = [...cells.values()].sort((a, b) => a[1] - b[1] || a[0] - b[0]).map(([x, y]) => {
    const south = y * CELL_DEGREES
    const north = south + CELL_DEGREES
    const dLat = margin / METRES_PER_DEGREE
    // The cell's widest margin in longitude: at its latitude nearest a pole.
    const dLon = margin / (METRES_PER_DEGREE * Math.max(0.01, Math.cos((Math.max(Math.abs(south), Math.abs(north)) * Math.PI) / 180)))
    return [round(x * CELL_DEGREES - dLon), round(Math.max(-90, south - dLat)), round((x + 1) * CELL_DEGREES + dLon), round(Math.min(90, north + dLat))]
  })
  const bbox = boxes.length ? [Math.min(...boxes.map((b) => b[0])), Math.min(...boxes.map((b) => b[1])), Math.max(...boxes.map((b) => b[2])), Math.max(...boxes.map((b) => b[3]))] : null
  return { boxes, bbox }
}

/**
 * The Overpass QL query for the {@link HIGHWAY_KINDS.path} ways in these
 * boxes: their tags and geometry.
 *
 * @param {number[][]} boxes - [west, south, east, north] each.
 * @returns {string}
 */
export function overpassQuery(boxes) {
  const kinds = `^(${HIGHWAY_KINDS.path.join('|')})$`
  const parts = boxes.map(([west, south, east, north]) => `way["highway"~"${kinds}"](${south},${west},${north},${east});`)
  return `[out:json][timeout:${OVERPASS_TIMEOUT_S}];(${parts.join('')});out tags geom;`
}

/**
 * Downloads the ways in these boxes from Overpass ({@link overpassQuery})
 * and keeps what the distances need ({@link simplifyOverpass}); asked again
 * after a wait when Overpass is busy ({@link BUSY_STATUSES}).
 *
 * @param {number[][]} boxes
 * @param {object} [options]
 * @param {typeof fetch} [options.fetchImpl=fetch]
 * @param {Date} [options.now=new Date()]
 * @param {number[]} [options.retryDelaysMs=RETRY_DELAYS_MS] - The waits before asking again when Overpass is busy.
 * @returns {Promise<RoadsFile>}
 * @throws {Error} When Overpass answers with an error, times out or sends no ways.
 */
export async function downloadRoads(boxes, { fetchImpl = fetch, now = new Date(), retryDelaysMs = RETRY_DELAYS_MS } = {}) {
  if (!boxes.length) throw new Error('No located cave: no roads to download')
  const body = new URLSearchParams({ data: overpassQuery(boxes) }).toString()
  for (let attempt = 0; ; attempt++) {
    const response = await fetchImpl(OVERPASS_URL, {
      method: 'POST',
      headers: { 'User-Agent': OVERPASS_USER_AGENT, 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
      signal: AbortSignal.timeout((OVERPASS_TIMEOUT_S + 60) * 1000),
    })
    // Busy (too many requests, its queue full): asked again later, as
    // Overpass asks - a few times, waiting longer each time.
    if (BUSY_STATUSES.includes(response.status) && attempt < retryDelaysMs.length) {
      await response.body?.cancel()
      await new Promise((resolve) => setTimeout(resolve, retryDelaysMs[attempt]))
      continue
    }
    if (!response.ok) throw new Error(`Overpass ${response.status}: ${(await response.text()).slice(0, 300)}`)
    const json = await response.json()
    // A query cut short still answers 200, with a remark.
    if (json.remark) throw new Error(`Overpass: ${String(json.remark).slice(0, 300)}`)
    const roads = simplifyOverpass(json, boxes, now)
    if (!roads.ways.length) throw new Error('Overpass sent no ways')
    return roads
  }
}

/**
 * The roads file from Overpass's answer: each way's highway kind, name and
 * points ([lon, lat, lon, lat...], 6 decimals), with the download's date and
 * the boxes it covers.
 *
 * @param {{elements?: {type: string, tags?: Record<string, string>, geometry?: {lat: number, lon: number}[]}[], osm3s?: {timestamp_osm_base?: string}}} json
 * @param {number[][]} boxes
 * @param {Date} [now=new Date()]
 * @returns {RoadsFile}
 */
export function simplifyOverpass(json, boxes, now = new Date()) {
  const kinds = new Set(HIGHWAY_KINDS.path)
  const round = (value) => Math.round(value * 1e6) / 1e6
  const seen = new Set()
  const ways = []
  for (const element of json.elements || []) {
    const kind = element.tags?.highway
    if (element.type !== 'way' || !kinds.has(kind) || !Array.isArray(element.geometry) || element.geometry.length < 2) continue
    // A way in two boxes comes once (the union), but be sure.
    if (element.id != null && seen.has(element.id)) continue
    seen.add(element.id)
    const way = /** @type {RoadWay} */ ({ k: kind, c: element.geometry.flatMap(({ lon, lat }) => [round(lon), round(lat)]) })
    const name = element.tags?.name || element.tags?.ref
    if (name) way.n = String(name).slice(0, 120)
    ways.push(way)
  }
  return { version: 1, source: 'OpenStreetMap', licence: 'ODbL', downloadedAt: now.toISOString(), osmBase: json.osm3s?.timestamp_osm_base || null, margin: ROADS_MARGIN_M, boxes, ways }
}

/**
 * Whether a new download looks complete next to the previous file: at
 * least {@link MIN_WAYS_RATIO} of its ways.
 *
 * @param {RoadsFile} roads
 * @param {RoadsFile|null} previous
 * @returns {boolean}
 */
export function plausibleRoads(roads, previous) {
  return !previous?.ways?.length || roads.ways.length >= previous.ways.length * MIN_WAYS_RATIO
}

/**
 * The roads file as stored: gzip JSON.
 *
 * @param {RoadsFile} roads
 * @returns {Buffer}
 */
export function encodeRoads(roads) {
  return gzipSync(Buffer.from(JSON.stringify(roads)))
}

/**
 * The roads file from its stored bytes ({@link encodeRoads}).
 *
 * @param {Buffer} bytes
 * @returns {RoadsFile}
 */
export function decodeRoads(bytes) {
  return JSON.parse(gunzipSync(bytes).toString('utf8'))
}

/**
 * The stored roads file, or null when there's none yet.
 *
 * @param {import('@google-cloud/storage').Bucket} bucket
 * @returns {Promise<{roads: RoadsFile, generation: string}|null>}
 */
export async function loadRoads(bucket) {
  const file = bucket.file(ROADS_FILE)
  const [exists] = await file.exists()
  if (!exists) return null
  const [[metadata], [bytes]] = await Promise.all([file.getMetadata(), file.download()])
  return { roads: decodeRoads(bytes), generation: String(metadata.generation) }
}

/**
 * Stores the roads file ({@link ROADS_FILE}), replacing the previous one.
 *
 * @param {import('@google-cloud/storage').Bucket} bucket
 * @param {RoadsFile} roads
 * @returns {Promise<void>}
 */
export async function saveRoads(bucket, roads) {
  await bucket.file(ROADS_FILE).save(encodeRoads(roads), { resumable: false, contentType: 'application/gzip', metadata: { cacheControl: 'no-cache', metadata: { downloadedAt: roads.downloadedAt } } })
}

/**
 * The roads' segments in a grid ({@link INDEX_CELL_DEGREES} cells), for
 * {@link nearestWays}.
 *
 * @param {RoadsFile} roads
 * @returns {RoadIndex}
 */
export function roadIndex(roads) {
  const roadKinds = new Set(HIGHWAY_KINDS.road)
  let count = 0
  for (const way of roads.ways) count += way.c.length / 2 - 1
  const ax = new Float64Array(count)
  const ay = new Float64Array(count)
  const bx = new Float64Array(count)
  const by = new Float64Array(count)
  const wayOf = new Int32Array(count)
  const grid = new Map()
  let s = 0
  roads.ways.forEach((way, index) => {
    for (let i = 0; i + 3 < way.c.length; i += 2, s++) {
      ax[s] = way.c[i]
      ay[s] = way.c[i + 1]
      bx[s] = way.c[i + 2]
      by[s] = way.c[i + 3]
      wayOf[s] = index
      const x0 = Math.floor(Math.min(ax[s], bx[s]) / INDEX_CELL_DEGREES)
      const x1 = Math.floor(Math.max(ax[s], bx[s]) / INDEX_CELL_DEGREES)
      const y0 = Math.floor(Math.min(ay[s], by[s]) / INDEX_CELL_DEGREES)
      const y1 = Math.floor(Math.max(ay[s], by[s]) / INDEX_CELL_DEGREES)
      for (let x = x0; x <= x1; x++) {
        for (let y = y0; y <= y1; y++) {
          const key = `${x},${y}`
          const cell = grid.get(key)
          if (cell) cell.push(s)
          else grid.set(key, [s])
        }
      }
    }
  })
  return { ways: roads.ways, isRoad: roads.ways.map((way) => roadKinds.has(way.k)), ax, ay, bx, by, wayOf, grid, boxes: roads.boxes || [], margin: roads.margin || ROADS_MARGIN_M, at: String(roads.downloadedAt || '').slice(0, 10) }
}

// The distance (metres) from the origin to the segment (x1, y1)-(x2, y2), on
// a flat plane.
function segmentDistance(x1, y1, x2, y2) {
  const dx = x2 - x1
  const dy = y2 - y1
  const length2 = dx * dx + dy * dy
  const t = length2 > 0 ? Math.max(0, Math.min(1, -(x1 * dx + y1 * dy) / length2)) : 0
  return Math.hypot(x1 + t * dx, y1 + t * dy)
}

/**
 * Whether a point is in the area the roads cover (one of its boxes).
 *
 * @param {RoadIndex} index
 * @param {{latitude: number, longitude: number}} point
 * @returns {boolean}
 */
export function coversPoint(index, point) {
  return index.boxes.some(([west, south, east, north]) => point.longitude >= west && point.longitude <= east && point.latitude >= south && point.latitude <= north)
}

/**
 * The nearest path and road to a point, within the roads' margin: each {m
 * (whole metres), kind (its highway tag), name?}, or null when there's none
 * that near. Searched ring by ring of the index's cells, until no nearer
 * segment can be.
 *
 * @param {RoadIndex} index
 * @param {{latitude: number, longitude: number}} point
 * @returns {{path: RoadDistanceWay|null, road: RoadDistanceWay|null}}
 */
export function nearestWays(index, point) {
  const { latitude, longitude } = point
  const kx = METRES_PER_DEGREE * Math.cos((latitude * Math.PI) / 180)
  const ky = METRES_PER_DEGREE
  const cx = Math.floor(longitude / INDEX_CELL_DEGREES)
  const cy = Math.floor(latitude / INDEX_CELL_DEGREES)
  // A cell's smaller side, in metres: a ring r away is at least (r - 1) of them away.
  const cellMetres = INDEX_CELL_DEGREES * Math.min(kx, ky)
  const maxRing = Math.ceil(index.margin / cellMetres) + 1
  const best = { path: { m: Infinity, s: -1 }, road: { m: Infinity, s: -1 } }
  const seen = new Set()
  for (let r = 0; r <= maxRing; r++) {
    const nearest = Math.max(0, (r - 1) * cellMetres)
    if (nearest > index.margin || (best.road.s >= 0 && nearest > best.road.m)) break
    for (let x = cx - r; x <= cx + r; x++) {
      for (let y = cy - r; y <= cy + r; y++) {
        if (Math.max(Math.abs(x - cx), Math.abs(y - cy)) !== r) continue
        const cell = index.grid.get(`${x},${y}`)
        if (!cell) continue
        for (const s of cell) {
          if (seen.has(s)) continue
          seen.add(s)
          const m = segmentDistance((index.ax[s] - longitude) * kx, (index.ay[s] - latitude) * ky, (index.bx[s] - longitude) * kx, (index.by[s] - latitude) * ky)
          if (m < best.path.m) best.path = { m, s }
          if (m < best.road.m && index.isRoad[index.wayOf[s]]) best.road = { m, s }
        }
      }
    }
  }
  const way = ({ m, s }) => {
    if (s < 0 || m > index.margin) return null
    const found = index.ways[index.wayOf[s]]
    return { m: Math.round(m), kind: found.k, ...(found.n && { name: found.n }) }
  }
  return { path: way(best.path), road: way(best.road) }
}

/**
 * A cave's roadDistance field as the roads give it ({@link nearestWays}, from
 * its coordinates, on the roads' download day), or null when it gets none
 * ({@link needsRoadDistance}) or is outside the area the roads cover.
 *
 * @param {RoadIndex} index
 * @param {Cave} cave
 * @returns {RoadDistance|null}
 */
export function roadDistanceOf(index, cave) {
  if (!needsRoadDistance(cave)) return null
  const from = { latitude: cave.location.latitude, longitude: cave.location.longitude }
  if (!coversPoint(index, from)) return null
  const { path, road } = nearestWays(index, from)
  return { path, road, within: index.margin, from, at: index.at }
}

// Whether two roadDistance values are the same (key order aside).
const sameValue = (a, b) => JSON.stringify(sortKeys(a ?? null)) === JSON.stringify(sortKeys(b ?? null))
function sortKeys(value) {
  if (Array.isArray(value)) return value.map(sortKeys)
  if (value && typeof value === 'object') return Object.fromEntries(Object.keys(value).sort().map((key) => [key, sortKeys(value[key])]))
  return value
}

/**
 * What a cave's roadDistance should become: 'set' (a new or changed value),
 * 'removed' (it has one, and should have none: its position confirmed, its
 * location gone, out of the roads' area), or 'unchanged'.
 *
 * @param {RoadIndex|null} index - null: no roads file yet (only removals).
 * @param {Cave} cave
 * @returns {{action: 'set'|'removed'|'unchanged', value: RoadDistance|null}}
 */
export function roadDistanceChange(index, cave) {
  const value = index ? roadDistanceOf(index, cave) : null
  if (value) return { action: sameValue(value, cave.roadDistance) ? 'unchanged' : 'set', value }
  // None to give: one it has goes - unless there are no roads yet to tell
  // (a cave still to confirm keeps its distances).
  const removed = Boolean(cave.roadDistance) && (Boolean(index) || !needsRoadDistance(cave))
  return { action: removed ? 'removed' : 'unchanged', value: null }
}

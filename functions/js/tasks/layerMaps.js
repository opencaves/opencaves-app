import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { logger } from 'firebase-functions/v2'
import { LAYER_CONFIGS_PATH, LAYER_MAPS_PATH, SITE_URL } from '../constants.js'

// Which maps the cave layer already has. The source: the two files the tiles
// build publishes with the tiles (scripts/map-layer/build-tiles.js), on the
// site itself - maps.json, the traced maps by layer id, each with its "maps"
// document (mapId for a map added in the app, mapImportKey for the bulk
// import's), its system and its date; configs.json, every config's map,
// traced, untraced or unverified. Chosen over anything new because they are
// the layer as deployed (a map counts once its tiles are live), the Map layers
// page already reads configs.json for its To process tab, and the configs
// themselves (scripts/map-layer/maps/) aren't deployed. In the emulators: the
// files of the last local build (public/tiles/caves/), which the local site
// serves.
const IS_EMULATOR = process.env.FUNCTIONS_EMULATOR === 'true'
const LOCAL_TILES = path.resolve(import.meta.dirname, '../../../public')
// Read again after this long (a deploy brings new tiles).
const CACHE_MS = 10 * 60 * 1000

let cached = null

async function readLayerFile(file) {
  if (IS_EMULATOR) return JSON.parse(await readFile(path.join(LOCAL_TILES, file), 'utf8'))
  const response = await fetch(`${SITE_URL}${file}`)
  if (!response.ok) throw new Error(`${file}: ${response.status}`)
  return response.json()
}

/**
 * The cave layer's maps: `traced`, the maps drawn in it ({ mapId?,
 * mapImportKey?, sistemaId?, date?, title }), and `configured`, the ids of
 * the "maps" documents a config names (traced or still being worked on: the
 * Map layers page's To process tab leaves them out). Cached for
 * {@link CACHE_MS}; null when the files can't be read (no tiles built yet, the
 * site down): the callers then leave the layer out of their checks.
 *
 * @param {object} [options]
 * @param {boolean} [options.fresh=false] - Read the files again.
 * @returns {Promise<{traced: LayerMap[], configured: Set<string>}|null>}
 */
export async function loadLayerMaps({ fresh = false } = {}) {
  if (!fresh && cached && Date.now() - cached.at < CACHE_MS) return cached.value
  try {
    const [maps, configs] = await Promise.all([readLayerFile(LAYER_MAPS_PATH), readLayerFile(LAYER_CONFIGS_PATH)])
    const traced = Object.values(maps || {}).map((map) => ({ ...(map.mapId && { mapId: map.mapId }), ...(map.mapImportKey && { mapImportKey: map.mapImportKey }), ...(map.sistemaId && { sistemaId: map.sistemaId }), ...(map.date && { date: String(map.date) }), title: map.title || map.name }))
    const configured = new Set([...(configs || []).map((config) => config.mapId), ...traced.map((map) => map.mapId)].filter(Boolean))
    const value = { traced, configured }
    cached = { at: Date.now(), value }
    return value
  } catch (error) {
    logger.warn('[tasks] the cave layer\'s maps could not be read', { error: error.message })
    return null
  }
}

/**
 * Whether partial date `a` ("2012", "2012-10", "2012-10-03") is later than
 * `b`, compared to the precision both have: "2013" is later than "2012-10",
 * "2012-11" than "2012-10", but "2012-10" isn't later than "2012" (the same
 * year, as far as both say). A missing or unreadable date is never later.
 *
 * @param {string} [a]
 * @param {string} [b]
 * @returns {boolean}
 */
export function isLaterDate(a, b) {
  const parts = (value) => /^(\d{4})(?:-(\d{2}))?(?:-(\d{2}))?/.exec(String(value || '').trim())?.slice(1).filter(Boolean) || []
  const [pa, pb] = [parts(a), parts(b)]
  if (!pa.length || !pb.length) return false
  const length = Math.min(pa.length, pb.length)
  return pa.slice(0, length).join('-') > pb.slice(0, length).join('-')
}

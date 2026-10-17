import { SITE_URL } from '@/config/app.js'
import { formatMeasuredDistance } from './units.js'

// A cave's road distances (its roadDistance, written by the server:
// functions/js/roads/roadDistances.js) as the caves' list to confirm shows
// them (/caves?missing=position): its sort ("Easiest to reach first"), each
// row's line, the GPX file of the list.

/** The orders of the caves still to confirm within each area: A to Z (the list's own), or by road distance. */
export const CAVE_SORTS = ['area', 'road']
/** The list's order when the address names none. */
export const DEFAULT_CAVE_SORT = 'area'

/**
 * A cave's road distances to show, or null: none, its position confirmed, or
 * measured from other coordinates than its own (it moved since).
 *
 * @param {{location?: {latitude?: number, longitude?: number, validity?: string}, roadDistance?: RoadDistance}} cave
 * @returns {RoadDistance|null}
 */
export function shownRoadDistance(cave) {
  const distance = cave?.roadDistance
  const location = cave?.location
  if (!distance?.from || location?.latitude == null || location?.longitude == null || location.validity === 'valid') return null
  return distance.from.latitude === location.latitude && distance.from.longitude === location.longitude ? distance : null
}

/**
 * The caves in the "Easiest to reach first" order: the nearest a road first,
 * then the nearest a path, then by name; those without distances last
 * (their order kept).
 *
 * @template {{roadDistance?: RoadDistance|null}} T
 * @param {T[]} caves - Their road distances already checked ({@link shownRoadDistance}).
 * @returns {T[]}
 */
export function sortByRoadDistance(caves) {
  const far = Number.POSITIVE_INFINITY
  const road = (cave) => (cave.roadDistance ? (cave.roadDistance.road?.m ?? far) : null)
  const path = (cave) => cave.roadDistance?.path?.m ?? far
  return caves
    .map((cave, index) => ({ cave, index }))
    .sort((a, b) => {
      const ra = road(a.cave)
      const rb = road(b.cave)
      if (ra === null || rb === null) return ra === rb ? a.index - b.index : ra === null ? 1 : -1
      return ra - rb || path(a.cave) - path(b.cave) || a.index - b.index
    })
    .map(({ cave }) => cave)
}

/**
 * A cave's road distances in a short line ("≈ path 120 m · road 1.8 km"),
 * in the reader's units; the path left out when it's the road itself. Null
 * without distances.
 *
 * @param {RoadDistance|null} distance
 * @param {(key: string, options?: object) => string} t - The indexPages namespace's.
 * @param {'metric'|'imperial'} units
 * @param {string} locale
 * @returns {string|null}
 */
export function roadDistanceText(distance, t, units, locale) {
  if (!distance) return null
  const length = (metres) => formatMeasuredDistance(metres, units, locale)
  const { path, road } = distance
  const within = length(distance.within)
  if (!path) return t('caves.toConfirm.distance.none', { within })
  if (!road) return t('caves.toConfirm.distance.pathOnly', { path: length(path.m), within })
  if (path.m < road.m) return t('caves.toConfirm.distance.pathAndRoad', { path: length(path.m), road: length(road.m) })
  return t('caves.toConfirm.distance.road', { road: length(road.m) })
}

// Text for XML (an element's content or an attribute's value).
const xml = (value) => String(value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

/**
 * A GPX 1.1 file of caves: a waypoint each, in their order - its name, its
 * description (its distances, the nearest road's name) and a link to its
 * page.
 *
 * @param {object} file
 * @param {string} file.name - The file's name (its metadata).
 * @param {string} file.link - The list's address.
 * @param {{id: string, name: string, latitude: number, longitude: number, description?: string|null}[]} file.waypoints
 * @param {Date} [file.time=new Date()]
 * @returns {string}
 */
export function gpxFile({ name, link, waypoints, time = new Date() }) {
  const points = waypoints.map(({ id, name: label, latitude, longitude, description }) => [
    `  <wpt lat="${latitude}" lon="${longitude}">`,
    `    <name>${xml(label)}</name>`,
    ...(description ? [`    <desc>${xml(description)}</desc>`] : []),
    `    <link href="${xml(`${SITE_URL}/caves/${encodeURIComponent(id)}`)}"><text>OpenCaves</text></link>`,
    '  </wpt>',
  ].join('\n'))
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<gpx version="1.1" creator="OpenCaves" xmlns="http://www.topografix.com/GPX/1/1" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:schemaLocation="http://www.topografix.com/GPX/1/1 http://www.topografix.com/GPX/1/1/gpx.xsd">',
    '  <metadata>',
    `    <name>${xml(name)}</name>`,
    `    <link href="${xml(link)}"><text>OpenCaves</text></link>`,
    `    <time>${time.toISOString()}</time>`,
    '  </metadata>',
    ...points,
    '</gpx>',
    '',
  ].join('\n')
}

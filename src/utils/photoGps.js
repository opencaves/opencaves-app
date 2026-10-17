import { PHOTO_GPS_MAX_DISTANCE } from '@/config/mediaPane.js'
import { distanceMetres } from './geoDistance.js'

/**
 * The photo's GPS position from its EXIF tags, or null (none, or unreadable).
 * exifr's lite build, loaded only when a photo is checked.
 *
 * @param {File} file
 * @returns {Promise<{latitude: number, longitude: number}|null>}
 */
async function photoPosition(file) {
  try {
    const { gps } = await import('exifr/dist/lite.esm.mjs')
    const position = await gps(file)
    return Number.isFinite(position?.latitude) && Number.isFinite(position?.longitude) ? position : null
  } catch {
    return null
  }
}

// The cave's known points - every coordinate field it has: its position, its
// entrance, its parking and where its key is (a photo can be of the gate or
// fence there, or of the sign at the parking),
// those marked invalid left out.
function cavePoints(cave) {
  const { location, entrance, parking, keys } = cave || {}
  return [location, entrance, parking, ...(Array.isArray(keys) ? keys : [])].filter(
    (point) => Number.isFinite(point?.latitude) && Number.isFinite(point?.longitude) && point.validity !== 'invalid',
  )
}

/**
 * The photos taken farther than {@link PHOTO_GPS_MAX_DISTANCE} from every one of the
 * cave's points, with their distance to the nearest one: [{ file, distance }]. A photo without
 * GPS tags, or a cave without coordinates, passes.
 *
 * @param {File[]} files
 * @param {Cave} cave
 * @returns {Promise<{file: File, distance: number}[]>}
 */
export async function photosFarFromCave(files, cave) {
  const points = cavePoints(cave)
  if (!points.length) return []
  const far = []
  for (const file of files) {
    const position = await photoPosition(file)
    if (!position) continue
    const distance = Math.min(...points.map((point) => distanceMetres(position, point)))
    if (distance > PHOTO_GPS_MAX_DISTANCE) far.push({ file, distance })
  }
  return far
}

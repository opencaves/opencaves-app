import { HOME_AREA_BBOX } from '@/config/map.js'

/**
 * The box around the caves with coordinates inside the home area
 * ({@link HOME_AREA_BBOX}), as [[west, south], [east, north]] for the map's fitBounds -
 * or null when there are none.
 *
 * @param {object[]} caves
 * @returns {[[number, number], [number, number]]|null}
 */
export function homeBounds(caves) {
  const [west, south, east, north] = HOME_AREA_BBOX
  let box = null
  for (const cave of caves || []) {
    const { longitude, latitude } = cave.location || {}
    if (!Number.isFinite(longitude) || !Number.isFinite(latitude)) continue
    if (longitude < west || longitude > east || latitude < south || latitude > north) continue
    box = box ? [[Math.min(box[0][0], longitude), Math.min(box[0][1], latitude)], [Math.max(box[1][0], longitude), Math.max(box[1][1], latitude)]] : [[longitude, latitude], [longitude, latitude]]
  }
  return box
}

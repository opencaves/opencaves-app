import { MAP_PROPS } from '@/config/map.js'

// The app's map style (MAP_PROPS.mapStyle, "mapbox://styles/<owner>/<id>"),
// for Mapbox's Static Images API.
const STYLE_PATH = MAP_PROPS.mapStyle.replace('mapbox://styles/', '')

/**
 * The address of a still image of the app's map around a point, with a pin
 * on it (Mapbox's Static Images API, the app's style and token; Mapbox's logo
 * and attribution kept, as its terms ask), drawn at twice the size for
 * high-density screens.
 *
 * @param {{latitude: number, longitude: number}} point
 * @param {object} [options]
 * @param {string} [options.color='d9b504'] - The pin's colour, hex without "#" (the app's gold).
 * @param {number} [options.zoom=13]
 * @param {number} [options.width=480] - In CSS pixels (at most 1280).
 * @param {number} [options.height=360] - In CSS pixels (at most 1280).
 * @returns {string}
 */
export function staticMapUrl({ latitude, longitude }, { color = 'd9b504', zoom = 13, width = 480, height = 360 } = {}) {
  const at = `${Number(longitude).toFixed(5)},${Number(latitude).toFixed(5)}`
  const pin = `pin-l+${color.replace('#', '').toLowerCase()}(${at})`
  return `https://api.mapbox.com/styles/v1/${STYLE_PATH}/static/${pin}/${at},${zoom}/${width}x${height}@2x?access_token=${import.meta.env.VITE_MAPBOX_ACCESS_TOKEN}`
}

import { isMapPath } from '@/redux/slices/sessionSlice.jsx'

// The map position in the URL hash (#zoom/latitude/longitude, mapbox-gl's own
// `hash` format). Synced here rather than with mapbox-gl's `hash` option,
// which rewrites the hash on whatever the current URL is: the map stays
// mounted under modal routes such as /about, which must not get it.
const locationHashRegEx = /^#(?<zoom>\d+(\.\d+)?)\/(?<latitude>[+-]?\d+(\.\d+)?)\/(?<longitude>[+-]?\d+(\.\d+)?)$/

/**
 * The map's view from the address's hash, or null when it has none.
 *
 * @returns {{zoom: number, latitude: number, longitude: number}|null}
 */
export function locationViewState() {
  const groups = locationHashRegEx.exec(window.location.hash)?.groups

  if (groups) {
    return {
      zoom: parseFloat(groups.zoom),
      latitude: parseFloat(groups.latitude),
      longitude: parseFloat(groups.longitude),
    }
  }

  return null
}

// Same rounding as mapbox-gl: coordinate precision grows with the zoom.
function mapHashString(map) {
  const center = map.getCenter()
  const zoom = Math.round(map.getZoom() * 100) / 100
  const precision = Math.ceil((zoom * Math.LN2 + Math.log(512 / 360 / 0.5)) / Math.LN10)
  const m = Math.pow(10, precision)
  return `#${zoom}/${Math.round(center.lat * m) / m}/${Math.round(center.lng * m) / m}`
}

/**
 * replaceState (not a router navigation) so moving the map doesn't add
 * history entries or re-render routes; history.state is kept for the router.
 *
 * @param {mapboxgl.Map} map
 */
export function writeMapHash(map) {
  const { pathname, search } = window.location
  if (!map || !isMapPath(pathname)) {
    return
  }
  const hash = mapHashString(map)
  if (window.location.hash !== hash) {
    window.history.replaceState(window.history.state, '', `${pathname}${search}${hash}`)
  }
}

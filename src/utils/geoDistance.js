// Distances on the ground, as great circles on a sphere of the Earth's mean
// radius (haversine): within a few metres in a kilometre of the ellipsoid's,
// plenty for caves a few kilometres apart. The Nearby caves (nearbyCaves.js),
// a photo's distance from its cave (photoGps.js) and the map's Measure tool.

// The Earth's mean radius (IUGG), in metres.
const EARTH_RADIUS = 6371008.8

const toRadians = (degrees) => (degrees * Math.PI) / 180

/**
 * The great-circle distance between two points, in metres (haversine).
 *
 * @param {{latitude: number, longitude: number}} a
 * @param {{latitude: number, longitude: number}} b
 * @returns {number}
 */
export function distanceMetres(a, b) {
  const dLat = toRadians(b.latitude - a.latitude)
  const dLng = toRadians(b.longitude - a.longitude)
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRadians(a.latitude)) * Math.cos(toRadians(b.latitude)) * Math.sin(dLng / 2) ** 2
  return 2 * EARTH_RADIUS * Math.asin(Math.sqrt(Math.min(1, h)))
}

/**
 * A path's length, in metres: the sum of its segments' {@link distanceMetres}.
 *
 * @param {{latitude: number, longitude: number}[]} points - In order; fewer than two make 0.
 * @returns {number}
 */
export function pathMetres(points) {
  let total = 0
  for (let index = 1; index < points.length; index++) total += distanceMetres(points[index - 1], points[index])
  return total
}

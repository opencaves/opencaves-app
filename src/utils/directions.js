/**
 * Driving directions through a cave's points, in order - the last the
 * destination, the others waypoints - in Google Maps, on iPhones too (its
 * address opens the Google Maps app when installed, else the web page: Apple
 * Maps would drop the waypoints). Points that are missing (null or
 * undefined) are skipped.
 *
 * @param {...({latitude: number, longitude: number}|null|undefined)} points - In travel order.
 */
export function openDirections(...points) {
  const stops = points.filter((point) => point && point.latitude != null && point.longitude != null)
  if (!stops.length) return
  const destination = stops.at(-1)
  const url = new URL('https://www.google.com/maps/dir/?api=1&travelmode=driving')
  url.searchParams.append('destination', `${destination.latitude},${destination.longitude}`)
  if (stops.length > 1) {
    url.searchParams.append('waypoints', stops.slice(0, -1).map((point) => `${point.latitude},${point.longitude}`).join('|'))
  }

  window.open(url)
}

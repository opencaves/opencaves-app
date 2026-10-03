// Driving directions to a point ({ latitude, longitude }), through an
// optional waypoint, in Google Maps - or Apple Maps on iOS.
export function openDirections(destination, waypoint) {
  const url = new URL('https://www.google.com/maps/dir/?api=1&travelmode=driving')
  url.searchParams.append('destination', `${destination.latitude},${destination.longitude}`)
  if (waypoint) {
    url.searchParams.append('waypoints', `${waypoint.latitude},${waypoint.longitude}`)
  }

  if ('platform' in navigator && /iPhone|iPad|iPod/.test(navigator.platform)) {
    url.protocol = 'maps:'
  }

  window.open(url)
}

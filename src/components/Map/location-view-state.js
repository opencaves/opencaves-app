const locationHashRegEx = /^#(?<zoom>\d+(\.\d+)?)\/(?<latitude>[+-]?\d+(\.\d+)?)\/(?<longitude>[+-]?\d+(\.\d+)?)$/

export function locationViewState() {
  const parsedHash = locationHashRegEx.exec(window.location.hash)

  if (parsedHash) {
    return {
      zoom: parseFloat(parsedHash.zoom),
      latitude: parseFloat(parsedHash.latitude),
      longitude: parseFloat(parsedHash.longitude)
    }
  }

  return null

}
export function hasViewState() {
  return locationHashRegEx.test(window.location.hash)
}

// Squared distance between two {longitude, latitude} points - only meant for
// relative sorting (nearest-first), not as an actual displayed distance, so
// the flat-earth approximation (accurate enough across a region as small as
// the Yucatán) skips the cost of a proper haversine calculation. Returns
// Infinity when either point is missing, so entries without a location sort
// to the end rather than throwing or landing in an arbitrary spot.
export function squaredDistance(a, b) {
  if (!a || !b || typeof a.longitude !== 'number' || typeof a.latitude !== 'number' || typeof b.longitude !== 'number' || typeof b.latitude !== 'number') {
    return Infinity
  }

  const dLng = a.longitude - b.longitude
  const dLat = a.latitude - b.latitude
  return dLng * dLng + dLat * dLat
}

const locationValidityValueMap = new Map([
  ['yes', 'valid'],
  ['no', 'invalid'],
  ['', 'unknown']
])

function getLocationValidityValue(oldValue) {
  if (!locationValidityValueMap.has(oldValue)) {
    throw new Error(`'${oldValue}' is not a proper location.valid value`)
  }

  return locationValidityValueMap.get(oldValue)
}

function isEmpty(val) {
  if (typeof val === 'undefined') {
    return true
  }
  return typeof val === 'string' && val.trim() === ''
}

export function dashedId(str) {
  if (isEmpty(str)) {
    return
  }
  return str.trim().toLowerCase().replace(/\s+/g, '-')
}

export function str(str) {
  if (isEmpty(str)) {
    return
  }
  return str.trim()
}

export function bol(str) {
  if (isEmpty(str)) {
    return
  }
  return (str === 'yes') ? true : (str === 'no') ? false : undefined
}

export function num(num, digits) {
  //return isEmpty(num) ? undefined : new Number(('' + num).replace(/\s/, ''));
  const ret = Number(('' + num).replace(/\s/, ''))

  if (digits) {
    return parseFloat(ret.toFixed(digits))
  }

  return ret
}

export function arrStr(str) {
  if (isEmpty(str)) {
    return
  }
  return str.split('|')
}

// Picks the description for `lang` out of a `descriptions: [{ lang, description }]`
// array (as stored on accesses/accessibilities), falling back to `fallbackLang`.
export function pickDescription(descriptions, lang, fallbackLang = 'eng') {
  if (!descriptions) {
    return ''
  }
  const match = descriptions.find((d) => d.lang === lang) || descriptions.find((d) => d.lang === fallbackLang)
  return match?.description || ''
}

export function loc(obj, lngProp, latProp, validProp = null) {
  if (typeof obj[lngProp] === 'undefined' || obj[lngProp] === '' || obj[latProp] === '') {
    return
  }

  const location = {
    longitude: num(obj[lngProp], 5),
    latitude: num(obj[latProp], 5)
  }

  if (validProp && Reflect.has(obj, validProp)) {
    location.validity = getLocationValidityValue(obj[validProp])
  }

  return location
}
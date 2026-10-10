// Relative, not '@/': this file is also loaded by the Node migration script
// (scripts/migrate-sheet-to-firestore.js).
import { COORDINATE_DECIMALS } from '../../config/map.js'


/**
 * Squared distance between two {longitude, latitude} points - only meant for
 * relative sorting (nearest-first), not as an actual displayed distance, so
 * the flat-earth approximation (accurate enough across a region as small as
 * the Yucatán) skips the cost of a proper haversine calculation.
 *
 * @param {{longitude?: number, latitude?: number}} [a]
 * @param {{longitude?: number, latitude?: number}} [b]
 * @returns {number} Infinity when either point is missing, so entries without a location sort
 *   to the end rather than throwing or landing in an arbitrary spot.
 */
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

/**
 * A 'yes' or 'no' cell as a boolean (undefined otherwise).
 *
 * @param {string} str
 * @returns {boolean|undefined}
 */
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

/**
 * A cell's values, separated by "|".
 *
 * @param {string} str
 * @returns {string[]|undefined}
 */
export function arrStr(str) {
  if (isEmpty(str)) {
    return
  }
  return str.split('|')
}

/**
 * Picks the description for `lang` out of a `descriptions: [{ lang, description }]`
 * array (as stored on accesses/accessibilities), falling back to `fallbackLang`.
 *
 * @param {{lang: string, description: string}[]|undefined} descriptions
 * @param {string} lang
 * @param {string} [fallbackLang='eng']
 * @returns {string}
 */
export function pickDescription(descriptions, lang, fallbackLang = 'eng') {
  if (!descriptions) {
    return ''
  }
  const match = descriptions.find((d) => d.lang === lang) || descriptions.find((d) => d.lang === fallbackLang)
  return match?.description || ''
}

/**
 * A record's location from its longitude and latitude fields (and its validity, from `validProp`).
 *
 * @param {object} obj
 * @param {string} lngProp
 * @param {string} latProp
 * @param {string|null} [validProp=null]
 * @returns {{longitude: number, latitude: number, validity?: *}|undefined}
 */
export function loc(obj, lngProp, latProp, validProp = null) {
  if (typeof obj[lngProp] === 'undefined' || obj[lngProp] === '' || obj[latProp] === '') {
    return
  }

  const location = {
    longitude: num(obj[lngProp], COORDINATE_DECIMALS),
    latitude: num(obj[latProp], COORDINATE_DECIMALS)
  }

  if (validProp && Reflect.has(obj, validProp)) {
    location.validity = getLocationValidityValue(obj[validProp])
  }

  return location
}
// Measurement units: lengths and depths are stored in metres; a person sees
// and enters them in their units (the account page's Units setting, the
// preferences slice): metric or imperial (feet), or Automatic - imperial where
// it's the usage (the browser's region: the United States, Liberia, Myanmar),
// metric elsewhere.
export const UNIT_SYSTEMS = ['metric', 'imperial']
export const METRES_PER_FOOT = 0.3048

const IMPERIAL_REGIONS = ['US', 'LR', 'MM']

export function automaticUnits() {
  const region = (navigator.languages?.[0] || navigator.language || '').split('-')[1]?.toUpperCase()
  return IMPERIAL_REGIONS.includes(region) ? 'imperial' : 'metric'
}

/**
 * The choice ('auto', 'metric' or 'imperial') as a unit system.
 *
 * @param {string} choice
 * @returns {'metric'|'imperial'}
 */
export const resolveUnits = (choice) => (UNIT_SYSTEMS.includes(choice) ? /** @type {'metric'|'imperial'} */ (choice) : automaticUnits())

/**
 * Metres -> the person's unit, and back.
 *
 * @param {number} metres
 * @param {'metric'|'imperial'} units
 * @returns {number}
 */
export const fromMetres = (metres, units) => (units === 'imperial' ? metres / METRES_PER_FOOT : metres)
export const toMetres = (value, units) => (units === 'imperial' ? value * METRES_PER_FOOT : value)

/**
 * The unit's symbol: 'm' or 'ft'.
 *
 * @param {'metric'|'imperial'} units
 * @returns {string}
 */
export const lengthUnit = (units) => (units === 'imperial' ? 'ft' : 'm')

/**
 * A stored length or depth (metres) as the person reads it: in their units,
 * a whole number ("9 m", "1,234 ft").
 *
 * @param {number} metres
 * @param {'metric'|'imperial'} units
 * @param {string} locale
 * @returns {string}
 */
export function formatMeasure(metres, units, locale) {
  const value = fromMetres(Number(metres), units)
  return `${value.toLocaleString(locale, { maximumFractionDigits: 0 })} ${lengthUnit(units)}`
}

// Metres in a statute mile.
const METRES_PER_MILE = 1609.344

/**
 * A long stored distance (metres) as the person reads it: kilometres or
 * miles, one decimal ("379.6 km", "235.9 mi") - a system's length, where
 * {@link formatMeasure}'s whole metres or feet run to six or seven digits.
 *
 * @param {number} metres
 * @param {'metric'|'imperial'} units
 * @param {string} locale
 * @returns {string}
 */
export function formatDistance(metres, units, locale) {
  const value = Number(metres) / (units === 'imperial' ? METRES_PER_MILE : 1000)
  return `${value.toLocaleString(locale, { minimumFractionDigits: 1, maximumFractionDigits: 1 })} ${units === 'imperial' ? 'mi' : 'km'}`
}

/**
 * A measured distance (metres) as the person reads it: under a kilometre (a
 * mile in imperial) in whole metres or feet ({@link formatMeasure}: "640 m",
 * "2,100 ft"), else in kilometres or miles ({@link formatDistance}: "3.2 km").
 * The map's Measure tool.
 *
 * @param {number} metres
 * @param {'metric'|'imperial'} units
 * @param {string} locale
 * @returns {string}
 */
export function formatMeasuredDistance(metres, units, locale) {
  return Number(metres) < (units === 'imperial' ? METRES_PER_MILE : 1000) ? formatMeasure(metres, units, locale) : formatDistance(metres, units, locale)
}

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

// The choice ('auto', 'metric' or 'imperial') as a unit system.
export const resolveUnits = (choice) => (UNIT_SYSTEMS.includes(choice) ? choice : automaticUnits())

// Metres -> the person's unit, and back.
export const fromMetres = (metres, units) => (units === 'imperial' ? metres / METRES_PER_FOOT : metres)
export const toMetres = (value, units) => (units === 'imperial' ? value * METRES_PER_FOOT : value)

// The unit's symbol: 'm' or 'ft'.
export const lengthUnit = (units) => (units === 'imperial' ? 'ft' : 'm')

// A stored length or depth (metres) as the person reads it: in their units,
// whole above 10, one decimal under ("8.5 m", "1,234 ft").
export function formatMeasure(metres, units, locale) {
  const value = fromMetres(Number(metres), units)
  return `${value.toLocaleString(locale, { maximumFractionDigits: value < 10 ? 1 : 0 })} ${lengthUnit(units)}`
}

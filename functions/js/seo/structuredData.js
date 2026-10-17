// Kept identical to src/utils/structuredData.js: a cave's structured data
// is written by the server's pages (cavePage.js, indexPages.js) and by the
// app on the map (src/components/Seo/CaveSeo.jsx), and the two must agree.
// schema.org types: a cave is a TouristAttraction (a Place visitors go to -
// a dive site - with a touristType), a cave system a Place. Each has an @id
// (its page's URL + "#place"), so a cave and its system name each other.
import { slugify } from './slug.js'

// The country the caves are in, until areas carry their own: all of them
// are in Mexico today.
const COUNTRY = { '@type': 'Country', name: 'Mexico' }
const ADDRESS = { '@type': 'PostalAddress', addressCountry: 'MX' }

// A cave system's caves in its structured data: all of them (the page lists
// them all; the largest has ~160), up to this.
const CONTAINED_MAX = 300

/**
 * A place's @id: its page's URL and "#place".
 *
 * @param {string} siteUrl
 * @param {'caves'|'sistemas'} kind
 * @param {string} id
 * @returns {string}
 */
export const placeId = (siteUrl, kind, id) => `${siteUrl}/${kind}/${id}#place`

// Coordinates as structured data, only confirmed ones (validity "valid"):
// unconfirmed ones can be rough guesses, and search engines would show them
// as the place's position. (The page itself shows them, flagged.)
const confirmedGeo = (location) => (location?.validity === 'valid' && location.latitude != null && location.longitude != null
  ? { '@type': 'GeoCoordinates', latitude: location.latitude, longitude: location.longitude }
  : null)

// Where a place is: its area (a section of its list, /caves or /sistemas,
// its anchor the area's slug: where the page's area links), in the country -
// or the country alone.
const areaPlace = (siteUrl, list, area) => (area
  ? { '@type': 'Place', name: area, url: `${siteUrl}/${list}#${slugify(area)}`, containedInPlace: COUNTRY }
  : COUNTRY)

/**
 * A cave's schema.org data (JSON-LD): a TouristAttraction with its names,
 * description, confirmed coordinates, share image, its system and area, and
 * its editors' rating.
 *
 * @param {object} cave
 * @param {string} cave.siteUrl
 * @param {string} cave.id
 * @param {string} cave.name - Its name, or its placeholder when it has none.
 * @param {string} cave.description - Its page's meta description.
 * @param {string[]} [cave.aka] - Its other names.
 * @param {{latitude: number, longitude: number, validity?: string}|null} [cave.location]
 * @param {string|null} [cave.image] - Its share image's URL.
 * @param {string|null} [cave.area] - Its area's name.
 * @param {{id: string, name: string}|null} [cave.sistema] - Its own system.
 * @param {{average: number|null, count: number}|null} [cave.rating] - Its ratings' summary (_caveRatings).
 * @returns {object}
 */
export function caveJsonLd({ siteUrl, id, name, description, aka = [], location = null, image = null, area = null, sistema = null, rating = null }) {
  const geo = confirmedGeo(location)
  const where = areaPlace(siteUrl, 'caves', area)
  return {
    '@context': 'https://schema.org',
    '@type': 'TouristAttraction',
    '@id': placeId(siteUrl, 'caves', id),
    name,
    ...(aka.length > 0 && { alternateName: aka }),
    description,
    url: `${siteUrl}/caves/${id}`,
    ...(image && { image }),
    touristType: 'Cave divers',
    address: ADDRESS,
    ...(geo && { geo }),
    containedInPlace: sistema
      ? [{ '@type': 'Place', '@id': placeId(siteUrl, 'sistemas', sistema.id), name: sistema.name, url: `${siteUrl}/sistemas/${sistema.id}` }, where]
      : where,
    ...(rating?.count > 0 && typeof rating.average === 'number' && { aggregateRating: { '@type': 'AggregateRating', ratingValue: Number(rating.average.toFixed(1)), ratingCount: rating.count, bestRating: 5, worstRating: 1 } }),
  }
}

/**
 * A cave system's schema.org data (JSON-LD): a Place with its names,
 * description, confirmed coordinates, share image, area, explored length and
 * depth (PropertyValues: schema.org has no property of its own for them),
 * and its caves.
 *
 * @param {object} sistema
 * @param {string} sistema.siteUrl
 * @param {string} sistema.id
 * @param {string} sistema.name
 * @param {string} sistema.description - Its page's meta description.
 * @param {string[]} [sistema.aka]
 * @param {{latitude: number, longitude: number, validity?: string}|null} [sistema.location]
 * @param {string|null} [sistema.image] - Its share image's URL.
 * @param {string|null} [sistema.area] - Its area's name.
 * @param {number|null} [sistema.exploredLength] - In metres.
 * @param {number|null} [sistema.maxDepth] - In metres.
 * @param {{id: string, name: string}[]} [sistema.caves] - Its caves, as its page lists them.
 * @returns {object}
 */
export function sistemaJsonLd({ siteUrl, id, name, description, aka = [], location = null, image = null, area = null, exploredLength = null, maxDepth = null, caves = [] }) {
  const geo = confirmedGeo(location)
  const measures = [
    exploredLength > 0 && { '@type': 'PropertyValue', name: 'Explored length', value: exploredLength, unitCode: 'MTR', unitText: 'm' },
    maxDepth > 0 && { '@type': 'PropertyValue', name: 'Maximum depth', value: maxDepth, unitCode: 'MTR', unitText: 'm' },
  ].filter(Boolean)
  return {
    '@context': 'https://schema.org',
    '@type': 'Place',
    '@id': placeId(siteUrl, 'sistemas', id),
    name,
    ...(aka.length > 0 && { alternateName: aka }),
    description,
    url: `${siteUrl}/sistemas/${id}`,
    ...(image && { image }),
    address: ADDRESS,
    ...(geo && { geo }),
    containedInPlace: areaPlace(siteUrl, 'sistemas', area),
    ...(measures.length > 0 && { additionalProperty: measures }),
    ...(caves.length > 0 && { containsPlace: caves.slice(0, CONTAINED_MAX).map((cave) => ({ '@type': 'TouristAttraction', '@id': placeId(siteUrl, 'caves', cave.id), name: cave.name, url: `${siteUrl}/caves/${cave.id}` })) }),
  }
}

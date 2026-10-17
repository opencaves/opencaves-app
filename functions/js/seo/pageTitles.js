// Kept identical to src/utils/pageTitles.js: a cave's and a system's <title>
// is written by the server's pages (cavePage.js, indexPages.js), in English,
// and by the app in its language, and the two must agree word for word in
// English. A title adds the words people search ("cenote", "cave diving",
// "location", "map") to the name when it fits search results' ~60
// characters: the longer words, else the shorter ones, else the name alone.

/**
 * The longest title, its " / Open Caves" included: about what search
 * results show whole.
 */
export const TITLE_MAX = 60

// A name that already says what the place is: no "cenote" added to it.
const SAYS_KIND = /c[eé]note|cueva|cave|grotte|sinkhole/i

/**
 * The words a page's title adds, in one language: the server's English ones
 * (shared.js' TITLE_WORDS), the app's from its locale (`seo.titleWords`).
 *
 * @typedef {object} TitleWords
 * @property {string} separator - Between the name and the words (": ", French " : ").
 * @property {string[]} cenote - A cenote's words, longest first.
 * @property {string[]} cave - Another cave's, longest first.
 * @property {string[]} sistemaMaps - A system with survey maps', longest first.
 * @property {string[]} sistema - A system without any.
 */

/**
 * The first title that fits {@link TITLE_MAX}: the head and each words in
 * turn, else the head alone (however long).
 *
 * @param {string} head - The name, or the system's title.
 * @param {string} separator
 * @param {string[]} tails - The words to try, longest first.
 * @param {string} brand - The title's end (" / Open Caves").
 * @returns {string}
 */
export function fitTitle(head, separator, tails, brand) {
  for (const tail of tails) {
    const title = `${head}${separator}${tail}${brand}`
    if (title.length <= TITLE_MAX) return title
  }
  return `${head}${brand}`
}

/**
 * Whether a point is in the region whose cave entrances are cenotes (the
 * Yucatán peninsula's box, REGION_BBOX): none without coordinates.
 *
 * @param {{latitude?: number, longitude?: number}|null|undefined} location
 * @param {number[]} bbox - [west, south, east, north].
 * @returns {boolean}
 */
export function inCenoteRegion(location, bbox) {
  const { latitude, longitude } = location || {}
  if (typeof latitude !== 'number' || typeof longitude !== 'number') return false
  const [west, south, east, north] = bbox
  return longitude >= west && longitude <= east && latitude >= south && latitude <= north
}

/**
 * A cave's page's <title>: its name (or its placeholder) and "cenote" words
 * when it's in the cenotes' region and its name doesn't say what it is
 * already, else the cave words ({@link fitTitle}).
 *
 * @param {object} cave
 * @param {string} cave.label - Its name, or "(Unnamed cave)".
 * @param {{latitude?: number, longitude?: number}|null} [cave.location]
 * @param {number[]} cave.bbox - The cenotes' region ({@link inCenoteRegion}).
 * @param {TitleWords} cave.words
 * @param {string} cave.brand - " / Open Caves".
 * @returns {string}
 */
export function caveTitle({ label, location = null, bbox, words, brand }) {
  const cenote = inCenoteRegion(location, bbox) && !SAYS_KIND.test(label)
  return fitTitle(label, words.separator, cenote ? words.cenote : words.cave, brand)
}

/**
 * A cave system's page's <title>: its title ("Sac Actun cave system",
 * "Sistema Ox Bel Ha") and its words - survey maps' when it has some
 * ({@link fitTitle}).
 *
 * @param {object} sistema
 * @param {string} sistema.title
 * @param {boolean} sistema.hasMaps - It lists survey maps of its own.
 * @param {TitleWords} sistema.words
 * @param {string} sistema.brand - " / Open Caves".
 * @returns {string}
 */
export function sistemaPageTitle({ title, hasMaps, words, brand }) {
  return fitTitle(title, words.separator, hasMaps ? words.sistemaMaps : words.sistema, brand)
}

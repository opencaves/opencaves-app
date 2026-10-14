import { slugify } from './slug.js'
import { hasText, isRecentReview, lastReviewedMonth, monthOf } from './caveReview.js'

// The caves' search criteria, shared by the caves' list (/caves) and the
// map's filter menu: each criterion once, its test on a cave's facts
// ({@link caveFacts}), its address value. In the address (/caves):
//   /caves?type=entrance&area=tulum&missing=photo&missing=fees
// - every parameter key=value, no bare flags;
// - several values repeat the key (read with getAll), never a comma list;
// - values are lowercase letters, digits and "-" only (area slugs, the
//   criteria's keys, the accesses' ids): nothing to percent-encode - but the
//   text search's q;
// - built with URLSearchParams in a fixed order (FILTER_KINDS', then q), so
//   the same filters always give the same address;
// - unknown keys and values ignored; the older ?filter=no-coordinates and
//   ?filter=unnamed still read (LEGACY_FILTERS).
// Several values of one kind: a cave matching any of them (a cave has one
// area, one access); several missing values: a cave missing them all; the
// kinds together: a cave matching each.

/** The value a cave with no area, access or accessibility has in its kind's list. */
export const UNKNOWN_VALUE = 'unknown'

// A value as the address may hold it.
const VALUE_PATTERN = /^[a-z0-9-]+$/

/**
 * What a cave lacks that people can add (the Needs help criteria), in their
 * order: each one's test on a cave's facts ({@link caveFacts}), photo's on
 * the caves with a cover photo, review's against the month it's counted in
 * ('YYYY-MM': one for the whole page view, so the server and the browser
 * count alike - hooks/useReviewMonth.js).
 *
 * @type {{value: string, test: (facts: CaveFacts, covers: Set<string>|null, month: string) => boolean}[]}
 */
export const MISSING_CRITERIA = [
  { value: 'coordinates', test: (facts) => !facts.located },
  // Placed (with coordinates), but not confirmed on site.
  { value: 'position', test: (facts) => facts.located && !facts.positionConfirmed },
  { value: 'name', test: (facts) => !facts.name },
  // Unknown until the covers are read: no cave counted as missing one.
  { value: 'photo', test: (facts, covers) => Boolean(covers) && !covers.has(facts.id) },
  { value: 'video', test: (facts) => !facts.hasVideo },
  { value: 'description', test: (facts) => !facts.hasDescription },
  { value: 'directions', test: (facts) => !facts.hasDirections },
  { value: 'fees', test: (facts) => !facts.feesKnown },
  { value: 'facilities', test: (facts) => !facts.facilitiesKnown },
  { value: 'system', test: (facts) => !facts.hasSystem },
  // Not confirmed recently: none of the sections it shows was confirmed
  // ("Still accurate") within the last two years (utils/caveReview.js).
  { value: 'review', test: (facts, covers, month) => !isRecentReview(facts.lastReviewed, month) },
]

/** The cave types: a cenote entrance into a system, or another cave. */
export const TYPE_VALUES = ['entrance', 'other']

/**
 * The filters' kinds, in the address's order; `any`: a cave matching one of
 * the kind's values, else (missing) all of them.
 *
 * @type {{key: keyof CaveFilters, any: boolean}[]}
 */
export const FILTER_KINDS = [
  { key: 'type', any: true },
  { key: 'area', any: true },
  { key: 'access', any: true },
  { key: 'accessibility', any: true },
  { key: 'missing', any: false },
]

// The older ?filter= values (the What can I do? page's first links).
const LEGACY_FILTERS = { 'no-coordinates': 'coordinates', unnamed: 'name' }

const hasPoint = (point) => point?.latitude != null && point?.longitude != null
// Videos: a list of addresses, or (older records) one "|"-separated string.
const hasVideos = (videos) => (Array.isArray(videos) ? videos : typeof videos === 'string' ? videos.split('|') : []).some(hasText)

/**
 * A cave's facts the criteria test, from a cave record (the store's), or from
 * a server-rendered page's list item (src/ssr/pageState.js), which carries
 * them instead of the fields they come from (and only those that are true).
 *
 * @param {Cave & Partial<Omit<CaveFacts, 'id' | 'name'>>} cave
 * @returns {CaveFacts}
 */
export function caveFacts(cave) {
  const name = typeof cave.name === 'string' ? cave.name : cave.name?.value
  return {
    id: cave.id,
    name: name?.trim() || null,
    located: cave.located ?? hasPoint(cave.location),
    positionConfirmed: cave.positionConfirmed ?? cave.location?.validity === 'valid',
    cenoteEntrance: Boolean(cave.cenoteEntrance),
    area: cave.area || null,
    access: cave.access || null,
    accessibility: cave.accessibility || null,
    hasDescription: cave.hasDescription ?? hasText(cave.description),
    hasDirections: cave.hasDirections ?? hasText(cave.direction),
    feesKnown: cave.feesKnown ?? cave.fees != null,
    facilitiesKnown: cave.facilitiesKnown ?? cave.facilities != null,
    hasVideo: cave.hasVideo ?? hasVideos(cave.videos),
    // Its system's id travels with it (a server-rendered list's too).
    hasSystem: Boolean(cave.sistemaId),
    lastReviewed: cave.lastReviewed ?? lastReviewedMonth(cave),
  }
}

/**
 * The facts {@link caveFacts} gives that a server-rendered list sends for a
 * cave (src/ssr/pageState.js): those that are true - whether it's an
 * entrance included (a missing one reads as false) - its access and
 * accessibility, and the last month a section it shows was confirmed.
 *
 * @param {Cave} cave
 * @returns {Partial<CaveFacts>}
 */
export function compactCaveFacts(cave) {
  const facts = caveFacts(cave)
  const compact = {}
  ;['cenoteEntrance', 'positionConfirmed', 'hasDescription', 'hasDirections', 'feesKnown', 'facilitiesKnown', 'hasVideo'].forEach((key) => facts[key] && (compact[key] = true))
  if (facts.access) compact.access = facts.access
  if (facts.accessibility) compact.accessibility = facts.accessibility
  if (facts.lastReviewed) compact.lastReviewed = facts.lastReviewed
  return compact
}

/**
 * A cave's value in a kind's list: its type, its area's slug, its access's
 * or accessibility's id ({@link UNKNOWN_VALUE} when it has none).
 *
 * @param {CaveFacts} facts
 * @param {'type'|'area'|'access'|'accessibility'} kind
 * @returns {string}
 */
export function caveValue(facts, kind) {
  if (kind === 'type') return facts.cenoteEntrance ? 'entrance' : 'other'
  if (kind === 'area') return slugify(facts.area) || UNKNOWN_VALUE
  return facts[kind] || UNKNOWN_VALUE
}

/**
 * No filter.
 *
 * @returns {CaveFilters}
 */
export function emptyCaveFilters() {
  return { type: [], area: [], access: [], accessibility: [], missing: [] }
}

/**
 * Whether no filter is set.
 *
 * @param {CaveFilters} filters
 * @returns {boolean}
 */
export function noCaveFilters(filters) {
  return FILTER_KINDS.every(({ key }) => filters[key].length === 0)
}

/**
 * The filters an address holds, its unknown keys and values left out: type
 * and missing to their known values; area, access and accessibility to the
 * values given (when given), else to any well-formed one. Each kind's values
 * in their canonical order, once each.
 *
 * @param {URLSearchParams} params
 * @param {{area?: string[], access?: string[], accessibility?: string[]}} [known] - Each kind's values, in
 *   their canonical order (the address's).
 * @returns {CaveFilters}
 */
export function parseCaveFilters(params, known = {}) {
  const lists = { type: TYPE_VALUES, missing: MISSING_CRITERIA.map(({ value }) => value), ...known }
  const filters = emptyCaveFilters()
  FILTER_KINDS.forEach(({ key }) => {
    const given = new Set(params.getAll(key).filter((value) => VALUE_PATTERN.test(value)))
    if (key === 'missing') params.getAll('filter').forEach((value) => LEGACY_FILTERS[value] && given.add(LEGACY_FILTERS[value]))
    filters[key] = lists[key] ? lists[key].filter((value) => given.has(value)) : [...given].sort()
  })
  return filters
}

/**
 * Whether an address's filter parameters are those the page writes for
 * filters ({@link caveFiltersParams}: in their order, known values only, no
 * older ?filter=) - its other parameters aside.
 *
 * @param {URLSearchParams} params
 * @param {CaveFilters} filters - {@link parseCaveFilters}' reading of it.
 * @returns {boolean}
 */
export function sameCaveFilterParams(params, filters) {
  const keys = new Set([...FILTER_KINDS.map(({ key }) => key), 'filter'])
  const given = [...params].filter(([key]) => keys.has(key))
  const written = [...caveFiltersParams(filters)]
  return given.length === written.length && given.every(([key, value], index) => written[index][0] === key && written[index][1] === value)
}

/**
 * The address's query for filters and a text search (q): the kinds in their
 * order ({@link FILTER_KINDS}), each value once, then q - the same filters,
 * the same address.
 *
 * @param {CaveFilters} filters
 * @param {string} [q] - The text search.
 * @returns {URLSearchParams}
 */
export function caveFiltersParams(filters, q) {
  const params = new URLSearchParams()
  FILTER_KINDS.forEach(({ key }) => [...new Set(filters[key])].forEach((value) => params.append(key, value)))
  if (q) params.set('q', q)
  return params
}

/**
 * Filters with a value added to its kind (or removed: on false), the kind's
 * values in the order of order (when given).
 *
 * @param {CaveFilters} filters
 * @param {keyof CaveFilters} kind
 * @param {string} value
 * @param {boolean} [on=true]
 * @param {string[]} [order] - The kind's values in their order.
 * @returns {CaveFilters}
 */
export function withCaveFilter(filters, kind, value, on = true, order) {
  const values = filters[kind].filter((item) => item !== value)
  if (on) values.push(value)
  const ordered = order ? order.filter((item) => values.includes(item)) : values
  return { ...filters, [kind]: ordered }
}

/**
 * Whether a cave matches the filters (see the top of this file).
 *
 * @param {CaveFacts} facts - {@link caveFacts}'.
 * @param {CaveFilters} filters
 * @param {Set<string>|null} covers - The caves with a cover photo (null until known).
 * @param {string} [month] - The month the confirmations' age is counted in ('YYYY-MM'), the
 *   device's ({@link monthOf}) if not given.
 * @returns {boolean}
 */
export function matchesCaveFilters(facts, filters, covers, month = monthOf()) {
  return FILTER_KINDS.every(({ key }) => {
    const values = filters[key]
    if (values.length === 0) return true
    if (key === 'missing') return values.every((value) => MISSING_CRITERIA.find((criterion) => criterion.value === value)?.test(facts, covers, month) ?? true)
    const value = caveValue(facts, key)
    return values.includes(value)
  })
}

/**
 * Whether a cave lacks something (one of {@link MISSING_CRITERIA}'s).
 *
 * @param {CaveFacts} facts
 * @param {string} missing - The criterion's value.
 * @param {Set<string>|null} covers
 * @param {string} [month] - As {@link matchesCaveFilters}'.
 * @returns {boolean}
 */
export function caveMisses(facts, missing, covers, month = monthOf()) {
  return Boolean(MISSING_CRITERIA.find(({ value }) => value === missing)?.test(facts, covers, month))
}

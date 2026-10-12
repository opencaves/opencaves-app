import { byName } from './indexData.js'
import { MISSING_CRITERIA } from './caveFilters.js'

// The caves' list ranked by usefulness: /caves with a Needs help filter
// (?missing=photo...) lists the caves where help is worth the most first -
// those people look at, then those they can dive. The signals, in their
// order of importance (the user's, 2026-10-12):
//   1. popularity: its pages' views (Google Analytics, /caves/<id> and
//      /map/<id>, the last 90 days) plus SAVE_WEIGHT views per account that
//      saved it (_popularity/caves, refreshPopularity);
//   2. a cenote entrance into its system (cenoteEntrance);
//   3. open access: open to anyone (OPEN_ACCESSES);
//   4. part of a major system: the longest explored length (exploredLength,
//      or the older length) among its system and the systems that one
//      joined (connections, up to the top one) - a cave of a system that
//      joined Sac Actun is a Sac Actun cave, and the top system's length is
//      the one that matters (the largest: a joined system's own length is
//      part of it);
//   5. almost complete: fewer of the Needs help criteria missing
//      (caveFilters.js' MISSING_CRITERIA);
//   6. a confirmed position (location.validity "valid") - not on the
//      ?missing=position list, all of which lack one.
// Lexicographic, compared signal by signal, with the two continuous ones
// in tiers so the next signals still decide between caves alike: the
// popularity by powers of two (0, 1, 2-3, 4-7, 8-15... views), a
// system's length by powers of ten (none or under 1 km, 1-10 km, 10-100
// km, 100 km and more). Ties: by name (unnamed last), then id - the same
// caves, the same order.

/**
 * The accesses open to anyone (the `accesses` records' ids): "yes", "The
 * site is accessible to anyone." - not customers, guide, key, permission
 * or no.
 */
export const OPEN_ACCESSES = ['yes']

/** How many page views an account saving a cave counts for. */
export const SAVE_WEIGHT = 10

// A system's explored length (m), 0 when unknown.
const lengthOf = (sistema) => {
  const value = Number(sistema?.exploredLength ?? sistema?.length)
  return value > 0 ? value : 0
}

/**
 * Each system's reach: the longest explored length (m) among it and the
 * systems it joined (connections, up to the top one), by system id - the
 * system signal ({@link rankSignals}).
 *
 * @param {Map<string, Sistema>} sistemasById - The public systems (utils/indexData.js').
 * @param {Connection[]} links - The connections joining two systems.
 * @returns {(sistemaId: string|null) => number} The reach of a system (0 for none).
 */
export function sistemaReach(sistemasById, links) {
  const parentOf = new Map(links.filter(({ sistemaId, parentSistemaId }) => sistemaId && parentSistemaId).map(({ sistemaId, parentSistemaId }) => [sistemaId, parentSistemaId]))
  const reach = new Map()
  return (sistemaId) => {
    if (!sistemaId) return 0
    if (!reach.has(sistemaId)) {
      let longest = 0
      // Up the chain, once each (a loop in the data stops).
      for (let id = sistemaId, seen = new Set(); id && !seen.has(id); id = parentOf.get(id)) {
        seen.add(id)
        longest = Math.max(longest, lengthOf(sistemasById.get(id)))
      }
      reach.set(sistemaId, longest)
    }
    return reach.get(sistemaId)
  }
}

/**
 * What ranks a cave ({@link rankCaves}): its popularity's views (with its
 * saves'), whether it's an entrance, open to anyone, its system's reach (m),
 * how many Needs help criteria it misses, whether its position is confirmed.
 *
 * @param {CaveFacts & {sistemaId?: string|null}} facts - utils/caveFilters.js' (an index item).
 * @param {object} context
 * @param {Popularity|null} [context.popularity] - None: the ranking starts at the entrances.
 * @param {(sistemaId: string|null) => number} context.reachOf - {@link sistemaReach}'s.
 * @param {Set<string>|null} context.covers - The caves with a cover photo.
 * @returns {{popularity: number, entrance: boolean, openAccess: boolean, reach: number, missing: number, confirmed: boolean}}
 */
export function rankSignals(facts, { popularity, reachOf, covers }) {
  return {
    popularity: (popularity?.views?.[facts.id] || 0) + SAVE_WEIGHT * (popularity?.saves?.[facts.id] || 0),
    entrance: facts.cenoteEntrance,
    openAccess: OPEN_ACCESSES.includes(facts.access),
    reach: reachOf(facts.sistemaId || null),
    missing: MISSING_CRITERIA.filter(({ test }) => test(facts, covers)).length,
    confirmed: facts.positionConfirmed,
  }
}

// A cave's key, compared value by value, higher first.
function rankKey(signals, positionShown) {
  const popularityTier = signals.popularity > 0 ? Math.floor(Math.log2(1 + signals.popularity)) : 0
  const reachTier = signals.reach >= 1000 ? Math.floor(Math.log10(signals.reach)) - 2 : 0
  return [popularityTier, Number(signals.entrance), Number(signals.openAccess), reachTier, -signals.missing, positionShown ? Number(signals.confirmed) : 0]
}

/**
 * Caves, most useful first (see the top of this file): a new array.
 *
 * @template {CaveFacts & {sistemaId?: string|null}} T
 * @param {T[]} caves - utils/indexData.js' items.
 * @param {object} context - As {@link rankSignals}'s, and:
 * @param {Popularity|null} [context.popularity]
 * @param {(sistemaId: string|null) => number} context.reachOf
 * @param {Set<string>|null} context.covers
 * @param {string[]} [context.missing=[]] - The list's Needs help filter (?missing=): position among them,
 *   the confirmed position doesn't rank.
 * @returns {T[]}
 */
export function rankCaves(caves, { popularity, reachOf, covers, missing = [] }) {
  const positionShown = !missing.includes('position')
  const keys = new Map(caves.map((cave) => [cave.id, rankKey(rankSignals(cave, { popularity, reachOf, covers }), positionShown)]))
  return [...caves].sort((a, b) => {
    const keyA = keys.get(a.id)
    const keyB = keys.get(b.id)
    for (let i = 0; i < keyA.length; i++) if (keyA[i] !== keyB[i]) return keyB[i] - keyA[i]
    if (!a.name || !b.name) return Number(!a.name) - Number(!b.name) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0)
    return byName(a, b) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0)
  })
}

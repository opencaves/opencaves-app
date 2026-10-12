// How much one save counts, in page views: a cave someone kept to dive
// weighs more than a visit.
const SAVE_WEIGHT = 10
// How strongly popularity lifts a map search result's score: a gentle
// factor (about ×2 for 50 views, ×2.8 for 1,000), so a clearly better
// match still wins.
const BOOST_STRENGTH = 0.6

/**
 * A record's popularity (_popularity/<kind>, hooks/usePopularity.js): its
 * page views, each save counting {@link SAVE_WEIGHT} views. 0 when unknown
 * (no data yet, the emulators).
 *
 * @param {Popularity|null|undefined} popularity
 * @param {string} id - A cave's or a system's id.
 * @returns {number}
 */
export function popularityOf(popularity, id) {
  if (!popularity) return 0
  return (popularity.views?.[id] || 0) + (popularity.saves?.[id] || 0) * SAVE_WEIGHT
}

/**
 * A search result's score factor for its popularity: 1 for none, growing
 * with the order of magnitude ({@link BOOST_STRENGTH}).
 *
 * @param {number} score - {@link popularityOf}'s.
 * @returns {number}
 */
export function popularityBoost(score) {
  return 1 + BOOST_STRENGTH * Math.log10(1 + score)
}

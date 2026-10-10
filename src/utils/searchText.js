/**
 * How the site's searches compare names (the landing page's and the app bar's
 * - useSiteSearch -, the cave and system lists - IndexSearchField -, the
 * coordinates maps' place search): lowercase, accents dropped, and hyphens,
 * apostrophes of every kind and dots read as spaces, so "Chac-Mol", "Kantun-Chi"
 * and "D’zonot" are found by "chac mol", "kantun chi" and "d zonot".
 *
 * @param {string} text
 * @returns {string}
 */
export function foldSearch(text) {
  return String(text || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/['’‘`´ʼ\-‐–—_.]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * A search's test of a text already folded ({@link foldSearch}): every word of the
 * search in it - or the search with its spaces dropped in the text with its
 * spaces dropped, so "chacmol" finds "Chac Mol" and "dzonot" finds "D’zonot".
 *
 * @param {string} query
 * @returns {(foldedText: string) => boolean}
 */
export function searchMatcher(query) {
  const folded = foldSearch(query)
  const words = folded.split(' ').filter(Boolean)
  const compact = folded.replace(/ /g, '')
  return (foldedText) => words.every((word) => foldedText.includes(word)) || (compact.length > 2 && foldedText.replace(/ /g, '').includes(compact))
}

// The shortest search term that is also looked up in record IDs. IDs are
// random-looking strings (push IDs like "-KPZkVQP2PNj9c43QysV", Auth UIDs),
// so a shorter term would match nearly every one of them by chance and bury
// the name matches.
export const MIN_ID_TERM_LENGTH = 4

/**
 * Whether a search term finds a record by its ID: case-insensitive, anywhere
 * in the ID, so a pasted ID or a fragment of one both work. Terms with spaces
 * are words, not IDs.
 *
 * @param {string} id
 * @param {string} term
 * @returns {boolean}
 */
export function matchesId(id, term) {
  const q = (term || '').trim().toLowerCase()
  if (!id || q.length < MIN_ID_TERM_LENGTH || /\s/.test(q)) return false
  return String(id).toLowerCase().includes(q)
}

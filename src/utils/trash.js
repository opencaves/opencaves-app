// The trash: a photo (cavesAssets) or a map (maps) an admin deletes is only
// marked { deletedAt, deletedBy } - kept, so it can be restored (Audits >
// Trash) until it's deleted for good. Every reader skips it. Firestore can't
// query "field missing", so it's filtered out after the query (a cave has few
// photos, the maps are few) - except the Trash tab, which queries
// where('deletedAt', '!=', null).

/**
 * Whether a record (plain data, or a DocumentSnapshot) is in the trash.
 *
 * @param {Trashable|import('firebase/firestore').DocumentSnapshot} record
 * @returns {boolean}
 */
export function isTrashed(record) {
  if (!record) return false
  const deletedAt = typeof record.get === 'function' && typeof record.data === 'function' ? record.get('deletedAt') : record.deletedAt
  return deletedAt != null
}

/**
 * A QuerySnapshot without its trashed documents, with the same shape its
 * readers use (docs, empty, size, metadata, forEach).
 *
 * @param {import('firebase/firestore').QuerySnapshot} snapshot
 * @returns {object}
 */
export function withoutTrashed(snapshot) {
  if (!snapshot) return snapshot
  const docs = snapshot.docs.filter((d) => !isTrashed(d))
  return {
    docs,
    empty: docs.length === 0,
    size: docs.length,
    metadata: snapshot.metadata,
    query: snapshot.query,
    forEach: (callback, thisArg) => docs.forEach(callback, thisArg),
  }
}

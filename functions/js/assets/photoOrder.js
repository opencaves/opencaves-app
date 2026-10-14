/**
 * A cave's photos (other than its cover) in the order the app shows them
 * (src/models/CaveAsset.js's photoOrder, kept the same): those the cave's
 * `photoOrder` doesn't name first, newest first (their date, then their
 * push id, in upload order), then those it names, in its order.
 *
 * @param {import('firebase-admin/firestore').QueryDocumentSnapshot[]} docs - The photos.
 * @param {string[]} [order] - The cave's `photoOrder`.
 * @returns {import('firebase-admin/firestore').QueryDocumentSnapshot[]} A new array.
 */
export function orderPhotos(docs, order) {
  const rank = new Map((Array.isArray(order) ? order : []).map((id, index) => [id, index]))
  const time = (doc) => doc.get('date')?.toMillis?.() ?? 0
  return [...docs].sort((a, b) => (rank.has(a.id) ? 1 : 0) - (rank.has(b.id) ? 1 : 0)
    || (rank.has(a.id) ? rank.get(a.id) - rank.get(b.id) : 0)
    || time(b) - time(a) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
}

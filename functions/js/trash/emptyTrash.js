import { getStorage } from 'firebase-admin/storage'
import { FieldValue } from 'firebase-admin/firestore'
import { onCall, HttpsError } from 'firebase-functions/v2/https'
import { logger } from 'firebase-functions/v2'
import { db } from '../init.js'
import { BUCKET_NAME, CAVES_COLL_NAME, DOCUMENTS_COLL_NAME, ENFORCE_APP_CHECK, REGION } from '../constants.js'
import { requireAdmin } from '../users/requireAdmin.js'
import { mapFilePaths } from '../maps/files.js'
import { documentCoverPath, documentFilePath } from '../documents/files.js'
import { AUDIT_LOG_COLL_NAME, TRASH_COLLECTIONS, auditEntry } from '../audit/log.js'

const MAX_ITEMS = 500

// The records that list a map or a document (their `maps`, `documents`
// field), to take it off when it's deleted for good.
const LISTED_BY = { maps: ['sistemas'], [DOCUMENTS_COLL_NAME]: [CAVES_COLL_NAME, 'sistemas'] }
const LIST_FIELDS = { maps: ['maps', 'mapOrder'], [DOCUMENTS_COLL_NAME]: ['documents', 'documentOrder'] }

// Deletes one record of the trash for good, with a purge entry (not
// undoable). A photo's files and private part go with its record
// (onAssetDeleted); a map's or a document's are deleted here, and it's taken
// off the records that list it (sistemas.maps; caves.documents,
// sistemas.documents - and their order).
async function purge({ collection, id }, adminUid) {
  const docRef = db.collection(collection).doc(id)
  const [field, orderField] = LIST_FIELDS[collection] || []
  const data = await db.runTransaction(async (transaction) => {
    const snap = await transaction.get(docRef)
    if (!snap.exists) throw new Error('notFound')
    if (!snap.get('deletedAt')) throw new Error('notInTrash')
    const listing = field ? (await Promise.all((LISTED_BY[collection] || []).map((name) => transaction.get(db.collection(name).where(field, 'array-contains', id))))).flatMap((query) => query.docs) : null

    transaction.delete(docRef)
    // Its order too, where there's one (arrayRemove would add an empty one).
    listing?.forEach((record) => transaction.update(record.ref, { [field]: FieldValue.arrayRemove(id), ...(Array.isArray(record.get(orderField)) && { [orderField]: FieldValue.arrayRemove(id) }) }))
    transaction.set(db.collection(AUDIT_LOG_COLL_NAME).doc(), auditEntry({
      action: 'purge', collection, docId: id, authorId: adminUid, authType: 'admin', before: snap.data(),
      // Older entries named only systems (a map's): their ids alone.
      ...(listing && { unlinkedFrom: listing.map((record) => (collection === 'maps' ? record.id : `${record.ref.parent.id}/${record.id}`)) }),
    }))
    return snap.data()
  })

  const bucket = getStorage().bucket(BUCKET_NAME)
  if (collection === 'maps') {
    await Promise.all(mapFilePaths(id, data).map((path) => bucket.file(path).delete({ ignoreNotFound: true })))
  }
  if (collection === DOCUMENTS_COLL_NAME && data.kind === 'file') {
    // The PDF and its cover.
    await Promise.all([documentFilePath(id), documentCoverPath(id)].map((path) => bucket.file(path).delete({ ignoreNotFound: true })))
  }
}

/**
 * Empties (part of) the trash (admins, the Audits page's Trash): photos,
 * maps and Further reading documents deleted to it are deleted for good,
 * with their files. Only records in
 * the trash (deletedAt set) are deleted.
 *
 * @param {CallableRequest} request - Its data: { items: [{ collection, id }] }.
 * @throws {HttpsError} permission-denied when the caller isn't an admin ({@link requireAdmin});
 *   invalid-argument for bad items.
 */
export const emptyTrash = onCall({ region: REGION, enforceAppCheck: ENFORCE_APP_CHECK }, async (request) => {
  requireAdmin(request, 'Only admins can empty the trash.')

  const { items } = request.data ?? {}
  if (!Array.isArray(items) || items.length === 0 || items.length > MAX_ITEMS) {
    throw new HttpsError('invalid-argument', `items must be 1 to ${MAX_ITEMS} { collection, id }.`)
  }

  const deleted = []
  const errors = []
  for (const item of items) {
    const { collection, id } = item ?? {}
    if (!TRASH_COLLECTIONS.includes(collection) || typeof id !== 'string' || !/^[-_A-Za-z0-9]{1,64}$/.test(id)) {
      errors.push({ collection: collection ?? null, id: id ?? null, reason: 'invalid' })
      continue
    }
    try {
      await purge({ collection, id }, request.auth.uid)
      deleted.push({ collection, id })
    } catch (error) {
      if (!['notFound', 'notInTrash'].includes(error.message)) logger.error('[emptyTrash] could not delete', { collection, id, error: error.message })
      errors.push({ collection, id, reason: error.message })
    }
  }
  return { deleted, errors }
})

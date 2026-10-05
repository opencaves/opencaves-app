import { getStorage } from 'firebase-admin/storage'
import { FieldValue } from 'firebase-admin/firestore'
import { onCall, HttpsError } from 'firebase-functions/v2/https'
import { logger } from 'firebase-functions/v2'
import { db } from '../init.js'
import { BUCKET_NAME, ENFORCE_APP_CHECK, REGION } from '../constants.js'
import { requireAdmin } from '../users/requireAdmin.js'
import { mapFilePaths } from '../maps/files.js'
import { AUDIT_LOG_COLL_NAME, TRASH_COLLECTIONS, auditEntry } from '../audit/log.js'

const MAX_ITEMS = 500

// Deletes one record of the trash for good, with a purge entry (not
// undoable). A photo's files and private part go with its record
// (onAssetDeleted); a map's are deleted here, and it's taken off the
// sistemas that list it (sistemas.maps).
async function purge({ collection, id }, adminUid) {
  const docRef = db.collection(collection).doc(id)
  const data = await db.runTransaction(async (transaction) => {
    const snap = await transaction.get(docRef)
    if (!snap.exists) throw new Error('notFound')
    if (!snap.get('deletedAt')) throw new Error('notInTrash')
    const sistemas = collection === 'maps' ? await transaction.get(db.collection('sistemas').where('maps', 'array-contains', id)) : null

    transaction.delete(docRef)
    sistemas?.docs.forEach((sistema) => transaction.update(sistema.ref, { maps: FieldValue.arrayRemove(id) }))
    transaction.set(db.collection(AUDIT_LOG_COLL_NAME).doc(), auditEntry({
      action: 'purge', collection, docId: id, authorId: adminUid, authType: 'admin', before: snap.data(),
      ...(sistemas && { unlinkedFrom: sistemas.docs.map((sistema) => sistema.id) }),
    }))
    return snap.data()
  })

  if (collection === 'maps') {
    const bucket = getStorage().bucket(BUCKET_NAME)
    await Promise.all(mapFilePaths(id, data).map((path) => bucket.file(path).delete({ ignoreNotFound: true })))
  }
}

// Empties (part of) the trash (admins, the Audits page's Trash): photos and
// maps deleted to it are deleted for good, with their files. Only records in
// the trash (deletedAt set) are deleted.
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

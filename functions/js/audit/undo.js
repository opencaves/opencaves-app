import { getStorage } from 'firebase-admin/storage'
import { FieldPath, FieldValue, Timestamp } from 'firebase-admin/firestore'
import { onCall, HttpsError } from 'firebase-functions/v2/https'
import { logger } from 'firebase-functions/v2'
import { db } from '../init.js'
import { BUCKET_NAME, ENFORCE_APP_CHECK, REGION, USERS_COLL_NAME } from '../constants.js'
import { requireAdmin } from '../users/requireAdmin.js'
import { mapOriginalPaths } from '../maps/files.js'
import { AUDIT_LOG_COLL_NAME, AUDITED_COLLECTIONS, TRASH_COLLECTIONS, auditEntry } from './log.js'
import { changedFields, isEqualValue, pickFields, toPlain } from './values.js'

const MAX_IDS = 500
const log = db.collection(AUDIT_LOG_COLL_NAME)

// What the entry did: an undo's own entry says it in undoAction, so undoing
// an undo works like undoing any change.
const actionOf = (entry) => (entry.action === 'undo' ? entry.undoAction : entry.action)

// Why an entry can't be undone, if it can't.
function skipReason(entry) {
  if (entry.undoneAt) return 'alreadyUndone'
  if (entry.collection === USERS_COLL_NAME) return 'userManagement'
  if (entry.action === 'purge') return 'purge'
  if (!AUDITED_COLLECTIONS.includes(entry.collection) || typeof entry.docId !== 'string') return 'notUndoable'
  if (entry.tooLarge) return 'tooLarge'
  const action = actionOf(entry)
  if (action === 'update' && (!Array.isArray(entry.changedFields) || !entry.before || !entry.after)) return 'noValues'
  if (action === 'create' && !entry.after) return 'noValues'
  if (action === 'delete' && !entry.before) return 'noValues'
  if (!['create', 'update', 'delete'].includes(action)) return 'notUndoable'
  return null
}

// A deleted photo's or map's files go with it (onAssetDeleted, emptyTrash):
// its record alone can't be brought back.
async function filesExist(collection, docId, data) {
  const bucket = getStorage().bucket(BUCKET_NAME)
  const paths = collection === 'maps' ? mapOriginalPaths(docId, data) : [data.fullPath].filter(Boolean)
  for (const path of paths) {
    const [exists] = await bucket.file(path).exists()
    if (exists) return true
  }
  return false
}

// The undo of one entry, from the document as it is now: what to write, and
// what the undo's own entry records - or why it's not done. Like `git
// revert`, the entry's result must still be there (a later change to the
// same fields is a conflict), unless forced.
function planUndo(entry, current, { force, adminUid }) {
  const { collection, docId } = entry
  const docRef = db.collection(collection).doc(docId)
  const cur = current.exists ? current.data() : null
  const isTrashed = TRASH_COLLECTIONS.includes(collection)

  switch (actionOf(entry)) {
    case 'update': {
      if (!cur) return { status: 'skipped', reason: isTrashed ? 'purged' : 'deleted' }
      const { before, after } = entry
      const conflicts = entry.changedFields
        .filter((field) => !isEqualValue(cur[field], after[field]))
        .map((field) => ({ field, expected: toPlain(after[field]), current: toPlain(cur[field]) }))
      if (conflicts.length && !force) return { status: 'conflict', conflicts }

      const restored = { ...cur }
      entry.changedFields.forEach((field) => (Object.hasOwn(before, field) ? (restored[field] = before[field]) : delete restored[field]))
      const fields = changedFields(cur, restored)
      if (!fields.length) return { status: 'skipped', reason: 'noChange' }
      // FieldPath: a field name is never read as a path (dots).
      const updates = fields.flatMap((field) => [new FieldPath(field), Object.hasOwn(restored, field) ? restored[field] : FieldValue.delete()])
      return {
        write: (transaction) => transaction.update(docRef, ...updates),
        undo: { undoAction: 'update', changedFields: fields, before: pickFields(cur, fields), after: pickFields(restored, fields) },
        conflicts,
      }
    }

    case 'create': {
      if (!cur) return { status: 'skipped', reason: 'deleted' }
      // Fields added since (a map's previews, by the server) aren't conflicts.
      const conflicts = Object.keys(entry.after)
        .filter((field) => !isEqualValue(cur[field], entry.after[field]))
        .map((field) => ({ field, expected: toPlain(entry.after[field]), current: toPlain(cur[field]) }))
      if (conflicts.length && !force) return { status: 'conflict', conflicts }

      // A photo or a map goes to the trash (its files stay), anything else is deleted.
      if (isTrashed) {
        if (cur.deletedAt) return { status: 'skipped', reason: 'inTrash' }
        const trashed = { deletedAt: Timestamp.now(), deletedBy: adminUid }
        return {
          write: (transaction) => transaction.update(docRef, trashed),
          undo: { undoAction: 'update', changedFields: ['deletedAt', 'deletedBy'], before: {}, after: trashed },
          conflicts,
        }
      }
      return { write: (transaction) => transaction.delete(docRef), undo: { undoAction: 'delete', before: cur }, conflicts }
    }

    case 'delete': {
      const { before } = entry
      if (cur) {
        const fields = changedFields(cur, before)
        if (!fields.length) return { status: 'skipped', reason: 'noChange' }
        // Created again since: overwritten only when forced.
        if (!force) return { status: 'conflict', reason: 'exists', conflicts: fields.map((field) => ({ field, expected: toPlain(before[field]), current: toPlain(cur[field]) })) }
        return {
          write: (transaction) => transaction.set(docRef, before),
          undo: { undoAction: 'update', changedFields: fields, before: pickFields(cur, fields), after: pickFields(before, fields) },
        }
      }
      return { write: (transaction) => transaction.set(docRef, before), undo: { undoAction: 'create', after: before } }
    }
  }
  return { status: 'skipped', reason: 'notUndoable' }
}

async function undoEntry(id, { force, adminUid }) {
  const entryRef = log.doc(id)
  try {
    const first = await entryRef.get()
    if (!first.exists) return { id, status: 'error', reason: 'notFound' }
    const firstEntry = first.data()
    const firstSkip = skipReason(firstEntry)
    if (firstSkip) return { id, status: 'skipped', reason: firstSkip }
    // Storage isn't transactional: checked before.
    if (actionOf(firstEntry) === 'delete' && TRASH_COLLECTIONS.includes(firstEntry.collection) && !(await filesExist(firstEntry.collection, firstEntry.docId, firstEntry.before))) {
      return { id, status: 'skipped', reason: 'filesGone' }
    }

    return await db.runTransaction(async (transaction) => {
      const snap = await transaction.get(entryRef)
      const entry = snap.data()
      const skip = skipReason(entry)
      if (skip) return { id, status: 'skipped', reason: skip }

      const current = await transaction.get(db.collection(entry.collection).doc(entry.docId))
      // Undoing an undo brings its entry's change back: that entry can be undone again.
      const undoneOfRef = entry.action === 'undo' && typeof entry.undoOf === 'string' ? log.doc(entry.undoOf) : null
      const undoneOf = undoneOfRef ? await transaction.get(undoneOfRef) : null

      const plan = planUndo(entry, current, { force, adminUid })
      if (plan.status) return { id, ...plan }

      plan.write(transaction)
      const undoRef = log.doc()
      transaction.set(undoRef, auditEntry({ action: 'undo', undoOf: id, collection: entry.collection, docId: entry.docId, authorId: adminUid, authType: 'admin', ...plan.undo }))
      transaction.update(entryRef, { undoneAt: FieldValue.serverTimestamp(), undoneBy: adminUid, undoEntryId: undoRef.id })
      if (undoneOf?.exists) transaction.update(undoneOfRef, { undoneAt: FieldValue.delete(), undoneBy: FieldValue.delete(), undoEntryId: FieldValue.delete() })
      return { id, status: 'undone', undoEntryId: undoRef.id, ...(plan.conflicts?.length && { conflicts: plan.conflicts }) }
    })
  } catch (error) {
    logger.error('[undoAuditEntries] could not undo', { id, error: error.message })
    return { id, status: 'error', reason: error.message }
  }
}

/**
 * Undoes audit log entries (admins, the Audits page): each brought back as
 * it was before the entry's change, newest first, each in its own
 * transaction. An entry whose fields were changed again since is a conflict
 * (nothing written) unless `force`. The undo is logged as its own entry
 * (action undo, undoOf), which can be undone in turn.
 *
 * @param {CallableRequest} request - Its data: { ids, force }.
 * @throws {HttpsError} permission-denied when the caller isn't an admin ({@link requireAdmin});
 *   invalid-argument for bad ids or force.
 */
export const undoAuditEntries = onCall({ region: REGION, enforceAppCheck: ENFORCE_APP_CHECK }, async (request) => {
  requireAdmin(request, 'Only admins can undo changes.')

  const { ids, force = false } = request.data ?? {}
  if (!Array.isArray(ids) || ids.length === 0 || ids.length > MAX_IDS || ids.some((id) => typeof id !== 'string' || !/^[A-Za-z0-9]{1,128}$/.test(id))) {
    throw new HttpsError('invalid-argument', `ids must be 1 to ${MAX_IDS} audit entry ids.`)
  }
  if (typeof force !== 'boolean') throw new HttpsError('invalid-argument', 'force must be true or false.')

  const unique = [...new Set(ids)]
  const snaps = await db.getAll(...unique.map((id) => log.doc(id)))
  const time = (snap) => snap.get('at')?.toMillis?.() ?? -Infinity
  const ordered = [...snaps].sort((a, b) => time(b) - time(a))

  const results = []
  for (const snap of ordered) {
    results.push(await undoEntry(snap.id, { force, adminUid: request.auth.uid }))
  }
  return { results }
})

import { FieldValue, Timestamp } from 'firebase-admin/firestore'
import { logger } from 'firebase-functions/v2'
import { db } from '../init.js'

export const AUDIT_LOG_COLL_NAME = '_auditLog'

// The collections people edit in the app: their changes are logged, and can
// be undone (undoAuditEntries).
export const AUDITED_COLLECTIONS = ['caves', 'sistemas', 'connections', 'accesses', 'accessibilities', 'sources', 'areas', 'colors', 'languages', 'maps', 'cavesAssets', '_settings']

// The records deleted to the trash first (deletedAt, deletedBy), and only
// then for good (emptyTrash).
export const TRASH_COLLECTIONS = ['cavesAssets', 'maps']

// The fields only the server writes (photo stamps, a map's derived files):
// not the app users' changes (onDataWritten in the emulator, getWhatsNew).
export const SERVER_FIELDS = new Set(['_created', '_modified', '_updated', 'previewUrl', 'previewUrls', 'thumbnailUrl', 'svgIds'])

// Entries are deleted this long after they're written, by the TTL policy on
// expireAt (firestore.indexes.json).
const RETENTION_MONTHS = 12

// An entry's values past this size (serialized) aren't kept - a document
// can't pass 1 MiB: the entry says tooLarge instead, and can't be undone.
const MAX_VALUES_BYTES = 900 * 1024

/**
 * When an entry written at `from` is deleted (by the TTL policy): {@link RETENTION_MONTHS} later.
 *
 * @param {Date} [from=new Date()]
 * @returns {Timestamp}
 */
export function expireAt(from = new Date()) {
  const date = new Date(from)
  date.setMonth(date.getMonth() + RETENTION_MONTHS)
  return Timestamp.fromDate(date)
}

/**
 * The entry as written: its time and expiry added, its before/after dropped
 * for tooLarge when they'd make it too big.
 *
 * @param {object} entry
 * @returns {object}
 */
export function auditEntry(entry) {
  const result = { ...entry, at: FieldValue.serverTimestamp(), expireAt: expireAt() }
  const size = Buffer.byteLength(JSON.stringify({ before: entry.before ?? null, after: entry.after ?? null }))
  if (size > MAX_VALUES_BYTES) {
    delete result.before
    delete result.after
    result.tooLarge = true
  }
  return result
}

/**
 * One entry in the audit log (_auditLog, admins only): who did what to which
 * document. A failure is logged, never thrown: the action itself is done.
 *
 * @param {object} entry
 * @returns {Promise<void>}
 */
export async function writeAuditLog(entry) {
  try {
    await db.collection(AUDIT_LOG_COLL_NAME).add(auditEntry(entry))
  } catch (error) {
    logger.error('[auditLog] could not write the entry', { entry: { ...entry, before: undefined, after: undefined }, error: error.message })
  }
}

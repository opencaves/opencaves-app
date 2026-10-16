// Audit log entries for the scripts that write to production with the Admin
// SDK: the audit trigger (functions/js/audit/onDataWritten.js) doesn't log
// those writes there, so the scripts write their own - credited to an account
// (--as <email>), shaped as the trigger's, so What's new shows the changes and
// undoAuditEntries can revert them. In the emulators the trigger logs the
// scripts' writes itself (as "emulator"): nothing to add there.

import { getAuth } from 'firebase-admin/auth'
import { FieldValue, Timestamp } from 'firebase-admin/firestore'

// The audit log's retention (functions/js/audit/log.js).
const RETENTION_MONTHS = 12

/**
 * The account a script's changes are credited to, by its email.
 *
 * @param {string} email
 * @returns {Promise<string>} Its uid.
 * @throws {Error} When no account has that email.
 */
export async function accountUid(email) {
  try {
    return (await getAuth().getUserByEmail(email)).uid
  } catch {
    throw new Error(`--as: no account with the email ${email}.`)
  }
}

/**
 * A writer of audit entries for one script run: `(entry) => Promise` writing
 * `{ ...entry, authorId, authType, at, expireAt }` to `_auditLog` - in
 * production only (`production` false: does nothing, the trigger logs).
 *
 * @param {import('firebase-admin/firestore').Firestore} db
 * @param {{production: boolean, uid: string|null}} options
 * @returns {(entry: object) => Promise<void>}
 */
export function auditWriter(db, { production, uid }) {
  return async (entry) => {
    if (!production) return
    if (!uid) throw new Error('No account to credit (--as).')
    const expireAt = new Date()
    expireAt.setMonth(expireAt.getMonth() + RETENTION_MONTHS)
    await db.collection('_auditLog').add({ ...entry, authorId: uid, authType: 'unknown', at: FieldValue.serverTimestamp(), expireAt: Timestamp.fromDate(expireAt) })
  }
}

/**
 * An update's audit entry: the fields it changed, their values before and
 * after (a field absent before or after is left out of that side).
 *
 * @param {string} collection
 * @param {string} docId
 * @param {Record<string, unknown>} before - The document's values before (only the changed fields are kept).
 * @param {Record<string, unknown>} after - The changed fields' new values.
 * @returns {object}
 */
export function updateEntry(collection, docId, before, after) {
  const changedFields = Object.keys(after)
  const pick = (values) => Object.fromEntries(changedFields.filter((f) => values?.[f] !== undefined && values?.[f] !== null).map((f) => [f, values[f]]))
  return { action: 'update', collection, docId, changedFields, before: pick(before), after: pick(after) }
}

import { FieldValue } from 'firebase-admin/firestore'
import { logger } from 'firebase-functions/v2'
import { db } from '../init.js'

export const AUDIT_LOG_COLL_NAME = 'auditLog'

// One entry in the audit log (auditLog, admins only): who did what to which
// document. A failure is logged, never thrown: the action itself is done.
export async function writeAuditLog(entry) {
  try {
    await db.collection(AUDIT_LOG_COLL_NAME).add({ ...entry, at: FieldValue.serverTimestamp() })
  } catch (error) {
    logger.error('[auditLog] could not write the entry', { entry, error: error.message })
  }
}

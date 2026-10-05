import { onDocumentWrittenWithAuthContext } from 'firebase-functions/v2/firestore'
import { logger } from 'firebase-functions/v2'
import { db } from '../init.js'
import { REGION } from '../constants.js'
import { AUDIT_LOG_COLL_NAME, AUDITED_COLLECTIONS, writeAuditLog } from './log.js'
import { changedFields, pickFields } from './values.js'

const IS_EMULATOR = process.env.FUNCTIONS_EMULATOR === 'true'

// The fields only the server writes (photo stamps, a map's derived files):
// in the emulator, a change to these alone is the server's, not logged.
const SERVER_FIELDS = new Set(['_created', '_modified', '_updated', 'previewUrl', 'previewUrls', 'thumbnailUrl', 'svgIds'])

// Only the app's users' changes are logged: not those made by scripts and
// functions (the production mirror, the photo triggers, an undo - which
// writes its own entry).
// An app user's write: no authType names it (only service_account, api_key,
// system, unauthenticated, unknown), so it's told by its writer's id - a
// Firebase account id. Scripts (Admin SDK, signed in as a Google account)
// and functions come as an email, a service account or the system.
// The emulator fakes every writer (authType unknown, an email), app users and
// server alike: there, every write is taken as an app user's ("emulator"),
// so the audit log and undo can be tried locally - scripts run against the
// emulator get logged too.
function writer({ authType, authId }) {
  if (IS_EMULATOR && authType === 'unknown') return { authorId: 'emulator', authType }
  if (authType === 'service_account' || authType === 'system') return null
  return typeof authId === 'string' && /^[A-Za-z0-9]{20,128}$/.test(authId) ? { authorId: authId, authType } : null
}

// In the emulator, an undo's or a purge's own write (which comes as the fake
// writer too): its entry, written in the same transaction, is already there.
async function isUndoOrPurgeWrite(event, collection) {
  const snap = await db.collection(AUDIT_LOG_COLL_NAME).where('docId', '==', event.params.docId).get()
  const writeTime = event.data?.after?.exists ? event.data.after.updateTime : null
  const eventMillis = Date.parse(event.time)
  return snap.docs.some((doc) => {
    const { action, undoAction, collection: entryCollection, at } = doc.data()
    if (entryCollection !== collection || !['undo', 'purge'].includes(action) || !at) return false
    // A delete is a purge's or an undo's that deleted; any other write an undo's that didn't.
    const deletes = action === 'purge' || undoAction === 'delete'
    if (deletes !== !writeTime) return false
    // The same commit time (the entry's in milliseconds). A delete has none:
    // its entry came after the document's last write, and before the event
    // (whose time the emulator gives in whole seconds).
    if (writeTime) return Math.abs(at.toMillis() - writeTime.toMillis()) < 2
    return at.toMillis() >= Math.floor(event.data.before.updateTime.toMillis()) && at.toMillis() < eventMillis + 1002
  })
}

// Logs each change to an audited collection, with what's needed to undo it
// (undoAuditEntries): a created document whole (after), an updated one's
// changed fields (changedFields, and their values before and after - a field
// missing from before or after was absent), a deleted one whole (before).
function auditCollection(collection) {
  return onDocumentWrittenWithAuthContext({ document: `${collection}/{docId}`, region: REGION }, async (event) => {
    const author = writer(event)
    if (!author) {
      logger.debug('[auditLog] not an app user write, not logged', { collection, docId: event.params.docId, authType: event.authType, authId: event.authId })
      return
    }

    const before = event.data?.before?.exists ? event.data.before.data() : null
    const after = event.data?.after?.exists ? event.data.after.data() : null
    if (!before && !after) return
    const action = !before ? 'create' : !after ? 'delete' : 'update'
    const entry = { action, collection, docId: event.params.docId, ...author }

    if (action === 'update') {
      entry.changedFields = changedFields(before, after)
      if (entry.changedFields.length === 0) return
      entry.before = pickFields(before, entry.changedFields)
      entry.after = pickFields(after, entry.changedFields)
    }
    if (action === 'create') entry.after = after
    if (action === 'delete') entry.before = before

    if (IS_EMULATOR) {
      // Photo records are only ever created by the server (onAssetUploaded).
      if (action === 'create' && collection === 'cavesAssets') return
      if (action === 'update' && entry.changedFields.every((field) => SERVER_FIELDS.has(field))) return
      if (await isUndoOrPurgeWrite(event, collection)) return
    }

    await writeAuditLog(entry)
  })
}

// Deployed as auditLog-caves, auditLog-sistemas...
export const auditLog = Object.fromEntries(AUDITED_COLLECTIONS.map((collection) => [collection, auditCollection(collection)]))

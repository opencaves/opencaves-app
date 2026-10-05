import { onDocumentWrittenWithAuthContext } from 'firebase-functions/v2/firestore'
import { logger } from 'firebase-functions/v2'
import { REGION } from '../constants.js'
import { writeAuditLog } from './log.js'

// The collections people edit in the app. Their changes made by scripts and
// functions (the Sheet sync, the production mirror, the photo triggers) aren't
// logged: only the app's users'. The emulators fake the writer (an email), so
// nothing is logged locally.
const AUDITED_COLLECTIONS = ['caves', 'sistemas', 'connections', 'accesses', 'accessibilities', 'sources', 'areas', 'colors', 'languages', 'maps', 'cavesAssets', 'settings']

// Logs each change to an audited collection: who, which document, created,
// updated (the fields changed) or deleted - a deleted document whole, so it
// can be restored.
// An app user's write: no authType names it (only service_account, api_key,
// system, unauthenticated, unknown), so it's told by its writer's id - a
// Firebase account id. Scripts (Admin SDK, signed in as a Google account)
// and functions come as an email, a service account or the system.
function isAppUserWrite({ authType, authId }) {
  if (authType === 'service_account' || authType === 'system') return false
  return typeof authId === 'string' && /^[A-Za-z0-9]{20,128}$/.test(authId)
}

function auditCollection(collection) {
  return onDocumentWrittenWithAuthContext({ document: `${collection}/{docId}`, region: REGION }, async (event) => {
    if (!isAppUserWrite(event)) {
      logger.debug('[auditLog] not an app user write, not logged', { collection, docId: event.params.docId, authType: event.authType, authId: event.authId })
      return
    }

    const before = event.data?.before?.exists ? event.data.before.data() : null
    const after = event.data?.after?.exists ? event.data.after.data() : null
    const action = !before ? 'create' : !after ? 'delete' : 'update'
    const entry = { action, collection, docId: event.params.docId, authorId: event.authId, authType: event.authType }

    if (action === 'update') {
      const fields = new Set([...Object.keys(before), ...Object.keys(after)])
      entry.changedFields = [...fields].filter((field) => JSON.stringify(before[field]) !== JSON.stringify(after[field]))
      if (entry.changedFields.length === 0) return
    }
    if (action === 'delete') entry.before = before

    await writeAuditLog(entry)
  })
}

// Deployed as auditLog-caves, auditLog-sistemas...
export const auditLog = Object.fromEntries(AUDITED_COLLECTIONS.map((collection) => [collection, auditCollection(collection)]))

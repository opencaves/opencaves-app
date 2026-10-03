import { onDocumentWrittenWithAuthContext } from 'firebase-functions/v2/firestore'
import { REGION } from '../constants.js'
import { writeAuditLog } from './log.js'

// The collections people edit in the app. Their changes made by scripts and
// functions (the Sheet sync, the production mirror, the photo triggers) aren't
// logged: only the app's users' (authType app_user). The emulators fake the
// writer (authType "unknown"), so nothing is logged locally.
const AUDITED_COLLECTIONS = ['caves', 'sistemas', 'connections', 'accesses', 'accessibilities', 'sources', 'areas', 'colors', 'languages', 'maps', 'cavesAssets', 'settings']

// Logs each change to an audited collection: who, which document, created,
// updated (the fields changed) or deleted - a deleted document whole, so it
// can be restored.
function auditCollection(collection) {
  return onDocumentWrittenWithAuthContext({ document: `${collection}/{docId}`, region: REGION }, async (event) => {
    if (event.authType !== 'app_user') return

    const before = event.data?.before?.exists ? event.data.before.data() : null
    const after = event.data?.after?.exists ? event.data.after.data() : null
    const action = !before ? 'create' : !after ? 'delete' : 'update'
    const entry = { action, collection, docId: event.params.docId, uid: event.authId || null }

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

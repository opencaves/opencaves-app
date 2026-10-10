import { onDocumentWritten } from 'firebase-functions/v2/firestore'
import { FieldValue } from 'firebase-admin/firestore'
import { logger } from 'firebase-functions/v2'
import { db } from '../init.js'
import { FEEDBACK_COLL_NAME, REGION, USERS_COLL_NAME } from '../constants.js'

const isMuted = (data) => data?.feedbackEmails === false

// An account's feedbackEmails setting (its settings page, or the emails'
// unsubscribe link), mirrored on its reports as authorMuted: the admins'
// Feedback page shows that their replies won't be emailed - without the
// admins reading the account's settings (_users stays its owner's).
export async function mirrorAuthorMuted(uid, muted) {
  const reports = await db.collection(FEEDBACK_COLL_NAME).where('userId', '==', uid).get()
  const writer = db.bulkWriter()
  for (const report of reports.docs) {
    if (Boolean(report.get('authorMuted')) !== muted) writer.update(report.ref, { authorMuted: muted ? true : FieldValue.delete() })
  }
  await writer.close()
}

export const onAuthorMutedChanged = onDocumentWritten({ document: `${USERS_COLL_NAME}/{uid}`, region: REGION }, async (event) => {
  const before = event.data?.before?.data()
  const after = event.data?.after?.data()
  // A deleted account: its reports aren't emailed anyway.
  if (!after || isMuted(before) === isMuted(after)) return
  try {
    await mirrorAuthorMuted(event.params.uid, isMuted(after))
  } catch (error) {
    logger.error('[feedback] the author’s email setting could not be mirrored on their reports', { uid: event.params.uid, error: error.message })
  }
})

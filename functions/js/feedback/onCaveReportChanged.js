import { onDocumentWritten } from 'firebase-functions/v2/firestore'
import { logger } from 'firebase-functions/v2'
import { db } from '../init.js'
import { CAVE_REPORTS_COLL_NAME, CAVE_WARNING_REPORTS, FEEDBACK_COLL_NAME, OPEN_FEEDBACK_STATUSES, REGION } from '../constants.js'

/**
 * Whether a feedback report shows a warning on its cave: a cave's "closed"
 * or "now private" quick report (caveId, caveReport) still open (new,
 * confirmed or in progress).
 *
 * @param {FeedbackReport|null|undefined} report
 * @returns {boolean}
 */
export function showsCaveWarning(report) {
  return Boolean(report?.caveId) && CAVE_WARNING_REPORTS.includes(report.caveReport) && OPEN_FEEDBACK_STATUSES.includes(report.status)
}

/**
 * A cave's warnings with one report's set as it now is: its entry removed,
 * then added back while it shows one ({@link showsCaveWarning}) - oldest
 * first.
 *
 * @param {CaveReports['reports']} reports - The cave's current entries.
 * @param {string} feedbackId
 * @param {FeedbackReport|null} report - The report now (null: deleted).
 * @returns {CaveReports['reports']}
 */
export function withCaveReport(reports, feedbackId, report) {
  const others = (Array.isArray(reports) ? reports : []).filter((entry) => entry?.feedbackId !== feedbackId)
  if (!showsCaveWarning(report)) return others
  const entry = { kind: report.caveReport, at: report.createdAt || null, feedbackId }
  return [...others, entry].sort((a, b) => (a.at?.toMillis?.() ?? 0) - (b.at?.toMillis?.() ?? 0))
}

/**
 * A cave's quick report (Report a change) written, staged or deleted: keeps
 * the cave's public warnings (_caveReports/{caveId}) in step - a "closed" or
 * "now private" report shows one from its creation until an admin resolves
 * it (done, rejected, duplicate) or deletes it; reopened, it shows again.
 * The document goes once the cave has none. "Fees changed" and "Road
 * changed" reports only reach the admins: never a warning.
 */
export const onCaveReportChanged = onDocumentWritten({ document: `${FEEDBACK_COLL_NAME}/{id}`, region: REGION }, async (event) => {
  const before = event.data?.before?.exists ? /** @type {FeedbackReport} */ (event.data.before.data()) : null
  const after = event.data?.after?.exists ? /** @type {FeedbackReport} */ (event.data.after.data()) : null
  const caveId = after?.caveId || before?.caveId
  if (!caveId || !CAVE_WARNING_REPORTS.includes(after?.caveReport || before?.caveReport)) return
  // Its other changes (a reply, its message count...) leave the warning as it is.
  if (before && after && showsCaveWarning(before) === showsCaveWarning(after)) return
  const ref = db.collection(CAVE_REPORTS_COLL_NAME).doc(caveId)
  try {
    await db.runTransaction(async (transaction) => {
      const snapshot = await transaction.get(ref)
      const reports = withCaveReport(snapshot.exists ? snapshot.get('reports') : [], event.params.id, after)
      if (reports.length > 0) transaction.set(ref, { reports })
      else if (snapshot.exists) transaction.delete(ref)
    })
  } catch (error) {
    logger.error('[caveReports] the cave’s warnings could not be updated', { id: event.params.id, caveId, error: error.message })
  }
})

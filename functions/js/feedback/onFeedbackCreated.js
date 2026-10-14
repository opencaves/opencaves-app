import { onDocumentCreated } from 'firebase-functions/v2/firestore'
import { logger } from 'firebase-functions/v2'
import { auth, db } from '../init.js'
import { CAVE_WARNING_REPORTS, FEEDBACK_COLL_NAME, FEEDBACK_PRIVATE_COLL_NAME, REGION, SITE_URL, USERS_COLL_NAME } from '../constants.js'
import { RESEND_API_KEY, sendEmail } from '../email/sendEmail.js'
import { renderEmail } from '../email/layout.js'
import { teamReplyAddress } from './replyAddress.js'

const KINDS = { bug: 'Bug', misleading: 'Misleading', idea: 'Idea / comment' }
const ICONS = { bug: '🐞', misleading: '🤔', idea: '💡' }
// A cave's quick report (Report a change): what changed.
const CAVE_REPORTS = { closed: 'Closed', private: 'Now private', fees: 'Fees changed', road: 'Road changed' }
// A proposed value's (access:permission, fees:no): the field and its key.
const FIELDS = { access: 'Access', accessibility: 'Accessibility' }
const FEES = { yes: 'Fees: now charged', no: 'Fees: now free' }
const reportLabel = (kind) => {
  const [field, value] = String(kind || '').split(':')
  return CAVE_REPORTS[kind] || (field === 'fees' ? FEES[value] : FIELDS[field] && value ? `${FIELDS[field]} is now: ${value}` : null) || null
}

/**
 * Every admin's email address (accounts whose roles include admin).
 *
 * @returns {Promise<string[]>}
 */
export async function adminEmails() {
  const emails = []
  let pageToken
  do {
    const page = await auth.listUsers(1000, pageToken)
    for (const user of page.users) if (user.email && Array.isArray(user.customClaims?.roles) && user.customClaims.roles.includes('admin')) emails.push(user.email)
    pageToken = page.pageToken
  } while (pageToken)
  return emails
}

/**
 * The name a report shows its readers (every registered account): its
 * author's display name - never anything taken from their email; none
 * without one.
 *
 * @param {import('firebase-admin/auth').UserRecord|null} author
 * @returns {string|null}
 */
export function feedbackAuthorName(author) {
  return author?.displayName?.trim().slice(0, 100) || null
}

// A cave's quick report's lines in the admins' email: what changed, and
// whether the cave shows a warning until the report is resolved.
function caveReportFacts(report) {
  if (!report.caveId || !reportLabel(report.caveReport)) return []
  const warning = CAVE_WARNING_REPORTS.includes(report.caveReport)
  return [{ label: 'Cave report', value: `${reportLabel(report.caveReport)}${warning ? ' - a warning shows on the cave until the report is closed' : ''}` }]
}

/**
 * A member's report (the Send feedback form, _feedback): it gets its
 * author's name (authorName - the members reading it can't look accounts
 * up), and the admins get it by email - its kind, the page it's about, who
 * sent it, the browser (its _feedbackPrivate doc) and the message - and read
 * and close it on the dashboard's Feedback page; a cave's quick report says
 * what changed, and whether the cave shows a warning until it's resolved
 * (onCaveReportChanged). A failure is logged: the report itself is saved.
 */
export const onFeedbackCreated = onDocumentCreated({ document: `${FEEDBACK_COLL_NAME}/{id}`, region: REGION, secrets: [RESEND_API_KEY] }, async (event) => {
  const report = event.data?.data()
  if (!report) return
  const author = await auth.getUser(report.userId).catch(() => null)
  // Its author's name, and whether they turned the feedback emails off: the
  // report says so to the admins (authorMuted, kept up to date by
  // onAuthorMutedChanged).
  try {
    const authorName = feedbackAuthorName(author)
    const muted = (await db.collection(USERS_COLL_NAME).doc(report.userId).get()).get('feedbackEmails') === false
    if (authorName || muted) await event.data.ref.update({ ...(authorName && { authorName }), ...(muted && { authorMuted: true }) })
  } catch (error) {
    logger.error('[feedback] the author’s name or email setting could not be saved', { id: event.params.id, error: error.message })
  }
  try {
    const [to, ...bcc] = await adminEmails()
    if (!to) {
      logger.warn('[feedback] no admin to email', { id: event.params.id })
      return
    }
    // The browser: in the report's private doc (written with it), or on the
    // report from an older version of the app.
    const browser = (await db.collection(FEEDBACK_PRIVATE_COLL_NAME).doc(event.params.id).get().catch(() => null))?.get('browser') || report.browser
    // Answering this email is a team reply (feedbackInbound, replyAddress.js).
    const replyTo = await teamReplyAddress(event.data.ref)
    const kind = KINDS[report.kind] || report.kind
    const page = report.page ? `${SITE_URL}${report.page}` : ''
    const from = author ? `${author.displayName || '-'} <${author.email || '-'}>` : report.userId
    const { html, text } = renderEmail({
      preheader: String(report.message).slice(0, 120),
      hero: { overline: 'Feedback', title: `${ICONS[report.kind] || ''} ${kind}`.trim() },
      blocks: [
        { type: 'facts', items: [{ label: 'From', value: from }, { label: 'Page', value: page || '-', href: page || undefined }, ...caveReportFacts(report), ...(browser ? [{ label: 'Browser', value: browser }] : [])] },
        { type: 'quote', text: report.message },
        { type: 'button', label: 'Open the report', href: `${SITE_URL}/feedback/${event.params.id}` },
      ],
      footer: replyTo ? 'You get this email because you are an OpenCaves admin. Reply to it to answer the reporter: your reply joins the report.' : 'You get this email because you are an OpenCaves admin.',
    })
    await sendEmail({
      to,
      bcc,
      subject: `[OpenCaves] ${kind}: ${String(report.message).split('\n')[0].slice(0, 70)}`,
      html,
      text,
      ...(replyTo && { replyTo }),
    })
  } catch (error) {
    logger.error('[feedback] the admins could not be emailed', { id: event.params.id, error: error.message })
  }
})

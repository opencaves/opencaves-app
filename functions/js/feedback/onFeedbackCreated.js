import { onDocumentCreated } from 'firebase-functions/v2/firestore'
import { logger } from 'firebase-functions/v2'
import { auth } from '../init.js'
import { FEEDBACK_COLL_NAME, REGION } from '../constants.js'
import { RESEND_API_KEY, sendEmail } from '../email/sendEmail.js'
import { SITE_URL } from '../seo/shared.js'
import { renderEmail } from '../email/layout.js'

const KINDS = { bug: 'Bug', misleading: 'Misleading', idea: 'Idea' }
const ICONS = { bug: '🐞', misleading: '🤔', idea: '💡' }

// Every admin's email address (accounts whose roles include admin).
async function adminEmails() {
  const emails = []
  let pageToken
  do {
    const page = await auth.listUsers(1000, pageToken)
    for (const user of page.users) if (user.email && Array.isArray(user.customClaims?.roles) && user.customClaims.roles.includes('admin')) emails.push(user.email)
    pageToken = page.pageToken
  } while (pageToken)
  return emails
}

// A tester's report (the beta's Send feedback form, _feedback): the admins
// get it by email - its kind, the page it's about, who sent it and the
// message - and read and close it on the dashboard's Feedback page. A failure
// is logged: the report itself is saved.
export const onFeedbackCreated = onDocumentCreated({ document: `${FEEDBACK_COLL_NAME}/{id}`, region: REGION, secrets: [RESEND_API_KEY] }, async (event) => {
  const report = event.data?.data()
  if (!report) return
  try {
    const [to, ...bcc] = await adminEmails()
    if (!to) {
      logger.warn('[feedback] no admin to email', { id: event.params.id })
      return
    }
    const author = await auth.getUser(report.userId).catch(() => null)
    const kind = KINDS[report.kind] || report.kind
    const page = report.page ? `${SITE_URL}${report.page}` : ''
    const from = author ? `${author.displayName || '-'} <${author.email || '-'}>` : report.userId
    const { html, text } = renderEmail({
      preheader: String(report.message).slice(0, 120),
      hero: { overline: 'Beta feedback', title: `${ICONS[report.kind] || ''} ${kind}`.trim() },
      blocks: [
        { type: 'facts', items: [{ label: 'From', value: from }, { label: 'Page', value: page || '-', href: page || undefined }, ...(report.browser ? [{ label: 'Browser', value: report.browser }] : [])] },
        { type: 'quote', text: report.message },
        { type: 'button', label: 'See all reports', href: `${SITE_URL}/feedback` },
      ],
      footer: 'You get this email because you are an OpenCaves admin.',
    })
    await sendEmail({
      to,
      bcc,
      subject: `[OpenCaves beta] ${kind}: ${String(report.message).split('\n')[0].slice(0, 70)}`,
      html,
      text,
    })
  } catch (error) {
    logger.error('[feedback] the admins could not be emailed', { id: event.params.id, error: error.message })
  }
})

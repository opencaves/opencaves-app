import { onDocumentCreated } from 'firebase-functions/v2/firestore'
import { FieldValue } from 'firebase-admin/firestore'
import { logger } from 'firebase-functions/v2'
import { auth, db } from '../init.js'
import { FEEDBACK_COLL_NAME, FEEDBACK_MESSAGES_COLL_NAME, FEEDBACK_REPLY_TO, REGION, SITE_URL, USERS_COLL_NAME } from '../constants.js'
import { RESEND_API_KEY, sendEmail } from '../email/sendEmail.js'
import { renderEmail } from '../email/layout.js'
import { FEEDBACK_EMAIL_CONTENT } from './onFeedbackStatusChanged.js'

const MAIL_DOMAIN = 'opencaves.org'

// The Message-IDs of a report's emails, which mail apps group into one
// conversation: the thread's root (no email of its own, only referenced) and
// each team reply's email. An author's answer by email keeps its own
// (emailMessageId, written with it by the server).
const rootMessageId = (reportId) => `<feedback-${reportId}@${MAIL_DOMAIN}>`
const replyMessageId = (reportId, messageId) => `<feedback-${reportId}-${messageId}@${MAIL_DOMAIN}>`

// The same subject for all of a report's emails: its first line.
export function feedbackThreadSubject(report) {
  const first = String(report.message || '').trim().split('\n')[0].trim()
  return `Re: ${first.length > 70 ? `${first.slice(0, 70)}…` : first}`
}

// The report's thread, oldest first: the admins' former note (before the
// thread existed, saved with the report's stage) as its first team reply,
// then its messages.
export function feedbackThread(report, messages) {
  // No date: the report's stage date changes with each new stage.
  const legacy = report.note ? [{ id: null, from: 'team', text: report.note, createdAt: null, legacy: true }] : []
  return [...legacy, ...messages]
}

const toDate = (value) => (value?.toDate ? value.toDate() : value instanceof Date ? value : null)

// { subject, html, text, headers } of the email of a team reply, `current`
// (one of `messages`, the report's thread so far): the reply on top - and the
// outcome, when it closed the report - then the earlier messages, newest
// first, down to the author's report.
export async function feedbackReplyEmail({ language, reportId, report, messages, current, name, replyTo = FEEDBACK_REPLY_TO }) {
  const { renderMarkdown } = await import('../email/markdown.js')
  const lang = FEEDBACK_EMAIL_CONTENT[language] ? language : 'en'
  const c = FEEDBACK_EMAIL_CONTENT[lang]
  const kind = c.kinds[report.kind] || c.kinds.misleading
  const s = (current.status && c[current.status]) || c.reply
  const when = new Intl.DateTimeFormat(lang, { year: 'numeric', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZone: 'UTC', timeZoneName: 'short' })
  const label = (message) => {
    const date = toDate(message.createdAt)
    return [message.from === 'team' ? c.team : c.you, date && when.format(date)].filter(Boolean).join(' · ')
  }
  const block = (message, highlight) => {
    const base = { type: 'message', label: label(message), highlight }
    if (message.from !== 'team') return { ...base, text: message.text }
    const { html, text } = renderMarkdown(message.text)
    return { ...base, html, text }
  }

  const thread = feedbackThread(report, messages)
  const index = thread.findIndex((message) => message.id === current.id)
  const earlier = thread.slice(0, index).reverse()
  const original = { from: 'author', text: String(report.message || ''), createdAt: report.createdAt }
  const preheader = renderMarkdown(current.text).text.replace(/\s+/g, ' ').slice(0, 120)

  const { html, text } = renderEmail({
    language: lang,
    preheader,
    hero: { overline: s.overline, title: s.title, lead: s.lead(kind) },
    blocks: [
      { type: 'p', text: c.greeting(name) },
      block(current, true),
      { type: 'h2', text: c.earlier },
      ...earlier.map((message) => block(message, false)),
      block(original, false),
      { type: 'button', label: c.button, href: `${SITE_URL}/what-can-i-do` },
      { type: 'signoff', lines: c.signoff },
    ],
    footer: replyTo ? c.footerReply : c.footer,
  })

  // In reply to the thread's previous email (or its root), referencing them all.
  const references = [rootMessageId(reportId), ...thread.slice(0, index).flatMap((message) => (message.from === 'team' && message.id ? [replyMessageId(reportId, message.id)] : message.emailMessageId ? [message.emailMessageId] : []))]
  const headers = { 'Message-ID': replyMessageId(reportId, current.id), 'In-Reply-To': references.at(-1), References: references.join(' ') }
  return { subject: feedbackThreadSubject(report), html, text, headers }
}

// A message of a report's thread (_feedback/{id}/messages): counted on the
// report (messageCount, lastMessageAt). A team reply (the admins' Feedback
// page): its author gets it by email, with the whole thread, in the
// language they wrote the report in - one email per reply, the outcome
// included when the reply closed the report (onFeedbackStatusChanged then
// sends none). emailedAt (on the reply) and reporterEmailedAt (on the
// report) record it. The author's own answers (Part 2: inbound email) aren't
// emailed back.
export const onFeedbackReplied = onDocumentCreated({ document: `${FEEDBACK_COLL_NAME}/{id}/${FEEDBACK_MESSAGES_COLL_NAME}/{messageId}`, region: REGION, secrets: [RESEND_API_KEY] }, async (event) => {
  const message = event.data?.data()
  if (!message) return
  const { id, messageId } = event.params
  const reportRef = db.collection(FEEDBACK_COLL_NAME).doc(id)
  // Every message (the team's, the author's) counts in the report's thread:
  // its count and latest activity, for the Feedback list (no read of each
  // thread there).
  try {
    await reportRef.update({ messageCount: FieldValue.increment(1), lastMessageAt: message.createdAt || FieldValue.serverTimestamp() })
  } catch (error) {
    logger.error('[feedback] the thread count could not be kept', { id, messageId, error: error.message })
  }
  if (message.from !== 'team') return
  try {
    const [reportSnapshot, messagesSnapshot] = await Promise.all([reportRef.get(), reportRef.collection(FEEDBACK_MESSAGES_COLL_NAME).orderBy('createdAt').get()])
    const report = reportSnapshot.data()
    if (!report) return
    const author = await auth.getUser(report.userId).catch(() => null)
    if (!author?.email) {
      logger.warn('[feedback] the reply has no one to email', { id, messageId })
      return
    }
    const language = report.language || (await db.collection(USERS_COLL_NAME).doc(report.userId).get()).get('language')
    const current = { id: messageId, ...message }
    // The thread up to this reply (not one written since).
    const created = toDate(message.createdAt)?.getTime() ?? Infinity
    const messages = messagesSnapshot.docs.map((d) => ({ id: d.id, ...d.data() })).filter((m) => m.id === messageId || (toDate(m.createdAt)?.getTime() ?? 0) <= created)
    const { subject, html, text, headers } = await feedbackReplyEmail({ language: String(language || '').slice(0, 2), reportId: id, report, messages, current, name: author.displayName?.split(' ')[0] || '' })
    const result = await sendEmail({ to: author.email, subject, html, text, headers, ...(FEEDBACK_REPLY_TO && { replyTo: FEEDBACK_REPLY_TO }) })
    if (result.sent) {
      await Promise.all([event.data.ref.update({ emailedAt: FieldValue.serverTimestamp() }), reportRef.update({ reporterEmailedAt: FieldValue.serverTimestamp() })])
    }
  } catch (error) {
    logger.error('[feedback] the reply could not be emailed', { id, messageId, error: error.message })
  }
})

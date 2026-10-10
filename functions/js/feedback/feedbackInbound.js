import { onRequest } from 'firebase-functions/v2/https'
import { defineSecret } from 'firebase-functions/params'
import { FieldValue } from 'firebase-admin/firestore'
import { logger } from 'firebase-functions/v2'
import { auth, db } from '../init.js'
import { FEEDBACK_COLL_NAME, FEEDBACK_MESSAGES_COLL_NAME, FEEDBACK_REPLY_DOMAIN, FEEDBACK_REPLY_MAX_LENGTH, FROZEN_USERS_COLL_NAME, REGION } from '../constants.js'

// Resend's inbound email (docs/maintenance.md, "Emails"): the webhook's
// signing secret (Resend's dashboard, Webhooks), and a full-access API key to
// read a received email (the sending key, RESEND_API_KEY, can't).
export const RESEND_WEBHOOK_SECRET = defineSecret('RESEND_WEBHOOK_SECRET')
export const RESEND_INBOUND_KEY = defineSecret('RESEND_INBOUND_KEY')

// The stages that close a report: an answer from its author reopens it.
const CLOSED = ['done', 'rejected', 'duplicate']

// A received email, as Resend's API gives it (from, to, received_for,
// subject, text, html, headers, authentication, message_id, attachments).
async function fetchFromResend(emailId) {
  const response = await fetch(`https://api.resend.com/emails/receiving/${encodeURIComponent(emailId)}`, { headers: { Authorization: `Bearer ${RESEND_INBOUND_KEY.value()}` } })
  if (!response.ok) throw new Error(`Resend ${response.status}: ${(await response.text()).slice(0, 200)}`)
  return response.json()
}

// In the emulator only, an email can come from a fixture file instead
// (<tmp>/opencaves-inbound-fixtures/<email id>.json): the end-to-end test
// posts a signed webhook without a real email at Resend. Never in production.
async function fetchReceivedEmail(emailId) {
  if (process.env.FUNCTIONS_EMULATOR === 'true') {
    const [{ readFile }, { tmpdir }, { join }] = await Promise.all([import('node:fs/promises'), import('node:os'), import('node:path')])
    const fixture = await readFile(join(tmpdir(), 'opencaves-inbound-fixtures', `${emailId}.json`), 'utf8').catch(() => null)
    if (fixture) return JSON.parse(fixture)
  }
  return fetchFromResend(emailId)
}

// The admin account an address belongs to - an admin, not disabled nor
// frozen (_frozenUsers) - or null.
async function adminByEmail(address) {
  if (!address) return null
  const user = await auth.getUserByEmail(address).catch(() => null)
  if (!user || user.disabled || !Array.isArray(user.customClaims?.roles) || !user.customClaims.roles.includes('admin')) return null
  const frozen = await db.collection(FROZEN_USERS_COLL_NAME).doc(user.uid).get()
  return frozen.exists ? null : user
}

// One received email, added to its report's thread: at its address, its
// author's answer; at its team address (team-<token>@, on the admins'
// emails), an admin's team reply - emailed to the author like one written in
// the app (onFeedbackReplied). Returns what happened, for the log; throws
// only on a failure worth Resend's retry (each email is added once: its
// message's id is the email's).
export async function receiveFeedbackEmail(emailId, helpers) {
  const { automaticReason, checkSender, emailAddress, findReplyToken, normalizeHeaders, replyText } = helpers
  const email = await fetchReceivedEmail(emailId)
  const address = findReplyToken(email, FEEDBACK_REPLY_DOMAIN)
  if (!address) return { dropped: 'no reply token' }
  const reason = automaticReason(email)
  if (reason) return { dropped: 'automatic', reason }
  const found = await db.collection(FEEDBACK_COLL_NAME).where('replyToken', '==', address.token).limit(1).get()
  if (found.empty) return { dropped: 'unknown token' }
  const reportRef = found.docs[0].ref
  const report = found.docs[0].data()
  // Who must have sent it: the author, or for the team address an admin.
  const writer = address.team
    ? await adminByEmail(emailAddress(email.from || normalizeHeaders(email.headers).from))
    : await auth.getUser(report.userId).catch(() => null)
  if (!writer) return { dropped: 'sender', reason: address.team ? 'not an admin' : 'no author', reportId: reportRef.id }
  const sender = checkSender(email, writer.email)
  if (!sender.ok) return { dropped: 'sender', reason: sender.reason, reportId: reportRef.id }
  const text = replyText(email, FEEDBACK_REPLY_MAX_LENGTH)
  if (!text) return { dropped: 'empty', reportId: reportRef.id }

  const droppedAttachments = Array.isArray(email.attachments) ? email.attachments.length : 0
  const messageRef = reportRef.collection(FEEDBACK_MESSAGES_COLL_NAME).doc(`email-${emailId}`)
  return db.runTransaction(async (transaction) => {
    const [existing, current] = await Promise.all([transaction.get(messageRef), transaction.get(reportRef)])
    if (existing.exists) return { dropped: 'duplicate', reportId: reportRef.id }
    transaction.create(messageRef, {
      from: address.team ? 'team' : 'author',
      text,
      createdAt: FieldValue.serverTimestamp(),
      userId: writer.uid,
      via: 'email',
      ...(email.message_id && { emailMessageId: String(email.message_id).slice(0, 500) }),
      ...(droppedAttachments && { droppedAttachments }),
    })
    // A closed report reopens when its author still has something to say
    // (a team reply leaves its stage alone). 'new' sends no email
    // (onFeedbackStatusChanged only tells done/rejected).
    const reopened = !address.team && CLOSED.includes(current.get('status'))
    if (reopened) transaction.update(reportRef, { status: 'new', statusUpdatedAt: FieldValue.serverTimestamp(), statusUpdatedBy: report.userId || 'email' })
    return { added: messageRef.id, reportId: reportRef.id, team: address.team, reopened, by: sender.by }
  })
}

// Resend's webhook for the mail received at FEEDBACK_REPLY_DOMAIN (event
// email.received): signed (Svix) with RESEND_WEBHOOK_SECRET - 401 otherwise.
// Its payload has only the email's metadata: the email itself is read from
// Resend's API. 200 once handled (added, or dropped on purpose), 500 on a
// failure, which Resend retries. Logs never hold an email's text.
export const feedbackInbound = onRequest({ region: REGION, secrets: [RESEND_WEBHOOK_SECRET, RESEND_INBOUND_KEY], memory: '256MiB', maxInstances: 5 }, async (req, res) => {
  if (req.method !== 'POST') {
    res.set('Allow', 'POST').status(405).send('Method Not Allowed')
    return
  }
  const helpers = await import('./inboundEmail.js')
  const verified = helpers.verifyWebhookSignature({
    secret: RESEND_WEBHOOK_SECRET.value(),
    id: req.get('svix-id'),
    timestamp: req.get('svix-timestamp'),
    signature: req.get('svix-signature'),
    body: req.rawBody,
  })
  if (!verified.ok) {
    logger.warn('[feedback] inbound webhook refused', { reason: verified.reason })
    res.status(401).send('Unauthorized')
    return
  }
  const event = req.body || {}
  const emailId = event.data?.email_id
  if (event.type !== 'email.received' || typeof emailId !== 'string' || !/^[A-Za-z0-9-]{1,100}$/.test(emailId)) {
    res.status(200).send('Ignored')
    return
  }
  try {
    const result = await receiveFeedbackEmail(emailId, helpers)
    if (result.dropped) logger.warn('[feedback] inbound email dropped', { emailId, ...result })
    else logger.info('[feedback] inbound email added to the thread', { emailId, ...result })
    res.status(200).send('OK')
  } catch (error) {
    logger.error('[feedback] inbound email failed', { emailId, error: error.message })
    res.status(500).send('Error')
  }
})

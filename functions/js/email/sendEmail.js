import { defineSecret } from 'firebase-functions/params'
import { logger } from 'firebase-functions/v2'

// OpenCaves' emails, sent with Resend (resend.com) from noreply@opencaves.org.
// The API key is the RESEND_API_KEY secret (Google Secret Manager: set with
// `firebase functions:secrets:set RESEND_API_KEY`); a function sending email
// lists it in its `secrets`. In the emulators nothing is sent: the email is
// written to the log.
export const RESEND_API_KEY = defineSecret('RESEND_API_KEY')

const FROM = 'OpenCaves <noreply@opencaves.org>'

/**
 * @param {object} email
 * @param {string|string[]} email.to
 * @param {string[]} [email.bcc=[]]
 * @param {string} email.subject
 * @param {string} email.text - The plain version.
 * @param {string} [email.html] - The formatted one (email/layout.js
 *   renders both).
 * @param {object} [email.headers] - Extra headers, e.g. Message-ID,
 *   In-Reply-To and References, which group a thread's emails in mail apps.
 * @param {string} [email.replyTo] - The address answers go to.
 * @returns {Promise<object>}
 */
export async function sendEmail({ to, bcc = [], subject, text, html, headers, replyTo }) {
  if (process.env.FUNCTIONS_EMULATOR === 'true') {
    logger.info('[email] not sent in the emulator', { to, bcc, subject, text, html: Boolean(html), ...(headers && { headers }), ...(replyTo && { replyTo }) })
    return { sent: false, emulator: true }
  }
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${RESEND_API_KEY.value()}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: FROM, to: [to], ...(bcc.length && { bcc }), subject, text, ...(html && { html }), ...(headers && { headers }), ...(replyTo && { reply_to: replyTo }) }),
  })
  if (!response.ok) {
    throw new Error(`Resend ${response.status}: ${await response.text()}`)
  }
  return { sent: true, ...(await response.json()) }
}

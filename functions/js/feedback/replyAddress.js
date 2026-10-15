import { db } from '../init.js'
import { FEEDBACK_PRIVATE_COLL_NAME, FEEDBACK_REPLY_DOMAIN, FEEDBACK_REPLY_TO } from '../constants.js'
import { randomToken } from '../email/unsubscribeUrl.js'

// A report's reply addresses, at FEEDBACK_REPLY_DOMAIN (feedbackInbound adds
// what comes in to its thread): <token>@ on its author's emails, taken from
// its author only; team-<token>@ on the admins' emails (a new report, an
// author's answer), taken from an admin only, as a team reply. Two addresses,
// so whoever is both (an admin reporting) answers as the email they got.
export const TEAM_ADDRESS_PREFIX = 'team-'

// A report's reply token (the local part of its reply address): 24 random
// lowercase letters and digits - unguessable, and safe from mail servers that
// lowercase addresses (push ids are case-sensitive). `length`: other tokens
// (an account's unsubscribe token, email/unsubscribe.js) are longer.
export const newReplyToken = randomToken

// The report's token, created (by the server only) the first time one of its
// emails needs it - kept in its _feedbackPrivate doc (admins only: every
// registered account reads the report). A report's own replyToken is an
// older one, left there if a one-time script (2026-10-10) didn't move it:
// still used.
async function replyToken(reportRef) {
  const privateRef = db.collection(FEEDBACK_PRIVATE_COLL_NAME).doc(reportRef.id)
  return db.runTransaction(async (transaction) => {
    const [privateDoc, report] = await Promise.all([transaction.get(privateRef), transaction.get(reportRef)])
    const existing = privateDoc.get('replyToken') || report.get('replyToken')
    if (existing) return existing
    const created = newReplyToken()
    transaction.set(privateRef, { replyToken: created }, { merge: true })
    return created
  })
}

/**
 * The address its author answers the team's emails to; the team's inbox
 * ({@link FEEDBACK_REPLY_TO}) while no reply domain is set.
 *
 * @param {import('firebase-admin/firestore').DocumentReference} reportRef
 * @returns {Promise<string>}
 */
export async function authorReplyAddress(reportRef) {
  if (!FEEDBACK_REPLY_DOMAIN) return FEEDBACK_REPLY_TO
  return `${await replyToken(reportRef)}@${FEEDBACK_REPLY_DOMAIN}`
}

/**
 * The address the admins answer its notifications to (a team reply); none
 * while no reply domain is set.
 *
 * @param {import('firebase-admin/firestore').DocumentReference} reportRef
 * @returns {Promise<string|null>}
 */
export async function teamReplyAddress(reportRef) {
  if (!FEEDBACK_REPLY_DOMAIN) return null
  return `${TEAM_ADDRESS_PREFIX}${await replyToken(reportRef)}@${FEEDBACK_REPLY_DOMAIN}`
}

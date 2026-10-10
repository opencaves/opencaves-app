import { randomBytes } from 'node:crypto'
import { db } from '../init.js'
import { FEEDBACK_REPLY_DOMAIN, FEEDBACK_REPLY_TO } from '../constants.js'

// A report's reply addresses, at FEEDBACK_REPLY_DOMAIN (feedbackInbound adds
// what comes in to its thread): <token>@ on its author's emails, taken from
// its author only; team-<token>@ on the admins' emails (a new report, an
// author's answer), taken from an admin only, as a team reply. Two addresses,
// so whoever is both (an admin reporting) answers as the email they got.
export const TEAM_ADDRESS_PREFIX = 'team-'

// A report's reply token (the local part of its reply address): 24 random
// lowercase letters and digits - unguessable, and safe from mail servers that
// lowercase addresses (push ids are case-sensitive).
const TOKEN_ALPHABET = 'abcdefghijklmnopqrstuvwxyz0123456789'
export function newReplyToken() {
  // 252 = 7 × 36: bytes above it are skipped, so every character is as likely.
  let token = ''
  while (token.length < 24) for (const byte of randomBytes(32)) if (byte < 252 && token.length < 24) token += TOKEN_ALPHABET[byte % 36]
  return token
}

// The report's token, created (by the server only) the first time one of its
// emails needs it.
async function replyToken(reportRef) {
  return db.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(reportRef)
    const existing = snapshot.get('replyToken')
    if (existing) return existing
    const created = newReplyToken()
    transaction.update(reportRef, { replyToken: created })
    return created
  })
}

// The address its author answers the team's emails to; the team's inbox
// (FEEDBACK_REPLY_TO) while no reply domain is set.
export async function authorReplyAddress(reportRef) {
  if (!FEEDBACK_REPLY_DOMAIN) return FEEDBACK_REPLY_TO
  return `${await replyToken(reportRef)}@${FEEDBACK_REPLY_DOMAIN}`
}

// The address the admins answer its notifications to (a team reply); none
// while no reply domain is set.
export async function teamReplyAddress(reportRef) {
  if (!FEEDBACK_REPLY_DOMAIN) return null
  return `${TEAM_ADDRESS_PREFIX}${await replyToken(reportRef)}@${FEEDBACK_REPLY_DOMAIN}`
}

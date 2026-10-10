import { db } from '../init.js'
import { SITE_URL, USERS_COLL_NAME } from '../constants.js'
import { newReplyToken } from '../feedback/replyAddress.js'

// One-click unsubscribe from the feedback emails, without signing in: each
// account's random token (32 lowercase letters and digits), kept on its
// _users/{uid} doc as unsubscribeToken - written by the server only (the
// security rules let the account change only its own settings there), gone
// with the account. The link, /email/unsubscribe?t=<token>, is served by
// feedbackUnsubscribe (feedback/feedbackUnsubscribe.js).
export const UNSUBSCRIBE_TOKEN_LENGTH = 32
export const UNSUBSCRIBE_PATH = '/email/unsubscribe'

export const isUnsubscribeToken = (value) => typeof value === 'string' && new RegExp(`^[a-z0-9]{${UNSUBSCRIBE_TOKEN_LENGTH}}$`).test(value)

// The account's token, created the first time an email needs it.
async function unsubscribeToken(uid) {
  const ref = db.collection(USERS_COLL_NAME).doc(uid)
  return db.runTransaction(async (transaction) => {
    const existing = (await transaction.get(ref)).get('unsubscribeToken')
    if (isUnsubscribeToken(existing)) return existing
    const created = newReplyToken(UNSUBSCRIBE_TOKEN_LENGTH)
    transaction.set(ref, { unsubscribeToken: created }, { merge: true })
    return created
  })
}

/**
 * The account's unsubscribe link, and the headers that give mail apps their
 * own Unsubscribe button (RFC 2369, and RFC 8058's one-click POST).
 *
 * @param {string} uid
 * @returns {Promise<{url: string, headers: object}>}
 */
export async function unsubscribeLink(uid) {
  const url = `${SITE_URL}${UNSUBSCRIBE_PATH}?t=${await unsubscribeToken(uid)}`
  return { url, headers: { 'List-Unsubscribe': `<${url}>`, 'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click' } }
}

/**
 * The account (its _users doc snapshot) a token belongs to, or null.
 *
 * @param {string} token
 * @returns {Promise<import('firebase-admin/firestore').DocumentSnapshot|null>}
 */
export async function accountOfUnsubscribeToken(token) {
  if (!isUnsubscribeToken(token)) return null
  const snapshot = await db.collection(USERS_COLL_NAME).where('unsubscribeToken', '==', token).limit(1).get()
  return snapshot.docs[0] || null
}

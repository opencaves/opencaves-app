import { db } from '../init.js'
import { USERS_COLL_NAME } from '../constants.js'
import { UNSUBSCRIBE_TOKEN_LENGTH, isUnsubscribeToken, randomToken, unsubscribeUrl } from './unsubscribeUrl.js'

// One-click unsubscribe, without signing in: each account's token (its
// unsubscribeToken, email/unsubscribeUrl.js), written by the server only (the
// security rules let the account change only its own settings there), gone
// with the account. The links, /email/unsubscribe?t=<token> (feedback) and
// &list=news, are served by feedbackUnsubscribe (feedback/feedbackUnsubscribe.js).
export { UNSUBSCRIBE_PATH, UNSUBSCRIBE_TOKEN_LENGTH, isUnsubscribeToken } from './unsubscribeUrl.js'

// The account's token, created the first time an email needs it.
async function unsubscribeToken(uid) {
  const ref = db.collection(USERS_COLL_NAME).doc(uid)
  return db.runTransaction(async (transaction) => {
    const existing = (await transaction.get(ref)).get('unsubscribeToken')
    if (isUnsubscribeToken(existing)) return existing
    const created = randomToken(UNSUBSCRIBE_TOKEN_LENGTH)
    transaction.set(ref, { unsubscribeToken: created }, { merge: true })
    return created
  })
}

/**
 * The account's unsubscribe link for one kind of email, and the headers that
 * give mail apps their own Unsubscribe button (RFC 2369, and RFC 8058's
 * one-click POST) - see {@link unsubscribeUrl}.
 *
 * @param {string} uid
 * @param {'feedback'|'news'} [list='feedback']
 * @returns {Promise<{url: string, headers: object}>}
 */
export async function unsubscribeLink(uid, list = 'feedback') {
  return unsubscribeUrl(await unsubscribeToken(uid), list)
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

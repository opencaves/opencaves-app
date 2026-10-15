import { randomBytes } from 'node:crypto'
import { SITE_URL } from '../constants.js'

// The unsubscribe links' pure parts (no database: the sending script uses
// them too). Each account has one random token (32 lowercase letters and
// digits), kept on its _users/{uid} doc as unsubscribeToken - written by the
// server only - and one setting per kind of email, which the link turns off:
// /email/unsubscribe?t=<token> for the feedback emails, &list=news for the
// news (feedbackUnsubscribe serves both).
export const UNSUBSCRIBE_TOKEN_LENGTH = 32
export const UNSUBSCRIBE_PATH = '/email/unsubscribe'

// Each kind of email ("list") and the _users setting its link turns off
// (false: none of them; absent: yes).
export const EMAIL_LISTS = { feedback: 'feedbackEmails', news: 'newsEmails' }

const TOKEN_ALPHABET = 'abcdefghijklmnopqrstuvwxyz0123456789'

/**
 * Whether a value has an unsubscribe token's form.
 *
 * @param {unknown} value
 * @returns {boolean}
 */
export const isUnsubscribeToken = (value) => typeof value === 'string' && new RegExp(`^[a-z0-9]{${UNSUBSCRIBE_TOKEN_LENGTH}}$`).test(value)

/**
 * A random token of lowercase letters and digits, every character as likely.
 *
 * @param {number} [length=24]
 * @returns {string}
 */
export function randomToken(length = 24) {
  // 252 = 7 × 36: bytes above it are skipped, so every character is as likely.
  let token = ''
  while (token.length < length) for (const byte of randomBytes(32)) if (byte < 252 && token.length < length) token += TOKEN_ALPHABET[byte % 36]
  return token
}

/**
 * The list a link names ({@link EMAIL_LISTS}' keys; feedback when absent or
 * unknown).
 *
 * @param {unknown} value - The link's `list` parameter.
 * @returns {'feedback'|'news'}
 */
export const emailListOf = (value) => (value === 'news' ? 'news' : 'feedback')

/**
 * An account's unsubscribe link for one kind of email, and the headers that
 * give mail apps their own Unsubscribe button (RFC 2369, and RFC 8058's
 * one-click POST, to the same address).
 *
 * @param {string} token - The account's unsubscribeToken.
 * @param {'feedback'|'news'} [list='feedback']
 * @returns {{url: string, headers: object}}
 */
export function unsubscribeUrl(token, list = 'feedback') {
  const url = `${SITE_URL}${UNSUBSCRIBE_PATH}?t=${token}${list === 'feedback' ? '' : `&list=${list}`}`
  return { url, headers: { 'List-Unsubscribe': `<${url}>`, 'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click' } }
}

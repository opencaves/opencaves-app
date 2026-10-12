import { isRouteErrorResponse } from 'react-router-dom'
import { ERROR_REPORTS_COLLECTION } from '@/config/collections.js'

// Error reports: a digest of each error the "Something went wrong" page shows
// (NoMatch), written to _errorReports for the team to examine later (admins
// read them; firestore.rules checks every field). Sent in production and in
// development alike (there, to the emulators' database); VITE_ERROR_REPORTS=false
// (.env.local) turns them off.
const ENABLED = import.meta.env.VITE_ERROR_REPORTS !== 'false'
// Kept this long, then deleted by Firestore's TTL policy on expireAt
// (firestore.indexes.json; firestore.rules allows at most 100 days).
const KEEP_DAYS = 90
// At most this many reports per browser session, the same error once: a page
// failing in a loop sends a few, not thousands.
const SESSION_MAX = 10
const SENT_KEY = 'oc-error-reports'
// The rules' size limits (firestore.rules, _errorReports).
const LIMITS = { message: 1000, stack: 4000, path: 1000, userAgent: 500 }

const cut = (value, max) => String(value ?? '').slice(0, max)

// The same error's digest, from its message and its stack's first frame
// (FNV-1a, hex): what groups reports of one bug.
function digestOf(message, stack) {
  const frame = stack.split('\n').find((line) => /^\s*at\s|@/.test(line)) || ''
  let hash = 0x811c9dc5
  for (const char of `${message}|${frame.trim()}`) {
    hash ^= char.codePointAt(0)
    hash = Math.imul(hash, 0x01000193) >>> 0
  }
  return hash.toString(16).padStart(8, '0')
}

// The session's digests already sent; null when storage is refused (then
// nothing is sent: no way to keep the count).
function sentDigests() {
  try {
    return JSON.parse(sessionStorage.getItem(SENT_KEY)) || []
  } catch {
    return null
  }
}

/**
 * Sends a digest of an error the error page shows to _errorReports: its
 * message, stack, HTTP status (a loader's response), the page's path, the
 * app's version, the browser, the language and the account (if signed in).
 * Once per error and at most {@link SESSION_MAX} per browser session; none
 * with VITE_ERROR_REPORTS=false ({@link ENABLED}). Never throws: a report
 * that can't be sent is dropped.
 *
 * @param {unknown} error - What the route threw (useRouteError).
 * @returns {Promise<void>}
 */
export async function reportError(error) {
  if (!ENABLED || !error) return
  try {
    const response = isRouteErrorResponse(error) ? error : null
    const message = cut(response ? `${response.status} ${response.statusText}` : (/** @type {Error} */ (error)?.message ?? error), LIMITS.message)
    const stack = cut(response ? '' : /** @type {Error} */ (error)?.stack, LIMITS.stack)
    const digest = digestOf(message, stack)
    const sent = sentDigests()
    if (!sent || sent.includes(digest) || sent.length >= SESSION_MAX) return
    sessionStorage.setItem(SENT_KEY, JSON.stringify([...sent, digest]))

    // Loaded here: Firestore stays out of the error page's own code.
    const [{ addDoc, collection, serverTimestamp, Timestamp }, { auth, db }] = await Promise.all([import('firebase/firestore'), import('@/config/firebase.js')])
    const uid = auth.currentUser && !auth.currentUser.isAnonymous ? auth.currentUser.uid : null
    await addDoc(collection(db, ERROR_REPORTS_COLLECTION), {
      message,
      stack,
      status: response ? response.status : null,
      digest,
      path: cut(`${window.location.pathname}${window.location.search}`, LIMITS.path),
      version: cut(import.meta.env.VITE_APP_VERSION, 40),
      userAgent: cut(navigator.userAgent, LIMITS.userAgent),
      language: cut(navigator.language, 20),
      uid,
      createdAt: serverTimestamp(),
      expireAt: Timestamp.fromMillis(Date.now() + KEEP_DAYS * 24 * 60 * 60 * 1000),
    })
  } catch (reportFailure) {
    console.warn('[error report] not sent', reportFailure)
  }
}

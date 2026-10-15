import { loadFirebase } from '@/utils/loadFirebase.js'
import { USERS_COLLECTION } from '@/config/collections.js'

/**
 * Which emails the person gets (the account page's EmailsSection), from
 * _users/{uid}: the team's replies to their feedback (feedbackEmails) and
 * news from OpenCaves (newsEmails), each yes when absent. The emails'
 * unsubscribe links (the feedbackUnsubscribe function) turn them off too,
 * hence a live read.
 *
 * @param {string} uid
 * @param {(settings: {feedbackEmails: boolean, newsEmails: boolean}) => void} onChange
 * @param {(error: Error) => void} [onError]
 * @returns {() => void} The unsubscribe.
 */
export function watchEmailPreferences(uid, onChange, onError) {
  let unsubscribe = null
  let stopped = false
  loadFirebase().then(({ db, doc, onSnapshot }) => {
    if (!stopped) unsubscribe = onSnapshot(doc(db, USERS_COLLECTION, uid), (snapshot) => onChange({ feedbackEmails: snapshot.get('feedbackEmails') !== false, newsEmails: snapshot.get('newsEmails') !== false }), onError)
  }, onError)
  return () => {
    stopped = true
    unsubscribe?.()
  }
}

/**
 * Turns one kind of email on or off for the person.
 *
 * @param {string} uid
 * @param {'feedbackEmails'|'newsEmails'} setting
 * @param {boolean} enabled
 * @returns {Promise<void>}
 */
export function saveEmailPreference(uid, setting, enabled) {
  return loadFirebase().then(({ db, doc, setDoc }) => setDoc(doc(db, USERS_COLLECTION, uid), { [setting]: Boolean(enabled) }, { merge: true }))
}

import { loadFirebase } from '@/utils/loadFirebase.js'
import { USERS_COLLECTION } from '@/config/collections.js'

/**
 * Whether the team's replies to the person's feedback are emailed to them
 * (the account page's FeedbackEmailsSection): _users/{uid}.feedbackEmails,
 * yes when absent. The emails' unsubscribe link (the feedbackUnsubscribe
 * function) turns it off too, hence a live read.
 *
 * @param {string} uid
 * @param {(enabled: boolean) => void} onChange
 * @param {(error: Error) => void} [onError]
 * @returns {() => void} The unsubscribe.
 */
export function watchFeedbackEmails(uid, onChange, onError) {
  let unsubscribe = null
  let stopped = false
  loadFirebase().then(({ db, doc, onSnapshot }) => {
    if (!stopped) unsubscribe = onSnapshot(doc(db, USERS_COLLECTION, uid), (snapshot) => onChange(snapshot.get('feedbackEmails') !== false), onError)
  }, onError)
  return () => {
    stopped = true
    unsubscribe?.()
  }
}

export function saveFeedbackEmails(uid, enabled) {
  return loadFirebase().then(({ db, doc, setDoc }) => setDoc(doc(db, USERS_COLLECTION, uid), { feedbackEmails: Boolean(enabled) }, { merge: true }))
}

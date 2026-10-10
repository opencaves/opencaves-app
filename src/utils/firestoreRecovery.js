import { clearIndexedDbPersistence, terminate } from 'firebase/firestore'
import { db } from '@/config/firebase.js'

// Firestore's own internal failures ("FIRESTORE (x.y.z) INTERNAL ASSERTION
// FAILED", ids ca9, b815 - a bug of the SDK, firebase-js-sdk #10434, #10410):
// once one happens, every later request fails until the page is reloaded,
// and the app would stay on its error page. Recovered in steps, at most once
// each per RECOVERY_WINDOW_MS:
// 1. a reload - all the SDK's reports need; the offline cache is kept, with
//    any edit not sent yet;
// 2. failing again: the offline cache cleared (a broken record in it - seen
//    after clearing the site's data while another copy of the app ran),
//    then a reload. Unsent edits are lost with it, hence step 2 only;
// 3. failing again: left to the error page, whose button reloads.
const RECOVERY_KEY = 'oc-firestore-recovery'
const RECOVERY_WINDOW_MS = 10 * 60 * 1000

export function isFirestoreFailure(error) {
  const message = String(error?.message ?? error ?? '')
  return /FIRESTORE \([\d.]+\) INTERNAL ASSERTION FAILED/.test(message)
}

function readSteps() {
  try {
    const { at = 0, steps = 0 } = JSON.parse(sessionStorage.getItem(RECOVERY_KEY)) || {}
    return Date.now() - at < RECOVERY_WINDOW_MS ? steps : 0
  } catch {
    return 0
  }
}

let recovering = false

// Starts the next step; false when both were already tried.
export function recoverFromFirestoreFailure() {
  if (recovering) return true
  const steps = readSteps()
  if (steps >= 2) return false
  recovering = true
  try {
    sessionStorage.setItem(RECOVERY_KEY, JSON.stringify({ at: Date.now(), steps: steps + 1 }))
  } catch {
    // Storage blocked: one plain reload, no loop (the flag can't be kept).
    if (steps > 0) return false
  }
  const clear = steps === 1 ? terminate(db).then(() => clearIndexedDbPersistence(db)) : Promise.resolve()
  clear
    // Another tab still holding the cache: cleared on a later try, reload anyway.
    .catch((error) => console.warn('[firestore] offline cache not cleared: %o', error))
    .finally(() => window.location.reload())
  return true
}

// Failures outside React's rendering (a listener's promise, a callback).
export function watchFirestoreFailures() {
  const handle = (error) => {
    if (isFirestoreFailure(error)) recoverFromFirestoreFailure()
  }
  window.addEventListener('unhandledrejection', (event) => handle(event.reason))
  window.addEventListener('error', (event) => handle(event.error ?? event.message))
}

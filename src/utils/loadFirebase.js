// The Firebase SDK (config/firebase.js: the app, Auth, Firestore, and the SDK
// functions the app calls - config/firebaseSdk.js), loaded on demand rather
// than with every page: its code and its start (Auth restoring the session,
// Firestore opening its offline cache, the cave data's listeners) took about
// 2 s of a phone's main thread on every page, the landing page included.
//
// Two ways in:
// - loadFirebase(): now - what a person's action needs (a save, a sign-in,
//   a menu reading the account);
// - whenFirebaseNeeded(): the background work (the cave data, the account's
//   session, the live queries). Right away on most pages; on a page the
//   server rendered (hydrated, index.jsx: deferFirebase()) - whose content
//   and data are in its HTML already - at the person's first interaction, or
//   a few seconds after the page has loaded when the browser is idle, so it
//   never competes with the page's hydration. Right away there too when this
//   device has a signed-in account (its session and editing tools are wanted
//   at once).

// The account's roles as last read from its token, kept on the device
// (components/auth/authSync.js): also tells that this device has a signed-in
// account.
export const KNOWN_ROLES_KEY = 'oc-known-roles'

// A server-rendered page: how long after its load event the background work
// starts at the latest (then when the browser is idle).
const DEFERRED_START_MS = 5000
const INTERACTIONS = ['pointerdown', 'keydown', 'touchstart', 'wheel', 'popstate']

let loading = null
let loaded = null
let deferred = false
let needed = null

/**
 * Loads (once) the Firebase module (config/firebase.js), now.
 *
 * @returns {Promise<typeof import('@/config/firebase.js')>}
 */
export function loadFirebase() {
  loading ??= import('@/config/firebase.js').then(
    (firebase) => (loaded = firebase),
    (error) => {
      // Not fetched (offline...): tried again next time.
      loading = null
      throw error
    },
  )
  return loading
}

/**
 * The Firebase module if it has loaded, else null - for code that runs only
 * once it has (a signed-in user's actions) and can't wait.
 *
 * @returns {typeof import('@/config/firebase.js')|null}
 */
export function loadedFirebase() {
  return loaded
}

/**
 * The signed-in Firebase user, or null (also while Firebase isn't loaded).
 *
 * @returns {import('firebase/auth').User|null}
 */
export function currentUser() {
  return loaded?.auth.currentUser ?? null
}

// Whether this device has a signed-in account ({@link KNOWN_ROLES_KEY}).
function hasKnownAccount() {
  try {
    return Boolean(localStorage.getItem(KNOWN_ROLES_KEY))
  } catch {
    return false
  }
}

/**
 * index.jsx, hydrating a page the server rendered: the background work
 * waits ({@link whenFirebaseNeeded}). Before anything asks for Firebase.
 */
export function deferFirebase() {
  deferred = !hasKnownAccount()
}

/**
 * Firebase for the background work: loaded now, or on a page the server
 * rendered at the first interaction or a few seconds after its load
 * ({@link deferFirebase}).
 *
 * @returns {Promise<typeof import('@/config/firebase.js')>}
 */
export function whenFirebaseNeeded() {
  if (loading || !deferred) return loadFirebase()
  needed ??= new Promise((resolve) => {
    let timer = null
    const start = () => {
      INTERACTIONS.forEach((type) => window.removeEventListener(type, start, true))
      window.removeEventListener('load', afterLoad)
      clearTimeout(timer)
      resolve(loadFirebase())
    }
    const whenIdle = () => ('requestIdleCallback' in window ? window.requestIdleCallback(start, { timeout: 5000 }) : start())
    function afterLoad() {
      timer = setTimeout(whenIdle, DEFERRED_START_MS)
    }
    INTERACTIONS.forEach((type) => window.addEventListener(type, start, { capture: true, passive: true }))
    if (document.readyState === 'complete') afterLoad()
    else window.addEventListener('load', afterLoad, { once: true })
  })
  return needed
}

/**
 * Auth's onAuthStateChanged, once Firebase is needed ({@link whenFirebaseNeeded}).
 *
 * @param {(user: import('firebase/auth').User|null) => void} callback
 * @returns {() => void} Unsubscribes (also before Firebase has loaded).
 */
export function onAuthChange(callback) {
  let unsubscribe = null
  let stopped = false
  whenFirebaseNeeded().then(({ auth, onAuthStateChanged }) => {
    if (!stopped) unsubscribe = onAuthStateChanged(auth, callback)
  }, (error) => console.error('[firebase] not loaded: %o', error))
  return () => {
    stopped = true
    unsubscribe?.()
  }
}

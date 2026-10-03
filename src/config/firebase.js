// Import the functions you need from the SDKs you need
import { initializeApp } from 'firebase/app'
import { initializeAppCheck, ReCaptchaV3Provider } from 'firebase/app-check'
import { browserLocalPersistence, browserPopupRedirectResolver, browserSessionPersistence, connectAuthEmulator, getAuth, getRedirectResult, indexedDBLocalPersistence, initializeAuth, signInWithPopup, signInWithRedirect } from 'firebase/auth'
import { connectStorageEmulator, getStorage } from 'firebase/storage'
import { connectFirestoreEmulator, getFirestore, initializeFirestore, persistentLocalCache, persistentMultipleTabManager } from 'firebase/firestore'
import { getFunctions, connectFunctionsEmulator } from 'firebase/functions'
// import { getAnalytics } from 'firebase/analytics'
import i18n from '../i18n.js'
import { toServiceLanguage } from '../utils/lang.js'
import { FIREBASE_CONFIG } from './firebase.config.js'
import { savePendingLink } from '../services/pendingLink.js'

// Initialize Firebase
const app = initializeApp(FIREBASE_CONFIG)

// App Check: Firestore, Storage and the functions can then refuse requests
// that don't come from this app (scripts calling the APIs directly). Its
// reCAPTCHA v3 site key is created in the Firebase console (App Check); none
// set, it stays off. Not on localhost: the emulators don't check it.
// eslint-disable-next-line no-restricted-globals
if (import.meta.env.VITE_RECAPTCHA_SITE_KEY && location.hostname !== 'localhost') {
  initializeAppCheck(app, {
    provider: new ReCaptchaV3Provider(import.meta.env.VITE_RECAPTCHA_SITE_KEY),
    isTokenAutoRefreshEnabled: true,
  })
}

const FUNCTIONS_REGION = FIREBASE_CONFIG.location || 'northamerica-northeast1'
export const functions = getFunctions(app, FUNCTIONS_REGION)

// Not getAuth(): it also sets up the popup/redirect resolver, which loads
// Firebase's auth iframe and Google's gapi script (~130 KiB) on every page
// load. Only signing in with a provider (Google…) needs them, so only those
// calls pass the resolver (signInWithProviderPopup/Redirect below). Same
// persistence as getAuth()'s. getAuth() only as a fallback when auth is
// already initialized (a hot reload of this module in dev).
function createAuth() {
  try {
    return initializeAuth(app, { persistence: [indexedDBLocalPersistence, browserLocalPersistence, browserSessionPersistence] })
  } catch {
    return getAuth(app)
  }
}
export const auth = createAuth()
auth.languageCode = toServiceLanguage(i18n.resolvedLanguage)

export const storage = getStorage(app)

const localCache = persistentLocalCache({
  tabManager: persistentMultipleTabManager()
})
export const db = initializeFirestore(app, { localCache })

// export const analytics = getAnalytics(app)

export default app

// Setup for dev environment

// eslint-disable-next-line no-restricted-globals
if (location.hostname === 'localhost') {
  connectFirestoreEmulator(db, '127.0.0.1', 8080)
  connectAuthEmulator(auth, 'http://127.0.0.1:9099/', { disableWarnings: true })
  connectFunctionsEmulator(functions, '127.0.0.1', 5001)
  connectStorageEmulator(storage, '127.0.0.1', 9199)
}

// Provider sign-in. A redirect (phones) comes back as a fresh page load,
// which getAuth() would finish on its own with its resolver: flagged here
// instead, so only that one load pays for the resolver.
const AUTH_REDIRECT_PENDING_KEY = 'oc-auth-redirect-pending'

export function signInWithProviderPopup(provider) {
  return signInWithPopup(auth, provider, browserPopupRedirectResolver)
}

export function signInWithProviderRedirect(provider) {
  try {
    sessionStorage.setItem(AUTH_REDIRECT_PENDING_KEY, '1')
  } catch {
    // No storage: the sign-in still happens, it just isn't finished on return.
  }
  return signInWithRedirect(auth, provider, browserPopupRedirectResolver)
}

let redirectPending = false
try {
  redirectPending = sessionStorage.getItem(AUTH_REDIRECT_PENDING_KEY) === '1'
  sessionStorage.removeItem(AUTH_REDIRECT_PENDING_KEY)
} catch {
  // No storage: nothing was flagged.
}
if (redirectPending) {
  getRedirectResult(auth, browserPopupRedirectResolver).catch((error) => {
    // The email already has an account: kept to add to it (AccountLinking).
    if (error.code === 'auth/account-exists-with-different-credential' && savePendingLink(error)) return
    console.error('Provider sign-in failed', error)
  })
}

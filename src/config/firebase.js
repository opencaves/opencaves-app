// Import the functions you need from the SDKs you need
import { initializeApp } from 'firebase/app'
import { browserLocalPersistence, browserPopupRedirectResolver, browserSessionPersistence, connectAuthEmulator, getAuth, getRedirectResult, indexedDBLocalPersistence, initializeAuth, signInWithPopup, signInWithRedirect } from 'firebase/auth'
import { connectFirestoreEmulator, getFirestore, initializeFirestore, persistentLocalCache, persistentMultipleTabManager } from 'firebase/firestore'
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
  // Its SDK only then (none set: not shipped with every page). Loaded
  // asynchronously: requests sent before it starts carry no token - check
  // that before turning enforcement on in the console.
  import('firebase/app-check').then(({ initializeAppCheck, ReCaptchaV3Provider }) =>
    initializeAppCheck(app, {
      provider: new ReCaptchaV3Provider(import.meta.env.VITE_RECAPTCHA_SITE_KEY),
      isTokenAutoRefreshEnabled: true,
    }),
  )
}

const FUNCTIONS_REGION = FIREBASE_CONFIG.location || 'northamerica-northeast1'
// eslint-disable-next-line no-restricted-globals
const isLocal = location.hostname === 'localhost'

// Storage and Functions: loaded on first use (an upload, a server call), not
// with every page - their SDKs weighed on every phone's start for nothing.
// getStorageService(): the Storage SDK's functions and the app's storage.
let storageService = null
export function getStorageService() {
  storageService ||= import('firebase/storage').then((sdk) => {
    const storage = sdk.getStorage(app)
    if (isLocal) sdk.connectStorageEmulator(storage, '127.0.0.1', 9199)
    return { ...sdk, storage }
  })
  return storageService
}

let functionsService = null
function getFunctionsService() {
  functionsService ||= import('firebase/functions').then((sdk) => {
    const functions = sdk.getFunctions(app, FUNCTIONS_REGION)
    if (isLocal) sdk.connectFunctionsEmulator(functions, '127.0.0.1', 5001)
    return { ...sdk, functions }
  })
  return functionsService
}

// A callable function, as httpsCallable(functions, name) gives: called with
// its data, it resolves to { data }.
export function callable(name) {
  return async (data) => {
    const { httpsCallable, functions } = await getFunctionsService()
    return httpsCallable(functions, name)(data)
  }
}

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

// config/firebase.js for the server build (vite.config.js), which renders the
// public pages (entry-server.jsx): the same exports, without the browser's
// set-up (persistent cache, emulators by hostname, App Check, sign-in
// redirects). The server never reads or writes through them - its data comes
// from the Admin SDK (functions/js/seo/ssr.js) - but modules make references
// (collection(db, ...)) when they load.
import { initializeApp } from 'firebase/app'
import { getAuth } from 'firebase/auth'
import { getFirestore } from 'firebase/firestore'
import { FIREBASE_CONFIG } from '../config/firebase.config.js'

const app = initializeApp(FIREBASE_CONFIG)

export const auth = getAuth(app)
export const db = getFirestore(app)

const unavailable = (what) => () => Promise.reject(new Error(`${what} is not available on the server`))
export const getStorageService = unavailable('Storage')
export const callable = (name) => unavailable(`The ${name} function`)
export const signInWithProviderPopup = unavailable('Sign-in')
export const signInWithProviderRedirect = unavailable('Sign-in')

export default app

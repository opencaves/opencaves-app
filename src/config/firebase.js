// Import the functions you need from the SDKs you need
import { initializeApp } from 'firebase/app'
import { connectAuthEmulator, getAuth } from 'firebase/auth'
import { connectStorageEmulator, getStorage } from 'firebase/storage'
import { connectFirestoreEmulator, initializeFirestore, persistentLocalCache, persistentMultipleTabManager } from 'firebase/firestore'
import { getFunctions, connectFunctionsEmulator } from 'firebase/functions'
import i18n from '../i18n'
import { firebaseConfig } from './firebase.config'

// Initialize Firebase
const app = initializeApp(firebaseConfig)

const functions = getFunctions(app)

export const auth = getAuth()
auth.languageCode = i18n.resolvedLanguage

export const storage = getStorage(app)

const localCache = persistentLocalCache({
  tabManager: persistentMultipleTabManager()
})
export const db = initializeFirestore(app, { localCache })

export default app

// Setup for dev environment

// eslint-disable-next-line no-restricted-globals
if (location.hostname === 'localhost') {
  connectFirestoreEmulator(db, '127.0.0.1', 8080)
  connectAuthEmulator(auth, 'http://127.0.0.1:9099/', { disableWarnings: true })
  connectFunctionsEmulator(functions, '127.0.0.1', 5001)
  connectStorageEmulator(storage, '127.0.0.1', 9199)
}

// Not working in development
// eslint-disable-next-line no-restricted-globals
export const storageResizeImagesExtensionFixed = location.hostname !== 'localhost'
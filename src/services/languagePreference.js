import { deleteField, doc, getDoc, setDoc } from 'firebase/firestore'
import { db } from '@/config/firebase.js'
import i18n, { LANGUAGE_STORAGE_KEY, SUPPORTED_LANGUAGES } from '@/i18n.js'

// The UI language a person picked (the account page's LanguageSection):
// kept on this device (localStorage, read by i18next's detector) and, for a
// signed-in account, in Firestore (users/{uid}.language) so it follows them
// to other devices. null means Automatic: the browser's language.

export function isSupportedLanguage(code) {
  return SUPPORTED_LANGUAGES.includes(code)
}

export function readDeviceLanguage() {
  try {
    const stored = window.localStorage.getItem(LANGUAGE_STORAGE_KEY)
    return isSupportedLanguage(stored) ? stored : null
  } catch {
    return null
  }
}

// Stores the choice on this device and switches the UI to it.
export function applyLanguage(code) {
  try {
    if (code) window.localStorage.setItem(LANGUAGE_STORAGE_KEY, code)
    else window.localStorage.removeItem(LANGUAGE_STORAGE_KEY)
  } catch {
    // Storage unavailable (e.g. private mode): still applies until reload.
  }
  // No argument: i18next detects it again - the browser's, once nothing is
  // stored.
  return i18n.changeLanguage(code || undefined)
}

export async function loadAccountLanguage(uid) {
  const snapshot = await getDoc(doc(db, 'users', uid))
  const code = snapshot.exists() ? snapshot.get('language') : null
  return isSupportedLanguage(code) ? code : null
}

// Automatic removes the field rather than storing a value.
export function saveAccountLanguage(uid, code) {
  return setDoc(doc(db, 'users', uid), { language: code || deleteField() }, { merge: true })
}

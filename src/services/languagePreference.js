import { deleteField, doc, getDoc, setDoc } from 'firebase/firestore'
import { db } from '@/config/firebase.js'
import i18n from '@/i18n.js'
import { APP_LANGUAGE_CODES, APP_LANGUAGE_STORAGE_KEY } from '@/config/appLanguages.js'
import { USERS_COLLECTION } from '@/config/collections.js'

// The app (UI) language a person picked (the account page's LanguageSection):
// kept on this device (localStorage, read by i18next's detector) and, for a
// signed-in account, in Firestore (users/{uid}.language) so it follows them
// to other devices. null means Automatic: the browser's language.

function isSupportedLanguage(code) {
  return APP_LANGUAGE_CODES.includes(code)
}

export function readDeviceLanguage() {
  try {
    const stored = window.localStorage.getItem(APP_LANGUAGE_STORAGE_KEY)
    return isSupportedLanguage(stored) ? stored : null
  } catch {
    return null
  }
}

/**
 * Stores the choice on this device and switches the UI to it.
 *
 * @param {string|null} code
 */
export function applyLanguage(code) {
  try {
    if (code) window.localStorage.setItem(APP_LANGUAGE_STORAGE_KEY, code)
    else window.localStorage.removeItem(APP_LANGUAGE_STORAGE_KEY)
  } catch {
    // Storage unavailable (e.g. private mode): still applies until reload.
  }
  // No argument: i18next detects it again - the browser's, once nothing is
  // stored.
  return i18n.changeLanguage(code || undefined)
}

export async function loadAccountLanguage(uid) {
  const snapshot = await getDoc(doc(db, USERS_COLLECTION, uid))
  const code = snapshot.exists() ? snapshot.get('language') : null
  return isSupportedLanguage(code) ? code : null
}

/**
 * Automatic removes the field rather than storing a value.
 *
 * @param {string} uid
 * @param {string|null} code
 * @returns {Promise<void>}
 */
function saveAccountLanguage(uid, code) {
  return setDoc(doc(db, USERS_COLLECTION, uid), { language: code || deleteField() }, { merge: true })
}

/**
 * A language chosen anywhere (the account page, the landing page's menu):
 * applied on this device and, for a signed-in account, saved as its
 * preference.
 *
 * @param {string|null} code - null: Automatic.
 * @param {object} [user]
 */
export function chooseLanguage(code, user) {
  const applied = applyLanguage(code)
  if (user?.uid && !user.isAnonymous) {
    saveAccountLanguage(user.uid, code).catch((error) => console.error(error))
  }
  return applied
}

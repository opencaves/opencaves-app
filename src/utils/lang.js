import { APP_TO_CONTENT_LANGUAGE } from '@/config/contentLanguages.js'
import { SERVICE_LANGUAGE } from '@/config/appLanguages.js'

/**
 * The content language (ISO 639-2, e.g. 'spa') for an app language (e.g.
 * 'es'), or null if there's none.
 *
 * @param {string} appLanguage
 * @returns {string|null}
 */
export function toContentLanguage(appLanguage) {
  return APP_TO_CONTENT_LANGUAGE[appLanguage] || null
}

/**
 * The language code to send an outside service (geocoding, auth emails) for
 * an app language: its stand-in when the service can't handle it (e.g.
 * Spanish for Yucatec Maya), else its primary subtag ('en', 'fr', 'es').
 *
 * @param {string} [appLanguage] - 'en' when none.
 * @returns {string}
 */
export function toServiceLanguage(appLanguage) {
  const code = (appLanguage || 'en').toLowerCase()
  return SERVICE_LANGUAGE[code] || code.split('-')[0]
}

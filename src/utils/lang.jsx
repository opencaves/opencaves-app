import { APP_TO_CONTENT_LANGUAGE } from '@/config/contentLanguages.js'

// The content language (ISO 639-2, e.g. 'spa') for an app language (e.g.
// 'es'), or null if there's none.
export function toContentLanguage(appLanguage) {
  return APP_TO_CONTENT_LANGUAGE[appLanguage] || null
}

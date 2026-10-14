import i18n from 'i18next'
import LanguageDetector from 'i18next-browser-languagedetector'
import { initReactI18next } from 'react-i18next'

// English is in the app (the server's language, every other's fallback);
// the others are loaded when needed (loadLanguage), a file each - a visitor
// downloads their own, not all four.
import en from './locales/en.json'
import { APP_LANGUAGE_CODES, APP_LANGUAGE_STORAGE_KEY, FALLBACK_LANGUAGES } from '@/config/appLanguages.js'

const LANGUAGE_FILES = import.meta.glob(['./locales/*.json', '!./locales/en.json'])

i18n
  // load translation using http -> see /public/locales
  // learn more: https://github.com/i18next/i18next-http-backend
  // .use(Backend)
  // detect user language
  // learn more: https://github.com/i18next/i18next-browser-languageDetector
  .use(LanguageDetector)
  // pass the i18n instance to react-i18next.
  .use(initReactI18next)
  // init i18next
  // for all options read: https://www.i18next.com/overview/configuration-options
  .init({
    resources: { en },
    // The other languages come in later (loadLanguage): i18next mustn't
    // treat their absence as final.
    partialBundledLanguages: true,
    supportedLngs: APP_LANGUAGE_CODES,
    nonExplicitSupportedLngs: true,
    // A browser language the app doesn't have falls back to English; a
    // partly translated one to its own fallbacks.
    fallbackLng: FALLBACK_LANGUAGES,
    detection: {
      // A language picked on the account page, else the browser's.
      order: ['localStorage', 'navigator'],
      lookupLocalStorage: APP_LANGUAGE_STORAGE_KEY,
      // Only an explicit choice is stored (LanguageSection), never a
      // detected one - otherwise "Automatic" couldn't be told apart from it.
      caches: [],
    },
    // fallbackLng: code => {
    //   if (!code || code === 'en') {
    //     return ['en']
    //   }

    //   const fallbacks = [code]

    //   if (code.indexOf('-')) {
    //     const langPart = code.split('-')[0]
    //     fallbacks.push(langPart)
    //   }

    //   console.log('[i18n] fallbacks: %o', fallbacks)

    //   return fallbacks
    // },
    debug: import.meta.env.DEV,
    defaultNS: 'app',
    // ns: ['common'],
    lowerCaseLng: true,

    interpolation: {
      escapeValue: false, // not needed for react as it escapes by default
    },
    react: {
      transKeepBasicHtmlNodesFor: ['br', 'strong', 'b', 'em', 'i', 'code', 'span', 'p'],
    }
    // backend: {
    //   loadPath: 'locales/{{lng}}/{{ns}}.{{lng}}.json'
    // }
  })

// Screen readers pick their voice from it. (The server, rendering the public
// pages in English, sets its page's lang itself: entry-server.jsx.)
if (typeof document !== 'undefined') {
  i18n.on('languageChanged', (lng) => {
    document.documentElement.lang = i18n.resolvedLanguage || lng
  })
  if (i18n.resolvedLanguage) document.documentElement.lang = i18n.resolvedLanguage
}

// The files loaded or loading, by language.
const loading = new Map([['en', Promise.resolve()]])

// A language's code as the app has it ('fr' for 'fr-CA'), if the app has it.
const appCode = (code) => {
  const lower = (code || '').toLowerCase()
  return APP_LANGUAGE_CODES.find((supported) => lower === supported || lower.startsWith(`${supported}-`)) || null
}

/**
 * Loads a language's translations, and those of its fallbacks (Yucatec
 * Maya: Spanish), unless already in - English always is.
 *
 * @param {string} code - A language code ('fr', 'fr-ca'...); one the app doesn't have loads nothing.
 * @returns {Promise<void>}
 */
export function loadLanguage(code) {
  const own = appCode(code)
  if (!own) return Promise.resolve()
  const codes = [own, ...(FALLBACK_LANGUAGES[own] || FALLBACK_LANGUAGES.default)]
  return Promise.all(
    codes.map((language) => {
      if (!loading.has(language)) {
        const file = LANGUAGE_FILES[`./locales/${language}.json`]
        loading.set(
          language,
          file
            ? file().then((module) => {
                const bundle = /** @type {{default: Record<string, object>}} */ (module).default
                for (const [namespace, strings] of Object.entries(bundle)) i18n.addResourceBundle(language, namespace, strings, true, true)
              })
            : Promise.resolve(),
        )
      }
      return loading.get(language)
    }),
  ).then(() => {})
}

// Switching language: its file first (the language picker, the account's
// language).
const changeLanguage = i18n.changeLanguage.bind(i18n)
// (No code: the detected language, i18next's detector's - a list or one.)
const detected = () => {
  const found = i18n.services.languageDetector?.detect?.()
  return Array.isArray(found) ? found[0] : found
}
i18n.changeLanguage = (code, callback) => loadLanguage(code || detected()).then(() => changeLanguage(code, callback))

/**
 * Resolved once the detected language's translations are in (at once for
 * English): what the app waits for before its first render (index.jsx).
 *
 * @type {Promise<void>}
 */
export const languageReady = appCode(i18n.language) && appCode(i18n.language) !== 'en'
  ? loadLanguage(i18n.language).then(() => changeLanguage(i18n.language)).then(() => {})
  : Promise.resolve()

export default i18n
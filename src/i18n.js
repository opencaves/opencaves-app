import i18n from 'i18next'
import LanguageDetector from 'i18next-browser-languagedetector'
import { initReactI18next } from 'react-i18next'

import en from './locales/en'
import fr from './locales/fr'
import es from './locales/es'
import yua from './locales/yua'
import { APP_LANGUAGE_CODES, APP_LANGUAGE_STORAGE_KEY, FALLBACK_LANGUAGES } from '@/config/appLanguages.js'

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
    resources: { en, fr, es, yua },
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

export default i18n
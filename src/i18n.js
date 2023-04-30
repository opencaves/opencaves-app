import i18n from 'i18next'
// import Backend from 'i18next-fs-backend'
import LanguageDetector from 'i18next-browser-languagedetector'
import { initReactI18next } from 'react-i18next'

import en from './locales/en'

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
    nonExplicitSupportedLngs: true,
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
    debug: !process.env.NODE_ENV.endsWith('production'),
    defaultNS: 'app',
    // ns: ['common'],
    lowerCaseLng: true,

    interpolation: {
      escapeValue: false, // not needed for react as it escapes by default
    },
    // backend: {
    //   loadPath: 'locales/{{lng}}/{{ns}}.{{lng}}.json'
    // }
  })

export default i18n
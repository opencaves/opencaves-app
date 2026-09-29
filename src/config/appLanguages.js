// The app's (UI's) own languages: what the interface is shown in - one per
// src/locales/*.json file. Not to be confused with content languages, which
// the cave data is written in (see contentLanguages.js).
export const APP_LANGUAGES = [
  // nativeName: each language's name in itself, recognizable whatever the
  // current UI language (the account page's language setting).
  { code: 'en', nativeName: 'English' },
  { code: 'fr', nativeName: 'Français' },
  { code: 'es', nativeName: 'Español' },
]

export const APP_LANGUAGE_CODES = APP_LANGUAGES.map(({ code }) => code)

// The app language picked on the account page, on this device (read by
// i18next's detector); absent means Automatic: the browser's language.
export const APP_LANGUAGE_STORAGE_KEY = 'oc-language'

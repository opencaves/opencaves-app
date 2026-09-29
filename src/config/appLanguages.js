// The app's (UI's) own languages: what the interface is shown in - one per
// src/locales/*.json file. Not to be confused with content languages, which
// the cave data is written in (see contentLanguages.js).
export const APP_LANGUAGES = [
  // nativeName: each language's name in itself, recognizable whatever the
  // current UI language (the account page's language setting).
  { code: 'en', nativeName: 'English' },
  { code: 'fr', nativeName: 'Français' },
  { code: 'es', nativeName: 'Español' },
  // Yucatec Maya (BCP 47 `yua`: no two-letter code exists). Partly
  // translated: what isn't falls back to Spanish (see FALLBACK_LANGUAGES).
  { code: 'yua', nativeName: "Maaya t'aan" },
]

export const APP_LANGUAGE_CODES = APP_LANGUAGES.map(({ code }) => code)

// Where an app language's missing strings come from, when not English:
// Spanish is the second language of Yucatec Maya speakers.
export const FALLBACK_LANGUAGES = {
  yua: ['es', 'en'],
  default: ['en'],
}

// The language to ask outside services (Mapbox and Google geocoding, Firebase
// Auth's emails) for, for app languages they don't support.
export const SERVICE_LANGUAGE = {
  yua: 'es',
}

// The app language picked on the account page, on this device (read by
// i18next's detector); absent means Automatic: the browser's language.
export const APP_LANGUAGE_STORAGE_KEY = 'oc-language'

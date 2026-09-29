// Content languages - what cave and reference data is written in (name
// translations, descriptions) - are data: the Firestore `languages` collection
// (ISO 639-2 codes, e.g. eng, spa, myn), which can include languages the app
// itself isn't translated into. Not to be confused with app languages (see
// appLanguages.js).

// The bridge between the two: which content language to show (or write) for
// each app language, e.g. descriptions in `spa` while the app is in Spanish.
export const APP_TO_CONTENT_LANGUAGE = {
  en: 'eng',
  fr: 'fra',
  es: 'spa',
}

export const DEFAULT_CONTENT_LANGUAGE = 'eng'

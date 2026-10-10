/**
 * A cave's name translations as one labelled line per language ("Anglais :
 * The Bees"), the same on the map's pane and the cave page - shown bare under
 * the name (it read like a type: "Cenote" for Dzulo), merged into "aka" on
 * the page, and only in the reader's own language (none in French). The
 * name's own language left out.
 *
 * @param {object} cave
 * @param {string} appLanguage
 * @param {object[]} [languages=[]] - The content languages (the store's data.languages: code, and
 *   their names keyed by content language).
 * @param {(language: string, names: string) => *} [format] - One line from the language's name and
 *   the names, comma-separated ("language: names" by default).
 * @returns {Array}
 */
export function nameTranslationLines(cave, appLanguage, languages = [], format = (language, names) => `${language}: ${names}`) {
  const translations = cave?.nameTranslations || {}
  const display = (() => {
    try {
      return new Intl.DisplayNames([appLanguage], { type: 'language' })
    } catch {
      return null
    }
  })()
  return Object.entries(translations)
    .filter(([code, names]) => code !== cave?.name?.languageCode && Array.isArray(names) && names.some(Boolean))
    .map(([code, names]) => {
      // The browser's name for it (French "anglais"), else the collection's.
      const known = display?.of(code)
      const record = languages.find((language) => language.code === code)
      const name = known && known !== code ? known : record?.[code] || record?.eng || code
      return format(name.charAt(0).toLocaleUpperCase(appLanguage) + name.slice(1), names.filter(Boolean).join(', '))
    })
}

// A dropdown's options ({ value, label, ... }) in alphabetical order of their
// labels, in the app's language (accents and case aside: "Écran" with the E's).
export function sortByLabel(options, language) {
  const collator = new Intl.Collator(language, { sensitivity: 'base', numeric: true })
  return [...options].sort((a, b) => collator.compare(a.label, b.label))
}

// Partial dates, as the data writes them: "2024", "2024-12", "2024-12-03", or
// a range of years "1990-1992" (PartialDateField, firestore.rules'
// partialDate).

/**
 * A partial date as the reader writes it: a year, a month and year, a day, or
 * a range of years ("1990–1992"). A date in no such form ("< 2004-10", written
 * before the rules checked it) is shown as written: one bad value mustn't take
 * the page down (Intl throws on an invalid date).
 *
 * @param {string|undefined} date
 * @param {string} language - The app's language (Intl's month names).
 * @returns {string} '' without a date.
 */
export function formatPartialDate(date, language) {
  if (!date) return ''
  const range = /^(\d{4})-(\d{4})$/.exec(date)
  if (range) return `${range[1]}–${range[2]}`
  const parts = /^(\d{4})(?:-(\d{2})(?:-(\d{2}))?)?$/.exec(date)
  if (!parts) return date
  const [year, month, day] = parts.slice(1).map(Number)
  if (!month) return String(year)
  const value = new Date(Date.UTC(year, month - 1, day || 1))
  // Date.UTC rolls over ("2004-13" would be January 2005).
  if (value.getUTCMonth() !== month - 1 || (day && value.getUTCDate() !== day)) return date
  /** @type {Intl.DateTimeFormatOptions} */
  const options = day ? { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC' } : { year: 'numeric', month: 'long', timeZone: 'UTC' }
  return new Intl.DateTimeFormat(language, options).format(value)
}

/**
 * Today as a partial date of the given precision: "2026-10", or "2026-10-11".
 *
 * @param {'month'|'day'} [precision='month']
 * @returns {string}
 */
export function todayPartialDate(precision = 'month') {
  const iso = new Date().toISOString()
  return precision === 'day' ? iso.slice(0, 10) : iso.slice(0, 7)
}

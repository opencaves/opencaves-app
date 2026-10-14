import { REVIEW_SECTIONS, REVIEW_VALID_MONTHS } from '@/config/caveReview.js'

// A confirmation's month, as Cave.reviewed holds it.
const MONTH_PATTERN = /^(\d{4})-(\d{2})$/

/**
 * Whether `value` is a string with something other than spaces in it.
 *
 * @param {unknown} value
 * @returns {boolean}
 */
export const hasText = (value) => typeof value === 'string' && value.trim() !== ''

/**
 * A date's month, 'YYYY-MM' (the device's time zone): what "Still accurate"
 * stamps, and what a confirmation's age is counted against.
 *
 * @param {Date} [date=new Date()]
 * @returns {string}
 */
export function monthOf(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
}

/**
 * Whether a value is a confirmation's month ('YYYY-MM', a real month).
 *
 * @param {unknown} value
 * @returns {boolean}
 */
export function isReviewMonth(value) {
  const match = typeof value === 'string' && value.match(MONTH_PATTERN)
  return Boolean(match) && Number(match[2]) >= 1 && Number(match[2]) <= 12
}

// A 'YYYY-MM' month as a count of months.
const monthIndex = (month) => Number(month.slice(0, 4)) * 12 + Number(month.slice(5, 7)) - 1

/**
 * Whether a section confirmed in month still counts as confirmed in now:
 * less than {@link REVIEW_VALID_MONTHS} months before it.
 *
 * @param {string|null|undefined} month - 'YYYY-MM'.
 * @param {string} now - 'YYYY-MM' ({@link monthOf}).
 * @returns {boolean}
 */
export function isRecentReview(month, now) {
  if (!isReviewMonth(month) || !isReviewMonth(now)) return false
  return monthIndex(now) - monthIndex(month) < REVIEW_VALID_MONTHS
}

/**
 * The sections of a cave its page and the map's pane show (each with its
 * "Still right?" line), in {@link REVIEW_SECTIONS}' order: its access
 * always; getting there, its description when it has them; its fees when
 * they show (Access: fees charged).
 *
 * @param {Cave} cave
 * @returns {string[]}
 */
export function shownReviewSections(cave) {
  const shown = { access: true, directions: hasText(cave.direction), fees: Boolean(cave.fees), description: hasText(cave.description) }
  return REVIEW_SECTIONS.filter((section) => shown[section])
}

/**
 * The latest month any of a cave's shown sections ({@link shownReviewSections})
 * was confirmed in, or null: none was.
 *
 * @param {Cave} cave
 * @returns {string|null}
 */
export function lastReviewedMonth(cave) {
  const reviewed = cave.reviewed && typeof cave.reviewed === 'object' ? cave.reviewed : {}
  const months = shownReviewSections(cave).map((section) => reviewed[section]).filter(isReviewMonth)
  return months.length > 0 ? months.sort().at(-1) : null
}

/**
 * A section's confirmation as its line says it: 'recent' (confirmed less
 * than {@link REVIEW_VALID_MONTHS} months ago), 'stale' (longer ago) or
 * 'never'.
 *
 * @param {string|null|undefined} month - The section's 'YYYY-MM', if any.
 * @param {string} now - 'YYYY-MM'.
 * @returns {'recent'|'stale'|'never'}
 */
export function reviewState(month, now) {
  if (!isReviewMonth(month)) return 'never'
  return isRecentReview(month, now) ? 'recent' : 'stale'
}

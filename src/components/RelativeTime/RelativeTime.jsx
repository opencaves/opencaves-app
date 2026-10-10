import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { toServiceLanguage } from '@/utils/lang.js'
import { RELATIVE_TIME_TAG, defineRelativeTimeElement } from './relativeTimeElement.js'

/**
 * A Date, a Firestore Timestamp, or a plain { seconds } object, as a Date.
 *
 * @param {Date|Timestamp|{seconds: number, nanoseconds?: number}} value
 * @returns {Date|null}
 */
export function toDate(value) {
  if (!value) return null
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value
  const timestamp = /** @type {import('firebase/firestore').Timestamp} */ (value)
  if (typeof timestamp.toDate === 'function') return timestamp.toDate()
  if (typeof value.seconds === 'number') return new Date(value.seconds * 1000 + Math.round((value.nanoseconds || 0) / 1e6))
  return null
}

/**
 * A date as "3 minutes ago", kept up to date: the <oc-relative-time> element
 * (relativeTimeElement.js), registered here from the browser. Its light DOM
 * is the fallback - a <time> with the date, in UTC, the same on the server
 * and in the browser (hydration) - shown until the element is defined; its
 * exact date and time is the element's own tooltip (hover, keyboard focus)
 * and hidden text for screen readers.
 *
 * @param {object} props
 * @param {Date|Timestamp|{seconds: number, nanoseconds?: number}} props.value - The date (toDate).
 * @param {string} [props.className]
 * @param {boolean} [props.focusable=false] - A Tab stop, and a tap target on touch screens, showing its exact date on focus; never inside a link or button (it would take their click).
 */
export default function RelativeTime({ value, className, focusable = false }) {
  const { i18n } = useTranslation()
  useEffect(() => defineRelativeTimeElement(), [])
  const date = toDate(value)
  if (!date) return null
  const language = toServiceLanguage(i18n.language)
  const Tag = RELATIVE_TIME_TAG
  return (
    <Tag className={['oc-relative-time', className].filter(Boolean).join(' ')} datetime={date.toISOString()} lang={language} focusable={focusable ? '' : undefined}>
      <time dateTime={date.toISOString()}>{new Intl.DateTimeFormat(language, { dateStyle: 'medium', timeZone: 'UTC' }).format(date)}</time>
    </Tag>
  )
}

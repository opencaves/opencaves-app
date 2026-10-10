import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { toServiceLanguage } from '@/utils/lang.js'
import { RELATIVE_TIME_TAG, defineRelativeTimeElement } from './relativeTimeElement.js'

// A Date, a Firestore Timestamp, or a plain { seconds } object, as a Date.
export function toDate(value) {
  if (!value) return null
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value
  if (typeof value.toDate === 'function') return value.toDate()
  if (typeof value.seconds === 'number') return new Date(value.seconds * 1000 + Math.round((value.nanoseconds || 0) / 1e6))
  return null
}

// A date as "3 minutes ago", kept up to date: the <oc-relative-time> element
// (relativeTimeElement.js), registered here from the browser. Its light DOM
// is the fallback - the date, in UTC, the same on the server and in the
// browser (hydration) - shown until the element is defined; its exact date
// and time on hover is the element's own title.
export default function RelativeTime({ value, className }) {
  const { i18n } = useTranslation()
  useEffect(() => defineRelativeTimeElement(), [])
  const date = toDate(value)
  if (!date) return null
  const language = toServiceLanguage(i18n.language)
  const Tag = RELATIVE_TIME_TAG
  return (
    <Tag className={['oc-relative-time', className].filter(Boolean).join(' ')} datetime={date.toISOString()} lang={language}>
      {new Intl.DateTimeFormat(language, { dateStyle: 'medium', timeZone: 'UTC' }).format(date)}
    </Tag>
  )
}

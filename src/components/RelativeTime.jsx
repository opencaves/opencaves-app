import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import Box from '@mui/material/Box'
import Tooltip from '@/components/Tooltip.jsx'
import { useHydrated } from '@/hooks/useHydrated.js'
import { toServiceLanguage } from '@/utils/lang.js'

// The app's <relative-time> (GitHub's element): "just now", "3 minutes ago",
// "yesterday"... up to a month, then the date itself ("on Oct 3", with the
// year when not this one); the exact date and time on hover. It keeps itself
// up to date: every instance listens to one shared ticker (below), which
// ticks as often as the youngest time shown needs.

const MINUTE = 60 * 1000
const HOUR = 60 * MINUTE
const DAY = 24 * HOUR
// Past this age, the date itself instead of "n days ago".
const DATE_AFTER = 30 * DAY

// --- The shared ticker -----------------------------------------------------
// One timer for every instance: every 15 s while a time shown is under a
// minute old, every minute under an hour, hourly beyond; stopped while the
// tab is hidden, and every instance refreshed when it shows again. Started
// by the first instance mounted (in an effect: nothing runs on the server),
// stopped with the last.
const listeners = new Map() // listener -> the time it shows (ms)
let timer = null

function delay() {
  const now = Date.now()
  const youngest = Math.min(...[...listeners.values()].map((time) => Math.abs(now - time)))
  return youngest < MINUTE ? 15 * 1000 : youngest < HOUR ? MINUTE : HOUR
}

function schedule() {
  clearTimeout(timer)
  timer = null
  if (!listeners.size || document.hidden) return
  timer = setTimeout(tick, delay())
}

function tick() {
  for (const listener of listeners.keys()) listener()
  schedule()
}

function onVisibilityChange() {
  if (document.hidden) schedule()
  else tick()
}

function subscribe(listener, time) {
  if (!listeners.size) document.addEventListener('visibilitychange', onVisibilityChange)
  listeners.set(listener, time)
  schedule()
  return () => {
    listeners.delete(listener)
    if (!listeners.size) {
      document.removeEventListener('visibilitychange', onVisibilityChange)
      clearTimeout(timer)
      timer = null
    } else schedule()
  }
}
// ---------------------------------------------------------------------------

// A Date, a Firestore Timestamp, or a plain { seconds } object, as a Date.
export function toDate(value) {
  if (!value) return null
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value
  if (typeof value.toDate === 'function') return value.toDate()
  if (typeof value.seconds === 'number') return new Date(value.seconds * 1000 + Math.round((value.nanoseconds || 0) / 1e6))
  return null
}

// The relative text of a date, `now` being now.
export function formatRelativeTime(date, language, t, now = Date.now()) {
  const age = now - date.getTime()
  if (Math.abs(age) < 45 * 1000) return t('justNow')
  if (Math.abs(age) >= DATE_AFTER) {
    const sameYear = date.getFullYear() === new Date(now).getFullYear()
    return t('on', { date: new Intl.DateTimeFormat(language, { month: 'short', day: 'numeric', ...(!sameYear && { year: 'numeric' }) }).format(date) })
  }
  const format = new Intl.RelativeTimeFormat(language, { numeric: 'auto' })
  const [value, unit] = Math.abs(age) < HOUR ? [age / MINUTE, 'minute'] : Math.abs(age) < DAY ? [age / HOUR, 'hour'] : [age / DAY, 'day']
  return format.format(-Math.round(value), unit)
}

export default function RelativeTime({ value, className, sx }) {
  const { t, i18n } = useTranslation('relativeTime')
  const hydrated = useHydrated()
  const date = toDate(value)
  const time = date?.getTime()
  const [, setTick] = useState(0)

  useEffect(() => {
    if (time == null) return undefined
    return subscribe(() => setTick((n) => n + 1), time)
  }, [time])

  if (!date) return null
  const language = toServiceLanguage(i18n.language)
  // The server and a hydration render a stable text (the date, in UTC): the
  // relative one depends on the reader's clock.
  const text = hydrated ? formatRelativeTime(date, language, t) : date.toISOString().slice(0, 10)
  const exact = new Intl.DateTimeFormat(language, { dateStyle: 'full', timeStyle: 'short' }).format(date)
  return (
    <Tooltip title={exact}>
      <Box component="time" className={['oc-relative-time', className].filter(Boolean).join(' ')} dateTime={date.toISOString()} sx={[{ textDecoration: 'underline dotted', textUnderlineOffset: '3px' }, ...(Array.isArray(sx) ? sx : [sx])]}>
        {text}
      </Box>
    </Tooltip>
  )
}

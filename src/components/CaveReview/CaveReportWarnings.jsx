import { useTranslation } from 'react-i18next'
import { Alert, Stack } from '@mui/material'
import { useCaveReports } from '@/models/caveReports.js'
import { useHydrated } from '@/hooks/useHydrated.js'
import { useReviewMonth } from '@/hooks/useReviewMonth.js'

/**
 * A cave's open "closed" and "now private" reports (useCaveReports), each a
 * warning at the top of its page and of the map's pane: "Reported closed on
 * Oct 12, being checked" - until an admin resolves the report. Nothing
 * while there's none. Its dates in UTC until the page is hydrated (the
 * server's), then in the device's time zone.
 *
 * @param {object} props
 * @param {string} props.caveId
 * @param {Sx} [props.sx]
 */
export default function CaveReportWarnings({ caveId, sx }) {
  const { t, i18n } = useTranslation('caveReview')
  const [reports] = useCaveReports(caveId)
  const hydrated = useHydrated()
  const year = useReviewMonth().slice(0, 4)
  if (reports.length === 0) return null

  const format = (at) => {
    const millis = typeof at?.toMillis === 'function' ? at.toMillis() : typeof at?.seconds === 'number' ? at.seconds * 1000 : null
    if (millis == null) return ''
    const date = new Date(millis)
    const timeZone = hydrated ? undefined : 'UTC'
    // The year only when it isn't this one.
    const otherYear = new Intl.DateTimeFormat('en', { year: 'numeric', timeZone }).format(date) !== year
    return new Intl.DateTimeFormat(i18n.resolvedLanguage, { month: 'short', day: 'numeric', ...(otherYear && { year: 'numeric' }), timeZone }).format(date)
  }

  return (
    <Stack className="oc-cave-report-warnings" spacing={1} sx={sx}>
      {reports.map((report) => (
        <Alert key={report.feedbackId} className={`oc-cave-report-warnings--${report.kind}`} severity="warning" sx={{ borderRadius: 3 }}>
          {t(`warning.${report.kind}`, { date: format(report.at) })}
        </Alert>
      ))}
    </Stack>
  )
}

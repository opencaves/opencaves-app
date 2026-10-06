import { useTranslation } from 'react-i18next'
import { Box, Typography } from '@mui/material'
import SistemaArrow from '@/components/SistemaArrow.jsx'
import Markdown from '@/components/Markdown/Markdown.jsx'

// The timeline's geometry: a dot centred on an entry's first line (body2,
// 20px), the text this far from the section's left.
const TIMELINE_DOT = 10
const TIMELINE_DOT_TOP = 5
const TIMELINE_INSET = 24

// A partial date's sort key: its own text (ISO, so "2004" < "2004-10" <
// "2004-10-16" < "2004-11"), a range ("2004-2006") by its first year.
// Undated last.
function sortKey(date) {
  if (!date) return '￿'
  return /^\d{4}-\d{4}$/.test(date) ? date.slice(0, 4) : date
}

// A partial date as the reader writes it: a year, a month and year, a day,
// or a range of years.
function formatDate(date, language) {
  if (!date) return ''
  const range = /^(\d{4})-(\d{4})$/.exec(date)
  if (range) return `${range[1]}–${range[2]}`
  const [year, month, day] = date.split('-').map(Number)
  if (!month) return String(year)
  const value = new Date(Date.UTC(year, month - 1, day || 1))
  const options = day ? { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC' } : { year: 'numeric', month: 'long', timeZone: 'UTC' }
  return new Intl.DateTimeFormat(language, options).format(value)
}

// The exploration history of a cave's systems (its own and those it joined),
// in calendar order where the dates allow, each entry with its system's name
// when there's more than one system. headingProps: its heading's, e.g. an h2
// on a system's own page; showNotes: false leaves out each entry's notes (its
// sources).
export default function ExplorationHistory({ sistemas, headingProps, showNotes = true }) {
  const { t, i18n } = useTranslation('resultPane')
  const entries = sistemas
    .flatMap((sistema) => (sistema?.explorations || []).map((exploration) => ({ ...exploration, sistemaName: sistema.name, sistemaColor: sistema.color, notes: showNotes ? exploration.notes : null })))
    .filter((e) => e.date || e.team || e.description || e.notes)
    .map((entry, index) => ({ entry, index }))
    .sort((a, b) => sortKey(a.entry.date).localeCompare(sortKey(b.entry.date)) || a.index - b.index)
    .map(({ entry }) => entry)
  if (entries.length === 0) return null
  const severalSistemas = new Set(entries.map((e) => e.sistemaName)).size > 1

  return (
    // Under the tree but not indented like it: lined up with the section's
    // system icon (the accordion details' left padding back to the pane's).
    <Box className="oc-exploration-history" sx={{ mt: 2, ml: 'calc(var(--oc-pane-padding-inline) - var(--oc-details-icon-min-width) - 24px)' }}>
      <Typography variant="subtitle2" component="h3" sx={{ mb: 1 }} {...headingProps}>
        {t('explorationHistory')}
      </Typography>
      {/* A vertical timeline at the left: a line through every entry, a dot
          beside each one's first line (its date). */}
      <Box
        component="ol"
        sx={(theme) => ({
          listStyle: 'none',
          m: 0,
          p: 0,
          display: 'flex',
          flexDirection: 'column',
          gap: 1.5,
          '& > li': { position: 'relative', pl: `${TIMELINE_INSET}px` },
          // The line: from the first dot to the last one.
          '& > li:not(:last-child)::before': {
            content: '""',
            position: 'absolute',
            left: TIMELINE_DOT / 2 - 1,
            top: TIMELINE_DOT_TOP + TIMELINE_DOT / 2,
            bottom: `calc(${theme.spacing(-1.5)} - ${TIMELINE_DOT_TOP + TIMELINE_DOT / 2}px)`,
            width: 2,
            bgcolor: theme.vars.sys.color.outlineVariant,
          },
          '& > li::after': {
            content: '""',
            position: 'absolute',
            left: 0,
            top: TIMELINE_DOT_TOP,
            width: TIMELINE_DOT,
            height: TIMELINE_DOT,
            borderRadius: '50%',
            bgcolor: 'primary.main',
          },
        })}
      >
        {entries.map((entry, index) => (
          <Box component="li" key={index} className="oc-exploration-history--entry">
            {(entry.date || severalSistemas) && (
              <Typography variant="body2" sx={{ fontWeight: 500 }}>
                {entry.date && formatDate(entry.date, i18n.language)}
                {severalSistemas && (
                  <>
                    {entry.date && ' · '}
                    <SistemaArrow color={entry.sistemaColor} sx={{ mr: 0.5 }} />
                    {entry.sistemaName}
                  </>
                )}
              </Typography>
            )}
            {entry.team && (
              <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                {entry.team}
              </Typography>
            )}
            {entry.description && (
              <Box sx={{ typography: 'body2', '& .oc-markdown p': { my: 0.5 } }}>
                <Markdown>{entry.description}</Markdown>
              </Box>
            )}
            {entry.notes && (
              <Typography variant="caption" component="p" sx={{ color: 'text.secondary' }}>
                {entry.notes}
              </Typography>
            )}
          </Box>
        ))}
      </Box>
    </Box>
  )
}

import { useTranslation } from 'react-i18next'
import { Box, Typography } from '@mui/material'
import SistemaArrow from '@/components/SistemaArrow.jsx'
import Markdown from '@/components/Markdown/Markdown.jsx'
import { teamLabel, teamNames } from '@/utils/explorationTeam.js'
import { formatPartialDate } from '@/utils/partialDate.js'
import './ExplorationHistory.scss'

// A partial date's sort key: its own text (ISO, so "2004" < "2004-10" <
// "2004-10-16" < "2004-11"), a range ("2004-2006") by its first year.
// Undated last.
function sortKey(date) {
  if (!date) return '￿'
  return /^\d{4}-\d{4}$/.test(date) ? date.slice(0, 4) : date
}

/**
 * The exploration history of a cave's systems (its own and those it joined),
 * in calendar order where the dates allow, each entry with its system's name
 * when there's more than one system. Each entry's notes (its sources) are an editing aid,
 * seen in the edit forms only, never here.
 *
 * @param {object} props
 * @param {Sistema[]} props.sistemas - The systems whose explorations it lists.
 * @param {boolean} [props.showHeading=true]
 * @param {object} [props.headingProps] - Its heading's, e.g. an h2
 *   on a system's own page.
 */
export default function ExplorationHistory({ sistemas, headingProps, showHeading = true }) {
  const { t, i18n } = useTranslation('resultPane')
  const entries = sistemas
    .flatMap((sistema) => (sistema?.explorations || []).map((exploration) => ({ ...exploration, sistemaName: sistema.name, sistemaColor: sistema.color })))
    .filter((e) => e.date || teamNames(e.team).length || e.description)
    .map((entry, index) => ({ entry, index }))
    .sort((a, b) => sortKey(a.entry.date).localeCompare(sortKey(b.entry.date)) || a.index - b.index)
    .map(({ entry }) => entry)
  if (entries.length === 0) return null
  const severalSistemas = new Set(entries.map((e) => e.sistemaName)).size > 1

  return (
    // Under the tree but not indented like it: lined up with the section's
    // system icon (the accordion details' left padding back to the pane's).
    <Box className="oc-exploration-history" sx={{ mt: 2, ml: 'calc(var(--oc-pane-padding-inline) - var(--oc-details-icon-min-width) - 24px)' }}>
      {showHeading && (
        <Typography variant="subtitle2" component="h3" sx={{ mb: 1 }} {...headingProps}>
          {t('explorationHistory')}
        </Typography>
      )}
      {/* A vertical timeline at the left: a line through every entry, a dot
          beside each one's first line (its date). */}
      <Box component="ol" className="oc-exploration-history--timeline">
        {entries.map((entry, index) => (
          <Box component="li" key={index} className="oc-exploration-history--entry">
            {(entry.date || severalSistemas) && (
              <Typography variant="body2" sx={{ fontWeight: 500 }}>
                {entry.date && formatPartialDate(entry.date, i18n.language)}
                {severalSistemas && (
                  <>
                    {entry.date && ' · '}
                    <SistemaArrow color={entry.sistemaColor} sx={{ mr: 0.5 }} />
                    {entry.sistemaName}
                  </>
                )}
              </Typography>
            )}
            {teamNames(entry.team).length > 0 && (
              <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                {teamLabel(entry.team)}
              </Typography>
            )}
            {entry.description && (
              <Box sx={{ typography: 'body2', '& .oc-markdown p': { my: 0.5 } }}>
                <Markdown>{entry.description}</Markdown>
              </Box>
            )}
          </Box>
        ))}
      </Box>
    </Box>
  )
}

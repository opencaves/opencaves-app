import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Alert, Box, ButtonBase, Typography } from '@mui/material'
import ArrowForwardRounded from '@mui/icons-material/ArrowForwardRounded'
import UnfoldMoreRounded from '@mui/icons-material/UnfoldMoreRounded'
import { lineCounts, lineDiff, toHunks } from '@/utils/lineDiff.js'
import PersonLabel from './PersonLabel.jsx'
import { entryFields, formatFullDate, formatValue, isCompactValue, toDiffText, toDate } from './auditFormat.js'

// Unchanged lines kept around each change; longer runs fold into an
// "Expand N unchanged lines" row (like GitHub's hunks).
const CONTEXT_LINES = 3

// The diff's colours (M3 error/success roles at a low opacity over the
// surface - stronger for the words that changed within a line), stronger in
// the dark theme, where a faint tint disappears.
const diffColorsSx = (theme) => ({
  '--oc-diff-removed-bg': `rgb(${theme.vars.palette.error.mainChannel} / 0.10)`,
  '--oc-diff-removed-word-bg': `rgb(${theme.vars.palette.error.mainChannel} / 0.28)`,
  '--oc-diff-added-bg': `rgb(${theme.vars.palette.success.mainChannel} / 0.12)`,
  '--oc-diff-added-word-bg': `rgb(${theme.vars.palette.success.mainChannel} / 0.32)`,
  '--oc-diff-gutter-bg': theme.vars.palette.action.hover,
  '--oc-diff-removed-fg': theme.vars.palette.error.dark,
  '--oc-diff-added-fg': theme.vars.palette.success.dark,
  ...theme.applyStyles('dark', {
    '--oc-diff-removed-bg': `rgb(${theme.vars.palette.error.mainChannel} / 0.18)`,
    '--oc-diff-removed-word-bg': `rgb(${theme.vars.palette.error.mainChannel} / 0.42)`,
    '--oc-diff-added-bg': `rgb(${theme.vars.palette.success.mainChannel} / 0.18)`,
    '--oc-diff-added-word-bg': `rgb(${theme.vars.palette.success.mainChannel} / 0.42)`,
    '--oc-diff-removed-fg': theme.vars.palette.error.light,
    '--oc-diff-added-fg': theme.vars.palette.success.light,
  }),
})

const MONO = { fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace', fontSize: '0.8125rem' }

// A short value as a chip: red and struck through on the old side, green on
// the new one; a field that wasn't there, an outlined "(none)".
function ValueChip({ value, tone, label }) {
  const { t, i18n } = useTranslation('audits')
  const formatted = formatValue(value, i18n.language)
  return (
    <Box
      component="span"
      className={`oc-audit-value-chip oc-audit-value-chip--${formatted.absent ? 'absent' : tone}`}
      aria-label={label}
      sx={[
        { display: 'inline-block', maxWidth: '100%', px: 1, py: 0.25, borderRadius: 2, typography: 'body2', overflowWrap: 'anywhere', whiteSpace: 'pre-wrap' },
        formatted.code && MONO,
        formatted.absent
          ? { fontStyle: 'italic', color: 'text.secondary', border: 1, borderColor: 'divider' }
          : tone === 'removed'
            ? { bgcolor: 'var(--oc-diff-removed-word-bg)', textDecoration: 'line-through' }
            : { bgcolor: 'var(--oc-diff-added-word-bg)' },
      ]}
    >
      {formatted.absent ? t('details.absent') : formatted.text}
    </Box>
  )
}

// A text (or JSON) change as a unified line diff: old and new line numbers,
// a -/+ marker, removed lines red, added green, the changed words within a
// line stronger; unchanged runs folded. Scrolls sideways on wide screens,
// wraps on a phone.
function LineDiff({ rows }) {
  const { t } = useTranslation('audits')
  const [expanded, setExpanded] = useState(() => new Set())
  const hunks = useMemo(() => toHunks(rows, CONTEXT_LINES), [rows])

  function lineRow(row, key) {
    const marker = row.type === 'removed' ? '-' : row.type === 'added' ? '+' : ' '
    return (
      <Box component="tr" key={key} className={`oc-audit-diff--line oc-audit-diff--${row.type}`} sx={{ bgcolor: row.type === 'same' ? 'transparent' : `var(--oc-diff-${row.type}-bg)` }}>
        <Box component="td" className="oc-audit-diff--line-number" sx={gutterSx}>
          {row.oldNo ?? ''}
        </Box>
        <Box component="td" className="oc-audit-diff--line-number" sx={gutterSx}>
          {row.newNo ?? ''}
        </Box>
        <Box component="td" aria-hidden="true" sx={{ width: '1.5em', textAlign: 'center', userSelect: 'none', verticalAlign: 'top', color: row.type === 'same' ? 'text.disabled' : `var(--oc-diff-${row.type}-fg)` }}>
          {marker}
        </Box>
        <Box component="td" sx={{ pr: 1.5, verticalAlign: 'top', whiteSpace: { xs: 'pre-wrap', sm: 'pre' }, overflowWrap: { xs: 'anywhere', sm: 'normal' } }}>
          {row.parts
            ? row.parts.map((part, i) =>
                part.type === 'same' ? (
                  part.text
                ) : (
                  <Box key={i} component={part.type === 'removed' ? 'del' : 'ins'} sx={{ textDecoration: 'none', bgcolor: `var(--oc-diff-${part.type}-word-bg)`, borderRadius: '2px' }}>
                    {part.text}
                  </Box>
                ),
              )
            : row.text || ' '}
        </Box>
      </Box>
    )
  }

  return (
    <Box className="oc-audit-diff--scroll" sx={{ overflowX: 'auto' }}>
      <Box component="table" className="oc-audit-diff--table" sx={{ ...MONO, lineHeight: 1.5, borderCollapse: 'collapse', width: { xs: '100%', sm: 'max-content' }, minWidth: '100%' }}>
        <tbody>
          {hunks.map((hunk, h) =>
            hunk.kind === 'gap' && !expanded.has(h) ? (
              <Box component="tr" key={`gap-${h}`} className="oc-audit-diff--gap" sx={{ bgcolor: 'var(--oc-diff-gutter-bg)' }}>
                <td colSpan={4}>
                  <ButtonBase
                    className="oc-audit-diff--expand"
                    onClick={() => setExpanded((prev) => new Set(prev).add(h))}
                    sx={{ width: '100%', justifyContent: 'flex-start', gap: 1, px: 1, py: 0.5, typography: 'body2', color: 'var(--mui-sys-color-primary)', '&:hover': { bgcolor: 'action.hover' } }}
                  >
                    <UnfoldMoreRounded fontSize="small" />
                    {t('details.expandLines', { count: hunk.rows.length })}
                  </ButtonBase>
                </td>
              </Box>
            ) : (
              hunk.rows.map((row, r) => lineRow(row, `${h}-${r}`))
            ),
          )}
        </tbody>
      </Box>
    </Box>
  )
}

const gutterSx = {
  width: '1%',
  minWidth: '2.5em',
  px: 1,
  textAlign: 'right',
  verticalAlign: 'top',
  userSelect: 'none',
  color: 'text.secondary',
  bgcolor: 'var(--oc-diff-gutter-bg)',
  whiteSpace: 'nowrap',
}

// One field's change. Short values: old -> new chips. Texts, and objects as
// pretty JSON: a GitHub-like line diff under a header with the field's name
// and its +added -removed line counts. beforeLabel/afterLabel name the two
// sides when they aren't before/after (a conflict: expected/now). oneSided:
// a creation or deletion, whose missing side isn't shown as "(none)".
export function FieldChange({ field, before, after, beforeLabel, afterLabel, oneSided = false }) {
  const { t, i18n } = useTranslation('audits')
  const compact = isCompactValue(before) && isCompactValue(after)
  const rows = useMemo(() => (compact ? [] : lineDiff(toDiffText(before, i18n.language), toDiffText(after, i18n.language))), [compact, before, after, i18n.language])
  const { added, removed } = lineCounts(rows)

  if (compact) {
    const showBefore = before !== undefined || !oneSided
    const showAfter = after !== undefined || !oneSided
    return (
      <Box className="oc-audit-field-change oc-audit-field-change--compact" sx={[diffColorsSx, { display: 'flex', flexWrap: 'wrap', alignItems: 'center', columnGap: 1, rowGap: 0.5 }]}>
        <Typography variant="subtitle2" component="span" sx={{ ...MONO, fontWeight: 500, minWidth: { sm: 140 } }}>
          {field}
        </Typography>
        {showBefore && (
          <>
            {beforeLabel && <Typography variant="caption" color="text.secondary">{beforeLabel}</Typography>}
            <ValueChip value={before} tone="removed" label={beforeLabel || t('details.before')} />
          </>
        )}
        {showBefore && showAfter && <ArrowForwardRounded aria-hidden="true" fontSize="small" sx={{ color: 'text.secondary' }} />}
        {showAfter && (
          <>
            {afterLabel && <Typography variant="caption" color="text.secondary">{afterLabel}</Typography>}
            <ValueChip value={after} tone="added" label={afterLabel || t('details.after')} />
          </>
        )}
      </Box>
    )
  }

  return (
    <Box className="oc-audit-field-change oc-audit-field-change--diff" sx={[diffColorsSx, { border: 1, borderColor: 'divider', borderRadius: 2, overflow: 'hidden', minWidth: 0 }]}>
      <Box className="oc-audit-field-change--header" sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', columnGap: 1.5, px: 1.5, py: 0.75, bgcolor: 'var(--oc-diff-gutter-bg)', borderBottom: 1, borderColor: 'divider' }}>
        <Typography variant="subtitle2" component="span" sx={{ ...MONO, fontWeight: 500, overflowWrap: 'anywhere' }}>
          {field}
        </Typography>
        {(beforeLabel || afterLabel) && (
          <Typography variant="caption" color="text.secondary">
            {`- ${beforeLabel || t('details.before')}   + ${afterLabel || t('details.after')}`}
          </Typography>
        )}
        <Box component="span" aria-label={t('details.lineCounts', { added, removed })} sx={{ ...MONO, ml: 'auto', display: 'inline-flex', gap: 1 }}>
          <Box component="span" aria-hidden="true" sx={{ color: 'var(--oc-diff-added-fg)', fontWeight: 600 }}>
            +{added}
          </Box>
          <Box component="span" aria-hidden="true" sx={{ color: 'var(--oc-diff-removed-fg)', fontWeight: 600 }}>
            −{removed}
          </Box>
        </Box>
      </Box>
      <LineDiff rows={rows} />
    </Box>
  )
}

// What an entry changed: each changed field old -> new; for a creation or a
// deletion (only one side), every field of the record, all added or removed.
export default function AuditEntryDetails({ entry, accountLabel }) {
  const { t, i18n } = useTranslation('audits')
  const fields = entryFields(entry)
  const record = entry.after ?? entry.before
  const undoneAt = toDate(entry.undoneAt)

  return (
    <Box className="oc-audit-entry-details" sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, py: 1, minWidth: 0 }}>
      {entry.tooLarge && (
        <Alert severity="info" variant="outlined">
          {t('details.tooLarge')}
        </Alert>
      )}

      {fields.length === 0 && !entry.tooLarge && (
        <Typography variant="body2" color="text.secondary">
          {t('details.noFields')}
        </Typography>
      )}

      {entry.tooLarge && !record
        ? fields.length > 0 && (
            // Only the changed fields' names were kept.
            <Typography variant="body2" sx={{ ...MONO, overflowWrap: 'anywhere' }}>
              {fields.join(', ')}
            </Typography>
          )
        : fields.map((field) => <FieldChange key={field} field={field} before={entry.before?.[field]} after={entry.after?.[field]} oneSided={!(entry.before && entry.after) && !Array.isArray(entry.changedFields)} />)}

      <Typography className="oc-audit-entry-details--meta" variant="caption" color="text.secondary" sx={{ overflowWrap: 'anywhere' }}>
        {[
          t('details.entryId', { id: entry.id }),
          t('details.recordId', { id: entry.docId }),
          entry.authType && t('details.authType', { type: entry.authType }),
        ]
          .filter(Boolean)
          .join(' · ')}
      </Typography>
      {undoneAt && (
        <Box className="oc-audit-entry-details--undone" sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'flex-start', columnGap: 1 }}>
          <Typography variant="caption" color="text.secondary" sx={{ lineHeight: 1.8 }}>
            {t('details.undoneBy', { date: formatFullDate(undoneAt, i18n.language) })}
          </Typography>
          <PersonLabel uid={entry.undoneBy} accountLabel={accountLabel} />
        </Box>
      )}
    </Box>
  )
}

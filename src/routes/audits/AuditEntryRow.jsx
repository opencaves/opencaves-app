import { memo } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Alert, Box, Checkbox, Chip, Collapse, IconButton, ListItem, Tooltip, Typography } from '@mui/material'
import ExpandMoreRounded from '@mui/icons-material/ExpandMoreRounded'
import UndoRounded from '@mui/icons-material/UndoRounded'
import { isUndoable } from '@/models/AuditLogModel.js'
import AuditEntryDetails from './AuditEntryDetails.jsx'
import PersonLabel from './PersonLabel.jsx'
import IconButtonGroup from '@/components/IconButtonGroup.jsx'
import { formatFullDate, formatRelative, toDate } from './auditFormat.js'

// The action's chip colour (M3 roles): additions, deletions, undos.
const ACTION_COLORS = { create: 'success', delete: 'error', purge: 'error', deleteUser: 'error', undo: 'info' }

/**
 * When it happened: relative ("5 minutes ago"), the full date on hover.
 */
export function When({ value }) {
  const { i18n } = useTranslation()
  const date = toDate(value)
  if (!date) return null
  return (
    <Tooltip title={formatFullDate(date, i18n.language)}>
      <Box component="time" className="oc-audit-when" dateTime={date.toISOString()}>
        {formatRelative(date, i18n.language)}
      </Box>
    </Tooltip>
  )
}

// One change: who, when, what (action, collection, record - a link while it
// exists), its state (undone, an undo of another change), the result of an
// undo just asked for; a checkbox and an Undo button when it can be undone;
// expanded, the change itself.
export default memo(function AuditEntryRow({ entry, label, path, accountLabel, selected, onToggleSelected, expanded, onToggleExpanded, onUndo, result, busy }) {
  const { t } = useTranslation('audits')
  const undoable = isUndoable(entry)
  const detailsId = `oc-audit-entry-${entry.id}`

  return (
    <ListItem className="oc-audit-entry-row" divider disablePadding sx={{ display: 'block', py: 1, px: { xs: 0, sm: 1 } }}>
      <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1 }}>
        <Box sx={{ width: 42, flex: 'none' }}>
          {undoable && <Checkbox checked={selected} disabled={busy} onChange={() => onToggleSelected(entry.id)} slotProps={{ input: { 'aria-label': t('selectEntry') } }} />}
        </Box>

        <Box sx={{ flex: 1, minWidth: 0, pt: 0.75 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', columnGap: 1, rowGap: 0.5 }}>
            <Chip size="small" variant="outlined" color={ACTION_COLORS[entry.action] || 'default'} label={t(`actions.${entry.action}`, { defaultValue: entry.action })} />
            <Typography variant="body2" color="text.secondary">
              {t(`collections.${entry.collection}`, { defaultValue: entry.collection })}
            </Typography>
            <Typography variant="body1" sx={{ minWidth: 0, overflowWrap: 'anywhere' }}>
              {path ? (
                <Link className="oc-audit-entry-row--record-link" to={path}>
                  {label}
                </Link>
              ) : (
                label
              )}
            </Typography>
            {entry.undoneAt && <Chip className="oc-audit-entry-row--undone" size="small" label={t('state.undone')} />}
            {entry.undoOf && (
              <Tooltip title={t('state.undoOfTooltip', { id: entry.undoOf })}>
                <Chip className="oc-audit-entry-row--undo-of" size="small" color="info" variant="outlined" label={t('state.undoOf')} />
              </Tooltip>
            )}
          </Box>
          <Box className="oc-audit-entry-row--who" sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'flex-start', columnGap: 1, mt: 0.25 }}>
            <PersonLabel uid={entry.authorId} accountLabel={accountLabel} />
            <Typography component="span" variant="body2" color="text.secondary">
              <When value={entry.at} />
            </Typography>
          </Box>
          {result && result.status !== 'undone' && (
            <Alert className="oc-audit-entry-row--result" severity={result.status === 'skipped' ? 'info' : result.status === 'conflict' ? 'warning' : 'error'} sx={{ mt: 1, py: 0 }}>
              {t(`results.${result.status}`)}
              {result.reason ? ` - ${result.reason}` : ''}
            </Alert>
          )}
        </Box>

        {/* 8dp apart, so their 48dp touch targets don't overlap. */}
        <IconButtonGroup className="oc-audit-entry-row--actions" sx={{ flex: 'none' }}>
          {undoable && (
            <Tooltip title={t('undo')}>
              <span>
                <IconButton aria-label={t('undo')} disabled={busy} onClick={() => onUndo([entry.id])}>
                  <UndoRounded />
                </IconButton>
              </span>
            </Tooltip>
          )}
          <Tooltip title={expanded ? t('hideChange') : t('showChange')}>
            <IconButton aria-label={expanded ? t('hideChange') : t('showChange')} aria-expanded={expanded} aria-controls={detailsId} onClick={() => onToggleExpanded(entry.id)}>
              <ExpandMoreRounded sx={(theme) => ({ transform: expanded ? 'rotate(180deg)' : 'none', transition: `transform ${theme.sys.motion.duration.standard}ms ${theme.sys.motion.easing.standard}` })} />
            </IconButton>
          </Tooltip>
        </IconButtonGroup>
      </Box>

      <Collapse in={expanded} unmountOnExit>
        <Box id={detailsId} sx={{ pl: { xs: 1, sm: 6.5 }, pr: 1 }}>
          <AuditEntryDetails entry={entry} accountLabel={accountLabel} />
        </Box>
      </Collapse>
    </ListItem>
  )
})

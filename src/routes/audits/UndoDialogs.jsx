import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Alert, Box, Button, CircularProgress, Dialog, DialogActions, DialogContent, DialogContentText, DialogTitle, LinearProgress, List, ListItem, ListItemText, MenuItem, TextField, Typography } from '@mui/material'
import DialogCloseButton from '@/components/DialogCloseButton.jsx'
import { useSmall } from '@/hooks/useSmall.jsx'
import { getAllAuthorEntriesSince, isUndoable, undoAuditEntries } from '@/models/AuditLogModel.js'
import { EMULATOR_AUTHOR_ID } from '@/config/audits.js'
import { FieldChange } from './AuditEntryDetails.jsx'
import { When } from './AuditEntryRow.jsx'
import PersonLabel, { AccountOption } from './PersonLabel.jsx'

// How many of each undo result: { undone, conflict, skipped, error }.
export function countResults(results) {
  const counts = { undone: 0, conflict: 0, skipped: 0, error: 0 }
  for (const { status } of results) counts[status] = (counts[status] ?? 0) + 1
  return counts
}

// "3 undone, 1 conflict…" - the statuses that happened.
export function resultsSummary(t, results) {
  const counts = countResults(results)
  return ['undone', 'conflict', 'skipped', 'error']
    .filter((status) => counts[status] > 0)
    .map((status) => t(`summary.${status}`, { count: counts[status] }))
    .join(', ')
}

// One entry, in a dialog's list: what, which record, who and when.
function EntrySummary({ entry, label, accountLabel }) {
  const { t } = useTranslation('audits')
  return (
    <ListItemText
      primary={`${t(`actions.${entry.action}`, { defaultValue: entry.action })} · ${t(`collections.${entry.collection}`, { defaultValue: entry.collection })} · ${label}`}
      secondary={
        <Box component="span" sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'flex-start', columnGap: 1 }}>
          <PersonLabel uid={entry.authorId} accountLabel={accountLabel} />
          <When value={entry.at} />
        </Box>
      }
      slotProps={{ primary: { sx: { overflowWrap: 'anywhere' } }, secondary: { component: 'div' } }}
    />
  )
}

// Before undoing: the list of what will be undone.
export function UndoConfirmDialog({ entries, labelOf, accountLabel, onConfirm, onClose }) {
  const { t } = useTranslation('audits')
  const fullScreen = useSmall()
  return (
    <Dialog className="oc-undo-confirm-dialog" open={entries.length > 0} onClose={onClose} fullScreen={fullScreen} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ pr: 7 }}>{t('confirmUndo.title', { count: entries.length })}</DialogTitle>
      <DialogCloseButton onClick={onClose} />
      <DialogContent>
        <DialogContentText>{t('confirmUndo.text', { count: entries.length })}</DialogContentText>
        <List dense sx={{ maxHeight: 360, overflowY: 'auto' }}>
          {entries.map((entry) => (
            <ListItem key={entry.id} divider disableGutters>
              <EntrySummary entry={entry} label={labelOf(entry)} accountLabel={accountLabel} />
            </ListItem>
          ))}
        </List>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>{t('cancel')}</Button>
        <Button variant="contained" disableElevation onClick={onConfirm}>
          {t('confirmUndo.action', { count: entries.length })}
        </Button>
      </DialogActions>
    </Dialog>
  )
}

// Undos the server refused because the record changed since: each field's
// value the undo expected and the one it found. Force undo overwrites them.
export function ConflictsDialog({ conflicts, entriesById, labelOf, accountLabel, busy, onForce, onClose }) {
  const { t } = useTranslation('audits')
  const fullScreen = useSmall()
  return (
    <Dialog className="oc-undo-conflicts-dialog" open={conflicts.length > 0} onClose={() => !busy && onClose()} fullScreen={fullScreen} maxWidth="md" fullWidth>
      <DialogTitle sx={{ pr: 7 }}>{t('conflicts.title', { count: conflicts.length })}</DialogTitle>
      <DialogCloseButton onClick={onClose} disabled={busy} />
      <DialogContent>
        <DialogContentText sx={{ mb: 2 }}>{t('conflicts.text', { count: conflicts.length })}</DialogContentText>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
          {conflicts.map((result) => {
            const entry = entriesById.get(result.id)
            return (
              <Box key={result.id} className="oc-undo-conflicts-dialog--entry" sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                {entry ? (
                  <EntrySummary entry={entry} label={labelOf(entry)} accountLabel={accountLabel} />
                ) : (
                  <Typography variant="subtitle2" sx={{ overflowWrap: 'anywhere' }}>
                    {t('details.entryId', { id: result.id })}
                  </Typography>
                )}
                {(result.conflicts ?? []).map((conflict) => (
                  <FieldChange key={conflict.field} field={conflict.field} before={conflict.expected} after={conflict.current} beforeLabel={t('conflicts.expected')} afterLabel={t('conflicts.current')} />
                ))}
              </Box>
            )
          })}
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={busy}>
          {t('cancel')}
        </Button>
        <Button variant="contained" color="warning" disableElevation onClick={onForce} disabled={busy} startIcon={busy ? <CircularProgress size={16} /> : undefined}>
          {t('conflicts.force')}
        </Button>
      </DialogActions>
    </Dialog>
  )
}

// A datetime-local input's value for a date, in local time.
function toLocalInput(date) {
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16)
}

// "Undo all changes by <author> since <date>": the author and the date, a
// preview of how many changes that is, then the undo (newest first, in
// chunks) and its results.
export function BulkUndoDialog({ open, accountList, accountLabel, onClose, onConflicts, onDone }) {
  const { t } = useTranslation('audits')
  const fullScreen = useSmall()
  const [authorId, setAuthorId] = useState('')
  const [since, setSince] = useState(() => toLocalInput(new Date(Date.now() - 24 * 3600 * 1000)))
  // form -> previewing -> preview -> undoing -> done
  const [phase, setPhase] = useState('form')
  const [entries, setEntries] = useState([])
  const [progress, setProgress] = useState({ done: 0, total: 0 })
  const [results, setResults] = useState([])
  const [error, setError] = useState(null)

  const undoable = entries.filter(isUndoable)
  const busy = phase === 'previewing' || phase === 'undoing'

  function reset() {
    setPhase('form')
    setEntries([])
    setResults([])
    setError(null)
  }

  function close() {
    if (busy) return
    if (phase === 'done') onDone()
    reset()
    onClose()
  }

  async function preview() {
    setPhase('previewing')
    setError(null)
    try {
      setEntries(await getAllAuthorEntriesSince(authorId, new Date(since)))
      setPhase('preview')
    } catch (err) {
      console.error(err)
      setError(err.message)
      setPhase('form')
    }
  }

  async function undo() {
    const ids = undoable.map((entry) => entry.id)
    setPhase('undoing')
    setProgress({ done: 0, total: ids.length })
    const allResults = await undoAuditEntries(ids, { onProgress: (done, total) => setProgress({ done, total }) })
    setResults(allResults)
    setPhase('done')
  }

  const conflicts = results.filter((result) => result.status === 'conflict')
  const notUndone = results.filter((result) => result.status !== 'undone')

  return (
    <Dialog className="oc-bulk-undo-dialog" open={open} onClose={close} fullScreen={fullScreen} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ pr: 7 }}>{t('bulkUndo.title')}</DialogTitle>
      <DialogCloseButton onClick={close} disabled={busy} />
      <DialogContent>
        {(phase === 'form' || phase === 'previewing' || phase === 'preview') && (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
            <DialogContentText>{t('bulkUndo.text')}</DialogContentText>
            <TextField
              select
              size="small"
              label={t('bulkUndo.author')}
              value={authorId}
              disabled={busy}
              slotProps={{ select: { renderValue: (uid) => accountLabel(uid) } }}
              onChange={(e) => {
                setAuthorId(e.target.value)
                setPhase('form')
              }}
            >
              {accountList.map((account) => (
                <MenuItem key={account.uid} value={account.uid}>
                  <AccountOption account={account} />
                </MenuItem>
              ))}
              <MenuItem value={EMULATOR_AUTHOR_ID}>{t('author.emulator')}</MenuItem>
            </TextField>
            <TextField
              type="datetime-local"
              size="small"
              label={t('bulkUndo.since')}
              value={since}
              disabled={busy}
              onChange={(e) => {
                setSince(e.target.value)
                setPhase('form')
              }}
              slotProps={{ inputLabel: { shrink: true } }}
            />
            {error && <Alert severity="error">{error}</Alert>}
            {phase === 'preview' && (
              <Alert className="oc-bulk-undo-dialog--preview" severity={undoable.length > 0 ? 'warning' : 'info'}>
                {undoable.length > 0 ? t('bulkUndo.preview', { count: undoable.length, who: accountLabel(authorId) }) : t('bulkUndo.nothing')}
                {entries.length > undoable.length && ` ${t('bulkUndo.notUndoable', { count: entries.length - undoable.length })}`}
              </Alert>
            )}
          </Box>
        )}

        {phase === 'undoing' && (
          <Box sx={{ pt: 1 }}>
            <DialogContentText sx={{ mb: 2 }}>{t('progress', { done: progress.done, total: progress.total })}</DialogContentText>
            <LinearProgress variant="determinate" value={progress.total ? (progress.done / progress.total) * 100 : 0} />
          </Box>
        )}

        {phase === 'done' && (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
            <Alert severity={notUndone.length === 0 ? 'success' : 'warning'}>{resultsSummary(t, results)}</Alert>
            {notUndone.length > 0 && (
              <List dense sx={{ maxHeight: 300, overflowY: 'auto' }}>
                {notUndone.map((result) => (
                  <ListItem key={result.id} divider disableGutters>
                    <ListItemText primary={`${t(`results.${result.status}`)}${result.reason ? ` - ${result.reason}` : ''}`} secondary={t('details.entryId', { id: result.id })} slotProps={{ secondary: { sx: { overflowWrap: 'anywhere' } } }} />
                  </ListItem>
                ))}
              </List>
            )}
          </Box>
        )}
      </DialogContent>
      <DialogActions>
        {phase === 'done' ? (
          <>
            {conflicts.length > 0 && (
              <Button
                onClick={() => {
                  onConflicts(conflicts, entries)
                  close()
                }}
              >
                {t('bulkUndo.reviewConflicts', { count: conflicts.length })}
              </Button>
            )}
            <Button variant="contained" disableElevation onClick={close}>
              {t('close')}
            </Button>
          </>
        ) : (
          <>
            <Button onClick={close} disabled={busy}>
              {t('cancel')}
            </Button>
            {phase === 'preview' && undoable.length > 0 ? (
              <Button variant="contained" color="warning" disableElevation onClick={undo}>
                {t('bulkUndo.confirm', { count: undoable.length })}
              </Button>
            ) : (
              <Button variant="contained" disableElevation onClick={preview} disabled={!authorId || !since || busy} startIcon={phase === 'previewing' ? <CircularProgress size={16} /> : undefined}>
                {t('bulkUndo.previewAction')}
              </Button>
            )}
          </>
        )}
      </DialogActions>
    </Dialog>
  )
}

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useSelector } from 'react-redux'
import { useTranslation } from 'react-i18next'
import { sortByLabel } from './sortOptions.js'
import { Alert, Box, Button, CircularProgress, IconButton, List, MenuItem, TextField, Tooltip, Typography } from '@mui/material'
import FilterListOffRounded from '@mui/icons-material/FilterListOffRounded'
import ManageHistoryRounded from '@mui/icons-material/ManageHistoryRounded'
import RefreshRounded from '@mui/icons-material/RefreshRounded'
import UndoRounded from '@mui/icons-material/UndoRounded'
import ListSkeleton from '@/components/Skeletons/ListSkeleton.jsx'
import { useSnackbar } from '@/components/Snackbar/useSnackbar.jsx'
import { getAuditPage, getRecord, isUndoable, undoAuditEntries } from '@/models/AuditLogModel.js'
import { USERS_COLLECTION } from '@/config/collections.js'
import { EMULATOR_AUTHOR_ID } from '@/config/audits.js'
import { REFERENCE_DATA_CONFIGS } from '@/routes/dashboard/referenceDataConfigs.js'
import AuditEntryRow from './AuditEntryRow.jsx'
import { AccountOption } from './PersonLabel.jsx'
import { BulkUndoDialog, ConflictsDialog, UndoConfirmDialog, resultsSummary } from './UndoDialogs.jsx'
import { DASHBOARD_LIST_SX } from '@/components/dashboardSurface.js'
import { hasRecordPage, nameOf, recordPath } from './auditFormat.js'

// The collections the filter offers: the cave data, the photos and maps, the
// reference data, and the admins' user management.
const FILTER_COLLECTIONS = ['caves', 'sistemas', 'connections', 'cavesAssets', 'maps', ...Object.keys(REFERENCE_DATA_CONFIGS), USERS_COLLECTION]

// The kinds of change the filter offers: the data's, then the admins' user
// management.
const FILTER_ACTIONS = ['create', 'update', 'delete', 'undo', 'purge', 'setRoles', 'freeze', 'unfreeze', 'deleteUser']

const NO_FILTERS = { collection: '', action: '', authorId: '', from: '', to: '' }

const recordKey = (entry) => `${entry.collection}/${entry.docId}`

/**
 * The Changes tab: the audit log, newest first, filtered by collection,
 * author and dates, a page at a time; each change can be looked at and, when
 * it's the app's own edit, undone - one, the selected ones, or all of an
 * author's since a date.
 */
export default function ChangesTab({ accountLabel, accountList }) {
  const { t, i18n } = useTranslation('audits')
  const [openSnackbar] = useSnackbar()
  const caves = useSelector((state) => state.data.caves)
  const sistemas = useSelector((state) => state.data.sistemas)
  const [filters, setFilters] = useState(NO_FILTERS)
  const [entries, setEntries] = useState([])
  const [cursor, setCursor] = useState(null)
  const [hasMore, setHasMore] = useState(false)
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState(null)
  // The records the changes are about, as they are now (null: gone), by
  // "collection/id": for their links and names.
  const [records, setRecords] = useState(() => new Map())
  const [selected, setSelected] = useState(() => new Set())
  const [expanded, setExpanded] = useState(() => new Set())
  // The last undo's result of each entry, by id (kept across reloads).
  const [results, setResults] = useState(() => new Map())
  const [confirmIds, setConfirmIds] = useState([])
  const [undoing, setUndoing] = useState(false)
  const [conflicts, setConflicts] = useState([])
  // Entries the conflicts dialog may show that aren't in the list (a bulk
  // undo's).
  const [extraEntries, setExtraEntries] = useState([])
  const [bulkOpen, setBulkOpen] = useState(false)
  const requestRef = useRef(0)

  const queryFilters = useMemo(
    () => ({
      collection: filters.collection || undefined,
      action: filters.action || undefined,
      authorId: filters.authorId || undefined,
      from: filters.from ? new Date(`${filters.from}T00:00:00`) : undefined,
      to: filters.to ? new Date(`${filters.to}T23:59:59.999`) : undefined,
    }),
    [filters],
  )

  const load = useCallback(async () => {
    const request = ++requestRef.current
    setLoading(true)
    setError(null)
    try {
      const page = await getAuditPage(queryFilters)
      if (request !== requestRef.current) return
      setEntries(page.entries)
      setCursor(page.cursor)
      setHasMore(page.hasMore)
      // Records may have changed (an undo): read again.
      setRecords(new Map())
      setSelected(new Set())
    } catch (err) {
      console.error(err)
      if (request === requestRef.current) setError(err.message)
    } finally {
      if (request === requestRef.current) setLoading(false)
    }
  }, [queryFilters])

  useEffect(() => {
    load()
  }, [load])

  async function loadMore() {
    const request = requestRef.current
    setLoadingMore(true)
    try {
      const page = await getAuditPage(queryFilters, cursor)
      if (request !== requestRef.current) return
      setEntries((prev) => [...prev, ...page.entries])
      setCursor(page.cursor)
      setHasMore(page.hasMore)
    } catch (err) {
      console.error(err)
      setError(err.message)
    } finally {
      setLoadingMore(false)
    }
  }

  // Reads the records of the entries not looked up yet.
  useEffect(() => {
    const keys = [...new Set(entries.filter((entry) => entry.collection !== USERS_COLLECTION && entry.docId && !records.has(recordKey(entry))).map(recordKey))]
    if (keys.length === 0) return undefined
    let cancelled = false
    Promise.all(
      keys.map((key) => {
        const [collectionName, id] = key.split('/')
        return getRecord(collectionName, id)
          .then((record) => [key, record])
          .catch(() => [key, null])
      }),
    ).then((found) => {
      if (!cancelled) setRecords((prev) => new Map([...prev, ...found]))
    })
    return () => {
      cancelled = true
    }
  }, [entries, records])

  const entriesById = useMemo(() => new Map([...extraEntries, ...entries].map((entry) => [entry.id, entry])), [entries, extraEntries])

  // A record's name: from the change itself, the record now, or the cave
  // data; a photo by its cave's name; an account by its email.
  const labelOf = useCallback(
    (entry) => {
      if (entry.collection === USERS_COLLECTION) return accountLabel(entry.docId)
      const record = records.get(recordKey(entry))
      const name = nameOf(entry.after) || nameOf(entry.before) || nameOf(record)
      if (name) return name
      if (entry.collection === 'caves') return nameOf(caves.find((cave) => cave.id === entry.docId)) || entry.docId
      if (entry.collection === 'sistemas') return nameOf(sistemas.find((sistema) => sistema.id === entry.docId)) || entry.docId
      if (entry.collection === 'cavesAssets') {
        const caveId = entry.after?.caveId ?? entry.before?.caveId ?? record?.caveId
        const caveName = nameOf(caves.find((cave) => cave.id === caveId))
        if (caveName) return t('photoOf', { cave: caveName })
      }
      return entry.docId
    },
    [records, caves, sistemas, accountLabel, t],
  )

  const toggleSelected = useCallback((id) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  const toggleExpanded = useCallback((id) => {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  const askUndo = useCallback((ids) => setConfirmIds(ids), [])

  // Newest first, as the server processes them.
  function newestFirst(ids) {
    const time = (id) => entriesById.get(id)?.at?.toMillis?.() ?? 0
    return [...ids].sort((a, b) => time(b) - time(a))
  }

  async function runUndo(ids, { force = false } = {}) {
    setUndoing(true)
    try {
      const undoResults = await undoAuditEntries(newestFirst(ids), { force })
      setResults((prev) => new Map([...prev, ...undoResults.map((result) => [result.id, result])]))
      const failed = undoResults.some((result) => result.status === 'error')
      openSnackbar(resultsSummary(t, undoResults), { severity: failed ? null : 'success' })
      setConflicts(undoResults.filter((result) => result.status === 'conflict'))
      await load()
    } finally {
      setUndoing(false)
    }
  }

  function confirmUndo() {
    const ids = confirmIds
    setConfirmIds([])
    runUndo(ids)
  }

  function forceConflicts() {
    const ids = conflicts.map((result) => result.id)
    runUndo(ids, { force: true })
  }

  function setFilter(name, value) {
    setFilters((prev) => ({ ...prev, [name]: value }))
  }

  const selectedIds = entries.filter((entry) => selected.has(entry.id) && isUndoable(entry)).map((entry) => entry.id)
  const filtered = Object.values(filters).some(Boolean)

  return (
    <Box className="oc-audits-changes">
      <Box className="oc-audits-changes--filters" sx={{ display: 'grid', gridTemplateColumns: { xs: 'minmax(0, 1fr)', sm: 'repeat(2, minmax(0, 1fr))', md: 'repeat(3, minmax(0, 1fr)) auto', lg: 'repeat(5, minmax(0, 1fr)) auto' }, gap: 1.5, alignItems: 'center', mb: 2 }}>
        <TextField select size="small" label={t('filters.collection')} value={filters.collection} onChange={(e) => setFilter('collection', e.target.value)}>
          <MenuItem value="">{t('filters.all')}</MenuItem>
          {/* All first, then the options alphabetically (in the app's language). */}
          {sortByLabel(FILTER_COLLECTIONS.map((name) => ({ value: name, label: t(`collections.${name}`, { defaultValue: name }) })), i18n.language).map(({ value, label }) => (
            <MenuItem key={value} value={value}>
              {label}
            </MenuItem>
          ))}
        </TextField>
        <TextField select size="small" label={t('filters.action')} value={filters.action} onChange={(e) => setFilter('action', e.target.value)}>
          <MenuItem value="">{t('filters.all')}</MenuItem>
          {sortByLabel(FILTER_ACTIONS.map((action) => ({ value: action, label: t(`actions.${action}`) })), i18n.language).map(({ value, label }) => (
            <MenuItem key={value} value={value}>
              {label}
            </MenuItem>
          ))}
        </TextField>
        <TextField
          select
          size="small"
          label={t('filters.author')}
          value={filters.authorId}
          onChange={(e) => setFilter('authorId', e.target.value)}
          // The field shows the name alone; the options, the email too.
          slotProps={{ select: { displayEmpty: true, renderValue: (uid) => (uid ? accountLabel(uid) : t('filters.all')) }, inputLabel: { shrink: true } }}
        >
          <MenuItem value="">{t('filters.all')}</MenuItem>
          {/* The accounts and the emulator, alphabetically together. */}
          {sortByLabel([...accountList.map((account) => ({ value: account.uid, label: account.name, account })), { value: EMULATOR_AUTHOR_ID, label: t('author.emulator') }], i18n.language).map(({ value, label, account }) => (
            <MenuItem key={value} value={value}>
              {account ? <AccountOption account={account} /> : label}
            </MenuItem>
          ))}
        </TextField>
        <TextField type="date" size="small" label={t('filters.from')} value={filters.from} onChange={(e) => setFilter('from', e.target.value)} slotProps={{ inputLabel: { shrink: true }, htmlInput: { max: filters.to || undefined } }} />
        <TextField type="date" size="small" label={t('filters.to')} value={filters.to} onChange={(e) => setFilter('to', e.target.value)} slotProps={{ inputLabel: { shrink: true }, htmlInput: { min: filters.from || undefined } }} />
        <Tooltip title={t('filters.clear')}>
          <span>
            <IconButton aria-label={t('filters.clear')} disabled={!filtered} onClick={() => setFilters(NO_FILTERS)}>
              <FilterListOffRounded />
            </IconButton>
          </span>
        </Tooltip>
      </Box>

      <Box className="oc-audits-changes--toolbar" sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 1, mb: 1 }}>
        <Button variant="contained" disableElevation startIcon={undoing ? <CircularProgress size={16} color="inherit" /> : <UndoRounded />} disabled={selectedIds.length === 0 || undoing} onClick={() => askUndo(selectedIds)}>
          {t('undoSelected', { count: selectedIds.length })}
        </Button>
        <Button variant="outlined" startIcon={<ManageHistoryRounded />} disabled={undoing} onClick={() => setBulkOpen(true)}>
          {t('bulkUndo.open')}
        </Button>
        <Box sx={{ flex: 1 }} />
        <Tooltip title={t('refresh')}>
          <span>
            <IconButton aria-label={t('refresh')} disabled={loading || undoing} onClick={load}>
              <RefreshRounded />
            </IconButton>
          </span>
        </Tooltip>
      </Box>

      {error && (
        <Alert className="oc-audits-changes--error" severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {t('loadError')} {error}
        </Alert>
      )}

      {loading ? (
        <ListSkeleton rows={8} leading={null} fill={false} card />
      ) : entries.length === 0 ? (
        !error && (
          <Typography className="oc-audits-changes--empty" color="text.secondary" sx={{ py: 6, textAlign: 'center' }}>
            {filtered ? t('emptyFiltered') : t('empty')}
          </Typography>
        )
      ) : (
        <>
          <List disablePadding sx={DASHBOARD_LIST_SX}>
            {entries.map((entry) => {
              const record = records.get(recordKey(entry))
              return (
                <AuditEntryRow
                  key={entry.id}
                  entry={entry}
                  label={labelOf(entry)}
                  path={hasRecordPage(entry.collection) ? recordPath(entry.collection, entry.docId, record) : null}
                  accountLabel={accountLabel}
                  selected={selected.has(entry.id)}
                  onToggleSelected={toggleSelected}
                  expanded={expanded.has(entry.id)}
                  onToggleExpanded={toggleExpanded}
                  onUndo={askUndo}
                  result={results.get(entry.id)}
                  busy={undoing}
                />
              )
            })}
          </List>
          {hasMore && (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 2 }}>
              <Button onClick={loadMore} disabled={loadingMore} startIcon={loadingMore ? <CircularProgress size={16} /> : undefined}>
                {t('loadMore')}
              </Button>
            </Box>
          )}
        </>
      )}

      <UndoConfirmDialog entries={confirmIds.map((id) => entriesById.get(id)).filter(Boolean)} labelOf={labelOf} accountLabel={accountLabel} onConfirm={confirmUndo} onClose={() => setConfirmIds([])} />
      <ConflictsDialog conflicts={conflicts} entriesById={entriesById} labelOf={labelOf} accountLabel={accountLabel} busy={undoing} onForce={forceConflicts} onClose={() => setConflicts([])} />
      <BulkUndoDialog
        open={bulkOpen}
        accountList={accountList}
        accountLabel={accountLabel}
        onClose={() => setBulkOpen(false)}
        onDone={load}
        onConflicts={(bulkConflicts, bulkEntries) => {
          setExtraEntries(bulkEntries)
          setConflicts(bulkConflicts)
        }}
      />
    </Box>
  )
}

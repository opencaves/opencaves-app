import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { collection, doc, limit, onSnapshot, orderBy, query, writeBatch } from 'firebase/firestore'
import { Accordion, AccordionDetails, AccordionSummary, Alert, Box, Button, Checkbox, Dialog, DialogActions, DialogContent, DialogContentText, DialogTitle, FormControlLabel, Stack, Typography } from '@mui/material'
import ExpandMoreRounded from '@mui/icons-material/ExpandMoreRounded'
import DeleteOutlineRounded from '@mui/icons-material/DeleteOutlineRounded'
import { db } from '@/config/firebase.js'
import { ERROR_REPORTS_COLLECTION } from '@/config/collections.js'
import { useTitle } from '@/hooks/useTitle.jsx'
import IndexPageHeader from '@/components/IndexPage/IndexPageHeader.jsx'
import IndexSection from '@/components/IndexPage/IndexSection.jsx'
import ListSkeleton from '@/components/Skeletons/ListSkeleton.jsx'
import DialogCloseButton from '@/components/DialogCloseButton.jsx'
import RelativeTime from '@/components/RelativeTime/RelativeTime.jsx'
import { useAccounts } from '@/routes/audits/useAccounts.js'

// The latest reports read: the page groups them by error.
const REPORTS_READ = 500
// A batch's most writes (Firestore's limit).
const BATCH_MAX = 500
// The groups' checkboxes in one column with Select all's, at the page's left
// edge (a checkbox's 9px padding taken back, as MUI's FormControlLabel does),
// each beside its group's title.
const GROUP_CHECKBOX_SX = { ml: '-11px', mt: '-5px', flexShrink: 0 }
const MONO = { fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace', fontSize: '0.8125rem' }

// The browser and the system, from a user agent ("Chrome on Android").
function browserOf(userAgent = '') {
  const browser = /Edg\//.test(userAgent) ? 'Edge' : /SamsungBrowser/.test(userAgent) ? 'Samsung Internet' : /Firefox\//.test(userAgent) ? 'Firefox' : /Chrome\//.test(userAgent) ? 'Chrome' : /Safari\//.test(userAgent) ? 'Safari' : null
  const system = /Android/.test(userAgent) ? 'Android' : /iPhone|iPad/.test(userAgent) ? 'iOS' : /Windows/.test(userAgent) ? 'Windows' : /Mac OS X/.test(userAgent) ? 'macOS' : /Linux/.test(userAgent) ? 'Linux' : null
  return [browser, system].filter(Boolean).join(' · ') || userAgent || '?'
}

// The reports by error (digest), the most recent error first; each group's
// reports newest first, as read.
function groupReports(reports) {
  const groups = new Map()
  for (const report of reports) {
    const group = groups.get(report.digest) || { digest: report.digest, message: report.message, stack: report.stack, status: report.status, reports: [], versions: new Set(), paths: new Set(), uids: new Set() }
    group.reports.push(report)
    if (report.version) group.versions.add(report.version)
    group.paths.add(report.path)
    group.uids.add(report.uid || null)
    groups.set(report.digest, group)
  }
  return [...groups.values()].map((group) => ({ ...group, last: group.reports[0].createdAt, first: group.reports.at(-1).createdAt }))
}

// The reports in _errorReports, newest first, live (a new report shows up,
// a deleted one goes): loading until the first answer, failed when they
// couldn't be read.
function useErrorReports() {
  const [state, setState] = useState({ reports: [], loading: true, failed: false })
  useEffect(
    () =>
      onSnapshot(
        query(collection(db, ERROR_REPORTS_COLLECTION), orderBy('createdAt', 'desc'), limit(REPORTS_READ)),
        // Its own writes too (a new report's server time still pending: shown at once).
        { includeMetadataChanges: false },
        (snapshot) => setState({ reports: snapshot.docs.map((report) => ({ id: report.id, ...report.data({ serverTimestamps: 'estimate' }) })), loading: false, failed: false }),
        (error) => {
          console.error(error)
          setState((current) => ({ ...current, loading: false, failed: true }))
        },
      ),
    [],
  )
  return state
}

/**
 * One error's reports, on a card titled with its message (an
 * {@link IndexSection}), a checkbox at its left selecting the error (all
 * its reports): how many, when last and first, the versions, pages and
 * accounts; opened, its stack and each report (its date and time, page,
 * version, browser, language, account), and a button deleting them all.
 *
 * @param {object} props
 * @param {ReturnType<typeof groupReports>[number]} props.group
 * @param {(uid: string) => string} props.accountLabel - An account's name (useAccounts).
 * @param {boolean} props.selected - The error is selected.
 * @param {(on: boolean) => void} props.onSelect - Selects (on) or unselects the error.
 * @param {() => void} props.onDelete - Asks to delete the error's reports.
 */
function ErrorGroup({ group, accountLabel, selected, onSelect, onDelete }) {
  const { t, i18n } = useTranslation('errorReports')
  // Each report's date and time, to the second, in the reader's language and time zone.
  const dateTime = useMemo(() => new Intl.DateTimeFormat(i18n.language, { dateStyle: 'medium', timeStyle: 'medium' }), [i18n.language])
  const signedIn = [...group.uids].filter(Boolean)
  return (
    // The error's checkbox (all its reports) outside its card, in a column
    // at the left - under Select all's.
    <Box className="oc-error-reports--group-row" sx={{ display: 'flex', alignItems: 'flex-start', gap: 0.5 }}>
      <Checkbox
        className="oc-error-reports--group-checkbox"
        checked={selected}
        onChange={(event) => onSelect(event.target.checked)}
        slotProps={{ input: { 'aria-label': t('selectGroup', { count: group.reports.length }) } }}
        sx={GROUP_CHECKBOX_SX}
      />
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <IndexSection
          className="oc-error-reports--group"
          card
          cardSx={{ p: 0, overflow: 'hidden' }}
          title={
            <Box component="span" sx={{ ...MONO, fontSize: '0.9375rem', overflowWrap: 'anywhere' }}>
              {group.message || t('noMessage')}
            </Box>
          }
          count={t('reports', { count: group.reports.length })}
        >
          {/* What it says of its reports. */}
          <Box className="oc-error-reports--group-summary" sx={{ px: 2, py: 1.5 }}>
            <Stack direction="row" sx={{ flexWrap: 'wrap', alignItems: 'center', columnGap: 1.5, rowGap: 0.5, minWidth: 0, color: 'text.secondary', fontSize: '0.8125rem' }}>
              <span>
                {t('lastSeen')} {group.last && <RelativeTime value={group.last} />}
              </span>
              {group.reports.length > 1 && (
                <span>
                  {t('firstSeen')} {group.first && <RelativeTime value={group.first} />}
                </span>
              )}
              <span>{[...group.versions].join(', ')}</span>
              <span>{t('pages', { count: group.paths.size })}</span>
              <span>{signedIn.length ? t('accounts', { count: signedIn.length }) : t('signedOut')}</span>
            </Stack>
          </Box>
          <Accordion className="oc-error-reports--details" disableGutters elevation={0} sx={{ bgcolor: 'transparent', borderTop: 1, borderColor: 'divider', '&:before': { display: 'none' } }}>
            <AccordionSummary expandIcon={<ExpandMoreRounded />} sx={{ px: 2 }}>
              <Typography variant="body2">{t('details')}</Typography>
            </AccordionSummary>
            <AccordionDetails sx={{ px: 2, pb: 2 }}>
              {group.status != null && <Typography sx={{ mb: 1 }}>{t('status', { status: group.status })}</Typography>}
              {group.stack && (
                <Box component="pre" className="oc-error-reports--stack" sx={(theme) => ({ ...MONO, m: 0, mb: 2, p: 1.5, borderRadius: 1, overflowX: 'auto', bgcolor: theme.vars.palette.action.hover })}>
                  {group.stack}
                </Box>
              )}
              <Typography component="h3" variant="subtitle2" sx={{ mb: 0.5 }}>
                {t('occurrences')}
              </Typography>
              <Box component="ul" className="oc-error-reports--occurrences" sx={{ listStyle: 'none', p: 0, m: 0, mb: 2 }}>
                {group.reports.map((report) => (
                  <Box component="li" key={report.id} sx={{ display: 'flex', flexWrap: 'wrap', columnGap: 1.5, rowGap: 0.25, py: 0.75, fontSize: '0.875rem', borderTop: 1, borderColor: 'divider' }}>
                    {report.createdAt && (
                      <Box component="time" dateTime={report.createdAt.toDate().toISOString()} sx={{ minWidth: 190, fontVariantNumeric: 'tabular-nums' }}>
                        {dateTime.format(report.createdAt.toDate())}
                      </Box>
                    )}
                    <Box component={Link} to={report.path} sx={{ ...MONO, overflowWrap: 'anywhere', minWidth: 0 }}>
                      {report.path}
                    </Box>
                    <Box component="span" sx={{ color: 'text.secondary' }}>
                      {[report.version, browserOf(report.userAgent), report.language, report.uid ? accountLabel(report.uid) : t('signedOut')].filter(Boolean).join(' · ')}
                    </Box>
                  </Box>
                ))}
              </Box>
              {/* The card's action, at the bottom right. */}
              <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
                <Button className="oc-error-reports--delete" color="error" variant="outlined" startIcon={<DeleteOutlineRounded />} onClick={onDelete}>
                  {t('delete')}
                </Button>
              </Box>
            </AccordionDetails>
          </Accordion>
        </IndexSection>
      </Box>
    </Box>
  )
}

/**
 * /error-reports (admins): the errors the "Something went wrong" page showed
 * (_errorReports, src/utils/errorReports.js), the latest
 * {@link REPORTS_READ} grouped by error (their digest), the most recent
 * first, live - each on its card with how often, when, on which versions,
 * pages and accounts, its stack and every report. Errors are selected (one
 * by one, or all at once) and the selected errors' reports deleted together
 * (in batches of {@link BATCH_MAX}), as one error's reports can be.
 */
export default function ErrorReports() {
  const { t } = useTranslation(['errorReports', 'dashboard'])
  const { setTitle } = useTitle()
  const { reports, loading, failed } = useErrorReports()
  const { accountLabel } = useAccounts()
  const groups = useMemo(() => groupReports(reports), [reports])
  // The errors checked (digests); those gone meanwhile (deleted, past the
  // latest read) aren't counted. Their reports: the ones shown now.
  const [checked, setChecked] = useState(() => new Set())
  const selectedGroups = useMemo(() => groups.filter((group) => checked.has(group.digest)), [groups, checked])
  // The reports asked to be deleted (ids), and whether they're the selection's.
  const [toDelete, setToDelete] = useState(null)
  const [deleting, setDeleting] = useState(false)
  const [deleteFailed, setDeleteFailed] = useState(false)

  useEffect(() => {
    setTitle(t('title'))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [t])

  function select(digests, on) {
    setChecked((current) => {
      const next = new Set(current)
      digests.forEach((digest) => (on ? next.add(digest) : next.delete(digest)))
      return next
    })
  }

  // The errors' reports (ids) to be deleted, asked first.
  function askToDelete(selection, isSelection = false) {
    setDeleteFailed(false)
    setToDelete({ ids: selection.flatMap((group) => group.reports.map((report) => report.id)), digests: selection.map((group) => group.digest), isSelection })
  }

  async function deleteReports() {
    setDeleting(true)
    setDeleteFailed(false)
    try {
      const { ids } = toDelete
      for (let i = 0; i < ids.length; i += BATCH_MAX) {
        const batch = writeBatch(db)
        ids.slice(i, i + BATCH_MAX).forEach((id) => batch.delete(doc(db, ERROR_REPORTS_COLLECTION, id)))
        await batch.commit()
      }
      // Their errors unchecked (a new report of one shows it again, unchecked).
      select(toDelete.digests, false)
      setToDelete(null)
    } catch (error) {
      console.error(error)
      setDeleteFailed(true)
    } finally {
      setDeleting(false)
    }
  }

  const allSelected = groups.length > 0 && selectedGroups.length === groups.length

  return (
    <Box className="oc-error-reports" sx={{ minHeight: '100%', minWidth: 0 }}>
      <IndexPageHeader sticky title={t('title')} subtitle={t('intro')} backTo="/dashboard" />

      {failed && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {t('failed')}
        </Alert>
      )}
      {loading && reports.length === 0 ? (
        <ListSkeleton rows={4} leading="square" grouped card fill={false} />
      ) : (
        !failed && (
          <>
            {/* Select all, how many, and the selection's Delete. */}
            <Box className="oc-error-reports--toolbar" sx={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', columnGap: 2, rowGap: 1, mb: 2 }}>
              {groups.length > 0 && (
                <FormControlLabel
                  className="oc-error-reports--select-all"
                  control={<Checkbox checked={allSelected} indeterminate={selectedGroups.length > 0 && !allSelected} onChange={(event) => select(groups.map((group) => group.digest), event.target.checked)} />}
                  label={t('selectAll')}
                  sx={{ mr: 0 }}
                />
              )}
              <Typography variant="body2" sx={{ color: 'text.secondary', flex: 1, minWidth: 'min(100%, 12rem)' }}>
                {groups.length ? `${t('errors', { count: groups.length })} · ${t('reports', { count: reports.length })}` : t('empty')}
                {reports.length >= REPORTS_READ && ` · ${t('limited', { count: REPORTS_READ })}`}
              </Typography>
              {groups.length > 0 && (
                <Button className="oc-error-reports--delete-selected" color="error" variant="outlined" startIcon={<DeleteOutlineRounded />} disabled={selectedGroups.length === 0} onClick={() => askToDelete(selectedGroups, true)}>
                  {t('deleteSelected', { count: selectedGroups.length })}
                </Button>
              )}
            </Box>
            {groups.map((group) => (
              <ErrorGroup key={group.digest} group={group} accountLabel={accountLabel} selected={checked.has(group.digest)} onSelect={(on) => select([group.digest], on)} onDelete={() => askToDelete([group])} />
            ))}
          </>
        )
      )}

      <Dialog className="oc-error-reports--delete-dialog" open={Boolean(toDelete)} onClose={() => !deleting && setToDelete(null)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ pr: 7 }}>{toDelete?.isSelection ? t('deleteSelectedTitle') : t('deleteTitle')}</DialogTitle>
        <DialogCloseButton onClick={() => !deleting && setToDelete(null)} />
        <DialogContent>
          <DialogContentText>{toDelete && t(toDelete.isSelection ? 'deleteSelectedText' : 'deleteText', { count: toDelete.ids.length })}</DialogContentText>
          {deleteFailed && (
            <Alert severity="error" sx={{ mt: 2 }}>
              {t('deleteFailed')}
            </Alert>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setToDelete(null)} disabled={deleting}>
            {t('cancel')}
          </Button>
          <Button color="error" variant="contained" disableElevation onClick={deleteReports} loading={deleting}>
            {t('deleteConfirm')}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
}

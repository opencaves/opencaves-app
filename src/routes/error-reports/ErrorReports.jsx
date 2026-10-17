import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { collection, doc, limit, onSnapshot, orderBy, query, writeBatch } from 'firebase/firestore'
import { Accordion, AccordionDetails, AccordionSummary, Alert, Box, Button, Chip, CircularProgress, Dialog, DialogActions, DialogContent, DialogContentText, DialogTitle, Stack, Typography } from '@mui/material'
import ExpandMoreRounded from '@mui/icons-material/ExpandMoreRounded'
import DeleteOutlineRounded from '@mui/icons-material/DeleteOutlineRounded'
import { db } from '@/config/firebase.js'
import { ERROR_REPORTS_COLLECTION } from '@/config/collections.js'
import { useTitle } from '@/hooks/useTitle.jsx'
import IndexPageHeader from '@/components/IndexPage/IndexPageHeader.jsx'
import { DASHBOARD_SURFACE_SX } from '@/components/dashboardSurface.js'
import DialogCloseButton from '@/components/DialogCloseButton.jsx'
import RelativeTime from '@/components/RelativeTime/RelativeTime.jsx'
import { useAccounts } from '@/routes/audits/useAccounts.js'

// The latest reports read: the page groups them by error.
const REPORTS_READ = 500
// A batch's most writes (Firestore's limit).
const BATCH_MAX = 500
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
 * One error's reports: its message, how many, when last and first, the
 * versions, pages and accounts; opened, its stack and each report (its date
 * and time, page, version, browser, language, account), and a button deleting them all.
 *
 * @param {object} props
 * @param {ReturnType<typeof groupReports>[number]} props.group
 * @param {(uid: string) => string} props.accountLabel - An account's name (useAccounts).
 * @param {(group: ReturnType<typeof groupReports>[number]) => void} props.onDelete - Asks to delete the group's reports.
 */
function ErrorGroup({ group, accountLabel, onDelete }) {
  const { t, i18n } = useTranslation('errorReports')
  // Each report's date and time, to the second, in the reader's language and time zone.
  const dateTime = useMemo(() => new Intl.DateTimeFormat(i18n.language, { dateStyle: 'medium', timeStyle: 'medium' }), [i18n.language])
  const signedIn = [...group.uids].filter(Boolean)
  return (
    <Accordion className="oc-error-reports--group" disableGutters elevation={0} sx={{ bgcolor: 'transparent', '&:before': { display: 'none' }, '& + &': { borderTop: 1, borderColor: 'divider' } }}>
      <AccordionSummary expandIcon={<ExpandMoreRounded />} sx={{ px: 2, '& .MuiAccordionSummary-content': { minWidth: 0, my: 1.5 } }}>
        <Box sx={{ minWidth: 0, flex: 1 }}>
          <Typography sx={{ ...MONO, fontSize: '0.875rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{group.message || t('noMessage')}</Typography>
          <Stack direction="row" sx={{ flexWrap: 'wrap', alignItems: 'center', columnGap: 1.5, rowGap: 0.5, mt: 0.5, color: 'text.secondary', fontSize: '0.8125rem' }}>
            <Chip size="small" label={t('reports', { count: group.reports.length })} />
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
        <Button className="oc-error-reports--delete" color="error" variant="outlined" startIcon={<DeleteOutlineRounded />} onClick={() => onDelete(group)}>
          {t('delete')}
        </Button>
      </AccordionDetails>
    </Accordion>
  )
}

/**
 * /error-reports (admins): the errors the "Something went wrong" page showed
 * (_errorReports, src/utils/errorReports.js), the latest
 * {@link REPORTS_READ} grouped by error (their digest), the most recent
 * first, live - each with how often, when, on which versions, pages and
 * accounts, its stack and every report; an error's reports can be deleted
 * together.
 */
export default function ErrorReports() {
  const { t } = useTranslation(['errorReports', 'dashboard'])
  const { setTitle } = useTitle()
  const { reports, loading, failed } = useErrorReports()
  const { accountLabel } = useAccounts()
  const groups = useMemo(() => groupReports(reports), [reports])
  const [toDelete, setToDelete] = useState(null)
  const [deleting, setDeleting] = useState(false)
  const [deleteFailed, setDeleteFailed] = useState(false)

  useEffect(() => {
    setTitle(t('title'))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [t])

  async function deleteGroup() {
    setDeleting(true)
    setDeleteFailed(false)
    try {
      const ids = toDelete.reports.map((report) => report.id)
      for (let i = 0; i < ids.length; i += BATCH_MAX) {
        const batch = writeBatch(db)
        ids.slice(i, i + BATCH_MAX).forEach((id) => batch.delete(doc(db, ERROR_REPORTS_COLLECTION, id)))
        await batch.commit()
      }
      setToDelete(null)
    } catch (error) {
      console.error(error)
      setDeleteFailed(true)
    } finally {
      setDeleting(false)
    }
  }

  return (
    <Box className="oc-error-reports" sx={{ minHeight: '100%', minWidth: 0 }}>
      <IndexPageHeader dashboard title={t('title')} subtitle={t('intro')} backTo="/dashboard" />

      {failed && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {t('failed')}
        </Alert>
      )}
      {loading && reports.length === 0 ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
          <CircularProgress aria-label={t('loading')} />
        </Box>
      ) : (
        !failed && (
          <>
            <Typography variant="body2" sx={{ color: 'text.secondary', mb: 1 }}>
              {groups.length ? `${t('errors', { count: groups.length })} · ${t('reports', { count: reports.length })}` : t('empty')}
              {reports.length >= REPORTS_READ && ` · ${t('limited', { count: REPORTS_READ })}`}
            </Typography>
            {groups.length > 0 && (
              <Box className="oc-error-reports--list" sx={{ ...DASHBOARD_SURFACE_SX, overflow: 'hidden' }}>
                {groups.map((group) => (
                  <ErrorGroup key={group.digest} group={group} accountLabel={accountLabel} onDelete={setToDelete} />
                ))}
              </Box>
            )}
          </>
        )
      )}

      <Dialog className="oc-error-reports--delete-dialog" open={Boolean(toDelete)} onClose={() => !deleting && setToDelete(null)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ pr: 7 }}>{t('deleteTitle')}</DialogTitle>
        <DialogCloseButton onClick={() => !deleting && setToDelete(null)} />
        <DialogContent>
          <DialogContentText>{toDelete && t('deleteText', { count: toDelete.reports.length })}</DialogContentText>
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
          <Button color="error" variant="contained" disableElevation onClick={deleteGroup} loading={deleting}>
            {t('deleteConfirm')}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
}

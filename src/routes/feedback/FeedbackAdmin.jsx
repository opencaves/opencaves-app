import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { collection, deleteDoc, deleteField, doc, onSnapshot, orderBy, query, serverTimestamp, updateDoc } from 'firebase/firestore'
import { Box, Button, Chip, Dialog, DialogActions, DialogContent, DialogContentText, DialogTitle, IconButton, ListItemIcon, ListItemText, Menu, MenuItem, Stack, TextField, Tooltip, Typography } from '@mui/material'
import ArrowBackRounded from '@mui/icons-material/ArrowBackRounded'
import BugReportOutlined from '@mui/icons-material/BugReportOutlined'
import ReportGmailerrorredOutlined from '@mui/icons-material/ReportGmailerrorredOutlined'
import LightbulbOutlined from '@mui/icons-material/LightbulbOutlined'
import DeleteOutlineRounded from '@mui/icons-material/DeleteOutlineRounded'
import ArrowDropDownRounded from '@mui/icons-material/ArrowDropDownRounded'
import FiberNewOutlined from '@mui/icons-material/FiberNewOutlined'
import VerifiedOutlined from '@mui/icons-material/VerifiedOutlined'
import PendingOutlined from '@mui/icons-material/PendingOutlined'
import TaskAltRounded from '@mui/icons-material/TaskAltRounded'
import BlockRounded from '@mui/icons-material/BlockRounded'
import ContentCopyRounded from '@mui/icons-material/ContentCopyRounded'
import CheckRounded from '@mui/icons-material/CheckRounded'
import { auth, db } from '@/config/firebase.js'
import { FEEDBACK_COLLECTION } from '@/config/collections.js'
import { FEEDBACK_STATUSES, OPEN_FEEDBACK_STATUSES, TOLD_FEEDBACK_STATUSES } from '@/utils/feedback.js'
import { useTitle } from '@/hooks/useTitle.jsx'
import { useAccounts } from '@/routes/audits/useAccounts.js'
import { DASHBOARD_SURFACE_SX } from '@/components/dashboardSurface.js'
import ListSkeleton from '@/components/Skeletons/ListSkeleton.jsx'

const ICONS = { bug: <BugReportOutlined />, misleading: <ReportGmailerrorredOutlined />, idea: <LightbulbOutlined /> }
// Each stage's icon and chip colour.
const STATUS = {
  new: { icon: <FiberNewOutlined />, color: 'primary' },
  confirmed: { icon: <VerifiedOutlined />, color: 'secondary' },
  inProgress: { icon: <PendingOutlined />, color: 'info' },
  done: { icon: <TaskAltRounded />, color: 'success' },
  rejected: { icon: <BlockRounded />, color: 'error' },
  duplicate: { icon: <ContentCopyRounded />, color: 'default' },
}
// The list's filters: the open reports (the default), each stage, or all.
const SHOWN = ['open', ...FEEDBACK_STATUSES, 'all']
const isShown = (report, shown) => shown === 'all' || (shown === 'open' ? OPEN_FEEDBACK_STATUSES.includes(report.status) : report.status === shown)

// A report's stage, as a chip opening the menu that changes it. Done or
// rejected, its author is emailed (onFeedbackStatusChanged): a dialog first
// takes the note for them, saved with the stage.
function StatusMenu({ report, authorLabel }) {
  const { t } = useTranslation('feedback')
  const [anchor, setAnchor] = useState(null)
  const [closing, setClosing] = useState(null)
  const [note, setNote] = useState('')
  const current = STATUS[report.status] ? report.status : 'new'

  function save(status, fields = {}) {
    updateDoc(doc(db, FEEDBACK_COLLECTION, report.id), { status, statusUpdatedAt: serverTimestamp(), statusUpdatedBy: auth.currentUser.uid, ...fields }).catch((error) => console.error(error))
  }

  function change(status) {
    setAnchor(null)
    if (status === current) return
    if (TOLD_FEEDBACK_STATUSES.includes(status)) {
      setNote(report.note || '')
      setClosing(status)
      return
    }
    save(status)
  }

  function close() {
    const trimmed = note.trim()
    save(closing, { note: trimmed || deleteField() })
    setClosing(null)
  }

  return (
    <>
      <Chip
        className="oc-feedback-admin--status"
        size="small"
        icon={STATUS[current].icon}
        label={
          <Box component="span" sx={{ display: 'inline-flex', alignItems: 'center' }}>
            {t(`admin.status.${current}`)}
            <ArrowDropDownRounded sx={{ fontSize: 20, mr: -0.75 }} />
          </Box>
        }
        color={STATUS[current].color}
        onClick={(event) => setAnchor(event.currentTarget)}
        aria-haspopup="menu"
        aria-label={t('admin.changeStatus', { status: t(`admin.status.${current}`) })}
      />
      <Menu anchorEl={anchor} open={Boolean(anchor)} onClose={() => setAnchor(null)}>
        {FEEDBACK_STATUSES.map((status) => (
          <MenuItem key={status} selected={status === current} onClick={() => change(status)}>
            <ListItemIcon>{STATUS[status].icon}</ListItemIcon>
            <ListItemText primary={t(`admin.status.${status}`)} secondary={t(`admin.statusHelp.${status}`)} />
            {status === current && <CheckRounded fontSize="small" sx={{ ml: 2, color: 'var(--mui-sys-color-primary)' }} />}
          </MenuItem>
        ))}
      </Menu>
      <Dialog className="oc-feedback-admin--close-dialog" open={Boolean(closing)} onClose={() => setClosing(null)} maxWidth="sm" fullWidth>
        <DialogTitle>{closing && t('admin.closeTitle', { status: t(`admin.status.${closing}`) })}</DialogTitle>
        <DialogContent>
          <DialogContentText sx={{ mb: 2 }}>{t('admin.closeText', { name: authorLabel })}</DialogContentText>
          <TextField
            autoFocus
            fullWidth
            multiline
            minRows={3}
            label={t('admin.noteForReporter')}
            placeholder={closing && t(`admin.closePlaceholder.${closing}`)}
            value={note}
            onChange={(event) => setNote(event.target.value.slice(0, 2000))}
          />
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setClosing(null)}>{t('cancel')}</Button>
          <Button variant="contained" onClick={close}>
            {t('admin.closeConfirm')}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  )
}

// The admins' note on a report (why it was rejected, what it duplicates, what
// was done), saved when the field is left.
function NoteField({ report }) {
  const { t } = useTranslation('feedback')
  const [value, setValue] = useState(report.note || '')
  useEffect(() => setValue(report.note || ''), [report.note])

  function save() {
    const note = value.trim()
    if (note === (report.note || '')) return
    updateDoc(doc(db, FEEDBACK_COLLECTION, report.id), { note: note || deleteField() }).catch((error) => console.error(error))
  }

  return (
    <TextField
      className="oc-feedback-admin--note"
      size="small"
      fullWidth
      multiline
      label={t('admin.note')}
      placeholder={t('admin.notePlaceholder')}
      value={value}
      onChange={(event) => setValue(event.target.value.slice(0, 2000))}
      onBlur={save}
      sx={{ mt: 1.5 }}
    />
  )
}

// /feedback (admins): the beta testers' reports (the Send feedback form,
// _feedback), newest first - each its kind, message, page, browser, author
// and date - moved through their stages (FEEDBACK_STATUSES: open while new,
// confirmed or in progress; closed once done, rejected or a duplicate), with
// a note, or deleted. The new ones were also emailed to the admins
// (onFeedbackCreated).
export default function FeedbackAdmin() {
  const { t, i18n } = useTranslation('feedback')
  const { setTitle } = useTitle()
  const { accountLabel } = useAccounts()
  const [reports, setReports] = useState(null)
  const [shown, setShown] = useState('open')
  const [toDelete, setToDelete] = useState(null)

  useEffect(() => {
    setTitle(t('admin.title'))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [t])

  useEffect(
    () =>
      onSnapshot(
        query(collection(db, FEEDBACK_COLLECTION), orderBy('createdAt', 'desc')),
        (snapshot) => setReports(snapshot.docs.map((d) => ({ id: d.id, ...d.data() }))),
        (error) => {
          console.error(error)
          setReports([])
        },
      ),
    [],
  )

  const counts = useMemo(() => Object.fromEntries(SHOWN.map((s) => [s, (reports || []).filter((r) => isShown(r, s)).length])), [reports])
  const list = (reports || []).filter((r) => isShown(r, shown))
  const dateOf = new Intl.DateTimeFormat(i18n.language, { dateStyle: 'medium', timeStyle: 'short' })
  const formatDate = (value) => (value?.toDate ? dateOf.format(value.toDate()) : null)

  return (
    <div className="oc-feedback-admin">
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
        <Tooltip title={t('admin.back')}>
          <IconButton component={Link} to="/dashboard" aria-label={t('admin.back')} sx={{ ml: { xs: 0, sm: -4 }, mr: -0.5 }}>
            <ArrowBackRounded />
          </IconButton>
        </Tooltip>
        <Typography component="h1" variant="h5">
          {t('admin.title')}
        </Typography>
      </Box>

      <Stack direction="row" sx={{ flexWrap: 'wrap', gap: 1, mb: 2 }}>
        {SHOWN.map((s) => (
          <Chip
            key={s}
            label={`${s === 'open' || s === 'all' ? t(`admin.shown.${s}`) : t(`admin.status.${s}`)} ${counts[s]}`}
            onClick={() => setShown(s)}
            color={shown === s ? 'primary' : 'default'}
            variant={shown === s ? 'filled' : 'outlined'}
            aria-pressed={shown === s}
          />
        ))}
      </Stack>

      {reports === null ? (
        <ListSkeleton rows={4} fill={false} card secondary />
      ) : list.length === 0 ? (
        <Typography sx={{ color: 'text.secondary' }}>{t('admin.none')}</Typography>
      ) : (
        <Stack spacing={1.5} component="ul" sx={{ listStyle: 'none', m: 0, p: 0 }}>
          {list.map((report) => {
            const closed = !OPEN_FEEDBACK_STATUSES.includes(report.status)
            return (
              <Box component="li" key={report.id} className="oc-feedback-admin--report" sx={{ ...DASHBOARD_SURFACE_SX, p: 2, '& > :not(.oc-feedback-admin--header)': { opacity: closed ? 0.7 : 1 } }}>
                <Box className="oc-feedback-admin--header" sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap', mb: 1 }}>
                  <StatusMenu report={report} authorLabel={accountLabel(report.userId)} />
                  <Chip size="small" icon={ICONS[report.kind]} label={t(`kinds.${report.kind}`, { defaultValue: report.kind })} variant="outlined" />
                  <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                    {[accountLabel(report.userId), formatDate(report.createdAt)].filter(Boolean).join(' · ')}
                  </Typography>
                  <Box sx={{ flex: 1 }} />
                  <Tooltip title={t('admin.delete')}>
                    <IconButton size="small" aria-label={t('admin.delete')} onClick={() => setToDelete(report)}>
                      <DeleteOutlineRounded />
                    </IconButton>
                  </Tooltip>
                </Box>
                <Typography sx={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{report.message}</Typography>
                {report.page && (
                  <Typography variant="body2" sx={{ mt: 1 }}>
                    {t('admin.page')}{' '}
                    <Link to={report.page} style={{ color: 'var(--mui-sys-color-primary)' }}>
                      {report.page}
                    </Link>
                  </Typography>
                )}
                {report.browser && (
                  <Typography variant="body2" sx={{ mt: 0.5, color: 'text.secondary', overflowWrap: 'anywhere' }}>
                    {t('admin.browser')} {report.browser}
                  </Typography>
                )}
                {report.statusUpdatedBy && (
                  <Typography variant="body2" sx={{ mt: 0.5, color: 'text.secondary' }}>
                    {t('admin.statusSet', { status: t(`admin.status.${report.status}`), name: accountLabel(report.statusUpdatedBy), date: formatDate(report.statusUpdatedAt) || '' })}
                  </Typography>
                )}
                {report.reporterEmailedAt && (
                  <Typography variant="body2" sx={{ mt: 0.5, color: 'text.secondary' }}>
                    {t('admin.reporterEmailed', { date: formatDate(report.reporterEmailedAt) || '' })}
                  </Typography>
                )}
                <NoteField report={report} />
              </Box>
            )
          })}
        </Stack>
      )}

      <Dialog open={Boolean(toDelete)} onClose={() => setToDelete(null)}>
        <DialogTitle>{t('admin.deleteTitle')}</DialogTitle>
        <DialogContent>
          <DialogContentText>{t('admin.deleteText')}</DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setToDelete(null)}>{t('cancel')}</Button>
          <Button
            color="error"
            onClick={async () => {
              const { id } = toDelete
              setToDelete(null)
              await deleteDoc(doc(db, FEEDBACK_COLLECTION, id))
            }}
          >
            {t('admin.delete')}
          </Button>
        </DialogActions>
      </Dialog>
    </div>
  )
}

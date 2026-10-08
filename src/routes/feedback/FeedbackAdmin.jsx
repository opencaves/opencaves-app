import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { collection, deleteDoc, doc, onSnapshot, orderBy, query, updateDoc } from 'firebase/firestore'
import { Box, Button, Chip, Dialog, DialogActions, DialogContent, DialogContentText, DialogTitle, IconButton, Stack, Tooltip, Typography } from '@mui/material'
import ArrowBackRounded from '@mui/icons-material/ArrowBackRounded'
import BugReportOutlined from '@mui/icons-material/BugReportOutlined'
import ReportGmailerrorredOutlined from '@mui/icons-material/ReportGmailerrorredOutlined'
import LightbulbOutlined from '@mui/icons-material/LightbulbOutlined'
import CheckCircleOutlineRounded from '@mui/icons-material/CheckCircleOutlineRounded'
import ReplayRounded from '@mui/icons-material/ReplayRounded'
import DeleteOutlineRounded from '@mui/icons-material/DeleteOutlineRounded'
import { db } from '@/config/firebase.js'
import { FEEDBACK_COLLECTION } from '@/config/collections.js'
import { useTitle } from '@/hooks/useTitle.jsx'
import { useAccounts } from '@/routes/audits/useAccounts.js'
import { DASHBOARD_SURFACE_SX } from '@/components/dashboardSurface.js'
import ListSkeleton from '@/components/Skeletons/ListSkeleton.jsx'

const ICONS = { bug: <BugReportOutlined />, misleading: <ReportGmailerrorredOutlined />, idea: <LightbulbOutlined /> }
const SHOWN = ['new', 'done', 'all']

// /feedback (admins): the beta testers' reports (the Send feedback form,
// _feedback), newest first - each its kind, message, page, author and date;
// marked done (or new again) or deleted. The new ones were also emailed to
// the admins (onFeedbackCreated).
export default function FeedbackAdmin() {
  const { t, i18n } = useTranslation('feedback')
  const { setTitle } = useTitle()
  const { accountLabel } = useAccounts()
  const [reports, setReports] = useState(null)
  const [shown, setShown] = useState('new')
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

  const counts = useMemo(() => ({ new: (reports || []).filter((r) => r.status !== 'done').length, done: (reports || []).filter((r) => r.status === 'done').length, all: (reports || []).length }), [reports])
  const list = (reports || []).filter((r) => shown === 'all' || (shown === 'done' ? r.status === 'done' : r.status !== 'done'))
  const dateOf = new Intl.DateTimeFormat(i18n.language, { dateStyle: 'medium', timeStyle: 'short' })

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
          <Chip key={s} label={`${t(`admin.shown.${s}`)} ${counts[s]}`} onClick={() => setShown(s)} color={shown === s ? 'primary' : 'default'} variant={shown === s ? 'filled' : 'outlined'} aria-pressed={shown === s} />
        ))}
      </Stack>

      {reports === null ? (
        <ListSkeleton rows={4} fill={false} card secondary />
      ) : list.length === 0 ? (
        <Typography sx={{ color: 'text.secondary' }}>{t('admin.none')}</Typography>
      ) : (
        <Stack spacing={1.5} component="ul" sx={{ listStyle: 'none', m: 0, p: 0 }}>
          {list.map((report) => (
            <Box component="li" key={report.id} className="oc-feedback-admin--report" sx={{ ...DASHBOARD_SURFACE_SX, p: 2, opacity: report.status === 'done' ? 0.65 : 1 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap', mb: 1 }}>
                <Chip size="small" icon={ICONS[report.kind]} label={t(`kinds.${report.kind}`, { defaultValue: report.kind })} variant="outlined" />
                {report.status === 'done' && <Chip size="small" label={t('admin.done')} color="success" variant="outlined" />}
                <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                  {[accountLabel(report.userId), report.createdAt?.toDate ? dateOf.format(report.createdAt.toDate()) : null].filter(Boolean).join(' · ')}
                </Typography>
                <Box sx={{ flex: 1 }} />
                <Tooltip title={report.status === 'done' ? t('admin.reopen') : t('admin.markDone')}>
                  <IconButton size="small" aria-label={report.status === 'done' ? t('admin.reopen') : t('admin.markDone')} onClick={() => updateDoc(doc(db, FEEDBACK_COLLECTION, report.id), { status: report.status === 'done' ? 'new' : 'done' })}>
                    {report.status === 'done' ? <ReplayRounded /> : <CheckCircleOutlineRounded />}
                  </IconButton>
                </Tooltip>
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
            </Box>
          ))}
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

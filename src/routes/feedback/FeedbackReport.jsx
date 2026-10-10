import { useEffect, useState } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { doc, onSnapshot } from 'firebase/firestore'
import { Box, Button, Chip, Dialog, DialogActions, DialogContent, DialogContentText, DialogTitle, Divider, IconButton, Skeleton, Tooltip, Typography } from '@mui/material'
import ArrowBackRounded from '@mui/icons-material/ArrowBackRounded'
import DeleteOutlineRounded from '@mui/icons-material/DeleteOutlineRounded'
import NotificationsOffOutlined from '@mui/icons-material/NotificationsOffOutlined'
import RadioButtonCheckedRounded from '@mui/icons-material/RadioButtonCheckedRounded'
import CheckCircleOutlineRounded from '@mui/icons-material/CheckCircleOutlineRounded'
import { auth, db } from '@/config/firebase.js'
import { FEEDBACK_COLLECTION, FEEDBACK_PRIVATE_COLLECTION } from '@/config/collections.js'
import { useTitle } from '@/hooks/useTitle.jsx'
import { useSnackbar } from '@/components/Snackbar/useSnackbar.jsx'
import { DASHBOARD_SURFACE_SX } from '@/components/dashboardSurface.js'
import { KindChip, RelativeTime, StageChip, StatusMenu, deleteFeedbackReport, isOpen, messageCountOf, statusOf, titleOf, useFeedbackReader } from './feedbackUi.jsx'
import { FeedbackTimeline, ReplyForm, useFeedbackMessages } from './FeedbackThread.jsx'

// One labelled entry of the side panel.
function Field({ label, children }) {
  return (
    <Box className="oc-feedback-report--field" sx={{ py: 1.5, '&:first-of-type': { pt: 0 } }}>
      {label && (
        <Typography variant="caption" component="h2" sx={{ display: 'block', fontWeight: 700, color: 'text.secondary', mb: 0.5 }}>
          {label}
        </Typography>
      )}
      <Box sx={{ typography: 'body2', overflowWrap: 'anywhere' }}>{children}</Box>
    </Box>
  )
}

// The open/closed badge (GitHub's issue state): closed as done in the
// secondary colour, otherwise neutral.
function StateBadge({ report }) {
  const { t } = useTranslation('feedback')
  const open = isOpen(report)
  return (
    <Chip
      className="oc-feedback-report--state"
      icon={open ? <RadioButtonCheckedRounded /> : <CheckCircleOutlineRounded />}
      label={t(open ? 'admin.report.open' : 'admin.report.closed')}
      color={open ? 'success' : statusOf(report) === 'done' ? 'secondary' : 'default'}
      sx={{ fontWeight: 600 }}
    />
  )
}

/**
 * /feedback/:feedbackId: one report, as GitHub shows an issue - its title
 * (its message's first line) and state, its timeline (the report, the
 * thread's messages, the stages set), and a side panel (under the timeline
 * on phones) with its stage, kind, author and page. Admins also get the
 * reply box, the stage menu, the author's email, the language, the browser
 * (its _feedbackPrivate doc, admins only), the email hints and its deletion;
 * every other registered account only reads it (Ideas and fixes), the
 * author by name only (useFeedbackReader).
 */
export default function FeedbackReport() {
  const { t, i18n } = useTranslation('feedback')
  const { feedbackId } = useParams()
  const location = useLocation()
  const navigate = useNavigate()
  const { setTitle } = useTitle()
  const { isAdmin, authorOf, labelsFor, accountList } = useFeedbackReader()
  const [openSnackbar] = useSnackbar()
  const [report, setReport] = useState(undefined)
  // Its browser: admins only, in its private doc.
  const [browser, setBrowser] = useState(null)
  const [toDelete, setToDelete] = useState(false)
  const messages = useFeedbackMessages(feedbackId)
  const back = `/feedback${location.state?.from || ''}`

  useEffect(
    () =>
      onSnapshot(
        doc(db, FEEDBACK_COLLECTION, feedbackId),
        (snapshot) => setReport(snapshot.exists() ? { id: snapshot.id, ...snapshot.data({ serverTimestamps: 'estimate' }) } : null),
        (error) => {
          console.error(error)
          setReport(null)
        },
      ),
    [feedbackId],
  )

  useEffect(() => {
    setBrowser(null)
    if (!isAdmin) return undefined
    return onSnapshot(
      doc(db, FEEDBACK_PRIVATE_COLLECTION, feedbackId),
      (snapshot) => setBrowser(snapshot.get('browser') || null),
      (error) => console.error(error),
    )
  }, [feedbackId, isAdmin])

  useEffect(() => {
    setTitle(report ? titleOf(report) : t(isAdmin ? 'admin.title' : 'members.title'))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [t, report?.message])

  const header = (
    <Tooltip title={t('admin.report.back')}>
      <IconButton component={Link} to={back} aria-label={t('admin.report.back')} sx={{ ml: { xs: 0, sm: -4 }, mr: -0.5, alignSelf: 'flex-start' }}>
        <ArrowBackRounded />
      </IconButton>
    </Tooltip>
  )

  if (report === null) {
    return (
      <div className="oc-feedback-report">
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          {header}
          <Typography>{t('admin.report.notFound')}</Typography>
        </Box>
      </div>
    )
  }
  if (!report || !messages) {
    return (
      <div className="oc-feedback-report">
        <Skeleton variant="text" width="60%" height={40} />
        <Skeleton variant="rounded" height={160} sx={{ mt: 2 }} />
      </div>
    )
  }

  const accountLabel = labelsFor(report)
  const authorName = authorOf(report)
  // Admins only (accountList is empty for anyone else).
  const authorEmail = accountList.find((account) => account.uid === report.userId)?.email
  // An older report's browser, on the report itself until
  // scripts/move-feedback-private.js moves it.
  const browserShown = browser || report.browser
  const me = auth.currentUser?.displayName || auth.currentUser?.email || ''
  const count = messageCountOf(report)
  let languageName = report.language || null
  try {
    if (languageName) languageName = new Intl.DisplayNames([i18n.language], { type: 'language' }).of(report.language)
  } catch {
    // An unknown code: shown as is.
  }

  return (
    <div className="oc-feedback-report">
      <Box className="oc-feedback-report--header" sx={{ display: 'flex', gap: 1, mb: 1 }}>
        {header}
        <Box sx={{ minWidth: 0 }}>
          <Typography component="h1" variant="h5" sx={{ overflowWrap: 'anywhere', pt: 0.5 }}>
            {titleOf(report) || t('admin.list.untitled')}
          </Typography>
          <Box sx={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 1, mt: 1 }}>
            <StateBadge report={report} />
            <Typography variant="body2" sx={{ color: 'text.secondary' }}>
              <Box component="strong" sx={{ color: 'text.primary' }}>
                {authorName}
              </Box>{' '}
              {t('admin.report.openedThis')} <RelativeTime value={report.createdAt} /> · {t('admin.list.messages', { count })}
            </Typography>
          </Box>
        </Box>
      </Box>
      <Divider sx={{ my: 2 }} />

      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: 'minmax(0, 1fr)', md: 'minmax(0, 1fr) 260px' }, gap: 3, alignItems: 'start' }}>
        <Box className="oc-feedback-report--main" sx={{ minWidth: 0 }}>
          <FeedbackTimeline report={report} messages={messages} accountLabel={accountLabel} readOnly={!isAdmin} />
          {isAdmin && <ReplyForm report={report} authorLabel={authorName} myName={me} />}
        </Box>

        <Box component="aside" className="oc-feedback-report--side" aria-label={t('admin.report.details')} sx={{ ...DASHBOARD_SURFACE_SX, p: 2, '& > .oc-feedback-report--field + .oc-feedback-report--field': { borderTop: 1, borderColor: 'divider' } }}>
          <Field label={t('admin.report.stage')}>
            {isAdmin ? <StatusMenu report={report} /> : <StageChip report={report} />}
            {report.statusUpdatedBy && (
              <Typography variant="body2" sx={{ mt: 0.75, color: 'text.secondary' }}>
                {accountLabel(report.statusUpdatedBy)} · <RelativeTime value={report.statusUpdatedAt} />
              </Typography>
            )}
          </Field>
          <Field label={t('admin.report.kind')}>
            <KindChip kind={report.kind} />
          </Field>
          <Field label={t('admin.report.author')}>
            <div>{authorName}</div>
            {isAdmin && authorEmail && (
              <Box component="a" href={`mailto:${authorEmail}`} sx={{ color: 'primary.main' }}>
                {authorEmail}
              </Box>
            )}
          </Field>
          {report.page && (
            <Field label={t('admin.report.page')}>
              <Box component={Link} to={report.page} sx={{ color: 'primary.main' }}>
                {report.page}
              </Box>
            </Field>
          )}
          {isAdmin && languageName && <Field label={t('admin.report.language')}>{languageName}</Field>}
          {isAdmin && browserShown && (
            <Field label={t('admin.report.browser')}>
              <Box className="oc-feedback-report--browser" sx={{ typography: 'caption', color: 'text.secondary', overflowWrap: 'anywhere' }}>{browserShown}</Box>
            </Field>
          )}
          {isAdmin && report.reporterEmailedAt && (
            <Field label={t('admin.report.lastEmailed')}>
              <RelativeTime value={report.reporterEmailedAt} />
            </Field>
          )}
          {/* authorMuted: mirrored by the server from the author's settings
              (onAuthorMutedChanged) - admins don't read _users. */}
          {isAdmin && report.authorMuted && (
            <Field>
              <Box className="oc-feedback-report--muted" sx={{ display: 'flex', alignItems: 'center', gap: 1, typography: 'body2', color: 'text.secondary' }}>
                <NotificationsOffOutlined fontSize="small" />
                {t('admin.report.authorMuted')}
              </Box>
            </Field>
          )}
          {isAdmin && (
            <Field>
              <Button className="oc-feedback-report--delete" size="small" color="error" variant="outlined" startIcon={<DeleteOutlineRounded />} onClick={() => setToDelete(true)}>
                {t('admin.delete')}
              </Button>
            </Field>
          )}
        </Box>
      </Box>

      <Dialog open={toDelete} onClose={() => setToDelete(false)}>
        <DialogTitle>{t('admin.deleteTitle')}</DialogTitle>
        <DialogContent>
          <DialogContentText>{t('admin.deleteText')}</DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setToDelete(false)}>{t('cancel')}</Button>
          <Button
            color="error"
            onClick={async () => {
              setToDelete(false)
              try {
                await deleteFeedbackReport(report.id)
                navigate(back, { replace: true })
              } catch (error) {
                console.error(error)
                openSnackbar(t('admin.deleteError'))
              }
            }}
          >
            {t('admin.delete')}
          </Button>
        </DialogActions>
      </Dialog>
    </div>
  )
}

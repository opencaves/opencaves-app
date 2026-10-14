import { useEffect, useState } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { doc, onSnapshot, serverTimestamp, updateDoc } from 'firebase/firestore'
import { useSelector } from 'react-redux'
import { Box, Button, Chip, Dialog, DialogActions, DialogContent, DialogContentText, DialogTitle, Divider, IconButton, Skeleton, Tooltip, Typography } from '@mui/material'
import ArrowBackRounded from '@mui/icons-material/ArrowBackRounded'
import DeleteOutlineRounded from '@mui/icons-material/DeleteOutlineRounded'
import NotificationsOffOutlined from '@mui/icons-material/NotificationsOffOutlined'
import RadioButtonCheckedRounded from '@mui/icons-material/RadioButtonCheckedRounded'
import SaveRounded from '@mui/icons-material/SaveRounded'
import CheckCircleOutlineRounded from '@mui/icons-material/CheckCircleOutlineRounded'
import { auth, db } from '@/config/firebase.js'
import { FEEDBACK_COLLECTION, FEEDBACK_PRIVATE_COLLECTION } from '@/config/collections.js'
import { useTitle } from '@/hooks/useTitle.jsx'
import { useSnackbar } from '@/components/Snackbar/useSnackbar.jsx'
import { DASHBOARD_SURFACE_SX } from '@/components/dashboardSurface.js'
import AccessIcon from '@/components/accessIcons.jsx'
import CaveModel from '@/models/CaveModel.js'
import { reportedValue } from '@/config/caveReview.js'
import { KindChip, RelativeTime, StageChip, StatusMenu, deleteFeedbackReport, isOpen, messageCountOf, statusOf, titleOf, useFeedbackReader } from './feedbackUi.jsx'
import { FeedbackTimeline, ReplyForm, useFeedbackMessages } from './FeedbackThread.jsx'

/**
 * One entry of the side panel, under its label (when it has one).
 *
 * @param {object} props
 * @param {import('react').ReactNode} [props.label]
 * @param {import('react').ReactNode} props.children
 */
function Field({ label, children }) {
  return (
    // One rhythm down the column (8px steps): 16px on each side of the lines
    // between fields, none above the first or under the last; 8px from a
    // title (one 16px line) to its content.
    <Box className="oc-feedback-report--field" sx={{ py: 2, '&:first-of-type': { pt: 0 }, '&:last-child': { pb: 0 } }}>
      {label && (
        <Typography variant="caption" component="h2" sx={{ display: 'block', fontWeight: 700, color: 'text.secondary', lineHeight: '16px', mb: 1 }}>
          {label}
        </Typography>
      )}
      <Box sx={{ typography: 'body2', overflowWrap: 'anywhere' }}>{children}</Box>
    </Box>
  )
}

// The open/closed badge (GitHub's issue state): open in the success colour's
// dark tone (white on the main green was 3:1, under text's 4.5:1), closed as
// done in the secondary colour, otherwise neutral.
function StateBadge({ report }) {
  const { t } = useTranslation('feedback')
  const open = isOpen(report)
  return (
    <Chip
      className="oc-feedback-report--state"
      icon={open ? <RadioButtonCheckedRounded /> : <CheckCircleOutlineRounded />}
      label={t(open ? 'admin.report.open' : 'admin.report.closed')}
      color={open ? 'success' : statusOf(report) === 'done' ? 'secondary' : 'default'}
      sx={(theme) => ({ fontWeight: 600, ...(open && { bgcolor: theme.vars.palette.success.dark, color: theme.vars.palette.common.white, '& .MuiChip-icon': { color: 'inherit' } }) })}
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

/**
 * A report that proposes a cave's access, accessibility or fees (What
 * changed?: access:permission, fees:no...), for an admin: the proposed value (its icon, its
 * table's name), the cave's current one, and a button that sets it on the
 * cave - a cave edit like the app's (audit-logged: What's new) - and closes
 * the report (done). Already the cave's value: said so, no button.
 *
 * @param {object} props
 * @param {FeedbackReport} props.report
 */
function ProposedChange({ report }) {
  const { t } = useTranslation('feedback', { keyPrefix: 'admin.report.proposed' })
  const { t: tTables } = useTranslation(['accesses', 'accessibilities', 'fees'])
  const caves = useSelector((/** @type {RootState} */ state) => state.data.caves)
  const [openSnackbar] = useSnackbar()
  const [saving, setSaving] = useState(false)
  const proposed = reportedValue(report.caveReport)
  if (!proposed || !report.caveId) return null
  const cave = caves.find(({ id }) => id === report.caveId)
  const current = cave?.[proposed.field]
  const applied = current === proposed.stored
  // A value's name in its table (the fees: true or false as yes or no).
  const label = (value) => {
    const key = typeof value === 'boolean' ? (value ? 'yes' : 'no') : value
    return key ? tTables(`${key}.label`, { ns: proposed.table, defaultValue: key }) : t('unknown')
  }

  async function apply() {
    setSaving(true)
    try {
      await CaveModel.save(report.caveId, { [proposed.field]: proposed.stored })
      await updateDoc(doc(db, FEEDBACK_COLLECTION, report.id), { status: 'done', statusUpdatedAt: serverTimestamp(), statusUpdatedBy: auth.currentUser.uid })
      openSnackbar(t('done', { name: cave?.name?.value?.trim() || report.caveId }), { severity: 'success' })
    } catch (error) {
      console.error(error)
      openSnackbar(t('error'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Field label={t('title')}>
      <Box className="oc-feedback-report--proposed" sx={{ display: 'flex', gap: 1, alignItems: 'flex-start', mb: 1.5 }}>
        <Box aria-hidden="true" sx={{ color: 'primary.main', display: 'flex', '& svg': { width: 20, height: 20 } }}>
          <AccessIcon table={proposed.table} value={proposed.value} fontSize="medium" />
        </Box>
        <div>
          <Box sx={{ fontWeight: 600 }}>{t(proposed.field)} · {label(proposed.value)}</Box>
          <Box sx={{ color: 'text.secondary' }}>{t('now', { value: label(current) })}</Box>
        </div>
      </Box>
      <Button className="oc-feedback-report--apply" size="small" sx={{ whiteSpace: 'nowrap' }} variant={applied ? 'text' : 'contained'} disableElevation disabled={applied || saving} startIcon={applied ? <CheckCircleOutlineRounded /> : <SaveRounded />} onClick={apply}>
        {applied ? t('applied') : t('apply')}
      </Button>
    </Field>
  )
}

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
  // An older report's browser, on the report itself where a one-time
  // script (2026-10-10) didn't move it.
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
              {t('admin.report.openedThis')} <RelativeTime value={report.createdAt} focusable /> · {t('admin.list.messages', { count })}
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
                {accountLabel(report.statusUpdatedBy)} · <RelativeTime value={report.statusUpdatedAt} focusable />
              </Typography>
            )}
          </Field>
          {isAdmin && <ProposedChange report={report} />}
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
              <RelativeTime value={report.reporterEmailedAt} focusable />
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

import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { collection, doc, getDocs, serverTimestamp, updateDoc, writeBatch } from 'firebase/firestore'
import { Avatar, Box, Button, Chip, Dialog, DialogActions, DialogContent, DialogContentText, DialogTitle, ListItemIcon, ListItemText, Menu, MenuItem, Typography } from '@mui/material'
import BugReportRounded from '@mui/icons-material/BugReportRounded'
import ReportGmailerrorredRounded from '@mui/icons-material/ReportGmailerrorredRounded'
import LightbulbRounded from '@mui/icons-material/LightbulbRounded'
import ArrowDropDownRounded from '@mui/icons-material/ArrowDropDownRounded'
import FiberNewRounded from '@mui/icons-material/FiberNewRounded'
import VerifiedRounded from '@mui/icons-material/VerifiedRounded'
import PendingRounded from '@mui/icons-material/PendingRounded'
import TaskAltRounded from '@mui/icons-material/TaskAltRounded'
import BlockRounded from '@mui/icons-material/BlockRounded'
import ContentCopyRounded from '@mui/icons-material/ContentCopyRounded'
import CheckRounded from '@mui/icons-material/CheckRounded'
import RadioButtonCheckedRounded from '@mui/icons-material/RadioButtonCheckedRounded'
import CheckCircleOutlineRounded from '@mui/icons-material/CheckCircleOutlineRounded'
import { auth, db } from '@/config/firebase.js'
import { FEEDBACK_COLLECTION, FEEDBACK_MESSAGES_COLLECTION } from '@/config/collections.js'
import { FEEDBACK_REPLY_MAX_LENGTH, FEEDBACK_STATUSES, OPEN_FEEDBACK_STATUSES, TOLD_FEEDBACK_STATUSES } from '@/utils/feedback.js'
import { toDate } from '@/components/RelativeTime.jsx'
import { useSnackbar } from '@/components/Snackbar/useSnackbar.jsx'
import MarkdownField from '@/components/Markdown/MarkdownField.jsx'

export { default as RelativeTime, toDate } from '@/components/RelativeTime.jsx'

// What the Feedback pages (the list, /feedback, and a report's page,
// /feedback/:feedbackId) share: the kinds' and stages' looks, the stage menu,
// dates, avatars and the writes.

// Each kind's icon and label colour.
export const KINDS = {
  bug: { icon: <BugReportRounded />, color: 'error' },
  misleading: { icon: <ReportGmailerrorredRounded />, color: 'warning' },
  idea: { icon: <LightbulbRounded />, color: 'info' },
}
// Each stage's icon and chip colour.
export const STATUS = {
  new: { icon: <FiberNewRounded />, color: 'primary' },
  confirmed: { icon: <VerifiedRounded />, color: 'secondary' },
  inProgress: { icon: <PendingRounded />, color: 'info' },
  done: { icon: <TaskAltRounded />, color: 'success' },
  rejected: { icon: <BlockRounded />, color: 'error' },
  duplicate: { icon: <ContentCopyRounded />, color: 'default' },
}
export const CLOSED_FEEDBACK_STATUSES = FEEDBACK_STATUSES.filter((status) => !OPEN_FEEDBACK_STATUSES.includes(status))
export const statusOf = (report) => (STATUS[report.status] ? report.status : 'new')
export const isOpen = (report) => OPEN_FEEDBACK_STATUSES.includes(statusOf(report))

// A report's title, GitHub-issue style: its message's first line.
export const titleOf = (report) => String(report.message || '').trim().split('\n')[0].trim()
// The messages of its thread: the server's count (onFeedbackReplied), and the
// admins' former note, shown as its first reply.
export const messageCountOf = (report) => (report.messageCount || 0) + (report.note ? 1 : 0)
// Its latest activity: a message, a stage set, or its sending.
export const activityOf = (report) => Math.max(...[report.createdAt, report.statusUpdatedAt, report.lastMessageAt].map((value) => toDate(value)?.getTime() || 0))

// The open/closed mark (GitHub's issue state): open, closed as done, or
// closed otherwise (rejected, a duplicate).
export function StateIcon({ report, sx }) {
  const status = statusOf(report)
  if (isOpen(report)) return <RadioButtonCheckedRounded className="oc-feedback-state-icon" sx={{ color: 'success.main', ...sx }} />
  return <CheckCircleOutlineRounded className="oc-feedback-state-icon" sx={{ color: status === 'done' ? 'secondary.main' : 'text.secondary', ...sx }} />
}

// A person's initials on a coloured disc: the team's in the primary colour.
export function Initials({ name, team, size = 32 }) {
  const initials =
    String(name || '?')
      .split(/[\s@._-]+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0].toUpperCase())
      .join('') || '?'
  return (
    <Avatar
      className="oc-feedback-avatar"
      aria-hidden
      sx={(theme) => ({
        width: size,
        height: size,
        fontSize: size * 0.42,
        fontWeight: 600,
        bgcolor: team ? theme.vars.sys.color.primary : theme.vars.sys.color.secondaryContainer,
        color: team ? theme.vars.palette.primary.contrastText : theme.vars.sys.color.onSecondaryContainer,
      })}
    >
      {initials}
    </Avatar>
  )
}

// A team reply to a report, emailed to its author (onFeedbackReplied). With a
// stage (done, rejected) it also closes the report, in the same batch: the
// report then names the reply (statusReplyId), so the author gets this one
// email - the reply, with the outcome - and not also the outcome's own
// (onFeedbackStatusChanged).
export async function sendFeedbackReply(report, text, status) {
  const reportRef = doc(db, FEEDBACK_COLLECTION, report.id)
  const messageRef = doc(collection(reportRef, FEEDBACK_MESSAGES_COLLECTION))
  const closes = status && status !== report.status
  const batch = writeBatch(db)
  batch.set(messageRef, { from: 'team', text, createdAt: serverTimestamp(), userId: auth.currentUser.uid, via: 'app', ...(closes && { status }) })
  if (closes) batch.update(reportRef, { status, statusUpdatedAt: serverTimestamp(), statusUpdatedBy: auth.currentUser.uid, statusReplyId: messageRef.id })
  await batch.commit()
}

// A report, deleted with its thread (a deleted document keeps its
// subcollections).
export async function deleteFeedbackReport(id) {
  const reportRef = doc(db, FEEDBACK_COLLECTION, id)
  const messages = await getDocs(collection(reportRef, FEEDBACK_MESSAGES_COLLECTION))
  const batch = writeBatch(db)
  messages.forEach((message) => batch.delete(message.ref))
  batch.delete(reportRef)
  await batch.commit()
}

// A report's stage, as a chip opening the menu that changes it. Done or
// rejected, its author is emailed: a dialog first takes an optional reply -
// with one, it's sent with the stage, one email with both (onFeedbackReplied);
// without, they're emailed the outcome alone (onFeedbackStatusChanged).
export function StatusMenu({ report, authorLabel, size = 'small' }) {
  const { t } = useTranslation('feedback')
  const [openSnackbar] = useSnackbar()
  const [anchor, setAnchor] = useState(null)
  const [closing, setClosing] = useState(null)
  const [reply, setReply] = useState('')
  const current = statusOf(report)
  const trimmed = reply.trim()
  const tooLong = trimmed.length > FEEDBACK_REPLY_MAX_LENGTH

  function save(status) {
    updateDoc(doc(db, FEEDBACK_COLLECTION, report.id), { status, statusUpdatedAt: serverTimestamp(), statusUpdatedBy: auth.currentUser.uid }).catch((error) => {
      console.error(error)
      openSnackbar(t('admin.statusError'))
    })
  }

  function change(status) {
    setAnchor(null)
    if (status === current) return
    if (TOLD_FEEDBACK_STATUSES.includes(status)) {
      setReply('')
      setClosing(status)
      return
    }
    save(status)
  }

  function close() {
    const status = closing
    setClosing(null)
    if (!trimmed) {
      save(status)
      return
    }
    sendFeedbackReply(report, trimmed, status)
      .then(() => openSnackbar(t('admin.thread.sent', { name: authorLabel }), { severity: 'success' }))
      .catch((error) => {
        console.error(error)
        openSnackbar(t('admin.thread.sendError'))
      })
  }

  return (
    <>
      <Chip
        className="oc-feedback-status"
        size={size}
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
            {status === current && <CheckRounded fontSize="small" sx={{ ml: 2, color: 'primary.main' }} />}
          </MenuItem>
        ))}
      </Menu>
      <Dialog className="oc-feedback-close-dialog" open={Boolean(closing)} onClose={() => setClosing(null)} maxWidth="sm" fullWidth>
        <DialogTitle>{closing && t('admin.closeTitle', { status: t(`admin.status.${closing}`) })}</DialogTitle>
        <DialogContent>
          <DialogContentText sx={{ mb: 2 }}>{t('admin.closeText', { name: authorLabel })}</DialogContentText>
          <MarkdownField label={t('admin.replyForReporter')} placeholder={closing ? t(`admin.closePlaceholder.${closing}`) : ''} value={reply} onChange={(event) => setReply(event.target.value)} minRows={3} />
          {tooLong && (
            <Typography variant="body2" sx={{ mt: 0.5, color: 'error.main' }}>
              {t('admin.thread.tooLong', { count: FEEDBACK_REPLY_MAX_LENGTH })}
            </Typography>
          )}
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setClosing(null)}>{t('cancel')}</Button>
          <Button variant="contained" onClick={close} disabled={tooLong}>
            {trimmed ? t('admin.closeConfirmReply') : t('admin.closeConfirm')}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  )
}

// The kind, as a coloured label.
export function KindChip({ kind, size = 'small' }) {
  const { t } = useTranslation('feedback')
  const look = KINDS[kind] || KINDS.misleading
  return <Chip className="oc-feedback-kind" size={size} variant="outlined" color={look.color} icon={look.icon} label={t(`kinds.${kind}`, { defaultValue: kind })} />
}

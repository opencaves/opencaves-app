import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { collection, doc, getDocs, serverTimestamp, updateDoc, writeBatch } from 'firebase/firestore'
import { Avatar, Box, Chip, ListItemIcon, ListItemText, Menu, MenuItem } from '@mui/material'
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
import { FEEDBACK_STATUSES, OPEN_FEEDBACK_STATUSES } from '@/utils/feedback.js'
import { toDate } from '@/components/RelativeTime/RelativeTime.jsx'
import { useSnackbar } from '@/components/Snackbar/useSnackbar.jsx'

export { default as RelativeTime, toDate } from '@/components/RelativeTime/RelativeTime.jsx'

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

/**
 * A report's title, GitHub-issue style: its message's first line.
 *
 * @param {object} report
 * @returns {string}
 */
export const titleOf = (report) => String(report.message || '').trim().split('\n')[0].trim()
/**
 * The messages of its thread: the server's count (onFeedbackReplied), and the
 * admins' former note, shown as its first reply.
 *
 * @param {object} report
 * @returns {number}
 */
export const messageCountOf = (report) => (report.messageCount || 0) + (report.note ? 1 : 0)
/**
 * Its latest activity: a message, a stage set, or its sending.
 *
 * @param {object} report
 * @returns {number}
 */
export const activityOf = (report) => Math.max(...[report.createdAt, report.statusUpdatedAt, report.lastMessageAt].map((value) => toDate(value)?.getTime() || 0))

/**
 * The open/closed mark (GitHub's issue state): open, closed as done, or
 * closed otherwise (rejected, a duplicate).
 */
export function StateIcon({ report, sx }) {
  const status = statusOf(report)
  if (isOpen(report)) return <RadioButtonCheckedRounded className="oc-feedback-state-icon" sx={{ color: 'success.main', ...sx }} />
  return <CheckCircleOutlineRounded className="oc-feedback-state-icon" sx={{ color: status === 'done' ? 'secondary.main' : 'text.secondary', ...sx }} />
}

/**
 * A person's initials on a coloured disc: the team's in the primary colour.
 */
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

/**
 * A team reply to a report, emailed to its author (onFeedbackReplied). With a
 * stage (done, rejected) it also closes the report, in the same batch: the
 * report then names the reply (statusReplyId), and the reply's email carries
 * the outcome.
 *
 * @param {object} report
 * @param {string} text
 * @param {string} [status]
 * @returns {Promise<void>}
 */
export async function sendFeedbackReply(report, text, status) {
  const reportRef = doc(db, FEEDBACK_COLLECTION, report.id)
  const messageRef = doc(collection(reportRef, FEEDBACK_MESSAGES_COLLECTION))
  const closes = status && status !== report.status
  const batch = writeBatch(db)
  batch.set(messageRef, { from: 'team', text, createdAt: serverTimestamp(), userId: auth.currentUser.uid, via: 'app', ...(closes && { status }) })
  if (closes) batch.update(reportRef, { status, statusUpdatedAt: serverTimestamp(), statusUpdatedBy: auth.currentUser.uid, statusReplyId: messageRef.id })
  await batch.commit()
}

/**
 * A report, deleted with its thread (a deleted document keeps its
 * subcollections).
 *
 * @param {string} id
 * @returns {Promise<void>}
 */
export async function deleteFeedbackReport(id) {
  const reportRef = doc(db, FEEDBACK_COLLECTION, id)
  const messages = await getDocs(collection(reportRef, FEEDBACK_MESSAGES_COLLECTION))
  const batch = writeBatch(db)
  messages.forEach((message) => batch.delete(message.ref))
  batch.delete(reportRef)
  await batch.commit()
}

/**
 * A report's stage, changeable from a menu. Changing it emails no one - only
 * replies do (the reply box's "Send and mark as done/rejected" sends the
 * stage with the reply, in one email).
 */
export function StatusMenu({ report, size = 'small' }) {
  const { t } = useTranslation('feedback')
  const [openSnackbar] = useSnackbar()
  const [anchor, setAnchor] = useState(null)
  const current = statusOf(report)

  function change(status) {
    setAnchor(null)
    if (status === current) return
    updateDoc(doc(db, FEEDBACK_COLLECTION, report.id), { status, statusUpdatedAt: serverTimestamp(), statusUpdatedBy: auth.currentUser.uid }).catch((error) => {
      console.error(error)
      openSnackbar(t('admin.statusError'))
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
    </>
  )
}

/**
 * The kind, as a coloured label.
 */
export function KindChip({ kind, size = 'small' }) {
  const { t } = useTranslation('feedback')
  const look = KINDS[kind] || KINDS.misleading
  return <Chip className="oc-feedback-kind" size={size} variant="outlined" color={look.color} icon={look.icon} label={t(`kinds.${kind}`, { defaultValue: kind })} />
}

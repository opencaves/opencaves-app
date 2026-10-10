import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { collection, onSnapshot, orderBy, query } from 'firebase/firestore'
import { Box, Button, ButtonGroup, Chip, ListItemIcon, ListItemText, Menu, MenuItem, Stack, Typography } from '@mui/material'
import SendRounded from '@mui/icons-material/SendRounded'
import ArrowDropDownRounded from '@mui/icons-material/ArrowDropDownRounded'
import MarkEmailReadOutlined from '@mui/icons-material/MarkEmailReadOutlined'
import AttachFileRounded from '@mui/icons-material/AttachFileRounded'
import { db } from '@/config/firebase.js'
import { FEEDBACK_COLLECTION, FEEDBACK_MESSAGES_COLLECTION } from '@/config/collections.js'
import { FEEDBACK_REPLY_MAX_LENGTH, TOLD_FEEDBACK_STATUSES } from '@/utils/feedback.js'
import { useSnackbar } from '@/components/Snackbar/useSnackbar.jsx'
import Markdown from '@/components/Markdown/Markdown.jsx'
import MarkdownField from '@/components/Markdown/MarkdownField.jsx'
import { Initials, RelativeTime, STATUS, sendFeedbackReply, toDate } from './feedbackUi.jsx'

/**
 * A report's thread (_feedback/{id}/messages), oldest first, live.
 *
 * @param {string} reportId
 * @returns {FeedbackMessage[]|null}
 */
export function useFeedbackMessages(reportId) {
  const [messages, setMessages] = useState(null)
  useEffect(() => {
    if (!reportId) return undefined
    return onSnapshot(
      query(collection(db, FEEDBACK_COLLECTION, reportId, FEEDBACK_MESSAGES_COLLECTION), orderBy('createdAt')),
      (snapshot) => setMessages(snapshot.docs.map((d) => ({ id: d.id, ...d.data({ serverTimestamps: 'estimate' }) }))),
      (error) => {
        console.error(error)
        setMessages([])
      },
    )
  }, [reportId])
  return messages
}

const AVATAR = 36
const RAIL_SX = { position: 'absolute', top: 0, bottom: 0, left: { xs: 16, sm: AVATAR + 16 + 18 }, width: 2, bgcolor: 'divider' }

// A comment card (GitHub style): the writer's initials beside it, a header
// (who, when, marks), then the text - the team's in Markdown, the author's as
// written.
function Comment({ name, team, date, action, marks, children }) {
  return (
    <Box className={`oc-feedback-comment oc-feedback-comment--${team ? 'team' : 'author'}`} component="li" sx={{ display: 'flex', gap: 2, position: 'relative' }}>
      <Box sx={{ display: { xs: 'none', sm: 'block' }, flex: 'none' }}>
        <Initials name={name} team={team} size={AVATAR} />
      </Box>
      <Box
        sx={(theme) => ({
          flex: 1,
          minWidth: 0,
          borderRadius: 2,
          border: 1,
          borderColor: team ? theme.vars.sys.color.secondaryContainer : 'divider',
          bgcolor: 'var(--oc-page-surface)',
          overflow: 'hidden',
        })}
      >
        <Box
          className="oc-feedback-comment--header"
          sx={(theme) => ({
            display: 'flex',
            alignItems: 'center',
            flexWrap: 'wrap',
            columnGap: 1,
            rowGap: 0.5,
            px: 2,
            py: 1,
            bgcolor: team ? theme.vars.sys.color.secondaryContainer : theme.vars.sys.color.surfaceContainer,
            color: team ? theme.vars.sys.color.onSecondaryContainer : 'text.primary',
            borderBottom: 1,
            borderColor: 'divider',
          })}
        >
          <Box sx={{ display: { xs: 'inline-flex', sm: 'none' } }}>
            <Initials name={name} team={team} size={22} />
          </Box>
          <Typography variant="body2" component="span" sx={{ fontWeight: 600 }}>
            {name}
          </Typography>
          <Typography variant="body2" component="span" sx={{ opacity: 0.8 }}>
            {action} {date && <RelativeTime value={date} />}
          </Typography>
          <Box sx={{ flex: 1 }} />
          {marks}
        </Box>
        <Box className="oc-feedback-comment--body" sx={{ px: 2, py: 1.5, overflowWrap: 'anywhere', '& .oc-markdown > :first-of-type': { mt: 0 }, '& .oc-markdown > :last-of-type': { mb: 0 } }}>
          {children}
        </Box>
      </Box>
    </Box>
  )
}

// A comment's small mark, in its header: an icon and a short label.
function Mark({ icon, label }) {
  return (
    <Typography className="oc-feedback-comment--mark" variant="caption" sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5, opacity: 0.85, '& svg': { fontSize: 16 } }}>
      {icon}
      {label}
    </Typography>
  )
}

// A comment's marks: a team reply emailed to the author; the attachments of
// an author's answer by email (feedbackInbound - its header says "replied by
// email"), not kept.
function MessageMarks({ message }) {
  const { t } = useTranslation('feedback')
  const marks = []
  if (message.emailedAt) marks.push(<Mark key="emailed" icon={<MarkEmailReadOutlined />} label={t('admin.thread.emailed')} />)
  if (message.droppedAttachments > 0) marks.push(<Mark key="attachments" icon={<AttachFileRounded />} label={t('admin.thread.attachmentsDropped', { count: message.droppedAttachments })} />)
  return marks.length ? <Box sx={{ display: 'inline-flex', flexWrap: 'wrap', columnGap: 1.5, rowGap: 0.5 }}>{marks}</Box> : null
}

// A small timeline event: a stage set.
function StageEvent({ status, name, date }) {
  const { t } = useTranslation('feedback')
  return (
    <Box component="li" className="oc-feedback-event" sx={{ display: 'flex', alignItems: 'center', gap: 1.5, pl: { xs: 0.5, sm: `${AVATAR + 16 + 6}px` }, position: 'relative' }}>
      <Box
        sx={(theme) => ({
          display: 'grid',
          placeItems: 'center',
          width: 26,
          height: 26,
          borderRadius: '50%',
          bgcolor: theme.vars.sys.color.surfaceContainerHigh,
          color: STATUS[status]?.color && STATUS[status].color !== 'default' ? `${STATUS[status].color}.main` : 'text.secondary',
          '& svg': { fontSize: 16 },
          zIndex: 1,
          flex: 'none',
        })}
      >
        {STATUS[status]?.icon}
      </Box>
      <Typography variant="body2" sx={{ color: 'text.secondary', flex: 1, minWidth: 0 }}>
        <Box component="strong" sx={{ color: 'text.primary' }}>
          {name}
        </Box>{' '}
        {t('admin.timeline.stageSet', { status: t(`admin.status.${status}`) })} <RelativeTime value={date} />
      </Typography>
    </Box>
  )
}

/**
 * The report's timeline: its message, then its thread - the admins' former
 * note (before the thread) as the first reply - with the stages set, each
 * where it happened: those set with a reply (the reply's status), and the
 * report's current one (statusUpdatedAt/By) when no reply set it.
 */
export function FeedbackTimeline({ report, messages, accountLabel }) {
  const { t } = useTranslation('feedback')
  const authorName = accountLabel(report.userId)
  const items = []
  const time = (value) => toDate(value)?.getTime() ?? 0
  for (const message of messages) {
    items.push({ type: 'message', at: time(message.createdAt), message })
    if (message.status) items.push({ type: 'stage', at: time(message.createdAt) + 1, status: message.status, by: message.userId, date: message.createdAt })
  }
  const setByReply = report.statusReplyId && messages.some((m) => m.id === report.statusReplyId && m.status === report.status)
  if (report.statusUpdatedAt && !setByReply) items.push({ type: 'stage', at: time(report.statusUpdatedAt), status: report.status, by: report.statusUpdatedBy, date: report.statusUpdatedAt })
  items.sort((a, b) => a.at - b.at)

  const teamName = (uid) => (uid ? accountLabel(uid) : t('admin.thread.team'))

  return (
    <Box component="ol" className="oc-feedback-timeline" aria-label={t('admin.thread.label')} sx={{ listStyle: 'none', m: 0, p: 0, position: 'relative', display: 'flex', flexDirection: 'column', gap: 2 }}>
      <Box aria-hidden sx={RAIL_SX} />
      <Comment name={authorName} date={report.createdAt} action={t('admin.timeline.opened')}>
        <Typography sx={{ whiteSpace: 'pre-wrap' }}>{report.message}</Typography>
      </Comment>
      {report.note && (
        <Comment name={t('admin.thread.team')} team action="" marks={<Chip size="small" variant="outlined" label={t('admin.thread.legacyNote')} sx={{ color: 'inherit', borderColor: 'currentColor' }} />}>
          <Markdown>{report.note}</Markdown>
        </Comment>
      )}
      {items.map((item) =>
        item.type === 'stage' ? (
          <StageEvent key={`stage-${item.at}`} status={item.status} name={teamName(item.by)} date={item.date} />
        ) : (
          <Comment
            key={item.message.id}
            name={item.message.from === 'team' ? teamName(item.message.userId) : authorName}
            team={item.message.from === 'team'}
            date={item.message.createdAt}
            action={t(item.message.via === 'email' ? 'admin.timeline.repliedByEmail' : 'admin.timeline.commented')}
            marks={<MessageMarks message={item.message} />}
          >
            {item.message.from === 'team' ? <Markdown>{item.message.text}</Markdown> : <Typography sx={{ whiteSpace: 'pre-wrap' }}>{item.message.text}</Typography>}
          </Comment>
        ),
      )}
    </Box>
  )
}

/**
 * The reply box, at the timeline's end: a Markdown field and Send - or, from
 * its menu, Send and close the report as done or rejected. One click, one
 * email.
 */
export function ReplyForm({ report, authorLabel, myName }) {
  const { t } = useTranslation('feedback')
  const [openSnackbar] = useSnackbar()
  const [text, setText] = useState('')
  const [menu, setMenu] = useState(null)
  const [sending, setSending] = useState(false)
  const trimmed = text.trim()
  const tooLong = trimmed.length > FEEDBACK_REPLY_MAX_LENGTH
  const closings = TOLD_FEEDBACK_STATUSES.filter((status) => status !== report.status)

  async function send(status) {
    setMenu(null)
    if (!trimmed || tooLong) return
    setSending(true)
    try {
      await sendFeedbackReply(report, trimmed, status)
      openSnackbar(t(report.authorMuted ? 'admin.thread.sentMuted' : 'admin.thread.sent', { name: authorLabel }), { severity: 'success' })
      setText('')
    } catch (error) {
      console.error(error)
      openSnackbar(t('admin.thread.sendError'))
    }
    setSending(false)
  }

  return (
    <Box className="oc-feedback-reply-form" sx={{ display: 'flex', gap: 2, mt: 3 }}>
      <Box sx={{ display: { xs: 'none', sm: 'block' }, flex: 'none' }}>
        <Initials name={myName} team size={AVATAR} />
      </Box>
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <MarkdownField label={t('admin.thread.replyLabel', { name: authorLabel })} value={text} onChange={(event) => setText(event.target.value)} minRows={4} placeholder={t(report.authorMuted ? 'admin.thread.replyPlaceholderMuted' : 'admin.thread.replyPlaceholder')} />
        {/* The author turned the feedback emails off (authorMuted, mirrored
            by the server): the reply only joins the thread. */}
        {report.authorMuted && (
          <Typography className="oc-feedback-reply-form--muted" variant="body2" sx={{ mt: 0.5, color: 'text.secondary' }}>
            {t('admin.thread.mutedHint', { name: authorLabel })}
          </Typography>
        )}
        {tooLong && (
          <Typography variant="body2" sx={{ mt: 0.5, color: 'error.main' }}>
            {t('admin.thread.tooLong', { count: FEEDBACK_REPLY_MAX_LENGTH })}
          </Typography>
        )}
        <Stack direction="row" sx={{ justifyContent: 'flex-end', alignItems: 'center', flexWrap: 'wrap', gap: 1, mt: 1 }}>
          <ButtonGroup variant="contained" disabled={sending || !trimmed || tooLong} aria-label={t('admin.thread.send')}>
            <Button startIcon={<SendRounded />} onClick={() => send()}>
              {t('admin.thread.send')}
            </Button>
            {closings.length > 0 && (
              <Button size="small" aria-label={t('admin.thread.sendOptions')} aria-haspopup="menu" onClick={(event) => setMenu(event.currentTarget)} sx={{ px: 0.5, minWidth: 0 }}>
                <ArrowDropDownRounded />
              </Button>
            )}
          </ButtonGroup>
          <Menu anchorEl={menu} open={Boolean(menu)} onClose={() => setMenu(null)} anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }} transformOrigin={{ vertical: 'top', horizontal: 'right' }}>
            {closings.map((status) => (
              <MenuItem key={status} onClick={() => send(status)}>
                <ListItemIcon>{STATUS[status].icon}</ListItemIcon>
                <ListItemText primary={t('admin.thread.sendAndClose', { status: t(`admin.status.${status}`) })} />
              </MenuItem>
            ))}
          </Menu>
        </Stack>
      </Box>
    </Box>
  )
}

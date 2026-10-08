import { useEffect, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { useSelector } from 'react-redux'
import { useTranslation } from 'react-i18next'
import { addDoc, collection, serverTimestamp } from 'firebase/firestore'
import { Button, Dialog, DialogActions, DialogContent, DialogContentText, DialogTitle, TextField, ToggleButton, ToggleButtonGroup, useMediaQuery, useTheme } from '@mui/material'
import BugReportOutlined from '@mui/icons-material/BugReportOutlined'
import ReportGmailerrorredOutlined from '@mui/icons-material/ReportGmailerrorredOutlined'
import LightbulbOutlined from '@mui/icons-material/LightbulbOutlined'
import { auth, db } from '@/config/firebase.js'
import { FEEDBACK_COLLECTION } from '@/config/collections.js'
import { FEEDBACK_KINDS, OPEN_FEEDBACK_EVENT } from '@/utils/feedback.js'
import { useRequireLogin } from '@/hooks/useRequireLogin.jsx'
import { useSettleWrite } from '@/hooks/useSettleWrite.jsx'
import { useSnackbar } from '@/components/Snackbar/useSnackbar.jsx'

const MAX_MESSAGE = 4000
const ICONS = { bug: <BugReportOutlined />, misleading: <ReportGmailerrorredOutlined />, idea: <LightbulbOutlined /> }

// The Send feedback form (openFeedback): a beta tester tells the OpenCaves
// team about a bug, something misleading or an idea - its kind, a message,
// the page it's about (the page it was opened from, editable). Saved to
// _feedback for the admins (the dashboard's Feedback page), who also get it
// by email (onFeedbackCreated). An account is needed: anyone else is asked
// to sign up or log in first.
export default function FeedbackDialog() {
  const { t } = useTranslation('feedback')
  const theme = useTheme()
  const fullScreen = useMediaQuery(theme.breakpoints.down('sm'))
  const location = useLocation()
  const isLoggedIn = useSelector((state) => state.session.isLoggedIn)
  const requireLogin = useRequireLogin()
  const settleWrite = useSettleWrite()
  const [openSnackbar] = useSnackbar()
  const [open, setOpen] = useState(false)
  const [kind, setKind] = useState(null)
  const [message, setMessage] = useState('')
  const [page, setPage] = useState('')
  const [sending, setSending] = useState(false)

  useEffect(() => {
    function onOpen(event) {
      if (!isLoggedIn) {
        requireLogin()
        return
      }
      setKind(event.detail?.kind || null)
      setMessage('')
      setPage(`${window.location.pathname}${window.location.search}`)
      setOpen(true)
    }
    window.addEventListener(OPEN_FEEDBACK_EVENT, onOpen)
    return () => window.removeEventListener(OPEN_FEEDBACK_EVENT, onOpen)
  }, [isLoggedIn, requireLogin])

  // Going to another page closes it.
  useEffect(() => setOpen(false), [location.pathname])

  async function send() {
    setSending(true)
    try {
      const report = { kind, message: message.trim(), page: page.trim().slice(0, 500), userId: auth.currentUser.uid, createdAt: serverTimestamp(), status: 'new' }
      const status = await settleWrite(addDoc(collection(db, FEEDBACK_COLLECTION), report), { name: t('itemName') })
      setOpen(false)
      if (status === 'saved') openSnackbar(t('sent'), { severity: 'success' })
    } catch (error) {
      console.error(error)
      openSnackbar(t('error'))
    } finally {
      setSending(false)
    }
  }

  const canSend = kind && message.trim() && !sending

  return (
    <Dialog className="oc-feedback-dialog" open={open} onClose={() => !sending && setOpen(false)} fullScreen={fullScreen} maxWidth="sm" fullWidth aria-labelledby="oc-feedback-title">
      <DialogTitle id="oc-feedback-title">{t('title')}</DialogTitle>
      <DialogContent>
        <DialogContentText sx={{ mb: 2 }}>{t('intro')}</DialogContentText>
        <ToggleButtonGroup value={kind} exclusive onChange={(_, value) => value && setKind(value)} aria-label={t('kindLabel')} sx={{ mb: 2, flexWrap: 'wrap' }}>
          {FEEDBACK_KINDS.map((k) => (
            <ToggleButton key={k} value={k} sx={{ gap: 1, textTransform: 'none', px: 2 }}>
              {ICONS[k]}
              {t(`kinds.${k}`)}
            </ToggleButton>
          ))}
        </ToggleButtonGroup>
        <TextField
          label={t('messageLabel')}
          placeholder={kind ? t(`placeholders.${kind}`) : ''}
          value={message}
          onChange={(event) => setMessage(event.target.value.slice(0, MAX_MESSAGE))}
          multiline
          minRows={5}
          fullWidth
          autoFocus
          helperText={`${message.length} / ${MAX_MESSAGE}`}
          sx={{ mb: 2 }}
        />
        <TextField label={t('pageLabel')} helperText={t('pageHelp')} value={page} onChange={(event) => setPage(event.target.value)} fullWidth size="small" />
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={() => setOpen(false)} disabled={sending}>
          {t('cancel')}
        </Button>
        <Button variant="contained" onClick={send} disabled={!canSend}>
          {t('send')}
        </Button>
      </DialogActions>
    </Dialog>
  )
}

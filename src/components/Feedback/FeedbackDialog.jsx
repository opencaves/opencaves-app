import { useEffect, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { useSelector } from 'react-redux'
import { useTranslation } from 'react-i18next'
import { addDoc, collection, serverTimestamp } from 'firebase/firestore'
import { Box, Button, ButtonBase, Dialog, DialogActions, DialogContent, IconButton, InputAdornment, TextField, Typography, useMediaQuery, useTheme } from '@mui/material'
import BugReportOutlined from '@mui/icons-material/BugReportOutlined'
import ReportGmailerrorredOutlined from '@mui/icons-material/ReportGmailerrorredOutlined'
import LightbulbOutlined from '@mui/icons-material/LightbulbOutlined'
import FeedbackOutlined from '@mui/icons-material/FeedbackOutlined'
import CheckCircleRounded from '@mui/icons-material/CheckCircleRounded'
import TipsAndUpdatesOutlined from '@mui/icons-material/TipsAndUpdatesOutlined'
import LinkRounded from '@mui/icons-material/LinkRounded'
import SendRounded from '@mui/icons-material/SendRounded'
import CloseRounded from '@mui/icons-material/CloseRounded'
import { auth, db } from '@/config/firebase.js'
import { FEEDBACK_COLLECTION } from '@/config/collections.js'
import { FEEDBACK_KINDS, OPEN_FEEDBACK_EVENT } from '@/utils/feedback.js'
import { toServiceLanguage } from '@/utils/lang.js'
import { useRequireLogin } from '@/hooks/useRequireLogin.jsx'
import { useSettleWrite } from '@/hooks/useSettleWrite.jsx'
import { useSnackbar } from '@/components/Snackbar/useSnackbar.jsx'

const MAX_MESSAGE = 4000
const ICONS = { bug: <BugReportOutlined />, misleading: <ReportGmailerrorredOutlined />, idea: <LightbulbOutlined /> }

// One of the kinds, as a selectable square: its icon at the top, its name
// and what it's for at the bottom (the name alone on a phone); the chosen
// one's icon in the secondary colour.
function KindCard({ kind, selected, onSelect }) {
  const { t } = useTranslation('feedback')
  return (
    <ButtonBase
      className="oc-feedback-dialog--kind"
      role="radio"
      aria-checked={selected}
      onClick={() => onSelect(kind)}
      sx={(theme) => ({
        position: 'relative',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'flex-start',
        justifyContent: 'space-between',
        gap: 1,
        aspectRatio: '1',
        width: '100%',
        p: { xs: 1.25, sm: 1.75 },
        borderRadius: 3,
        textAlign: 'left',
        border: '2px solid',
        borderColor: selected ? theme.vars.sys.color.primary : theme.vars.palette.divider,
        bgcolor: selected ? theme.vars.sys.color.secondaryContainer : 'transparent',
        transition: 'border-color 150ms, background-color 150ms',
        '&:hover': { borderColor: selected ? theme.vars.sys.color.primary : theme.vars.sys.color.outline },
        '&.Mui-focusVisible': { outline: `2px solid ${theme.vars.sys.color.primary}`, outlineOffset: 2 },
      })}
    >
      <Box
        aria-hidden="true"
        sx={(theme) => ({ width: 40, height: 40, borderRadius: '50%', display: 'grid', placeItems: 'center', transition: 'background-color 150ms, color 150ms', ...(selected ? { color: theme.vars.palette.secondary.contrastText, bgcolor: theme.vars.palette.secondary.main } : { color: theme.vars.sys.color.primary, bgcolor: theme.vars.sys.color.secondaryContainer }) })}
      >
        {ICONS[kind]}
      </Box>
      <Box>
        <Typography sx={{ fontWeight: 600, lineHeight: 1.3 }}>{t(`kinds.${kind}`)}</Typography>
        <Typography variant="body2" sx={{ display: { xs: 'none', sm: 'block' }, color: 'text.secondary', lineHeight: 1.4, mt: 0.5 }}>
          {t(`kindText.${kind}`)}
        </Typography>
      </Box>
      {selected && <CheckCircleRounded aria-hidden="true" sx={{ position: 'absolute', top: 10, right: 10, fontSize: 20, color: 'var(--mui-sys-color-primary)' }} />}
    </ButtonBase>
  )
}

// The Send feedback form (openFeedback): a beta tester tells the OpenCaves
// team about a bug, something misleading or an idea - its kind, a message
// (a hint and a placeholder per kind: a bug's steps to reproduce it), the
// page it's about (the page it was opened from, editable), and the browser
// (its user agent, filled in unseen), with the app's language (the email
// telling the author its outcome is in it). Saved to
// _feedback for the admins (the dashboard's Feedback page), who also get it
// by email (onFeedbackCreated). An account is needed: anyone else is asked
// to sign up or log in first.
export default function FeedbackDialog() {
  const { t, i18n } = useTranslation('feedback')
  const theme = useTheme()
  const fullScreen = useMediaQuery(theme.breakpoints.down('sm'))
  const location = useLocation()
  const isLoggedIn = useSelector((state) => state.session.isLoggedIn)
  const requireLogin = useRequireLogin('feedback')
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
      const report = { kind, message: message.trim(), page: page.trim().slice(0, 500), browser: navigator.userAgent.slice(0, 500), language: toServiceLanguage(i18n.language), userId: auth.currentUser.uid, createdAt: serverTimestamp(), status: 'new' }
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

  const close = () => !sending && setOpen(false)
  const canSend = kind && message.trim() && !sending

  return (
    <Dialog className="oc-feedback-dialog" open={open} onClose={close} fullScreen={fullScreen} maxWidth="sm" fullWidth aria-labelledby="oc-feedback-title" slotProps={{ paper: { sx: { borderRadius: fullScreen ? 0 : 5 } } }}>
      {/* Header: a tinted band, the form's icon and purpose. */}
      <Box className="oc-feedback-dialog--header" sx={(theme) => ({ position: 'relative', display: 'flex', gap: 2, alignItems: 'center', px: 3, pt: 3, pb: 2.5, bgcolor: theme.vars.sys.color.surfaceContainer })}>
        <Box aria-hidden="true" sx={(theme) => ({ width: 52, height: 52, flexShrink: 0, borderRadius: '50%', display: 'grid', placeItems: 'center', bgcolor: theme.vars.sys.color.primary, color: theme.vars.palette.background.paper, '& svg': { fontSize: 28 } })}>
          <FeedbackOutlined />
        </Box>
        <Box sx={{ pr: 4 }}>
          <Typography id="oc-feedback-title" component="h2" variant="h6" sx={{ fontWeight: 600, lineHeight: 1.3 }}>
            {t('title')}
          </Typography>
          <Typography variant="body2" sx={{ color: 'text.secondary', mt: 0.25 }}>
            {t('intro')}
          </Typography>
        </Box>
        <IconButton aria-label={t('close')} onClick={close} disabled={sending} sx={{ position: 'absolute', top: 8, right: 8 }}>
          <CloseRounded />
        </IconButton>
      </Box>
      <DialogContent sx={{ pt: '20px !important' }}>
        <Typography component="h3" variant="subtitle2" sx={{ mb: 1.25 }}>
          {t('kindLabel')}
        </Typography>
        <Box role="radiogroup" aria-label={t('kindLabel')} sx={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 1.25, mb: 2.5 }}>
          {FEEDBACK_KINDS.map((k) => (
            <KindCard key={k} kind={k} selected={kind === k} onSelect={setKind} />
          ))}
        </Box>
        {kind && (
          <>
            {/* What a good report of this kind says (a bug: how to reproduce it). */}
            <Box className="oc-feedback-dialog--hint" sx={(theme) => ({ display: 'flex', gap: 1.25, alignItems: 'flex-start', p: 1.5, mb: 2, borderRadius: 2, borderLeft: `4px solid ${theme.vars.palette.secondary.main}`, bgcolor: theme.vars.sys.color.secondaryContainer })}>
              <TipsAndUpdatesOutlined aria-hidden="true" sx={{ color: 'var(--mui-sys-color-primary)', mt: 0.125 }} />
              <Typography variant="body2" sx={{ lineHeight: 1.5 }}>
                {t(`hints.${kind}`)}
              </Typography>
            </Box>
            <TextField
              label={t('messageLabel')}
              placeholder={t(`placeholders.${kind}`)}
              value={message}
              onChange={(event) => setMessage(event.target.value.slice(0, MAX_MESSAGE))}
              multiline
              minRows={kind === 'bug' ? 7 : 5}
              fullWidth
              autoFocus
              helperText={`${message.length} / ${MAX_MESSAGE}`}
              slotProps={{ formHelperText: { sx: { textAlign: 'right' } } }}
              sx={{ mb: 2 }}
            />
            <TextField
              label={t('pageLabel')}
              helperText={t('pageHelp')}
              value={page}
              onChange={(event) => setPage(event.target.value)}
              fullWidth
              size="small"
              slotProps={{ input: { startAdornment: <InputAdornment position="start"><LinkRounded fontSize="small" /></InputAdornment> } }}
            />
          </>
        )}
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2.5, pt: 1 }}>
        <Button onClick={close} disabled={sending}>
          {t('cancel')}
        </Button>
        <Button variant="contained" onClick={send} disabled={!canSend} endIcon={<SendRounded />} sx={{ borderRadius: 5, px: 2.5 }}>
          {t('send')}
        </Button>
      </DialogActions>
    </Dialog>
  )
}

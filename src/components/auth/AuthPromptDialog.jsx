import { useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useDispatch } from 'react-redux'
import { useTranslation } from 'react-i18next'
import { Button, Dialog, DialogActions, DialogContent, DialogContentText, DialogTitle, IconButton } from '@mui/material'
import CloseRounded from '@mui/icons-material/CloseRounded'
import { setContinueUrl } from '@/redux/slices/sessionSlice.jsx'
import { AUTH_PROMPT_EVENT } from '@/hooks/useRequireLogin.jsx'

const REASONS = ['photos', 'videos', 'maps', 'feedback']

// Why an account is needed, before the log-in or sign-up page
// (useRequireLogin): worded for the action, with Not now, Log in and Create
// an account - as the map pane's Save prompt. Back here after signing up or
// logging in (continueUrl).
export default function AuthPromptDialog() {
  const { t } = useTranslation('authPrompt')
  const navigate = useNavigate()
  const dispatch = useDispatch()
  const { pathname } = useLocation()
  const [prompt, setPrompt] = useState(null)

  useEffect(() => {
    const onPrompt = (event) => setPrompt({ reason: REASONS.includes(event.detail?.reason) ? event.detail.reason : 'default', continueUrl: event.detail?.continueUrl })
    window.addEventListener(AUTH_PROMPT_EVENT, onPrompt)
    return () => window.removeEventListener(AUTH_PROMPT_EVENT, onPrompt)
  }, [])

  // Going to another page closes it.
  useEffect(() => setPrompt(null), [pathname])

  function go(path) {
    if (prompt?.continueUrl) dispatch(setContinueUrl(prompt.continueUrl))
    setPrompt(null)
    navigate(path)
  }

  const reason = prompt?.reason || 'default'
  return (
    <Dialog className="oc-auth-prompt-dialog" open={Boolean(prompt)} onClose={() => setPrompt(null)} aria-labelledby="oc-auth-prompt-title" aria-describedby="oc-auth-prompt-text">
      <DialogTitle id="oc-auth-prompt-title" sx={{ pr: 6 }}>
        {t(`${reason}.title`)}
      </DialogTitle>
      <IconButton aria-label={t('close')} onClick={() => setPrompt(null)} sx={{ position: 'absolute', top: 8, right: 8 }}>
        <CloseRounded />
      </IconButton>
      <DialogContent>
        <DialogContentText id="oc-auth-prompt-text">{t(`${reason}.text`)}</DialogContentText>
      </DialogContent>
      {/* Stacked full-width on a phone (three labels side by side wrapped),
          the main action on top. */}
      <DialogActions sx={{ flexDirection: { xs: 'column-reverse', sm: 'row' }, alignItems: 'stretch', gap: 1, '& > :not(style) ~ :not(style)': { ml: { xs: 0, sm: 1 } } }}>
        <Button onClick={() => setPrompt(null)}>{t('notNow')}</Button>
        <Button onClick={() => go('/login')}>{t('logIn')}</Button>
        <Button variant="contained" onClick={() => go('/signup')} autoFocus>
          {t('signUp')}
        </Button>
      </DialogActions>
    </Dialog>
  )
}

import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Button, Dialog, DialogActions, DialogContent, DialogContentText, DialogTitle, TextField } from '@mui/material'
import { sendPasswordResetEmail } from 'firebase/auth'
import { auth } from '@/config/firebase.js'
import AuthButton from './AuthButton.jsx'
import OfflineAuthNote from './OfflineAuthNote.jsx'
import DialogCloseButton from '@/components/DialogCloseButton.jsx'

// "Forgot password?": an email with a link to set a new password (Firebase's
// own page, in the app's language - auth.languageCode). The same answer
// whether or not the email has an account, so the form can't be used to find
// out who has one. initialEmail: what the log-in form already holds.
export default function PasswordResetDialog({ open, onClose, initialEmail = '' }) {
  const { t } = useTranslation('auth', { keyPrefix: 'passwordReset' })
  const { t: tErrors } = useTranslation('errors')
  const [email, setEmail] = useState(initialEmail)
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState('')
  // Each time it opens: the email the log-in form holds then.
  useEffect(() => {
    if (open) setEmail(initialEmail)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  async function send(event) {
    event.preventDefault()
    setError('')
    // The browser's own email check (as the log-in form's): Firebase answers
    // "sent" whatever the address, "bad" included.
    const field = event.currentTarget.elements.email
    if (!email.trim() || !field.validity.valid) {
      setError(tErrors('auth.emailInvalid'))
      field.focus()
      return
    }
    setSending(true)
    try {
      await sendPasswordResetEmail(auth, email.trim(), { url: `${window.location.origin}/login/with-email` })
      setSent(true)
    } catch (cause) {
      if (cause.code === 'auth/user-not-found') setSent(true)
      else if (cause.code === 'auth/invalid-email' || cause.code === 'auth/missing-email') setError(tErrors('auth.emailInvalid'))
      else if (cause.code === 'auth/network-request-failed') setError(tErrors('auth.network'))
      else {
        console.error(cause)
        setError(tErrors('auth.default'))
      }
    } finally {
      setSending(false)
    }
  }

  function close() {
    setSent(false)
    setError('')
    onClose()
  }

  return (
    <Dialog className="oc-password-reset-dialog" open={open} onClose={close} fullWidth maxWidth="xs" aria-labelledby="oc-password-reset-title">
      {/* The app's rule: an X on every dialog. */}
      <DialogCloseButton onClick={close} />
      <DialogTitle id="oc-password-reset-title" sx={{ pr: 7 }}>{t('title')}</DialogTitle>
      {sent ? (
        <>
          <DialogContent>
            <DialogContentText>{t('sent', { email: email.trim() })}</DialogContentText>
          </DialogContent>
          <DialogActions sx={{ px: 3, pb: 2 }}>
            <Button onClick={close}>{t('close')}</Button>
          </DialogActions>
        </>
      ) : (
        <form onSubmit={send} noValidate>
          <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <OfflineAuthNote />
            <DialogContentText>{t('text')}</DialogContentText>
            <TextField label={t('email')} type="email" name="email" autoComplete="email" inputMode="email" required autoFocus fullWidth value={email} onChange={(e) => setEmail(e.target.value)} error={Boolean(error)} helperText={error || ' '} />
          </DialogContent>
          <DialogActions sx={{ px: 3, pb: 2, gap: 1 }}>
            <Button onClick={close}>{t('cancel')}</Button>
            <AuthButton type="submit" disabled={sending} sx={{ width: 'auto' }}>
              {t('send')}
            </AuthButton>
          </DialogActions>
        </form>
      )}
    </Dialog>
  )
}

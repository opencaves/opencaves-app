import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { onAuthStateChanged } from 'firebase/auth'
import { Button, Dialog, DialogActions, DialogContent, DialogContentText, DialogTitle } from '@mui/material'
import { auth, signInWithProviderPopup, signInWithProviderRedirect } from '@/config/firebase.js'
import { useSnackbar } from '@/components/Snackbar/useSnackbar.jsx'
import { useSmall } from '@/hooks/useSmall.jsx'
import { clearPendingLink, linkPendingCredential, PENDING_LINK_EVENT, readPendingLink } from '@/services/pendingLink.js'
import { googleProvider, microsoftProvider } from './providers.jsx'
import DialogCloseButton from '@/components/DialogCloseButton.jsx'

const PROVIDERS = {
  'google.com': { name: 'Google', provider: googleProvider },
  'microsoft.com': { name: 'Microsoft', provider: microsoftProvider },
}

// When a provider sign-in is refused because its email already has an
// account (pendingLink.js): explains it and offers to sign in the way used
// before (the other provider, or the email link); once signed in to that
// account, the refused provider is added to it, and the person is told.
export default function AccountLinking() {
  const { t } = useTranslation('auth', { keyPrefix: 'linking' })
  const [openSnackbar] = useSnackbar()
  const isSmall = useSmall()
  const [pending, setPending] = useState(null)

  useEffect(() => {
    const onPending = (event) => setPending(event.detail)
    window.addEventListener(PENDING_LINK_EVENT, onPending)
    // Kept before this mounted (a phone's redirect sign-in, or a reload).
    const kept = readPendingLink()
    if (kept && !auth.currentUser?.email) setPending({ email: kept.email, providerId: kept.providerId })
    return () => window.removeEventListener(PENDING_LINK_EVENT, onPending)
  }, [])

  useEffect(() => {
    return onAuthStateChanged(auth, async (user) => {
      if (!user || user.isAnonymous) return
      try {
        const linked = await linkPendingCredential(user)
        if (linked) {
          setPending(null)
          openSnackbar(t('linked', { provider: PROVIDERS[linked]?.name || linked }), { severity: 'success' })
        }
      } catch (error) {
        console.error('[AccountLinking] the sign-in method could not be added', error)
        openSnackbar(t('linkFailed'))
      }
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function cancel() {
    clearPendingLink()
    setPending(null)
  }

  // Signing in with the other provider: the link is made on sign-in (above).
  function continueWith(provider) {
    setPending(null)
    if (isSmall) signInWithProviderRedirect(provider)
    else signInWithProviderPopup(provider).catch((error) => console.error('[AccountLinking] sign-in failed', error))
  }

  const refused = PROVIDERS[pending?.providerId]?.name || pending?.providerId
  const others = Object.entries(PROVIDERS).filter(([id]) => id !== pending?.providerId)

  return (
    <Dialog className="oc-account-linking" open={Boolean(pending)} onClose={cancel}>
      {/* The app's rule: an X on every dialog. */}
      <DialogCloseButton onClick={cancel} />
      <DialogTitle sx={{ pr: 7 }}>{t('title')}</DialogTitle>
      <DialogContent>
        <DialogContentText>{t('text', { email: pending?.email, provider: refused })}</DialogContentText>
      </DialogContent>
      <DialogActions sx={{ flexWrap: 'wrap', gap: 1 }}>
        <Button onClick={cancel}>{t('cancel')}</Button>
        {others.map(([id, { name, provider }]) => (
          <Button key={id} variant="contained" disableElevation onClick={() => continueWith(provider)}>
            {t('continueWith', { provider: name })}
          </Button>
        ))}
      </DialogActions>
    </Dialog>
  )
}

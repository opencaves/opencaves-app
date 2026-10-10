import { useState } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { ProviderId, linkWithCredential } from 'firebase/auth'
import { useNavigate } from 'react-router-dom'
import { savePendingLink } from '@/services/pendingLink.js'
import AuthButton from './AuthButton.jsx'
import { useSmall } from '@/hooks/useSmall.jsx'
import useAnonymous from '@/hooks/useAnonymous.jsx'
import { auth, signInWithProviderPopup, signInWithProviderRedirect } from '@/config/firebase.js'
import { useSnackbar } from '@/components/Snackbar/useSnackbar.jsx'
import { useTranslation } from 'react-i18next'

export default function LogInWithProvider({ Provider, message, color, onSuccess, Logo, sx, className, ...props }) {
  const [openSnackbar] = useSnackbar()
  const { t: tErrors } = useTranslation('errors')
  const navigate = useNavigate()
  const dispatch = useDispatch()
  const [disabled, setDisabled] = useState(false)
  const isSmall = useSmall()
  const isAnonymous = useAnonymous()
  const user = useSelector((/** @type {RootState} */ state) => state.session.user)
  const continueUrl = useSelector((/** @type {RootState} */ state) => state.session.continueUrl)

  function onLogInWithProviderSuccess() {
    if (onSuccess) {
      return onSuccess()
    }

    const url = continueUrl || '/'

    if (url.includes('#')) {
      window.location.href = url
    } else {
      navigate(url)
    }
  }


  async function loginWithProvider() {
    setDisabled(true)

    if (isAnonymous) {
      // User is signed in with anonymous.
      // Convert the anonymous account to a permanent account

      // Get an AuthCredential for the new authentication provider
      const credentialArgs = []

      switch (Provider.PROVIDER_ID) {
        // If this is a Google Signin
        case ProviderId.GOOGLE:
          const idToken = await user.getIdToken()
          credentialArgs.push(idToken)
          break

        // case ProviderId.PASSWORD:
        //   credentialArgs.push()

        default:
      }

      if (credentialArgs.length > 0) {
        const credential = Provider.credential(...credentialArgs)
        linkWithCredential(user, credential)
          .catch((error) => {
            console.error('Error upgrading anonymous account', error)
          })
      }
    }

    if (isSmall) {
      signInWithProviderRedirect(new Provider())
    } else {
      signInWithProviderPopup(new Provider())
        .then(() => {
          onLogInWithProviderSuccess()
        })
        .catch((error) => {
          // The email already has an account, signed in another way: keep
          // this sign-in to add it to that account (AccountLinking).
          if (error.code === 'auth/account-exists-with-different-credential') {
            savePendingLink(error)
            return
          }
          console.error('Provider sign-in failed', error)
          // No connection (or too weak): said, rather than nothing happening.
          if (error.code === 'auth/network-request-failed') openSnackbar(tErrors('auth.network'))
        })
        .finally(() => {
          setDisabled(false)
        })
    }
  }

  return (
    <AuthButton
      className={`oc-log-in-with-provider ${className || ''}`.trim()}
      startIcon={
        <Logo width={18} height={18} aria-hidden="true" focusable="false" />
      }
      variant="outlined"
      color={color}
      disabled={disabled}
      onClick={loginWithProvider}
      sx={sx || null}
      {...props}
    >
      {message}
    </AuthButton>
  )
}

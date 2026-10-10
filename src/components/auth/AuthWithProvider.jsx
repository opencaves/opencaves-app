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

/**
 * Signs up (or links the anonymous session) with an identity provider (Google, Microsoft), in a popup - a redirect
 * on phones.
 *
 * @param {object} props - Also AuthButton's.
 * @param {typeof import('firebase/auth').GoogleAuthProvider | typeof import('./providers.jsx').MicrosoftAuthProvider} props.Provider - The provider's class.
 * @param {string} props.message - The button's text.
 * @param {import('@mui/material/Button').ButtonProps['color']} [props.color]
 * @param {() => void} [props.onSuccess] - Called once done, instead of going on.
 * @param {import('react').ElementType} props.Logo - The provider's logo.
 * @param {import('@mui/material').SxProps<import('@mui/material').Theme>} [props.sx]
 * @param {string} [props.className]
 */
export default function AuthWithProvider({ Provider, message, color, onSuccess, Logo, sx, className, ...props }) {
  const [openSnackbar] = useSnackbar()
  const { t: tErrors } = useTranslation('errors')
  const navigate = useNavigate()
  const dispatch = useDispatch()
  const [disabled, setDisabled] = useState(false)
  const isSmall = useSmall()
  const isAnonymous = useAnonymous()
  const user = useSelector((/** @type {RootState} */ state) => state.session.user)
  const continueUrl = useSelector((/** @type {RootState} */ state) => state.session.continueUrl)

  function onAuthWithProviderSuccess() {
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


  async function signInWithProvider() {
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
        const credential = /** @type {typeof import('firebase/auth').GoogleAuthProvider} */ (Provider).credential(...credentialArgs)
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
          setDisabled(false)
          onAuthWithProviderSuccess()
        })
        .catch((error) => {
          setDisabled(false)

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
    }
  }

  return (
    <AuthButton
      className={`oc-auth-with-provider ${className || ''}`.trim()}
      startIcon={
        <Logo width={18} height={18} aria-hidden="true" focusable="false" />
      }
      variant="outlined"
      color={color}
      disabled={disabled}
      onClick={signInWithProvider}
      sx={sx || null}
      {...props}
    >
      {message}
    </AuthButton>
  )
}

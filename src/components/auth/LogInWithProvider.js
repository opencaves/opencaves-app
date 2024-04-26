import { useState } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { ProviderId, linkWithCredential, signInWithPopup, signInWithRedirect } from 'firebase/auth'
import { useNavigate } from 'react-router-dom'
import { SvgIcon } from '@mui/material'
import { getProviderForProviderId } from './providers'
import AuthButton from './AuthButton'
import { deleteContinueUrl, setContinueUrl } from '@/redux/slices/sessionSlice'
import { useSmall } from '@/hooks/useSmall'
import useAnonymous from '@/hooks/useAnonymous'
import { auth } from '@/config/firebase'

export default function LogInWithProvider({ Provider, message, color, onSuccess, Logo, sx, ...props }) {
  const navigate = useNavigate()
  const dispatch = useDispatch()
  const [disabled, setDisabled] = useState(false)
  const isSmall = useSmall()
  const isAnonymous = useAnonymous()
  const user = useSelector(state => state.session.user)
  const continueUrl = useSelector(state => state.session.continueUrl)

  function onLogInWithProviderSuccess() {
    if (onSuccess) {
      return onSuccess.call(null, arguments)
    }

    navigate(continueUrl || '/')
    dispatch(deleteContinueUrl())
  }

  function promptUserForPassword() {
    return prompt('password')
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
          console.log('[case ProviderId.GOOGLE] user: %o', user)
          const idToken = await user.getIdToken()
          console.log('idToken: %o', idToken)
          credentialArgs.push(idToken)
          break

        // case ProviderId.PASSWORD:
        //   credentialArgs.push()

        default:
      }

      if (credentialArgs.length > 0) {
        console.log('credentialArgs: %o', credentialArgs)
        const credential = Provider.credential(...credentialArgs)
        linkWithCredential(user, credential)
          .then(usercred => {
            console.log('Anonymous account successfully upgraded', usercred.user)
          }).catch((error) => {
            console.log('Error upgrading anonymous account', error)
          })
      }
    }

    if (isSmall) {
      signInWithRedirect(auth, new Provider())
    } else {
      signInWithPopup(auth, new Provider())
        .then(result => {
          navigate(continueUrl || '/')
        })
        .catch((error) => {

          if (error.code === 'auth/account-exists-with-different-credential') {
            // User's email already exists.
            // Let's try to fix this

            // The pending Google credential.
            var pendingCred = error.credential
            // The provider account's email address.
            var email = error.email
            // Get sign-in methods for this email.
            auth.fetchSignInMethodsForEmail(email).then(function (methods) {
              // Step 3.
              // If the user has several sign-in methods,
              // the first method in the list will be the 'recommended' method to use.
              if (methods[0] === 'password') {
                // Asks the user their password.
                // In real scenario, you should handle this asynchronously.
                var password = promptUserForPassword() // TODO: implement promptUserForPassword.
                auth.signInWithEmailAndPassword(email, password).then(function (result) {
                  // Step 4a.
                  return result.user.linkWithCredential(pendingCred)
                }).then(function () {
                  // Google account successfully linked to the existing Firebase user.
                  onSuccess()
                })
                return
              }
              // All the other cases are external providers.
              // Construct provider object for that provider.
              // TODO: implement getProviderForProviderId.
              var provider = getProviderForProviderId(methods[0])
              // At this point, you should let the user know that they already have an account
              // but with a different provider, and let them validate the fact they want to
              // sign in with this provider.
              // Sign in to provider. Note: browsers usually block popup triggered asynchronously,
              // so in real scenario you should ask the user to click on a 'continue' button
              // that will trigger the signInWithPopup.
              auth.signInWithPopup(provider).then(function (result) {
                // Remember that the user may have signed in with an account that has a different email
                // address than the first one. This can happen as Firebase doesn't control the provider's
                // sign in flow and the user is free to login using whichever account they own.
                // Step 4b.
                // Link to Google credential.
                // As we have access to the pending credential, we can directly call the link method.
                result.user.linkAndRetrieveDataWithCredential(pendingCred).then(function (usercred) {
                  // Google account successfully linked to the existing Firebase user.
                  onLogInWithProviderSuccess()
                })
              })
            })
          }
        })
        .finally(() => {
          setDisabled(false)
        })
    }
  }

  return (
    <AuthButton
      startIcon={<SvgIcon component={Logo} inheritViewBox />}
      variant='outlined'
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
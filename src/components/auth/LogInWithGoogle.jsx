import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { GOOGLE_BUTTON_SX } from './providerButtonSx.js'
import { GoogleAuthProvider } from 'firebase/auth'
import { noop } from 'lodash'
import LogInWithProvider from './LogInWithProvider.jsx'
import GoogleGLogo from '@/images/app/auth/google-g-logo.svg?react'

/**
 * The log-in button for a Google account.
 *
 * @param {object} props
 * @param {string} [props.message] - The button's text (its own by default).
 * @param {() => void} [props.onSuccess] - Called once logged in.
 */
export default function LogInWithGoogle({ message = null, onSuccess = noop }) {
  const { t } = useTranslation('auth', { keyPrefix: 'login' })
  const [_message, setMessage] = useState(null)

  useEffect(() => {
    setMessage(message ?? t('withGoogle'))
  }, [message, t])

  return <LogInWithProvider message={_message} Provider={GoogleAuthProvider} onSuccess={onSuccess} Logo={GoogleGLogo} className="oc-log-in-with-google" sx={GOOGLE_BUTTON_SX} />
}

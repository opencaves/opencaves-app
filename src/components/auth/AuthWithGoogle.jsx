import { useTranslation } from 'react-i18next'
import { GOOGLE_BUTTON_SX } from './providerButtonSx.js'
import { GoogleAuthProvider } from 'firebase/auth'
import AuthWithProvider from './AuthWithProvider.jsx'
import GoogleGLogo from '@/images/app/auth/google-g-logo.svg?react'

/**
 * The sign-up button for a Google account.
 *
 * @param {object} props - Also AuthWithProvider's.
 * @param {string} [props.message] - The button's text (its own by default).
 * @param {() => void} [props.onSuccess] - Called once signed up, instead of going on.
 * @param {string} [props.className]
 */
export default function AuthWithGoogle({ message, onSuccess, className, ...props }) {
  const { t } = useTranslation('auth', { keyPrefix: 'signup' })

  return <AuthWithProvider message={message || t('withGoogle')} Provider={GoogleAuthProvider} onSuccess={onSuccess} Logo={GoogleGLogo} className={`oc-auth-with-google ${className || ''}`.trim()} sx={GOOGLE_BUTTON_SX} {...props} />
}

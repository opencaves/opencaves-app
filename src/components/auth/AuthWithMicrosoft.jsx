import { useTranslation } from 'react-i18next'
import { MICROSOFT_BUTTON_SX } from './providerButtonSx.js'
import AuthWithProvider from './AuthWithProvider.jsx'
import { MicrosoftAuthProvider } from './providers.jsx'
import MicrosoftLogo from '@/images/app/auth/microsoft-logo.svg?react'

/**
 * The sign-up button for a Microsoft account.
 *
 * @param {object} props - Also AuthWithProvider's.
 * @param {string} [props.message] - The button's text (its own by default).
 * @param {() => void} [props.onSuccess] - Called once signed up, instead of going on.
 * @param {string} [props.className]
 */
export default function AuthWithMicrosoft({ message, onSuccess, className, ...props }) {
  const { t } = useTranslation('auth', { keyPrefix: 'signup' })

  return <AuthWithProvider message={message || t('withMicrosoft')} Provider={MicrosoftAuthProvider} onSuccess={onSuccess} Logo={MicrosoftLogo} className={`oc-auth-with-microsoft ${className || ''}`.trim()} sx={MICROSOFT_BUTTON_SX} {...props} />
}

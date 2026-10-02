import { useTranslation } from 'react-i18next'
import AuthWithProvider from './AuthWithProvider.jsx'
import { MicrosoftAuthProvider } from './providers.jsx'
import MicrosoftLogo from '@/images/app/auth/microsoft-logo.svg?react'

export default function AuthWithMicrosoft({ message, onSuccess, className, ...props }) {
  const { t } = useTranslation('auth', { keyPrefix: 'signup' })

  return <AuthWithProvider message={message || t('withMicrosoft')} Provider={MicrosoftAuthProvider} onSuccess={onSuccess} Logo={MicrosoftLogo} className={`oc-auth-with-microsoft ${className || ''}`.trim()} {...props} />
}

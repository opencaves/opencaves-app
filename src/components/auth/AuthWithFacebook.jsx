import { useTranslation } from 'react-i18next'
import AuthWithProvider from './AuthWithProvider.jsx'
import { FacebookEmailAuthProvider } from './providers.jsx'
import FacebookLogo from '@/images/app/auth/facebook-logo.svg?react'

export default function AuthWithFacebook({ message, onSuccess, className, ...props }) {
  const { t } = useTranslation('auth', { keyPrefix: 'signup' })

  return <AuthWithProvider message={message || t('withFacebook')} Provider={FacebookEmailAuthProvider} onSuccess={onSuccess} Logo={FacebookLogo} className={`oc-auth-with-facebook ${className || ''}`.trim()} {...props} />
}

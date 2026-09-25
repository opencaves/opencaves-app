import { useTranslation } from 'react-i18next'
import { GoogleAuthProvider } from 'firebase/auth'
import AuthWithProvider from './AuthWithProvider.jsx'
import GoogleGLogo from '@/images/app/auth/google-g-logo.svg?react'

export default function AuthWithGoogle({ message, onSuccess, className, ...props }) {
  const { t } = useTranslation('auth', { keyPrefix: 'signup' })

  return <AuthWithProvider message={message || t('withGoogle')} Provider={GoogleAuthProvider} onSuccess={onSuccess} Logo={GoogleGLogo} className={`oc-auth-with-google ${className || ''}`.trim()} {...props} />
}

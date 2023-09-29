import { useTranslation } from 'react-i18next'
import { GoogleAuthProvider } from 'firebase/auth'
import AuthWithProvider from './AuthWithProvider'
import { ReactComponent as GoogleGLogo } from '@/images/app/auth/google-g-logo.svg'

export default function AuthWithGoogle({ message, onSuccess, ...props }) {
  const { t } = useTranslation('auth', { keyPrefix: 'signup' })

  return (
    <AuthWithProvider
      message={message || t('withGoogle')}
      Provider={GoogleAuthProvider}
      onSuccess={onSuccess}
      Logo={GoogleGLogo}
      {...props}
    />
  )
}
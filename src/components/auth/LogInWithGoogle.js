
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { GoogleAuthProvider } from 'firebase/auth'
import LogInWithProvider from './LogInWithProvider'
import { ReactComponent as GoogleGLogo } from '@/images/app/auth/google-g-logo.svg'
import { noop } from 'lodash'

export default function LogInWithGoogle({ message = null, onSuccess = noop }) {
  const { t } = useTranslation('auth', { keyPrefix: 'login' })
  const [_message, setMessage] = useState(null)

  useEffect(() => {
    setMessage(message ?? t('withGoogle'))
  }, [message, t])

  return (
    <LogInWithProvider message={_message} Provider={GoogleAuthProvider} onSuccess={onSuccess} Logo={GoogleGLogo} />
  )
}
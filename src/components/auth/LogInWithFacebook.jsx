import { useTranslation } from 'react-i18next'
import { noop } from 'lodash'
import LogInWithProvider from './LogInWithProvider.jsx'
import { FacebookEmailAuthProvider } from './providers.jsx'
import FacebookLogo from '@/images/app/auth/facebook-logo.svg?react'

export default function LogInWithFacebook({ message = null, onSuccess = noop }) {
  const { t } = useTranslation('auth', { keyPrefix: 'login' })

  return <LogInWithProvider message={message ?? t('withFacebook')} Provider={FacebookEmailAuthProvider} onSuccess={onSuccess} Logo={FacebookLogo} className="oc-log-in-with-facebook" />
}

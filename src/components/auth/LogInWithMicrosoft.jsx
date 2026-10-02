import { useTranslation } from 'react-i18next'
import { noop } from 'lodash'
import LogInWithProvider from './LogInWithProvider.jsx'
import { MicrosoftAuthProvider } from './providers.jsx'
import MicrosoftLogo from '@/images/app/auth/microsoft-logo.svg?react'

export default function LogInWithMicrosoft({ message = null, onSuccess = noop }) {
  const { t } = useTranslation('auth', { keyPrefix: 'login' })

  return <LogInWithProvider message={message ?? t('withMicrosoft')} Provider={MicrosoftAuthProvider} onSuccess={onSuccess} Logo={MicrosoftLogo} className="oc-log-in-with-microsoft" />
}

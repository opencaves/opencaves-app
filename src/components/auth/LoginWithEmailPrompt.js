import { useTranslation } from 'react-i18next'
import AuthPrompt, { Header } from './AuthPrompt'
import LogInWithEmail from './LogInWithEmail'

export default function LogInWithEmailPrompt({ open, onClose }) {
  const { t } = useTranslation('auth', { keyPrefix: 'loginWithEmailPrompt' })

  return (
    <AuthPrompt
      open={open}
      onClose={onClose}
    >
      <Header>{t('header')}</Header>
      <LogInWithEmail />

    </AuthPrompt>
  )
}
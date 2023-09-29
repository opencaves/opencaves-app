import { useTranslation } from 'react-i18next'
import AuthPrompt, { Header } from './AuthPrompt'
import LoginWithEmail from './LoginWithEmail'

export default function LoginWithEmailPrompt({ open, onClose }) {
  const { t } = useTranslation('auth', { keyPrefix: 'loginWithEmailPrompt' })

  return (
    <AuthPrompt
      open={open}
      onClose={onClose}
    >
      <Header>{t('header')}</Header>
      <LoginWithEmail />

    </AuthPrompt>
  )
}
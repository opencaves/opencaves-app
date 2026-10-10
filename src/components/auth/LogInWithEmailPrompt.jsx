import { useTranslation } from 'react-i18next'
import AuthPrompt, { Header } from './AuthPrompt.jsx'
import LogInWithEmail from './LogInWithEmail.jsx'

/**
 * The log-in-with-email form, in a dialog.
 *
 * @param {object} props
 * @param {boolean} props.open
 * @param {() => void} props.onClose
 */
export default function LogInWithEmailPrompt({ open, onClose }) {
  const { t } = useTranslation('auth', { keyPrefix: 'loginWithEmailPrompt' })

  return (
    <AuthPrompt
      open={open}
      onClose={onClose}
      className="oc-log-in-with-email-prompt"
    >
      <Header>{t('header')}</Header>
      <LogInWithEmail />

    </AuthPrompt>
  )
}
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import AuthPrompt, { Header } from './AuthPrompt.jsx'
import LogInWithEmail from './LogInWithEmail.jsx'

/**
 * The log-in-with-email form, in a dialog. Closed, it leaves for the page
 * above (/login), as the sign-up dialog does, unless given an onClose.
 *
 * @param {object} props
 * @param {boolean} props.open
 * @param {() => void} [props.onClose]
 */
export default function LogInWithEmailPrompt({ open, onClose }) {
  const { t } = useTranslation('auth', { keyPrefix: 'loginWithEmailPrompt' })
  const navigate = useNavigate()

  return (
    <AuthPrompt
      open={open}
      onClose={onClose ?? (() => navigate('..'))}
      className="oc-log-in-with-email-prompt"
    >
      <Header>{t('header')}</Header>
      <LogInWithEmail />

    </AuthPrompt>
  )
}
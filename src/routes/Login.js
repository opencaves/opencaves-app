import { useEffect } from 'react'
import { useMatches } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import Login from '@/components/auth/Login'
import { useTitle } from '@/hooks/useTitle'

export default function SignupPage() {
  const { t } = useTranslation('auth', { keyPrefix: 'login' })
  const { setTitle } = useTitle()
  const matches = useMatches()

  useEffect(() => {
    if (matches.length === 1) {
      setTitle(t('title'))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [matches])

  return (
    <Login />
  )
}
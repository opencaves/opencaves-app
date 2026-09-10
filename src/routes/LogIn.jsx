import { useEffect } from 'react'
import { useMatches } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import LogIn from '@/components/auth/LogIn.jsx'
import { useTitle } from '@/hooks/useTitle.jsx'

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
    <LogIn />
  )
}
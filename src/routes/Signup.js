import { useEffect } from 'react'
import { useMatches } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import Signup from '@/components/auth/Signup'
import { useTitle } from '@/hooks/useTitle'

export default function SignupPage() {
  const { t } = useTranslation('auth', { keyPrefix: 'signup' })
  const { setTitle } = useTitle()
  const matches = useMatches()

  useEffect(() => {
    if (matches.length === 1) {
      setTitle(t('title'))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [matches])

  return (
    <Signup />
  )
}
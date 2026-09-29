import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import Signup from '@/components/auth/Signup.jsx'
import { useTitle } from '@/hooks/useTitle.jsx'

export default function SignupPage() {
  const { t } = useTranslation('auth', { keyPrefix: 'signup' })
  const { setTitle } = useTitle()
  const { pathname } = useLocation()

  // Only on the page itself - its child routes (e.g. /signup/with-email)
  // set their own title.
  useEffect(() => {
    if (pathname.replace(/\/$/, '') === '/signup') {
      setTitle(t('title'))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname, t])

  return (
    <Signup className="oc-signup" />
  )
}
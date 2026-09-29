import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import LogIn from '@/components/auth/LogIn.jsx'
import { useTitle } from '@/hooks/useTitle.jsx'

export default function SignupPage() {
  const { t } = useTranslation('auth', { keyPrefix: 'login' })
  const { setTitle } = useTitle()
  const { pathname } = useLocation()

  // Only on the page itself - its child routes (e.g. /login/with-email)
  // set their own title.
  useEffect(() => {
    if (pathname.replace(/\/$/, '') === '/login') {
      setTitle(t('title'))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname, t])

  return (
    <LogIn className="oc-log-in" />
  )
}
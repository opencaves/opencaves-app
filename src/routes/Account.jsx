import { useEffect, useState } from 'react'
import { useSelector } from 'react-redux'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { signOut } from 'firebase/auth'
import { Box, Button, Typography } from '@mui/material'
import { CheckRounded, LogoutRounded } from '@mui/icons-material'
import { auth } from '@/config/firebase.js'

export default function Account() {
  const { t } = useTranslation('account')
  const user = useSelector((state) => state.session.user)
  const navigate = useNavigate()
  const [signedOut, setSignedOut] = useState(false)
  const [signingOut, setSigningOut] = useState(false)

  useEffect(() => {
    if (!signedOut) return undefined

    const timeoutId = setTimeout(() => navigate('/login'), 3000)
    return () => clearTimeout(timeoutId)
  }, [navigate, signedOut])

  async function handleSignOut() {
    setSigningOut(true)
    try {
      await signOut(auth)
      setSignedOut(true)
    } catch (error) {
      console.error(error)
      setSigningOut(false)
    }
  }

  return (
    <div className="oc-account center">
      <div className="oc-account--profile profile">
        <Typography component="h1" variant="h4">
          {t('profile')}
        </Typography>
        <p>
          <strong>{t('name')}: </strong>
          {user?.displayName || user?.name}
        </p>
        <p>
          <strong>{t('email')}: </strong>
          {`${user?.email}`}
        </p>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Button variant="contained" color="primary" startIcon={<LogoutRounded />} onClick={handleSignOut} disabled={signingOut}>
            {t('signOut')}
          </Button>
          {signedOut && (
            <CheckRounded
              color="success"
              aria-label={t('signedOut')}
              sx={{
                '@keyframes account-check-in': {
                  from: { opacity: 0, transform: 'scale(0.5)' },
                  to: { opacity: 1, transform: 'scale(1)' },
                },
                animation: 'account-check-in 400ms ease-out',
                fontSize: '2rem',
              }}
            />
          )}
        </Box>
      </div>
    </div>
  )
}

import { useEffect, useState } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { signOut, updateProfile } from 'firebase/auth'
import { Box, Button, TextField, Typography } from '@mui/material'
import { CheckRounded, LogoutRounded, SaveRounded } from '@mui/icons-material'
import { auth } from '@/config/firebase.js'
import { setUser } from '@/redux/slices/sessionSlice.jsx'

export default function Account() {
  const { t } = useTranslation('account')
  const user = useSelector((state) => state.session.user)
  const dispatch = useDispatch()
  const navigate = useNavigate()
  const [name, setName] = useState(user?.displayName || user?.name || '')
  const [savingName, setSavingName] = useState(false)
  const [nameSaved, setNameSaved] = useState(false)
  const [nameCheckFading, setNameCheckFading] = useState(false)
  const [nameError, setNameError] = useState(false)
  const [signedOut, setSignedOut] = useState(false)
  const [signingOut, setSigningOut] = useState(false)

  useEffect(() => {
    setName(user?.displayName || user?.name || '')
  }, [user?.displayName, user?.name])

  useEffect(() => {
    if (!signedOut) return undefined

    const timeoutId = setTimeout(() => navigate('/login'), 3000)
    return () => clearTimeout(timeoutId)
  }, [navigate, signedOut])

  useEffect(() => {
    if (!nameSaved) return undefined

    const fadeTimeoutId = setTimeout(() => setNameCheckFading(true), 2500)
    const removeTimeoutId = setTimeout(() => setNameSaved(false), 3000)
    return () => {
      clearTimeout(fadeTimeoutId)
      clearTimeout(removeTimeoutId)
    }
  }, [nameSaved])

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

  async function handleSaveName() {
    const nextName = name.trim()
    if (!auth.currentUser) return

    setSavingName(true)
    setNameSaved(false)
    setNameCheckFading(false)
    setNameError(false)
    try {
      await updateProfile(auth.currentUser, { displayName: nextName || null })
      dispatch(setUser({ ...user, displayName: nextName }))
      setNameSaved(true)
    } catch (error) {
      console.error(error)
      setNameError(true)
    } finally {
      setSavingName(false)
    }
  }

  return (
    <div className="oc-account center">
      <Box className="oc-account--profile profile" sx={{ width: 'min(100%, 560px)', mx: 'auto', px: { xs: 2, sm: 3 }, py: { xs: 2, sm: 4 } }}>
        <Typography component="h1" variant="h4" sx={{ mb: 4, textAlign: 'center' }}>
          {t('profile')}
        </Typography>
        <Box sx={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 1.5, mb: 2.5 }}>
          <TextField size="small" label={t('name')} value={name} onChange={(event) => setName(event.target.value)} error={nameError} helperText={nameError ? t('nameSaveError') : undefined} disabled={savingName || signedOut} sx={{ flex: '1 1 280px' }} />
          <Button variant="outlined" startIcon={<SaveRounded />} onClick={handleSaveName} disabled={savingName || signedOut || name.trim() === (user?.displayName || user?.name || '').trim()} sx={{ minHeight: 40 }}>
            {t('saveName')}
          </Button>
          <Box sx={{ width: 24, height: 24, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {nameSaved && (
              <CheckRounded
                color="success"
                aria-label={t('nameSaved')}
                sx={{
                  '@keyframes account-name-check-in': {
                    from: { opacity: 0, transform: 'scale(0.5)' },
                    to: { opacity: 1, transform: 'scale(1)' },
                  },
                  '@keyframes account-name-check-out': {
                    from: { opacity: 1, transform: 'scale(1)' },
                    to: { opacity: 0, transform: 'scale(0.5)' },
                  },
                  animation: `${nameCheckFading ? 'account-name-check-out' : 'account-name-check-in'} 400ms ease-out forwards`,
                }}
              />
            )}
          </Box>
        </Box>
        <Box sx={{ mb: 3 }}>
          <Typography variant="body2" color="text.secondary">
            {t('email')}
          </Typography>
          <Typography component="p">{user?.email || ''}</Typography>
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 1.5, pt: 2.5, borderTop: '1px solid', borderColor: 'divider' }}>
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
      </Box>
    </div>
  )
}

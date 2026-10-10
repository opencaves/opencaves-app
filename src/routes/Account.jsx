import { useEffect, useState } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { EmailAuthProvider, reauthenticateWithCredential, signOut, updatePassword, updateProfile } from 'firebase/auth'
import { Avatar, Box, Button, Divider, TextField, Typography } from '@mui/material'
import CheckRounded from '@mui/icons-material/CheckRounded'
import LogoutRounded from '@mui/icons-material/LogoutRounded'
import SaveRounded from '@mui/icons-material/SaveRounded'
import { auth } from '@/config/firebase.js'
import { setUser } from '@/redux/slices/sessionSlice.jsx'
import SavedCavesList from '@/components/SavedCaves/SavedCavesList.jsx'
import OfflineStorageSection from '@/components/Offline/OfflineStorageSection.jsx'
import LanguageSection from '@/components/Account/LanguageSection.jsx'
import UnitsSection from '@/components/Account/UnitsSection.jsx'
import AppearanceSection from '@/components/Account/AppearanceSection.jsx'
import FeedbackEmailsSection from '@/components/Account/FeedbackEmailsSection.jsx'
import { useTitle } from '@/hooks/useTitle.jsx'
import { PAGE_TITLE_SX } from '@/components/pageTitle.js'
import { formSectionDividerSx, formSectionHeadingProps } from '@/components/formSectionHeading.js'

const sectionHeadingProps = formSectionHeadingProps('oc-account--section-title')

export default function Account() {
  const { t } = useTranslation('account')
  const user = useSelector((state) => state.session.user)
  const isLoggedIn = useSelector((state) => state.session.isLoggedIn)
  const dispatch = useDispatch()
  const navigate = useNavigate()
  const [name, setName] = useState(user?.displayName || user?.name || '')
  const [savingName, setSavingName] = useState(false)
  const [nameSaved, setNameSaved] = useState(false)
  const [nameCheckFading, setNameCheckFading] = useState(false)
  const [nameError, setNameError] = useState(false)
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [passwordSaving, setPasswordSaving] = useState(false)
  const [passwordSaved, setPasswordSaved] = useState(false)
  const [passwordError, setPasswordError] = useState(null)
  const [signedOut, setSignedOut] = useState(false)
  const [signingOut, setSigningOut] = useState(false)
  const { setTitle } = useTitle()

  // Its own title, which also follows a language change made on this page.
  useEffect(() => {
    setTitle(t('profile'))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [t])

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

  async function handleChangePassword() {
    setPasswordError(null)
    setPasswordSaved(false)
    if (newPassword.length < 6) {
      setPasswordError(t('passwordTooShort'))
      return
    }
    if (newPassword !== confirmPassword) {
      setPasswordError(t('passwordMismatch'))
      return
    }
    if (!auth.currentUser?.email) return

    setPasswordSaving(true)
    try {
      const credential = EmailAuthProvider.credential(auth.currentUser.email, currentPassword)
      await reauthenticateWithCredential(auth.currentUser, credential)
      await updatePassword(auth.currentUser, newPassword)
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
      setPasswordSaved(true)
    } catch (error) {
      console.error(error)
      setPasswordError(error.code === 'auth/wrong-password' || error.code === 'auth/invalid-credential' ? t('currentPasswordIncorrect') : t('passwordSaveError'))
    } finally {
      setPasswordSaving(false)
    }
  }

  const hasPasswordProvider = auth.currentUser?.providerData.some(({ providerId }) => providerId === 'password')
  const displayName = (user?.displayName || user?.name || '').trim()
  const nameCheck = nameSaved && (
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
  )

  return (
    <div className="oc-account">
      {/* Same column and section style as the edit pages (section headings,
          dividers), under an identity header like the account menu's. */}
      <Box className="oc-account--content" sx={{ width: 'min(100%, 720px)', mx: 'auto', py: { xs: 1, sm: 3 }, display: 'flex', flexDirection: 'column', gap: 2 }}>
        <Box className="oc-account--identity" sx={{ display: 'flex', alignItems: 'center', gap: 2.5 }}>
          <Avatar src={user?.photoURL || undefined} alt="" sx={{ width: 72, height: 72, bgcolor: 'primary.main', fontSize: 32, flexShrink: 0 }}>
            {!user?.photoURL && (displayName[0]?.toUpperCase() || null)}
          </Avatar>
          <Box sx={{ minWidth: 0 }}>
            <Typography component="h1" sx={{ ...PAGE_TITLE_SX, overflowWrap: 'anywhere' }}>
              {displayName || t('profile')}
            </Typography>
            {user?.email && (
              <Typography color="text.secondary" sx={{ overflowWrap: 'anywhere' }}>
                {user.email}
              </Typography>
            )}
          </Box>
        </Box>

        <Divider sx={formSectionDividerSx} />

        <Box component="section" className="oc-account--personal-info">
          <Typography {...sectionHeadingProps}>{t('personalInfo')}</Typography>
          <Box sx={{ display: 'flex', alignItems: 'flex-start', flexWrap: 'wrap', gap: 1.5 }}>
            <TextField size="small" label={t('name')} value={name} onChange={(event) => setName(event.target.value)} error={nameError} helperText={nameError ? t('nameSaveError') : undefined} disabled={savingName || signedOut} sx={{ flex: { xs: '1 1 100%', sm: '1 1 280px' } }} />
            {/* Phones: the field takes the whole first line, and Save goes under
                it at the right, flush with the field, the check just before. */}
            <Box sx={{ width: 24, height: 40, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', order: { xs: 1, sm: 2 }, ml: { xs: 'auto', sm: 0 } }}>{nameCheck}</Box>
            <Button variant="outlined" startIcon={<SaveRounded />} onClick={handleSaveName} disabled={savingName || signedOut || name.trim() === displayName} sx={{ minHeight: 40, order: { xs: 2, sm: 1 } }}>
              {t('saveName')}
            </Button>
          </Box>
          {/* The language, units and display mode, as fields of the personal info. */}
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 2.5 }}>
            <LanguageSection asField />
            <UnitsSection asField />
            <AppearanceSection />
          </Box>
        </Box>


        {isLoggedIn && (
          <>
            <Divider sx={formSectionDividerSx} />
            <SavedCavesList headingProps={sectionHeadingProps} />
            <Divider sx={formSectionDividerSx} />
            <FeedbackEmailsSection headingProps={sectionHeadingProps} />
          </>
        )}

        <Divider sx={formSectionDividerSx} />
        <OfflineStorageSection headingProps={sectionHeadingProps} />

        {hasPasswordProvider && (
          <>
            <Divider sx={formSectionDividerSx} />
            <Box component="section" className="oc-account--password">
              <Typography {...sectionHeadingProps}>{t('changePassword')}</Typography>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <TextField type="password" size="small" label={t('currentPassword')} value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} disabled={passwordSaving || signedOut} autoComplete="current-password" />
                <TextField type="password" size="small" label={t('newPassword')} value={newPassword} onChange={(event) => setNewPassword(event.target.value)} disabled={passwordSaving || signedOut} autoComplete="new-password" />
                <TextField type="password" size="small" label={t('confirmPassword')} value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} error={!!passwordError} helperText={passwordError || undefined} disabled={passwordSaving || signedOut} autoComplete="new-password" />
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 1 }}>
                  <Box sx={{ width: 24, height: 24, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{passwordSaved && <CheckRounded color="success" aria-label={t('passwordSaved')} />}</Box>
                  <Button variant="outlined" onClick={handleChangePassword} disabled={passwordSaving || signedOut || !currentPassword || !newPassword || !confirmPassword}>
                    {t('savePassword')}
                  </Button>
                </Box>
              </Box>
            </Box>
          </>
        )}

        <Divider sx={formSectionDividerSx} />
        <Box className="oc-account--sign-out" sx={{ display: 'flex', alignItems: 'center', gap: 1.5, pb: 2 }}>
          <Button variant="outlined" startIcon={<LogoutRounded />} onClick={handleSignOut} disabled={signingOut}>
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

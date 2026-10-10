import { useEffect, useId, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useSelector } from 'react-redux'
import { useTranslation } from 'react-i18next'
import { Typography } from '@mui/material'
import { Grid } from '@mui/material'
import { signInWithEmailAndPassword } from 'firebase/auth'
import { Section, SectionActions, SectionFields, SectionForm } from './Section.jsx'
import AuthButton from './AuthButton.jsx'
import TextInput from './TextInput.jsx'
import { auth } from '@/config/firebase.js'
import { PASSWORD_MIN_LENGTH } from '@/config/auth.js'
import PasswordResetDialog from './PasswordResetDialog.jsx'

export default function LogInWithEmail() {
  const navigate = useNavigate()
  const continueUrl = useSelector((/** @type {RootState} */ state) => state.session.continueUrl)
  const { t } = useTranslation('auth', { keyPrefix: 'loginWithEmail' })
  const { t: tErrors } = useTranslation('errors')

  const emailInputRef = useRef(null)
  const passwordInputRef = useRef(null)

  // Filled in when coming from sign-up with an email already in use.
  const location = useLocation()
  const [email, setEmail] = useState(location.state?.email || '')
  const [password, setPassword] = useState('')

  const [emailError, setEmailError] = useState(false)
  const [passwordError, setPasswordError] = useState(false)
  const [emailInputValid, setEmailInputValid] = useState(false)
  const [passwordInputValid, setPasswordInputValid] = useState(false)
  const [authErrorText, setAuthErrorText] = useState('')
  const [resetOpen, setResetOpen] = useState(false)
  // Its own: the form can show twice (the log-in page, and its email dialog
  // over it).
  const passwordId = useId()

  function navigateToContinueUrl() {
    const url = continueUrl ?? '/'
    if (url.includes('#')) {
      window.location.href = url
    } else {
      navigate(url)
    }
  }

  function onEmailInputValidityChange(validity) {
    setEmailInputValid(validity.valid)
  }

  useEffect(() => {
    if (emailInputValid) {
      setAuthErrorText('')
    }
  }, [emailInputValid])

  async function onLogInBtnClick() {
    await login()
  }

  function onEmailInputKeyUp(event) {
    if (event.key === 'Enter') {
      passwordInputRef.current?.querySelector('input')?.focus()
    }
  }

  async function onPasswordInputKeyUp(event) {
    if (event.key === 'Enter') {
      await login()
    }
  }

  async function login() {
    try {
      await signInWithEmailAndPassword(auth, email, password)
      navigateToContinueUrl()
    } catch (error) {
      console.error('Error login in: %o', error)
      // updateInputsValidity()
      const firebaseErrors = tErrors('firebaseErrors', { returnObjects: true })
      const errorMsg = Reflect.has(firebaseErrors, error.code) ? firebaseErrors[error.code] : tErrors('auth.default')
      setAuthErrorText(errorMsg)

      if (error.code.indexOf('email') > -1) {
        setEmailError(true)
      }

      if (error.code.indexOf('password') > -1) {
        setPasswordError(true)
      }
    }
  }

  return (
    <Section className="oc-log-in-with-email">
      <SectionForm>
        <SectionFields>
          <TextInput ref={emailInputRef} label={t('emailLabel')} type="email" name="email" required inputMode="email" autoComplete="email" value={email} error={emailError} onChange={(e) => setEmail(e.target.value)} onKeyUp={onEmailInputKeyUp} onValidityChange={onEmailInputValidityChange} />
          <Grid container sx={{ flexDirection: 'column' }}>
            <TextInput id={passwordId} ref={passwordInputRef} label={t('passwordLabel')} type="password" name="password" required value={password} error={passwordError} minLength={PASSWORD_MIN_LENGTH} onChange={(e) => setPassword(e.target.value)} onKeyUp={onPasswordInputKeyUp} onValidityChange={(validity) => setPasswordInputValid(validity.valid)} />
            {/* A link's look; a button: it opens the reset dialog. */}
            <Typography component="button" type="button" onClick={() => setResetOpen(true)} sx={{ fontSize: 'small', display: 'block', textAlign: 'right', mt: 0.75, ml: 'auto', p: 0, border: 0, bgcolor: 'transparent', color: 'var(--mui-sys-color-primary)', textDecoration: 'underline', cursor: 'pointer', font: 'inherit' }}>
              {t('forgotPassword')}
            </Typography>
          </Grid>
        </SectionFields>

        <Typography sx={{ fontSize: 'small', display: 'block', textAlign: 'center' }} color="error">
          {authErrorText}
        </Typography>

        <SectionActions>
          <AuthButton
            // endIcon={<NavigateNextRounded />}
            onClick={onLogInBtnClick}
          >
            {t('loginBtn.label')}
          </AuthButton>
        </SectionActions>
      </SectionForm>
      <PasswordResetDialog open={resetOpen} onClose={() => setResetOpen(false)} initialEmail={email} />
    </Section>
  )
}

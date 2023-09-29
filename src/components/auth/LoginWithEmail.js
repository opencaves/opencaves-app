import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useDispatch } from 'react-redux'
import { useTranslation } from 'react-i18next'
import Grid from '@mui/material/Unstable_Grid2'
import { signInWithEmailAndPassword } from 'firebase/auth'
import { deleteContinueUrl, setContinueUrl } from '@/redux/slices/sessionSlice'
import AuthButton from './AuthButton'
import TextInput from './TextInput'
import { auth } from '@/config/firebase'
import { passwordMinLength } from '@/config/auth'
import { Section, SectionActions, SectionFields, SectionForm } from './Section.js'
import { Typography } from '@mui/material'

export default function LoginWithEmail() {
  const navigate = useNavigate()
  const dispatch = useDispatch()
  const { t } = useTranslation('auth', { keyPrefix: 'loginWithEmail' })
  const { t: tErrors } = useTranslation('errors')
  const { state } = useLocation()
  const [continueUrl, setContinueUrl] = useState()
  const emailInputRef = useRef(null)
  const passwordInputRef = useRef(null)

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')

  const [emailError, setEmailError] = useState(false)
  const [passwordError, setPasswordError] = useState(false)
  const [emailInputValid, setEmailInputValid] = useState(false)
  const [passwordInputValid, setPasswordInputValid] = useState(false)
  const [authErrorText, setAuthErrorText] = useState('')

  if (state && state.continueUrl) {
    dispatch(setContinueUrl(state.continueUrl))
  }

  function navigateToContinueUrl(continueUrl = '/') {
    dispatch(deleteContinueUrl())
    navigate(continueUrl)
  }

  function onEmailInputValidityChange(validity) {
    console.log('%c[onEmailInputValidityChange] %o', 'color: blue; font-weight: bold;', validity)
    setEmailInputValid(validity.valid)
  }

  // function updateInputsValidity() {
  //   if (emailInputRef) {
  //     console.log('emailInputRef: %o', emailInputRef)
  //     emailInputRef.current.error = !emailInputRef.current.inputRef.checkValidity()
  //   }

  //   if (passwordInputRef) {
  //     passwordInputRef.current.error = !passwordInputRef.current.inputRef.checkValidity()
  //   }
  // }

  useEffect(() => {
    console.log('emailInputValid: %o', emailInputValid)
    if (emailInputValid) {
      setAuthErrorText('')
    }
  }, [emailInputValid])

  async function onLoginBtnClick() {

    try {
      await signInWithEmailAndPassword(auth, email, password)
      navigateToContinueUrl(continueUrl)
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
    <Section>
      <SectionForm>
        <SectionFields>
          <TextInput
            ref={emailInputRef}
            label={t('emailLabel')}
            type='email'
            name='email'
            required
            inputMode='email'
            autoComplete='email'
            variant='outlined'
            value={email}
            error={emailError}
            onChange={e => setEmail(e.target.value)}
            onValidityChange={onEmailInputValidityChange}
          />
          <Grid
            container
            direction='column'
          >
            <TextInput
              ref={passwordInputRef}
              label={t('passwordLabel')}
              type='password'
              name='password'
              required
              variant='outlined'
              value={password}
              error={passwordError}
              minLength={passwordMinLength}
              onChange={e => setPassword(e.target.value)}
              onValidityChange={validity => setPasswordInputValid(validity.valid)}
            />
            <Typography
              component={Link}
              to='/password-recovery'
              fontSize='small'
              display='block'
              textAlign='right'
              mt={0.75}
            >{t('forgotPassword')}</Typography>
          </Grid>

        </SectionFields>

        <Typography
          fontSize='small'
          display='block'
          textAlign='center'
          color='error'
        >{authErrorText}</Typography>

        <SectionActions>
          <AuthButton
            // endIcon={<NavigateNextRounded />}
            onClick={onLoginBtnClick}
          >
            {t('loginBtn.label')}
          </AuthButton>

        </SectionActions>
      </SectionForm>
    </Section>
  )
}
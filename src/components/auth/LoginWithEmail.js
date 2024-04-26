import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useDispatch, useSelector } from 'react-redux'
import { useTranslation } from 'react-i18next'
import { Typography } from '@mui/material'
import Grid from '@mui/material/Unstable_Grid2'
import { signInWithEmailAndPassword } from 'firebase/auth'
import { deleteContinueUrl } from '@/redux/slices/sessionSlice'
import { Section, SectionActions, SectionFields, SectionForm } from './Section'
import AuthButton from './AuthButton'
import TextInput from './TextInput'
import { auth } from '@/config/firebase'
import { passwordMinLength } from '@/config/auth'

export default function LogInWithEmail() {
  const navigate = useNavigate()
  const dispatch = useDispatch()
  const continueUrl = useSelector(state => state.session.continueUrl)
  const { t } = useTranslation('auth', { keyPrefix: 'loginWithEmail' })
  const { t: tErrors } = useTranslation('errors')

  const emailInputRef = useRef(null)
  const passwordInputRef = useRef(null)

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')

  const [emailError, setEmailError] = useState(false)
  const [passwordError, setPasswordError] = useState(false)
  const [emailInputValid, setEmailInputValid] = useState(false)
  const [passwordInputValid, setPasswordInputValid] = useState(false)
  const [authErrorText, setAuthErrorText] = useState('')

  function navigateToContinueUrl() {
    const url = continueUrl ?? '/'
    // dispatch(deleteContinueUrl())
    // console.log('!!! navigating to url: %s', url)
    // navigate(url)
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
      passwordInputRef.current?.querySelector('#pwd')?.focus()
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
            onKeyUp={onEmailInputKeyUp}
            onValidityChange={onEmailInputValidityChange}
          />
          <Grid
            container
            direction='column'
          >
            <TextInput
              id="pwd"
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
              onKeyUp={onPasswordInputKeyUp}
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
            onClick={onLogInBtnClick}
          >
            {t('loginBtn.label')}
          </AuthButton>

        </SectionActions>
      </SectionForm>
    </Section>
  )
}
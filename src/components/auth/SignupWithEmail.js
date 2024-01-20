import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useDispatch, useSelector } from 'react-redux'
import { usePageVisibility } from 'react-page-visibility'
import { Trans, useTranslation } from 'react-i18next'
import { checkActionCode, fetchSignInMethodsForEmail, isSignInWithEmailLink, sendSignInLinkToEmail, signInWithEmailLink, updatePassword, updateProfile } from 'firebase/auth'
import { Box, Dialog, DialogContent, DialogTitle, IconButton, Skeleton, Typography, useMediaQuery, useTheme } from '@mui/material'
import Grid from '@mui/material/Unstable_Grid2'
import { LoadingButton } from '@mui/lab'
import { ArrowBack, CheckCircleOutlineRounded, Close, SendRounded, WarningRounded } from '@mui/icons-material'
import { register } from 'swiper/element/bundle'
import { deleteContinueUrl } from '@/redux/slices/sessionSlice'
import Logo from '../App/Logo'
import PasswordInput from './PasswordInput'
import AuthButton from './AuthButton'
import TextInput from './TextInput'
import AuthWithGoogle from './AuthWithGoogle'
import { Progress, Section, SectionActions, SectionDetails, SectionFields, SectionForm } from './Section'
import { useTitle } from '@/hooks/useTitle'
import { useSmall } from '@/hooks/useSmall'
import { useBroadcastChannel } from '@/hooks/useBroadcastChannel'
import { Forward } from '../Transitions'
import { auth } from '@/config/firebase'
import { defaultContinuetUrl, firstNameMinLength, gap, passwordMinLength } from '@/config/auth'
import { NavigateNextRounded } from '../icons'
import './SignupWithEmail.scss'

const emailValidatedParam = 'email-valid'

if (!customElements.get('swiper-container')) {
  register()
}

export default function SignupWithEmail({ open: initialOpen }) {

  const logoHeight = 100
  const logoWidth = 185
  const emailCallbackStep = 2

  const { t } = useTranslation('auth', { keyPrefix: 'signup.withEmailDialog' })
  const { t: ts } = useTranslation('auth', { keyPrefix: 'signup.withEmailDialog.steps' })
  const { t: tErrors } = useTranslation('errors', { keyPrefix: 'auth' })
  const swiperRef = useRef()
  const dispatch = useDispatch()
  const theme = useTheme()
  const isMd = useMediaQuery(theme.breakpoints.down('md'))
  const isSmall = useSmall()
  const navigate = useNavigate()
  const { setTitle } = useTitle()
  const isVisible = usePageVisibility()
  const [searchParams] = useSearchParams()

  const [open, setOpen] = useState(initialOpen)
  const [header, setHeader] = useState(' ')
  const [registrationComplete, setRegistrationComplete] = useState(false)
  const [emailAlreadyInUse, setEmailAlreadyInUse] = useState(false)
  const [signinMethodsForEmail, setSigninMethodsForEmail] = useState()
  const continueUrl = useSelector(state => state.session.continueUrl)

  const [currentStep, setCurrentStep] = useState(searchParams.has(emailValidatedParam) ? emailCallbackStep : 0)
  const initialStep = currentStep

  const [email, setEmail] = useState('')
  const [email2, setEmail2] = useState('')
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [password, setPassword] = useState('')

  const [firstNameInputHelperText, setFirstNameInputHelperText] = useState(' ')
  const [firstNameInputValidity, setFirstNameInputValidity] = useState({ valid: false })

  const [emailInputHelperText, setEmailInputHelperText] = useState(' ')
  const [emailInputValidity, setEmailInputValidity] = useState({})
  const [emailInputEmpty, setEmailInputEmpty] = useState(true)

  const [email2InputHelperText, setEmail2InputHelperText] = useState(' ')
  const [email2InputValidity, setEmail2InputValidity] = useState(false)
  const [email2InputEmpty, setEmail2InputEmpty] = useState(true)
  const [email2InputCustomError, setEmail2InputCustomError] = useState(false)
  const [email2Prefilled, setEmail2Prefilled] = useState(false)

  const [passwordInputValid, setPasswordInputValid] = useState(false)
  const [passwordInputState, setPasswordInputState] = useState('indeterminate')
  const [passwordInputError, setPasswordInputError] = useState(null)

  const [stepEmailLoading, setStepEmailLoading] = useState(false)
  const [stepPasswordLoading, setStepPasswordLoading] = useState(false)
  const [showInvalidActionCodeStep, setShowInvalidActionCodeStep] = useState(false)
  const [showRetypeEmailStep, setShowRetypeEmailStep] = useState(false)

  const actionCodeSettings = {
    url: `${window.location.origin}/signup/with-email?${emailValidatedParam}`,
    // This must be true.
    handleCodeInApp: true,
  }

  const broadcastCurrentStep = useBroadcastChannel('currentStep', event => {
    if (!isVisible) {
      console.log('[broadcast] going to step: %o', event.data)
      goToStep(event.data, 0, false)
    }
  })

  const broadcastEmail = useBroadcastChannel('email', event => {
    if (event.data.action === 'GET') {
      broadcastEmail({
        action: 'SET',
        email
      })
    }

    if (event.data.action === 'SET') {
      const { email } = event.data
      setEmail2(email)
      setEmail2Prefilled(!!email)
    }
  })

  function onClose() {
    setOpen(false)
  }

  function onTransitionExited() {
    if (!open) {
      navigate('..')
      if (registrationComplete) {
        goToStep(0, 0, false)
      }
    }
  }

  function previousStep(speed = undefined, runCallbacks = true) {
    if (swiperRef.current?.swiper) {
      let previousStep = swiperRef.current.swiper.activeIndex - 1

      if (previousStep < 0) {
        previousStep = 0
      }

      goToStep(previousStep, speed, runCallbacks)
    }
  }

  function nextStep(speed = undefined, runCallbacks = true) {
    if (swiperRef.current?.swiper) {
      const nextStep = swiperRef.current.swiper.activeIndex + 1
      goToStep(nextStep, speed, runCallbacks)
    }
  }

  function goToStep(step, speed = undefined, runCallbacks = true) {
    const swiper = swiperRef.current?.swiper
    if (swiper) {
      swiper.slideTo(step, speed, runCallbacks)

    }

    if (step >= emailCallbackStep) {
      broadcastCurrentStep(step)
    }

  }

  // Set step header
  useEffect(() => {
    if (swiperRef.current) {
      const swiper = swiperRef.current?.swiper
      if (swiper) {
        swiper.update()
        setTimeout(() => {
          const currentSlideEl = swiper.slides[currentStep]
          const step = currentSlideEl.dataset.step
          const subStep = currentSlideEl.dataset.subStep
          if (step) {
            const i18nPath = `${step}${subStep ? `.${subStep}` : ``}.header`
            setHeader(ts(i18nPath))
          }
        })
      }
    }
  }, [currentStep, showRetypeEmailStep, showInvalidActionCodeStep, ts])

  //
  // Step 0 - Enter email
  //

  function onEmailInputKeyUp(event) {
    const inputEmpty = !event.target.value
    setEmailInputEmpty(inputEmpty)
    if (!emailInputValidity.valid) {
      setEmailInputHelperText(inputEmpty ? tErrors('emailMissing') : tErrors('emailInvalid'))
    }
  }

  async function onStepEmailContinueBtnClick() {

    if (!emailInputValidity.valid) {
      setEmailInputHelperText(emailInputEmpty ? tErrors('emailMissing') : tErrors('emailInvalid'))
      return
    }

    try {

      setStepEmailLoading(true)

      const fetchedSigninMethodsForEmail = await fetchSignInMethodsForEmail(auth, email)
      console.log('fetchedSigninMethodsForEmail: %o', fetchedSigninMethodsForEmail)
      const emailInUse = fetchedSigninMethodsForEmail.length > 0

      setEmailAlreadyInUse(emailInUse)

      if (emailInUse) {
        setSigninMethodsForEmail(fetchedSigninMethodsForEmail)
      } else {
        await sendSignInLinkToEmail(auth, email, actionCodeSettings)
      }

      nextStep()

    } catch (error) {
      console.error(error)
    } finally {
      setStepEmailLoading(false)
    }
  }

  //
  // Step 1 - Email already in use / Check email
  //

  //
  // Step 2 - Email callback
  //

  //
  // Step 2a - Invalid action code
  //

  // Go to Email callback step on load
  useEffect(() => {

    async function doEmailCallback() {

      if (searchParams.has(emailValidatedParam)) {

        if (swiperRef.current?.swiper) {

          goToStep(emailCallbackStep, 0)

          const oobCode = searchParams.get('oobCode')
          let bypassEmailCallbackStep = true
          try {

            // Validates action code
            const result = await checkActionCode(auth, oobCode)
            console.log('[verifyActionCode] result: %o', result)

            // Check for email prefilled
            setShowRetypeEmailStep(!email2Prefilled)
            if (!email2Prefilled) {
              bypassEmailCallbackStep = false
            }

          } catch (error) {
            console.error('[verifyActionCode] error: %o', error)
            setShowInvalidActionCodeStep(true)
            bypassEmailCallbackStep = false
          } finally {
            if (bypassEmailCallbackStep) {
              nextStep(0)
            } else {
              console.log('NOT bypassing email callback step.')
              // swiperRef.current.swiper.update()
            }
          }

        }
      }
    }

    doEmailCallback()

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, swiperRef.current?.swiper, showRetypeEmailStep, email2Prefilled])

  //
  // Step 2b - Retype email ( / Mismatch email verification ?)
  //

  function onEmail2InputKeyUp(event) {
    // console.log('[onEmail2InputKeyUp] event: %o', event)
    // if (!email2InputValidity.valid) {
    //   const message = email2InputValidity.valueMissing ? tErrors('emailMissing') : email2InputValidity.customError ? tErrors(email2InputValidity.customError) : tErrors('emailInvalid')
    //   console.log('MESSAGE: %o', message)
    //   setEmail2InputHelperText(message)
    // }
  }

  function onEmail2InputChange(event) {
    setEmail2InputCustomError(false)
    setEmail2(event.target.value)
  }

  // Updates the email2 input helper text
  useMemo(() => {
    if (!email2InputValidity.valid) {
      const message = email2InputValidity.valueMissing ? tErrors('emailMissing') : email2InputValidity.customError ? tErrors(email2InputValidity.customError) : tErrors('emailInvalid')
      setEmail2InputHelperText(message)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [email2InputValidity])

  //
  // Step 3 - Enter first name / Last name
  //

  function validateFirstNameInput() {
    if (!firstNameInputValidity.valid) {
      setFirstNameInputHelperText(firstNameInputValidity.valueMissing ? tErrors('firstNameMissing') : ts('firstNameTooShort', { minLength: firstNameMinLength }))
      return false
    }

    return true
  }

  function onFirstNameInputKeyUp() {
    validateFirstNameInput()
  }

  function onStepNameContinueBtnClick() {
    const valid = validateFirstNameInput()
    console.log('onStepNameContinueBtnClick: %o', valid)
    if (!valid) {
      return
    }

    nextStep()
  }

  //
  // Step 4 - Enter password
  //

  function onPasswordInputKeyUp() {
    if (passwordInputState === 'determinate' && password.length < passwordMinLength) {
      setPasswordInputError(true)
    } else {
      setPasswordInputError(false)
    }
  }

  function onPasswordInputChange(event) {
    setPassword(event.target.value)
    setPasswordInputValid(event.target.checkValidity())
  }

  useEffect(() => {
    if (password && passwordInputState === 'indeterminate') {
      setPasswordInputState('determinate')
    }

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [password])

  async function onStepPasswordContinueBtnClick() {

    try {

      if (isSignInWithEmailLink(auth, window.location.href)) {

        setStepPasswordLoading(true)

        // Create User
        const { user } = await signInWithEmailLink(auth, email2, window.location.href)

        console.log('User created. result: %o', user)

        await updatePassword(user, password)

        // const { user } = await createUserWithEmailAndPassword(auth, email2, password)
        console.log('User created. result: %o', user)

        await updateProfile(user, {
          displayName: `${firstName}${lastName ? ` ${lastName}` : ``}`
        })

        nextStep()
      } else {
        alert('[TODO] Email link cound not be verified. To be done.')
      }

    } catch (error) {
      console.error(error)
      console.error(error.code)
      if (error.code === 'auth/invalid-email') {
        console.error('------------------------------')
        setEmail2InputCustomError('emailMismatch')
        // setEmail2InputHelperText(tErrors('emailMismatch'))
        goToStep(emailCallbackStep)
        return
      }
    } finally {
      setStepPasswordLoading(false)
    }
  }

  //
  // Step 5 - Registration completed
  //

  function onStepCreatedCloseBtnClick() {
    dispatch(deleteContinueUrl())
  }

  //
  // Init
  //

  // Set page title
  useEffect(() => {
    setTitle(t('title'))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // 
  useEffect(() => {
    if (swiperRef.current) {
      const swiperEl = swiperRef.current

      function onActiveIndexChange() {
        const swiper = swiperRef.current?.swiper
        if (swiper) {
          swiper.update()
          setCurrentStep(swiper.activeIndex)

          // // Set step header
          // const currentSlideEl = swiper.slides[swiper.activeIndex]
          // const step = currentSlideEl.dataset.step
          // const subStep = currentSlideEl.dataset.subStep
          // setStepHeader(step, subStep)
        }
      }

      swiperEl.addEventListener('activeindexchange', onActiveIndexChange)

      // Initialization
      onActiveIndexChange()

      return () => swiperEl.removeEventListener('activeindexchange', onActiveIndexChange)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [swiperRef?.current])

  useEffect(() => {
    if (currentStep === emailCallbackStep) {
      broadcastEmail({ action: 'GET' })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentStep])

  return (
    <Dialog
      fullScreen={isSmall}
      fullWidth
      maxWidth={isMd ? 'sm' : 'md'}
      open={open}
      sx={{
        '--swiper-pagination-color': 'var(--md-palette-secondary-main)'
      }}
      // TransitionComponent={Grow}
      transitionDuration={{
        enter: theme.oc.sys.motion.duration.emphasizedDecelerate,
        exit: theme.oc.sys.motion.duration.emphasizedAccelerate
      }}
      TransitionProps={{
        mountOnEnter: true,
        unmountOnExit: true
      }}
      onClose={onClose}
      // onTransitionEnter={onTransitionEnter}
      onTransitionExited={onTransitionExited}
    >
      <DialogTitle>
        <Grid
          container
          xs
          alignItems='center'
          gap={2}
        >
          <Grid
            xs
            order={isSmall && 1}>
            {t('header')}
          </Grid>
          <Grid
          >
            <IconButton
              aria-label={isSmall ? t('closeBtnSm.ariaLabel') : t('closeBtn.ariaLabel')}

              onClick={onClose}
              sx={{
                p: 0
              }}
            >
              {
                isSmall ? (
                  <ArrowBack />
                ) : (
                  <Close />
                )
              }
            </IconButton>
          </Grid>
        </Grid>
      </DialogTitle>
      <DialogContent
        sx={{
          position: 'relative',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: isSmall ? 'flex-start' : 'center',
          alignItems: 'center',
        }}
      >
        <Grid
          container
          direction='column'
          alignItems='center'
          width={{
            xs: '100%',
            sm: '80%'
          }}
          sx={{
            py: {
              xs: 4,
              sm: 6,
              md: 7
            },
          }}
        >
          <Logo
            variant='brand-short'
            width={logoWidth}
            height={logoHeight}
            mb={{
              xs: 6,
              md: 8,
              lg: 10
            }}
          />

          <Typography
            variant='h1'
            component='h1'
            fontSize={{
              xs: 30,
              md: 32,
              lg: 36
            }}
            // mt={{
            //   xs: 6,
            //   md: 8,
            //   lg: 10
            // }}
            mb={4}
            textAlign='center'
          >
            {header}
          </Typography>

          <Box
            width='100%'
          >
            <swiper-container
              ref={swiperRef}
              initial-slide={initialStep}
              allow-touch-move={process.env.NODE_ENV !== 'production'}
              slides-per-view='1'
              speed='350'
              // css-mode
              pagination
            >

              {/* 
                * Step 0 - Enter email
                */}
              <swiper-slide data-step="email">
                <Section>
                  <SectionForm>
                    <SectionFields>
                      <TextInput
                        type='email'
                        name='email'
                        label={ts('email.label')}
                        value={email}
                        required
                        inputMode='email'
                        autoComplete='email'
                        helperText={emailInputHelperText}
                        onChange={event => setEmail(event.target.value)}
                        onKeyUp={onEmailInputKeyUp}
                        onValidityChange={validity => setEmailInputValidity(validity)}
                      />
                    </SectionFields>
                    <SectionActions>

                      <Progress enabled={stepEmailLoading} />

                      <AuthButton
                        disabled={!emailInputValidity.valid}
                        Component={LoadingButton}
                        loading={stepEmailLoading}
                        endIcon={<NavigateNextRounded />}
                        onClick={onStepEmailContinueBtnClick}
                      >
                        {ts('email.continueBtn')}
                      </AuthButton>

                      <Box mt={1}>
                        <p style={{ margin: 0, textAlign: 'center' }}>
                          <small>
                            {ts('email.loginInvite')}
                            {' '}
                            <Link to={`/login`} >
                              {ts('email.loginBtn')}
                            </Link>
                          </small>
                        </p>
                      </Box>
                    </SectionActions>
                  </SectionForm>
                </Section>
              </swiper-slide>

              {/* 
                * Step 1 - Email already in use / Check email
                */}
              <swiper-slide data-step="emailSentAndEmailVerification" data-sub-step={emailAlreadyInUse ? 'emailInUse' : 'emailSentNotification'}>
                <Section>
                  {
                    emailAlreadyInUse ? (
                      <>
                        <SectionDetails mb={gap}>
                          <Trans i18nKey='emailSentAndEmailVerification.emailInUse.details' t={ts} values={{ email }} />
                        </SectionDetails>
                        <SectionForm>
                          <SectionActions>
                            <AuthButton
                              onClick={() => { previousStep() }}
                            >
                              {ts('emailSentAndEmailVerification.emailInUse.previousBtn')}
                            </AuthButton>

                            <AuthWithGoogle
                              message={ts('emailSentAndEmailVerification.emailInUse.loginWithGoogle')}
                            />
                            <Box mt={1}>
                              <p style={{ margin: 0, textAlign: 'center' }}>
                                <small>
                                  {ts('email.loginInvite')}
                                  {' '}
                                  <Link to={`/login`} >
                                    {ts('email.loginBtn')}
                                  </Link>
                                </small>
                              </p>
                            </Box>
                          </SectionActions>
                        </SectionForm>
                      </>
                    ) : (
                      <Grid
                        container
                        direction='column'
                        alignItems='center'
                        sx={{
                          mt: 2,
                          mb: 4
                        }}
                      >
                        <SendRounded
                          // <EmailFastOutline
                          color='primary'
                          sx={{
                            fontSize: 80
                          }}
                        />

                        <SectionDetails
                          sx={{
                            mt: 1
                          }}
                        >
                          <Trans
                            t={ts}
                            i18nKey='emailSentAndEmailVerification.emailSentNotification.details'
                            values={{ email }}
                          />
                        </SectionDetails>
                      </Grid>
                    )
                  }
                </Section>
              </swiper-slide>

              {/* 
                * Step 2 - Email callback
                */}
              <swiper-slide data-step="emailCallback" data-sub-step={showInvalidActionCodeStep ? 'invalidActionCode' : showRetypeEmailStep ? 'retypeEmail' : null}>
                <Section>

                  {/* 
                    * Step 2a - Invalid action code
                    */

                    showInvalidActionCodeStep ? (
                      <>
                        <Grid
                          container
                          direction='column'
                          alignItems='center'
                          sx={{
                            mt: 2,
                            mb: 4
                          }}
                        >
                          <WarningRounded
                            // <EmailFastOutline
                            color='warning'
                            sx={{
                              fontSize: 80
                            }}
                          />

                          <SectionDetails
                            sx={{
                              mt: 1
                            }}
                          >
                            <Trans
                              t={ts}
                              i18nKey='emailCallback.invalidActionCode.details'
                              values={{ email }}
                            />
                          </SectionDetails>
                        </Grid>

                        <SectionForm>
                          <SectionActions>
                            <AuthButton
                              onClick={() => { goToStep(0, 0) }}
                            >
                              {ts('emailCallback.invalidActionCode.previousBtn')}
                            </AuthButton>
                          </SectionActions>
                        </SectionForm>
                      </>
                    ) : (

                      /*
                       * Step 2b - Retype email
                       */

                      showRetypeEmailStep ? (
                        <SectionForm>
                          <SectionFields>
                            <TextInput
                              type='email'
                              name='email2'
                              label={ts('emailCallback.retypeEmail.email2Label')}
                              value={email2}
                              required
                              autoComplete='off'
                              helperText={email2InputHelperText}
                              customError={email2InputCustomError}
                              onChange={onEmail2InputChange}
                              onKeyUp={onEmail2InputKeyUp}
                              onValidityChange={validity => setEmail2InputValidity(validity)}
                            />
                          </SectionFields>
                          <SectionActions>
                            <AuthButton
                              endIcon={<NavigateNextRounded />}
                              disabled={!email2InputValidity.valid}
                              onClick={() => nextStep()}
                            >
                              {ts('emailCallback.retypeEmail.continueBtn')}
                            </AuthButton>
                          </SectionActions>
                        </SectionForm>
                      ) : (
                        <SectionForm>
                          <SectionFields>
                            <Skeleton variant='rounded' height={56} sx={{ mt: .75, mb: 2.875 }} />
                            <Skeleton variant='rounded' height={56} mt={.75} />
                          </SectionFields>
                          <SectionActions>
                            <Skeleton variant='circular' height={40} mt={1} sx={{ borderRadius: '20px' }} />
                          </SectionActions>
                        </SectionForm>
                      )
                    )
                  }
                </Section>
              </swiper-slide>

              {/* 
                * Step 3 - Enter first name / Last name
                */}
              <swiper-slide data-step="name">
                <Section>
                  <SectionForm>
                    <SectionFields>
                      <TextInput
                        name='firstName'
                        label={ts('name.firstNameLabel')}
                        value={firstName}
                        // sx={{ mt: .75 }}
                        required
                        autoComplete='given-name'
                        minLength={firstNameMinLength}
                        helperText={firstNameInputHelperText}
                        onChange={event => setFirstName(event.target.value)}
                        onKeyUp={onFirstNameInputKeyUp}
                        onValidityChange={validity => setFirstNameInputValidity(validity)}
                      />

                      <TextInput
                        name='lastName'
                        label={ts('name.lastNameLabel')}
                        value={lastName}
                        autoComplete='family-name'
                        onChange={event => setLastName(event.target.value)}
                      />
                    </SectionFields>
                    <SectionActions>
                      <AuthButton
                        disabled={!firstNameInputValidity}
                        endIcon={<NavigateNextRounded />}
                        onClick={onStepNameContinueBtnClick}
                      >
                        {ts('name.continueBtn')}
                      </AuthButton>
                    </SectionActions>
                  </SectionForm>
                </Section>
              </swiper-slide>

              {/* 
                * Step 4 - Enter password
                */}
              <swiper-slide data-step="password">
                <Section>
                  <SectionForm>
                    <SectionDetails>{ts('password.details')}</SectionDetails>
                    <SectionFields>
                      <PasswordInput
                        label={ts('password.passwordLabel')}
                        type='password'
                        name='password'
                        value={password}
                        fullWidth
                        required
                        autoComplete='new-password'
                        minLength={passwordMinLength}
                        inputMode='password'
                        error={passwordInputError}
                        onChange={onPasswordInputChange}
                        onKeyUp={onPasswordInputKeyUp}
                      />
                    </SectionFields>

                    <Progress enabled={stepPasswordLoading} />

                    <SectionActions>
                      <AuthButton
                        Component={LoadingButton}
                        loading={stepPasswordLoading}
                        endIcon={<NavigateNextRounded />}
                        disabled={passwordInputError}
                        onClick={onStepPasswordContinueBtnClick}
                      >
                        {ts('password.continueBtn')}
                      </AuthButton>
                    </SectionActions>
                  </SectionForm>
                </Section>
              </swiper-slide>

              {/* 
                * Step 5 - Registration completed
                */}
              <swiper-slide data-step="created">
                <Section>
                  <CheckCircleOutlineRounded
                    sx={{
                      fontSize: 80,
                      mt: 2,
                      mb: 4
                    }}
                    color='success'
                  />
                  <SectionForm>
                    <SectionActions>
                      <AuthButton
                        component={Link}
                        to={continueUrl || defaultContinuetUrl}
                        onClick={onStepCreatedCloseBtnClick}
                      >
                        {ts('created.closeBtn')}
                      </AuthButton>

                      {/* <Link to='/account'>{ts('created.accountLink')}</Link> */}
                    </SectionActions>
                  </SectionForm>
                </Section>
              </swiper-slide>
            </swiper-container>
          </Box>
        </Grid>
      </DialogContent>
    </Dialog>
  )
}
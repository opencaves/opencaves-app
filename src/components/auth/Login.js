import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { useDispatch, useSelector } from 'react-redux'
import { useTranslation } from 'react-i18next'
import { Stack, Typography } from '@mui/material'
import Grid from '@mui/material/Unstable_Grid2'
import { googleProvider } from './providers'
import AuthWithProvider from './AuthWithProvider'
import LoginWithEmail from './LoginWithEmail'
import Or from '../utils/Or'
import { deleteContinueUrl, setContinueUrl } from '@/redux/slices/sessionSlice'
import { ReactComponent as GoogleGLogo } from '@/images/app/auth/google-g-logo.svg'

export default function Login() {
  const navigate = useNavigate()
  const dispatch = useDispatch()
  const continueUrl = useSelector(state => state.session.continueUrl)
  const { t } = useTranslation('auth', { keyPrefix: 'login' })

  function onSuccess() {
    const url = continueUrl ?? '/'
    dispatch(deleteContinueUrl())
    navigate(url)
  }

  return (
    <>
      <Grid
        container
        direction='column'
        alignItems='center'
        m={4}
      >
        <Stack
          spacing={4}
          width={{
            xs: '100%',
            sm: '42ch'
          }}
        >
          <AuthWithProvider message={t('withGoogle')} provider={googleProvider} onSuccess={onSuccess} Logo={GoogleGLogo} />

          <Or><Typography variant='caption'>{t('or')}</Typography></Or>

          <LoginWithEmail />

        </Stack>

        <p>
          <small>
            {t('goToSignup.invite')}
            {' '}
            <NavLink to='/signup' >
              {t('goToSignup.btn')}
            </NavLink>
          </small>
        </p>
      </Grid>
      <Outlet />
    </>
  )
}
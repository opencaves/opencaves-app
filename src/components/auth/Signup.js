import { Link, Outlet, useNavigate } from 'react-router-dom'
import { useDispatch } from 'react-redux'
import { useTranslation } from 'react-i18next'
import { Box, Stack, Typography } from '@mui/material'
import Grid from '@mui/material/Unstable_Grid2'
import { deleteContinueUrl, setContinueUrl } from '@/redux/slices/sessionSlice'
import AuthButton from './AuthButton'
import AuthWithGoogle from './AuthWithGoogle'
import Or from '../utils/Or'
import Logo from '../App/Logo'

export default function Signup() {
  const navigate = useNavigate()
  const dispatch = useDispatch()
  const { t } = useTranslation('auth', { keyPrefix: 'signup' })
  // const { state } = useLocation()

  // if (state && state.continueUrl) {
  //   dispatch(setContinueUrl(state.continueUrl))
  // }

  function onSuccess(continueUrl = '/') {
    dispatch(deleteContinueUrl())
    navigate(continueUrl)
  }

  return (
    <>
      <Grid
        container
        direction='column'
        alignItems='center'
        m={4}
      >

        <Logo
          variant='brand'
          sx={{
            width: '80%',
            maxWidth: '400px',
            my: 12
          }}
        />

        <Stack
          spacing={3}
          width='32ch'
        >
          <AuthWithGoogle onSuccess={onSuccess} />

          <Or><Typography variant='caption'>{t('or')}</Typography></Or>

          <AuthButton variant='contained' component={Link} to='with-email'>{t('withEmail')}</AuthButton>

        </Stack>

        <Box mt={5}>
          <p>
            <small>
              {t('goToLogIn.invite')}
              {' '}
              <Link to='/login' >
                {t('goToLogIn.btn')}
              </Link>
            </small>
          </p>
        </Box>
      </Grid>
      <Outlet />
    </>
  )
}
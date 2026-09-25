import { Link, Outlet, useNavigate } from 'react-router-dom'
import { useSelector } from 'react-redux'
import { useTranslation } from 'react-i18next'
import { Box, Stack, Typography } from '@mui/material'
import { Grid } from '@mui/material'
import AuthButton from './AuthButton.jsx'
import AuthWithGoogle from './AuthWithGoogle.jsx'
import Or from '../utils/Or.jsx'
import Logo from '../App/Logo.jsx'

export default function Signup() {
  const navigate = useNavigate()
  const continueUrl = useSelector((state) => state.session.continueUrl)
  const { t } = useTranslation('auth', { keyPrefix: 'signup' })
  // const { state } = useLocation()

  // if (state && state.continueUrl) {
  //   dispatch(setContinueUrl(state.continueUrl))
  // }

  function onSuccess() {
    const url = continueUrl ?? '/'
    if (url.includes('#')) {
      window.location.href = url
    } else {
      navigate(url)
    }
  }

  return (
    <>
      <Grid className="oc-signup" container direction="column" sx={{ m: 4, alignItems: 'center' }}>
        <Logo
          variant="brand"
          sx={{
            width: '80%',
            maxWidth: '400px',
            my: 12,
          }}
        />

        <Stack spacing={3} sx={{ width: '32ch' }}>
          <AuthWithGoogle onSuccess={onSuccess} />

          <Or>
            <Typography variant="caption">{t('or')}</Typography>
          </Or>

          <AuthButton variant="contained" component={Link} to="with-email">
            {t('withEmail')}
          </AuthButton>
        </Stack>

        <Box sx={{ mt: 5 }}>
          <p>
            <small>
              {t('goToLogIn.invite')} <Link to="/login">{t('goToLogIn.btn')}</Link>
            </small>
          </p>
        </Box>
      </Grid>
      <Outlet />
    </>
  )
}

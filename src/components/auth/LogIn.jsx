import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useSelector } from 'react-redux'
import { useTranslation } from 'react-i18next'
import { Stack, Typography } from '@mui/material'
import { Grid } from '@mui/material'
import LogInWithGoogle from './LogInWithGoogle.jsx'
import LogInWithEmail from './LogInWithEmail.jsx'
import Or from '../utils/Or.jsx'

export default function LogIn() {
  const navigate = useNavigate()
  const continueUrl = useSelector((state) => state.session.continueUrl)
  const { t } = useTranslation('auth', { keyPrefix: 'login' })

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
      <Grid container direction="column" sx={{ m: 4, alignItems: 'center' }}>
        <Stack
          spacing={4}
          sx={{
            width: {
              xs: '100%',
              sm: '42ch',
            },
          }}
        >
          <LogInWithGoogle onSuccess={onSuccess} />

          <Or>
            <Typography variant="caption" sx={{ textTransform: 'uppercase' }}>
              {t('or')}
            </Typography>
          </Or>

          <LogInWithEmail />
        </Stack>

        <p>
          <small>
            {t('goToSignup.invite')} <NavLink to="/signup">{t('goToSignup.btn')}</NavLink>
          </small>
        </p>
      </Grid>
      <Outlet />
    </>
  )
}

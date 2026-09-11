import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { useDispatch, useSelector } from 'react-redux'
import { useTranslation } from 'react-i18next'
import { Stack, Typography } from '@mui/material'
import { Grid } from '@mui/material'
import LogInWithGoogle from './LogInWithGoogle.jsx'
import LogInWithEmail from './LogInWithEmail.jsx'
import Or from '../utils/Or.jsx'
import { deleteContinueUrl, setContinueUrl } from '@/redux/slices/sessionSlice.jsx'

export default function LogIn() {
  const navigate = useNavigate()
  const dispatch = useDispatch()
  const continueUrl = useSelector((state) => state.session.continueUrl)
  const { t } = useTranslation('auth', { keyPrefix: 'login' })

  function onSuccess() {
    const url = continueUrl ?? '/'
    dispatch(deleteContinueUrl())
    navigate(url)
  }

  return (
    <>
      <Grid container direction="column" m={4} sx={{ alignItems: 'center' }}>
        <Stack
          spacing={4}
          width={{
            xs: '100%',
            sm: '42ch',
          }}
        >
          <LogInWithGoogle onSuccess={onSuccess} />

          <Or>
            <Typography variant="caption" textTransform="uppercase">
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

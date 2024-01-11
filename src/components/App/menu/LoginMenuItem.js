
import { useDispatch } from 'react-redux'
import { useTranslation } from 'react-i18next'
import { Link, useLocation } from 'react-router-dom'
import { ListItemIcon } from '@mui/material'
import { PersonRounded } from '@mui/icons-material'
import MenuItem from '@/components/App/MenuItem'
import { setContinueUrl } from '@/redux/slices/sessionSlice'


export default function LoginMenuItem(props) {
  const dispatch = useDispatch()
  const { t } = useTranslation('app', { keyPrefix: 'menu' })
  // const location = useLocation()
  const { location } = window

  function onLoginMenuItemClick() {
    const continueUrl = `${location.pathname}${location.search}${location.hash}`
    dispatch(setContinueUrl(continueUrl))
  }

  return (
    <MenuItem
      key='key-login'
      component={Link}
      to='/login'
      onClick={onLoginMenuItemClick}
      {...props}
    >
      <ListItemIcon>
        <PersonRounded fontSize='small' />
      </ListItemIcon>
      {t('login')}
    </MenuItem>
  )
}

import { Link, useLocation } from 'react-router-dom'
import { useDispatch } from 'react-redux'
import { useTranslation } from 'react-i18next'
import { ListItemIcon } from '@mui/material'
import { PersonAddRounded } from '@mui/icons-material'
import MenuItem from '@/components/App/MenuItem.jsx'
import { setContinueUrl } from '@/redux/slices/sessionSlice.jsx'

export default function SignupMenuItem(props) {
  const { t } = useTranslation('app', { keyPrefix: 'menu' })
  const dispatch = useDispatch()
  const location = useLocation()

  function onSignupBtnClick() {
    dispatch(setContinueUrl(`${location.pathname}${location.search}${location.hash}`))
  }

  return (
    <MenuItem
      component={Link}
      to='/signup'
      onClick={onSignupBtnClick}
      {...props}
    >
      <ListItemIcon>
        <PersonAddRounded fontSize='small' />
      </ListItemIcon>
      {t('signup')}
    </MenuItem>
  )
}

import { Link, useLocation } from 'react-router-dom'
import { useDispatch } from 'react-redux'
import { useTranslation } from 'react-i18next'
import { ListItemIcon } from '@mui/material'
import { PersonAddRounded } from '@mui/icons-material'
import MenuItem from '@/components/App/MenuItem.jsx'
import { buildContinueUrl, setContinueUrl } from '@/redux/slices/sessionSlice.jsx'

export default function SignupMenuItem({ className, ...props }) {
  const { t } = useTranslation('app', { keyPrefix: 'menu' })
  const dispatch = useDispatch()
  const location = useLocation()

  function onSignupBtnClick() {
    if (location.pathname.startsWith('/login') || location.pathname.startsWith('/signup')) {
      return
    }

    dispatch(setContinueUrl(buildContinueUrl(location)))
  }

  return (
    <MenuItem
      component={Link}
      to='/signup'
      onClick={onSignupBtnClick}
      className={`oc-signup-menu-item ${className || ''}`.trim()}
      {...props}
    >
      <ListItemIcon>
        <PersonAddRounded fontSize='small' />
      </ListItemIcon>
      {t('signup')}
    </MenuItem>
  )
}
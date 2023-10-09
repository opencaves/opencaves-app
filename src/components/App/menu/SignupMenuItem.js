
import { Link, useLocation } from 'react-router-dom'
import { useDispatch } from 'react-redux'
import { ListItemIcon } from '@mui/material'
import { PersonAddRounded } from '@mui/icons-material'
import MenuItem from '@/components/App/MenuItem'
import { setContinueUrl } from '@/redux/slices/sessionSlice'
import { useTranslation } from 'react-i18next'

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
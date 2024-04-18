import { signOut } from 'firebase/auth'
import { useTranslation } from 'react-i18next'
import { ListItemIcon } from '@mui/material'
import { LogoutRounded } from '@mui/icons-material'
import { useSnackbar } from '@/components/Snackbar/useSnackbar'
import MenuItem from '../MenuItem'
import Message from '../../Message'
import { auth } from '@/config/firebase'

export default function LogoutMenuItem() {
  const { t } = useTranslation('app', { keyPrefix: 'menu' })
  const [openSnackbar] = useSnackbar()

  function onLogoutMenuItemClick() {
    signOut(auth).then(() => {
      // Sign-out successful.
      openSnackbar(<Message message={t('logoutSuccess')} />)
    }).catch((error) => {
      // An error happened.
      console.error(error)
    })
  }

  return (
    <MenuItem onClick={onLogoutMenuItemClick}>
      <ListItemIcon>
        <LogoutRounded fontSize='small' />
      </ListItemIcon>
      {t('logout')}
    </MenuItem>
  )
}
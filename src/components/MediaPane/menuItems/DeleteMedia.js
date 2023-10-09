import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useSelector } from 'react-redux'
import { MenuItem } from '@mui/material'
import Message from '@/components/App/Message'
import { useSnackbar } from '@/components/Snackbar/useSnackbar'
import { deleteById } from '@/models/CaveAsset'

export default function DeleteMedia({ mediaAsset }) {

  const { t } = useTranslation('mediaPane', { keyPrefix: 'menu' })
  const user = useSelector(state => state.session.user)
  const [openSnackbar] = useSnackbar()
  const [isAdmin, setIsAdmin] = useState(false)

  useEffect(() => {
    async function getIdToken() {
      if (user) {
        const idTokenResult = await user.getIdTokenResult()
        if (idTokenResult.claims.roles && idTokenResult.claims.roles.includes('admin')) {
          setIsAdmin(true)
        }
      }
    }

    getIdToken()
  }, [user])

  async function onDeleteClick() {
    try {

      await deleteById(mediaAsset.id)

      openSnackbar(<Message message={t('deleteSuccess')} />)
    } catch (error) {
      console.error(error)
      openSnackbar(<Message message={t('deleteFail')} type='error' />, { autoHide: false })
    } finally {
      // handleClose()
    }
  }

  return isAdmin && (
    <MenuItem onClick={onDeleteClick}>{t('deleteAction')}</MenuItem>
  )
}
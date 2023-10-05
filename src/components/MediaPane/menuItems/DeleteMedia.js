import { useTranslation } from 'react-i18next'
import { MenuItem } from '@mui/material'
import Message from '@/components/App/Message'
import { useSnackbar } from '@/components/Snackbar/useSnackbar'
import { deleteById } from '@/models/CaveAsset'

export default function DeleteMedia({ mediaAsset }) {

  const { t } = useTranslation('mediaPane', { keyPrefix: 'menu' })
  const [openSnackbar] = useSnackbar()

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

  return (
    <MenuItem onClick={onDeleteClick}>{t('deleteAction')}</MenuItem>
  )
}
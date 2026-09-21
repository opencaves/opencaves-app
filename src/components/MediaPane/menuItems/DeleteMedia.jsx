import { forwardRef } from 'react'
import { useTranslation } from 'react-i18next'
import { MenuItem } from '@mui/material'
import Message from '@/components/Message.jsx'
import { useSnackbar } from '@/components/Snackbar/useSnackbar.jsx'
import useRoles from '@/hooks/useRoles.jsx'
import { noopAsync } from '@/utils/noop.jsx'
import { deleteById } from '@/models/CaveAsset.js'

export function useDeleteMedia() {
  return useRoles('admin')
}

// export default function DeleteMedia({ mediaAsset, onBeforeDelete = noopAsync }) {
export default forwardRef(function DeleteMedia({ mediaAsset, onBeforeDelete = noopAsync }, ref) {

  const { t } = useTranslation('mediaPane', { keyPrefix: 'menu' })
  const isAdmin = useDeleteMedia()
  const [openSnackbar] = useSnackbar()

  async function onDeleteClick() {
    try {

      await onBeforeDelete()

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
    <MenuItem ref={ref} onClick={onDeleteClick}>{t('deleteAction')}</MenuItem>
  )
})
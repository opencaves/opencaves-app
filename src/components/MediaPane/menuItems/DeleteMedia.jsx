import { forwardRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Button, Dialog, DialogActions, DialogContent, DialogContentText, DialogTitle, ListItemIcon, ListItemText, MenuItem } from '@mui/material'
import DeleteOutlineRounded from '@mui/icons-material/DeleteOutlineRounded'
import Message from '@/components/Message.jsx'
import { useSnackbar } from '@/components/Snackbar/useSnackbar.jsx'
import useRoles from '@/hooks/useRoles.jsx'
import { noopAsync } from '@/utils/noop.jsx'
import { deleteById } from '@/models/CaveAsset.js'

// Deleting a photo: admins only.
export function useDeleteMedia() {
  return useRoles('admin')
}

// The confirmation before a photo is deleted (it and its thumbnails, for
// good). Its dialog is rendered by the menu's owner, outside the menu: a
// menu's items unmount when it closes. onBeforeDelete(mediaAsset) runs
// first (e.g. moving the viewer to the next photo).
export function useDeleteMediaConfirm({ onBeforeDelete = noopAsync } = {}) {
  const { t } = useTranslation('mediaPane', { keyPrefix: 'menu' })
  const [openSnackbar] = useSnackbar()
  const [pending, setPending] = useState(null)
  const [deleting, setDeleting] = useState(false)

  async function confirm() {
    const mediaAsset = pending
    setDeleting(true)
    try {
      await onBeforeDelete(mediaAsset)
      await deleteById(mediaAsset.id)
      openSnackbar(t('deleteSuccess'), { severity: 'success' })
    } catch (error) {
      console.error(error)
      openSnackbar(<Message message={t('deleteFail')} type="error" />, { autoHide: false })
    } finally {
      setDeleting(false)
      setPending(null)
    }
  }

  const dialog = (
    <Dialog className="oc-delete-media-dialog" open={Boolean(pending)} onClose={() => !deleting && setPending(null)}>
      <DialogTitle>{t('deleteConfirmTitle')}</DialogTitle>
      <DialogContent>
        <DialogContentText>{t('deleteConfirm')}</DialogContentText>
      </DialogContent>
      <DialogActions>
        <Button onClick={() => setPending(null)} disabled={deleting}>
          {t('deleteCancel')}
        </Button>
        <Button color="error" onClick={confirm} disabled={deleting}>
          {t('deleteAction')}
        </Button>
      </DialogActions>
    </Dialog>
  )

  return { requestDelete: setPending, dialog }
}

// The menu item: asks for the deletion (onClick), shown to admins only.
export default forwardRef(function DeleteMedia({ onClick }, ref) {
  const { t } = useTranslation('mediaPane', { keyPrefix: 'menu' })
  const isAdmin = useDeleteMedia()

  return isAdmin && (
    <MenuItem ref={ref} className="oc-delete-media" onClick={onClick} sx={{ color: 'error.main' }}>
      <ListItemIcon sx={{ color: 'inherit' }}>
        <DeleteOutlineRounded fontSize="small" />
      </ListItemIcon>
      <ListItemText>{t('deleteAction')}</ListItemText>
    </MenuItem>
  )
})

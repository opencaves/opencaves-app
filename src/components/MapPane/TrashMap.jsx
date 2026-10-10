import { useState } from 'react'
import { useSelector } from 'react-redux'
import { useTranslation } from 'react-i18next'
import { Button, Dialog, DialogActions, DialogContent, DialogContentText, DialogTitle } from '@mui/material'
import DialogCloseButton from '@/components/DialogCloseButton.jsx'
import Message from '@/components/Message.jsx'
import { useSnackbar } from '@/components/Snackbar/useSnackbar.jsx'
import mapsModel from '@/models/MapModel.js'
import { noopAsync } from '@/utils/noop.js'

/**
 * Deleting a map itself (not removing it from a sistema): admins only, as
 * deleting it was in firestore.rules.
 *
 * @returns {boolean}
 */
export function useCanTrashMaps() {
  return useSelector((/** @type {RootState} */ state) => state.session.roles.includes('admin'))
}

/**
 * The confirmation before a map goes to the trash - out of every sistema
 * that shows it, until an admin restores it (Audits > Trash). The owner
 * renders `dialog`.
 *
 * @param {object} [options]
 * @param {(map: CaveMap) => Promise} [options.onAfterTrash] - Runs once it's done (e.g. moving the
 *   viewer on to another map).
 * @returns {{requestTrash: (map: CaveMap) => void, dialog: React.ReactNode}}
 */
export function useTrashMapConfirm({ onAfterTrash = noopAsync } = {}) {
  const { t } = useTranslation('resultPane', { keyPrefix: 'edit' })
  const [openSnackbar] = useSnackbar()
  const [pending, setPending] = useState(null)
  const [trashing, setTrashing] = useState(false)

  function close() {
    if (!trashing) setPending(null)
  }

  async function confirm() {
    const map = pending
    setTrashing(true)
    try {
      await mapsModel.moveToTrash(map.id)
      openSnackbar(t('trashMapSuccess'), { severity: 'success' })
      await onAfterTrash(map)
    } catch (error) {
      console.error(error)
      openSnackbar(<Message message={t('trashMapError')} type="error" />, { autoHide: false })
    } finally {
      setTrashing(false)
      setPending(null)
    }
  }

  const dialog = (
    <Dialog className="oc-trash-map-dialog" open={Boolean(pending)} onClose={close}>
      <DialogTitle sx={{ pr: 7 }}>{t('trashMapTitle')}</DialogTitle>
      <DialogCloseButton onClick={close} disabled={trashing} />
      <DialogContent>
        <DialogContentText>{t('trashMapConfirm', { name: pending?.name || '' })}</DialogContentText>
      </DialogContent>
      <DialogActions>
        <Button onClick={close} disabled={trashing}>
          {t('cancel')}
        </Button>
        <Button color="error" onClick={confirm} disabled={trashing}>
          {t('trashMap')}
        </Button>
      </DialogActions>
    </Dialog>
  )

  return { requestTrash: setPending, dialog }
}

import { useTranslation } from 'react-i18next'
import { MenuItem } from '@mui/material'
import { useSnackbar } from '@/components/Snackbar/useSnackbar'
import useRoles from '@/hooks/useRoles'
import noop from '@/utils/noop'

export function useUseAsCoverImage() {
  return useRoles('editor')
}

export default function UseAsCoverImage({ mediaAsset, onClick = noop }) {

  const { t } = useTranslation('mediaPane', { keyPrefix: 'menu' })
  const isEditor = useUseAsCoverImage()
  const [openSnackbar] = useSnackbar()

  async function onSetAsCoverImageClick() {
    try {

      onClick()

      await mediaAsset.setAsCoverImage()

      openSnackbar(t('useAsCoverSuccess'))

    } catch (error) {
      console.error(error)
      openSnackbar(t('useAsCoverFail'), { autoHide: false, hideOnClickAway: true })
    } finally {
      // handleClose()
    }
  }

  return isEditor && (
    <MenuItem onClick={onSetAsCoverImageClick} disabled={mediaAsset.isCover}>{t('useAsCoverImage')}</MenuItem>
  )
}
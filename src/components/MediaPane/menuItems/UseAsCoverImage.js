import { useTranslation } from 'react-i18next'
import { MenuItem } from '@mui/material'
import { useSnackbar } from '@/components/Snackbar/useSnackbar'
import useRoles from '@/hooks/useRoles'

export function useUseAsCoverImage() {
  return useRoles('editor')
}

export default function UseAsCoverImage({ mediaAsset }) {

  const { t } = useTranslation('mediaPane', { keyPrefix: 'menu' })
  const isEditor = useUseAsCoverImage()
  const [openSnackbar] = useSnackbar()

  async function onUseAsCoverImageClick() {
    try {

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
    <MenuItem onClick={onUseAsCoverImageClick} disabled={mediaAsset.isCover}>{t('useAsCoverImage')}</MenuItem>
  )
}
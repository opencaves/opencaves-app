import { useTranslation } from 'react-i18next'
import { MenuItem } from '@mui/material'
import { useSnackbar } from '@/components/Snackbar/useSnackbar'

export default function UseAsCoverImage({ mediaAsset }) {

  const { t } = useTranslation('mediaPane', { keyPrefix: 'menu' })
  const [openSnackbar] = useSnackbar()

  async function onUseAsCoverImageClick() {
    try {

      await mediaAsset.setAsCoverImage()

      openSnackbar(t('useAsCoverSuccess'))

    } catch (error) {
      console.error(error)
      openSnackbar(t('useAsCoverFail'))
    } finally {
      // handleClose()
    }
  }

  return (
    <MenuItem onClick={onUseAsCoverImageClick} disabled={mediaAsset.isCover}>{t('useAsCoverImage')}</MenuItem>
  )
}
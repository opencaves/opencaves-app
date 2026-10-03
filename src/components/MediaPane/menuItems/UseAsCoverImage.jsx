import { useTranslation } from 'react-i18next'
import { ListItemIcon, ListItemText, MenuItem } from '@mui/material'
import WallpaperRounded from '@mui/icons-material/WallpaperRounded'
import { useSnackbar } from '@/components/Snackbar/useSnackbar.jsx'
import useRoles from '@/hooks/useRoles.jsx'
import noop from '@/utils/noop.js'

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

      openSnackbar(t('useAsCoverSuccess'), { severity: 'success' })

    } catch (error) {
      console.error(error)
      openSnackbar(t('useAsCoverFail'), { autoHide: false, hideOnClickAway: true })
    } finally {
      // handleClose()
    }
  }

  return isEditor && (
    <MenuItem className="oc-use-as-cover-image" onClick={onSetAsCoverImageClick} disabled={mediaAsset.isCover}>
      <ListItemIcon>
        <WallpaperRounded fontSize="small" />
      </ListItemIcon>
      <ListItemText>{t('useAsCoverImage')}</ListItemText>
    </MenuItem>
  )
}
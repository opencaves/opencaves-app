import { useTranslation } from 'react-i18next'
import { ListItemIcon, ListItemText, MenuItem } from '@mui/material'
import WallpaperRounded from '@mui/icons-material/WallpaperRounded'
import CropFreeRounded from '@mui/icons-material/CropFreeRounded'
import { useSnackbar } from '@/components/Snackbar/useSnackbar.jsx'
import { capturePanoramaView } from '@/components/MediaViewer/panoramaViews.js'
import useRoles from '@/hooks/useRoles.jsx'
import noop from '@/utils/noop.js'

/**
 * Whether the user can choose a photo's use as the cover: editors.
 *
 * @returns {boolean}
 */
export function useUseAsCoverImage() {
  return useRoles('editor')
}

// A panorama's thumbnails made from the view its viewer shows now.
async function takeViewAsThumbnail(mediaAsset) {
  const capture = await capturePanoramaView(mediaAsset.id)
  if (!capture) throw new Error('No panorama view to capture')
  await mediaAsset.setViewThumbnail(capture)
}

export default function UseAsCoverImage({ mediaAsset, onClick = noop }) {

  const { t } = useTranslation('mediaPane', { keyPrefix: 'menu' })
  const isEditor = useUseAsCoverImage()
  const [openSnackbar] = useSnackbar()

  async function onSetAsCoverImageClick() {
    try {

      onClick()

      // A panorama's cover shows the view on screen, not the flattened sphere.
      if (mediaAsset.usePanoramaViewer) {
        await takeViewAsThumbnail(mediaAsset)
      }
      await mediaAsset.setAsCoverImage()

      openSnackbar(t('useAsCoverSuccess'), { severity: 'success' })

    } catch (error) {
      console.error(error)
      openSnackbar(t('useAsCoverFail'), { autoHide: false, hideOnClickAway: true })
    }
  }

  return isEditor && (
    <MenuItem className="oc-use-as-cover-image" onClick={onSetAsCoverImageClick} disabled={mediaAsset.isCover}>
      <ListItemIcon>
        <WallpaperRounded fontSize="small" />
      </ListItemIcon>
      {/* Greyed on the cover itself: it says so. */}
      <ListItemText>{mediaAsset.isCover ? t('isCoverImage') : t('useAsCoverImage')}</ListItemText>
    </MenuItem>
  )
}

/**
 * A panorama: its thumbnails retaken from the view on screen.
 */
export function UseViewAsThumbnail({ mediaAsset, onClick = noop }) {

  const { t } = useTranslation('mediaPane', { keyPrefix: 'menu' })
  const isEditor = useUseAsCoverImage()
  const [openSnackbar] = useSnackbar()

  async function onUseViewClick() {
    try {
      onClick()
      await takeViewAsThumbnail(mediaAsset)
      openSnackbar(t('useViewAsThumbnailSuccess'), { severity: 'success' })
    } catch (error) {
      console.error(error)
      openSnackbar(t('useViewAsThumbnailFail'), { autoHide: false, hideOnClickAway: true })
    }
  }

  return isEditor && mediaAsset.usePanoramaViewer && (
    <MenuItem className="oc-use-view-as-thumbnail" onClick={onUseViewClick}>
      <ListItemIcon>
        <CropFreeRounded fontSize="small" />
      </ListItemIcon>
      <ListItemText>{t('useViewAsThumbnail')}</ListItemText>
    </MenuItem>
  )
}

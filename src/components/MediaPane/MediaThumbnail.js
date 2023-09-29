import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { collection, doc, getDocs, query, serverTimestamp, updateDoc, where } from 'firebase/firestore'
import { getDownloadURL, ref } from 'firebase/storage'
import { Box, ButtonBase, IconButton, Menu, MenuItem, useTheme } from '@mui/material'
import { MoreVert } from '@mui/icons-material'
import Message from '@/components/App/Message'
import { useSnackbar } from '@/components/Snackbar/useSnackbar'
import { deleteById, getImageAssetUrl } from '@/models/CaveAsset'
import { paneWidth } from '@/config/app'
import { db, storage } from '@/config/firebase'
import { mediaThumbnailMinHeight } from '@/config/mediaPane'
import { Link } from 'react-router-dom'

const drawerWidth = paneWidth
const mediaItemPadding = 12

function getMediaThumbnailSize(asset) {
  const containedWidth = drawerWidth - (mediaItemPadding * 2)
  const height = Math.round(Math.max(mediaThumbnailMinHeight, asset.height * (containedWidth / asset.width)))
  const width = Math.round((height / asset.height) * asset.width)
  return {
    width,
    height
  }
}

export default function MediaThumbnail({ mediaAsset, ...props }) {

  const theme = useTheme()
  const { t } = useTranslation('mediaPane', { keyPrefix: 'mediaThumbnailItem' })
  const [anchorEl, setAnchorEl] = useState(null)
  const [downloadUrl, setDownloadUrl] = useState(null)
  const [openSnackbar] = useSnackbar()

  const open = Boolean(anchorEl)
  const cavesAssetsColl = collection(db, 'cavesAssets')

  const mediaThumbnailSize = getMediaThumbnailSize(mediaAsset)
  // console.log('mediaThumbnailSize: %o', mediaThumbnailSize)
  // const imageUrl = getImageAssetUrl(mediaAsset.fullPath, mediaThumbnailSize, 50)
  const imageUrl = mediaAsset.url
  const mediaThumbnailItemId = `media-thumbnail-item-${mediaAsset.id}`

  function handleClick(event) {
    setAnchorEl(event.currentTarget)
  }

  function handleClose() {
    setAnchorEl(null)
  }

  async function onUseAsCoverImageClick() {
    try {

      await mediaAsset.setAsCoverImage()

      // const q = query(cavesAssetsColl, where('caveId', '==', mediaAsset.caveId), where('type', '==', 'image'), where('isCover', '==', true))
      // const querySnapshot = await getDocs(q)

      // for (const doc of querySnapshot.docs) {
      //   await updateDoc(doc.ref, {
      //     isCover: false,
      //     updated: serverTimestamp()
      //   })
      // }

      // const docRef = doc(db, 'cavesAssets', mediaAsset.id)
      // await updateDoc(docRef, {
      //   isCover: true,
      //   updated: serverTimestamp()
      // })

      openSnackbar(t('useAsCoverSuccess'))

    } catch (error) {
      console.error(error)
      openSnackbar(t('useAsCoverFail'))
    } finally {
      handleClose()
    }
  }

  async function onDeleteClick() {
    try {

      await deleteById(mediaAsset.id)

      openSnackbar(<Message message={t('deleteSuccess')} />)
    } catch (error) {
      console.error(error)
      openSnackbar(<Message message={t('deleteFail')} type='error' />, { autoHide: false })
    } finally {
      handleClose()
    }
  }

  useEffect(() => {
    getDownloadURL(ref(storage, mediaAsset.fullPath)).then(url => setDownloadUrl(url))
  }, [mediaAsset])

  return (
    <Box
      {...props}
      sx={{
        '--_menu-opacity': 0,
        '--_menu-transition-duration': 'var(--md-transition-duration-complex)',
        '--_menu-transition-delay': '.5s',
        px: `${mediaItemPadding}px`,
        '&:hover': {
          '--_menu-opacity': 1,
          '--_menu-transition-duration': 'var(--md-transition-duration-shortest)',
          '--_menu-transition-delay': '0s',
        }
      }}
    >
      <Box
        sx={{
          position: 'relative',
        }}
      >
        <ButtonBase
          component={Link}
          to={mediaAsset.id}
          aria-label={t('openBtn.ariaLabel')}
        >
          <img src={imageUrl} style={{ width: '100%', height: 'auto', minHeight: mediaThumbnailMinHeight, objectFit: 'cover', marginBottom: '4px', borderRadius: '0.5rem' }} alt='' /></ButtonBase>
        <Box
          position='absolute'
          left={0}
          right={0}
          top={0}
          display='flex'
          flexDirection={theme.direction === 'ltr' ? 'row-reverse' : 'row'}
          px='8px'
          pt='8px'
          sx={{
            opacity: 'var(--_menu-opacity)',
            backgroundImage: 'linear-gradient(0deg,rgba(0,0,0,0),rgba(0,0,0,.4))',
            transition: 'opacity var(--_menu-transition-duration) linear var(--_menu-transition-delay)'
          }}
        >
          <IconButton
            aria-label="more"
            id="long-button"
            aria-controls={open ? mediaThumbnailItemId : undefined}
            aria-expanded={open ? 'true' : undefined}
            aria-haspopup="true"
            onClick={handleClick}
            sx={{
              color: '#fff'
            }}
          >
            <MoreVert />
          </IconButton>
          <Menu
            id={mediaThumbnailItemId}
            MenuListProps={{
              'aria-labelledby': 'long-button',
            }}
            anchorOrigin={{
              vertical: 'bottom',
              horizontal: theme.direction === 'ltr' ? 'right' : 'left'
            }}
            transformOrigin={{
              vertical: 'top',
              horizontal: theme.direction === 'ltr' ? 'right' : 'left'
            }}
            anchorEl={anchorEl}
            open={open}
            onClose={handleClose}
          >
            <MenuItem onClick={onUseAsCoverImageClick} disabled={mediaAsset.isCover}>{t('useAsCoverAction')}</MenuItem>
            <MenuItem component='a' href={downloadUrl} target='_blank' sx={{ '&:hover': { color: 'unset' } }}>{t('viewOriginalImageAction')}</MenuItem>
            <MenuItem onClick={onDeleteClick}>{t('deleteAction')}</MenuItem>
          </Menu>
        </Box>
      </Box>
    </Box>
  )
}
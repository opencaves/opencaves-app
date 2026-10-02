import { Link, useLoaderData, useNavigate, useParams } from 'react-router-dom'
import { useEffect, useRef, useState } from 'react'
import { useSelector } from 'react-redux'
import { useTranslation } from 'react-i18next'
import { Box, Drawer, IconButton, Typography, styled, useTheme } from '@mui/material'
import { AddAPhotoOutlined, ArrowBackRounded, ArrowForwardRounded } from '@mui/icons-material'
import { getAssetList, useCaveAssetsList } from '@/models/CaveAsset.js'
import AddMediasButton from '@/components/MediaPane/AddMediasButton.jsx'
import MediaPaneDetails from '@/components/MediaPane/MediaPaneDetails.jsx'
import MediaList from '@/components/MediaPane/MediaList.jsx'
import Dropzone from '@/components/AddMedias/Dropzone.jsx'
import usePaneWidth from '@/hooks/usePaneWidth'
import { useSmall } from '@/hooks/useSmall.jsx'

const DrawerHeader = styled('div')(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  padding: theme.spacing(0, 1),
  borderBottom: `1px solid ${theme.palette.divider}`,
  // necessary for content to be below app bar
  ...theme.mixins.toolbar
}))

export async function mediaPaneLoader({ params }) {
  return getAssetList(params.caveId)
}

export default function MediaPane() {
  const params = useParams()
  const isSmall = useSmall()
  const theme = useTheme()
  const { t } = useTranslation('mediaPane')
  const mediaPaneRef = useRef(null)
  const paneWidth = usePaneWidth()
  const { caveId, mediaId } = useParams()
  const currentCave = useSelector(state => state.map.currentCave)
  const [mediaListSnapshot, loading, error] = useCaveAssetsList(caveId)
  const initialMediaList = useLoaderData()
  const navigate = useNavigate()
  const [dropzoneOpen, setDropzoneOpen] = useState(false)
  const counter = useRef(0)

  function onMediaPaneDragEnter(event) {
    event.preventDefault()
    counter.current = counter.current + 1
    setDropzoneOpen(true)
  }

  function onMediaPaneDragLeave() {
    counter.current = counter.current - 1
    // console.log('[dragLeave] %s', counter.current)
    if (counter.current === 0) {
      setDropzoneOpen(false)
    }
  }

  function onDropzoneDrop() {
    counter.current = 0
    setDropzoneOpen(false)
  }

  useEffect(() => {
    // Default display to the first media
    if (!initialMediaList.empty && !params.mediaId) {
      const assetId = initialMediaList.docs[0].data().id
      navigate(assetId, { replace: true })
    }

    if (initialMediaList.empty) {
      navigate('..', { replace: true })
    }

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mediaId])

  function onBeforeDeleteMedia(item, isActive) {
    if (isActive) {
      const index = mediaListSnapshot.docs.findIndex(docSnap => docSnap.id === item.id)

      if (mediaListSnapshot.size === 1) {
        return
      }

      const nextItemIndex = index < mediaListSnapshot.size - 1 ? index + 1 : index - 1
      const nextItemId = mediaListSnapshot.docs[nextItemIndex].id
      navigate(`../${nextItemId}`, { replace: true, relative: 'path' })
    }
  }

  return isSmall ? (
    <Box
      ref={mediaPaneRef}
      className="oc-media-pane"
      sx={{
        display: 'flex',
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
      }}
    >
      {
        mediaId && mediaListSnapshot && !mediaListSnapshot.empty && (
          <MediaPaneDetails mediaId={mediaId} medias={mediaListSnapshot} onBeforeDelete={onBeforeDeleteMedia} />
        )
      }
    </Box>
  ) : (
    <Box
      ref={mediaPaneRef}
      className="oc-media-pane"
      sx={{
        display: 'flex',
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
      }}
      onDragEnter={onMediaPaneDragEnter}
      onDragLeave={onMediaPaneDragLeave}
    >
      <Drawer
        className="oc-media-pane--drawer"
        sx={{
          width: paneWidth,
          flexShrink: 0,
          '& > .MuiDrawer-paper': {
            width: paneWidth,
            boxSizing: 'border-box',
            border: 0,
            overflow: 'hidden',
          },
        }}
        variant="persistent"
        anchor="left"
        open={true}
      >
        <DrawerHeader className="oc-media-pane--header">
          <IconButton
            aria-label={t('backBtn.ariaLabel')}
            component={Link}
            to='..'
            disableRipple
          >
            {theme.direction === 'ltr' ? <ArrowBackRounded /> : <ArrowForwardRounded />}
          </IconButton>

          <Typography
            variant='fontTitleLarge'
            sx={{
              flexGrow: 1,
              textAlign: 'center',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap'
            }}
          >
            {t('header', { name: currentCave.name?.value || t('caveNameUnknown', { ns: 'map' }) })}
          </Typography>

          <AddMediasButton
            component={
              <IconButton
                color='primary'
              >
                <AddAPhotoOutlined />
              </IconButton>
            }
          />

        </DrawerHeader>

        <Box
          sx={{
            mt: 'var(--oc-pane-padding-block)',
            height: '100%'
          }}
        >
          <MediaList />
        </Box>
      </Drawer>
      {
        mediaId && mediaListSnapshot && !mediaListSnapshot.empty && (
          <MediaPaneDetails mediaId={mediaId} medias={mediaListSnapshot} onBeforeDelete={onBeforeDeleteMedia} />
        )
      }
      <Dropzone open={dropzoneOpen} onDrop={onDropzoneDrop} />
    </Box>
  )
}
import { Link, useLoaderData, useNavigate, useParams } from 'react-router-dom'
import { useSelector } from 'react-redux'
import { useTranslation } from 'react-i18next'
import { Box, Divider, Drawer, IconButton, Typography, styled, useTheme } from '@mui/material'
import Grid from '@mui/material/Unstable_Grid2'
import { AddAPhotoOutlined, ArrowBackRounded, ArrowForwardRounded } from '@mui/icons-material'
import { getAssetList, useCaveAssetsList } from '@/models/CaveAsset'
import AddMediasButton from '@/components/MediaPane/AddMediasButton'
import MediaPaneDetails from '@/components/MediaPane/MediaPaneDetails'
import MediaList from '@/components/MediaPane/MediaList'
import Dropzone from '@/components/AddMedias/Dropzone'
import usePaneWidth from '@/hooks/usePaneWidth'
import { useEffect, useRef, useState } from 'react'

const DrawerHeader = styled('div')(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  padding: theme.spacing(0, 1),
  borderBottom: `1px solid ${theme.palette.divider}`,
  // necessary for content to be below app bar
  ...theme.mixins.toolbar
}))

export async function mediaPaneLoader({ params }) {
  console.log('--- mediaPaneLoader --- %s', params.caveId)
  return getAssetList(params.caveId)
}

export default function MediaPane() {
  const params = useParams()
  const theme = useTheme()
  const { t } = useTranslation('mediaPane')
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
    console.log('[dragEnter] %s', counter.current)
    setDropzoneOpen(true)
  }

  function onMediaPaneDragLeave() {
    counter.current = counter.current - 1
    // console.log('[dragLeave] %s', counter.current)
    if (counter.current === 0) {
      console.log('[dragLeave] ====================== %s', counter.current)
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

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mediaId])

  return (
    <Box
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
        <DrawerHeader>
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
            flexGrow={1}
            textAlign='center'
            sx={{
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap'
            }}
          >
            {t('header', { name: currentCave.name.value })}
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
          <MediaPaneDetails mediaId={mediaId} medias={mediaListSnapshot} />
        )
      }
      <Dropzone open={dropzoneOpen} onDrop={onDropzoneDrop} />
    </Box>
  )
}
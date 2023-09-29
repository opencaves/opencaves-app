import { Link, Outlet, useParams } from 'react-router-dom'
import { useSelector } from 'react-redux'
import { useTranslation } from 'react-i18next'
// import Scrollbars from 'react-custom-scrollbars-2'
import { Box, Divider, Drawer, IconButton, Skeleton, Typography, styled, useTheme } from '@mui/material'
import Grid from '@mui/material/Unstable_Grid2'
import { AddAPhotoOutlined, ArrowBackRounded, ArrowForwardRounded } from '@mui/icons-material'
import { useCaveAssetsList } from '@/models/CaveAsset'
import Scrollbars from '@/components/Scrollbars/Scrollbars'
import MediaListEmpty from '@/components/MediaPane/MediaListEmpty'
import MediaThumbnail from '@/components/MediaPane/MediaThumbnail'
import AddMediasButton from '@/components/MediaPane/AddMediasButton'
import MediaPaneDetails from '@/components/MediaPane/MediaPaneDetails'
import usePaneWidth from '@/hooks/usePaneWidth'

const drawerWidth = 400
const mediaItemPadding = 12

function getImageWidth() {
  return drawerWidth - (mediaItemPadding * 2)
}

const DrawerHeader = styled('div')(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  padding: theme.spacing(0, 1),
  // necessary for content to be below app bar
  ...theme.mixins.toolbar
}))

export default function MediaPane() {
  const theme = useTheme()
  const { t } = useTranslation('mediaPane')
  const paneWidth = usePaneWidth()
  const { caveId, mediaId } = useParams()
  const currentCave = useSelector(state => state.map.currentCave)
  const isLoggedIn = useSelector(state => state.session.isLoggedIn)
  const [value, loading, error] = useCaveAssetsList(caveId)

  const imageWidth = getImageWidth()

  return (
    <>
      <Box
        sx={{
          display: 'flex',
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
        }}
      >
        <Drawer
          sx={{
            width: paneWidth,
            flexShrink: 0,
            '& > .MuiDrawer-paper': {
              width: paneWidth,
              boxSizing: 'border-box',
              border: 0,
              overflow: 'hidden'
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
          <Grid>
            <Scrollbars
              autoHide
              autoHeight
              autoHeightMax='100vh'
            >
              <Divider />
              {error && <div><strong>Error: {JSON.stringify(error)}</strong></div>}

              {loading && Array.from(Array(6)).map((_, i) => (
                <Box
                  key={i}
                  sx={{
                    px: `${mediaItemPadding}px`,
                    pb: `${mediaItemPadding}px`,
                  }}
                >
                  <Skeleton variant='rectangular' width={imageWidth} height={imageWidth * .5625} />
                </Box>
              )
              )}

              {
                value && (
                  value.docs.length === 0 ? (
                    <MediaListEmpty />
                  ) : (
                    value.docs.map(doc => {
                      const mediaAsset = doc.data()

                      return (
                        <MediaThumbnail key={mediaAsset.id} mediaAsset={mediaAsset} />
                      )
                    })
                  )
                )
              }
            </Scrollbars>
          </Grid>
        </Drawer>
        {
          mediaId && (
            <MediaPaneDetails mediaId={mediaId} />
          )
        }
      </Box>
    </>
  )
}
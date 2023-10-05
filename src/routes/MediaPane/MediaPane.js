import { Link, useLoaderData, useNavigate, useParams } from 'react-router-dom'
import { useSelector } from 'react-redux'
import { useTranslation } from 'react-i18next'
import { Box, Divider, Drawer, IconButton, Skeleton, Typography, styled, useTheme } from '@mui/material'
import Grid from '@mui/material/Unstable_Grid2'
import { AddAPhotoOutlined, ArrowBackRounded, ArrowForwardRounded } from '@mui/icons-material'
import { getAssetList, useCaveAssetsList } from '@/models/CaveAsset'
import AddMediasButton from '@/components/MediaPane/AddMediasButton'
import MediaPaneDetails from '@/components/MediaPane/MediaPaneDetails'
import MediaList from '@/components/MediaPane/MediaList'
import usePaneWidth from '@/hooks/usePaneWidth'

const drawerWidth = 400
const mediaItemPadding = 12

const DrawerHeader = styled('div')(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  padding: theme.spacing(0, 1),
  // necessary for content to be below app bar
  ...theme.mixins.toolbar
}))

export async function mediaPaneLoader({ params }) {
  return getAssetList(params.caveId)
}

export default function MediaPane() {
  const theme = useTheme()
  const { t } = useTranslation('mediaPane')
  const paneWidth = usePaneWidth()
  const { caveId, mediaId } = useParams()
  const currentCave = useSelector(state => state.map.currentCave)
  const [mediaListSnapshot, loading, error] = useCaveAssetsList(caveId)
  const initialMediaList = useLoaderData()
  const navigate = useNavigate()

  console.log('initialMediaList: %o, mediaId: %o', initialMediaList, mediaId)

  if (!mediaId && !initialMediaList.empty) {
    const assetId = initialMediaList.docs[0].data().id
    return navigate(assetId, { replace: true })
  }

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

        <Divider />

        <Grid
          sx={{
            mt: 'var(--oc-pane-padding-block)'
          }}
        >
          <MediaList />
        </Grid>
      </Drawer>
      {
        mediaId && mediaListSnapshot && !mediaListSnapshot.empty && (
          <MediaPaneDetails mediaId={mediaId} medias={mediaListSnapshot} />
        )
      }
    </Box>
  )
}
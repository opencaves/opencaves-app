import { Link, Outlet, useParams } from 'react-router-dom'
import { useSelector } from 'react-redux'
import { useTranslation } from 'react-i18next'
// import Scrollbars from 'react-custom-scrollbars-2'
import { Box, Divider, Skeleton, Typography, styled, useTheme } from '@mui/material'
import Grid from '@mui/material/Unstable_Grid2'
import { useCaveAssetsList } from '@/models/CaveAsset'
import Scrollbars from '@/components/Scrollbars/Scrollbars'
import MediaListEmpty from './MediaListEmpty'
import MediaThumbnail from './MediaThumbnail'

const drawerWidth = 400
const mediaItemPadding = 12

function getImageWidth() {
  return drawerWidth - (mediaItemPadding * 2)
}

export default function MediaList() {
  const { t } = useTranslation('mediaPane')
  const { caveId, mediaId } = useParams()
  const currentCave = useSelector(state => state.map.currentCave)
  const isLoggedIn = useSelector(state => state.session.isLoggedIn)
  const [mediaListSnapshot, loading, error] = useCaveAssetsList(caveId)
  console.log('mediaListSnapshot: %o', mediaListSnapshot)
  const imageWidth = getImageWidth()

  return (
    <Grid>
      <Scrollbars
        autoHide
        autoHeight
        autoHeightMax='100vh'
      >

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
          mediaListSnapshot && (
            mediaListSnapshot.docs.length === 0 ? (
              <MediaListEmpty />
            ) : (
              mediaListSnapshot.docs.map(doc => {
                const mediaAsset = doc.data()
                const isActive = mediaAsset.id === mediaId

                return (
                  <MediaThumbnail key={mediaAsset.id} mediaAsset={mediaAsset} isActive={isActive} />
                )
              })
            )
          )
        }
      </Scrollbars>
    </Grid>
  )
}
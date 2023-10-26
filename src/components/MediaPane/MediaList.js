import { useParams } from 'react-router-dom'
import { useSelector } from 'react-redux'
import { useTranslation } from 'react-i18next'
import { Box, Skeleton } from '@mui/material'
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
  const [mediaListSnapshot, loading, error] = useCaveAssetsList(caveId)
  console.log('mediaListSnapshot: %o', mediaListSnapshot)
  const imageWidth = getImageWidth()

  return (
    <Scrollbars
      autoHide
      style={{
        width: '100%',
        height: '100%'
      }}
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
          <Skeleton variant='rounded' width={imageWidth} height={imageWidth * .5625} sx={{
            borderRadius: '0.5rem',
          }} />
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
  )
}
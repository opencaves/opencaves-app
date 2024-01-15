import { useNavigate, useParams } from 'react-router-dom'
import { Box, Collapse, Skeleton, useTheme } from '@mui/material'
import { useCaveAssetsList } from '@/models/CaveAsset'
import Scrollbars from '@/components/Scrollbars/Scrollbars'
import MediaListEmpty from './MediaListEmpty'
import MediaThumbnail from './MediaThumbnail'
import { TransitionGroup } from 'react-transition-group'

const drawerWidth = 400
const mediaItemPadding = 12

function getImageWidth() {
  return drawerWidth - (mediaItemPadding * 2)
}

export default function MediaList() {
  const { caveId, mediaId } = useParams()
  const navigate = useNavigate()
  const [mediaListSnapshot, loading, error] = useCaveAssetsList(caveId)
  const imageWidth = getImageWidth()
  const theme = useTheme()
  console.log('theme: %o', theme)

  function onBeforeDeleteMediaThumbnail(item, isActive) {
    console.log('[onBeforeDeleteMediaThumbnail] start')
    if (isActive) {
      console.log(`[onBeforeDeleteMediaThumbnail] %o, isActive: %o`, item, isActive)
      const index = mediaListSnapshot.docs.findIndex(docSnap => docSnap.id === item.id)
      console.log(`[onBeforeDeleteMediaThumbnail] Found deleted item in mediaList at index %o of %o`, index, mediaListSnapshot.size - 1)

      if (mediaListSnapshot.size === 1) {
        console.log('[onBeforeDeleteMediaThumbnail] Deleted the only media in the list')
        return
      }

      const nextItemIndex = index < mediaListSnapshot.size - 1 ? index + 1 : index - 1
      console.log('[onBeforeDeleteMediaThumbnail] New index: %o, item: %o', nextItemIndex, mediaListSnapshot.docs[nextItemIndex])
      const nextItemId = mediaListSnapshot.docs[nextItemIndex].id
      navigate(`../${nextItemId}`, { replace: true, relative: 'path' })
    }
  }

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
            <TransitionGroup>
              {mediaListSnapshot.docs.map(doc => {
                const mediaAsset = doc.data()
                const isActive = mediaAsset.id === mediaId

                return (
                  <Collapse key={mediaAsset.id} easing={theme.sys.motion.easing.emphasizedAccelerate}>
                    <MediaThumbnail mediaAsset={mediaAsset} isActive={isActive} onBeforeDelete={onBeforeDeleteMediaThumbnail} />
                  </Collapse>
                )
              })}
            </TransitionGroup>
          )
        )
      }
    </Scrollbars>
  )
}
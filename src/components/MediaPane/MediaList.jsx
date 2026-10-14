import { useCallback, useMemo, useRef } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useSelector } from 'react-redux'
import { TransitionGroup } from 'react-transition-group'
import { Box, Collapse, Skeleton, useTheme } from '@mui/material'
import { useCaveAssetsList } from '@/models/CaveAsset.js'
import { usePhotoReorder } from '@/hooks/usePhotoReorder.js'
import Reorderable from '@/components/Reorder/Reorderable.jsx'
import Scrollbars from '@/components/Scrollbars/Scrollbars.jsx'
import MediaListEmpty from './MediaListEmpty.jsx'
import MediaThumbnail from './MediaThumbnail.jsx'
import { drawerWidth, mediaItemPadding, mediaItemRadius } from './config.js'

function getImageWidth() {
  return drawerWidth - (mediaItemPadding * 2)
}

/**
 * The media viewer's list of a cave's photos (/map/:caveId/medias/:mediaId),
 * the one shown marked; editors reorder them by drag and drop (the whole
 * thumbnail; the first is the cover, and says so).
 */
export default function MediaList() {
  const { caveId, mediaId } = useParams()
  const navigate = useNavigate()
  const [mediaListSnapshot, loading, error] = useCaveAssetsList(caveId)
  const isEditor = useSelector((/** @type {RootState} */ state) => state.session.roles).includes('editor')
  const [order, reorder] = usePhotoReorder(caveId, mediaListSnapshot)
  // The photos drawn, by id.
  const shownAssets = useRef(new Map())
  // Each photo's object made once per snapshot (data() makes a new one each
  // call: every thumbnail then re-rendered, and asked Storage for its link
  // again, whenever the list did - a drag starting included).
  const assetsById = useMemo(() => new Map((mediaListSnapshot?.docs || []).map((doc) => [doc.id, doc.data()])), [mediaListSnapshot])
  const imageWidth = getImageWidth()
  const theme = useTheme()

  const onBeforeDeleteMediaThumbnail = useCallback((item, isActive) => {
    if (isActive) {
      const index = mediaListSnapshot.docs.findIndex(docSnap => docSnap.id === item.id)

      if (mediaListSnapshot.size === 1) {
        return
      }

      const nextItemIndex = index < mediaListSnapshot.size - 1 ? index + 1 : index - 1
      const nextItemId = mediaListSnapshot.docs[nextItemIndex].id
      navigate(`../${nextItemId}`, { replace: true, relative: 'path' })
    }
  }, [mediaListSnapshot, navigate])

  return (
    <Scrollbars
      className="oc-media-list"
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
            borderRadius: mediaItemRadius,
          }} />
        </Box>
      )
      )}

      {
        mediaListSnapshot && (
          mediaListSnapshot.docs.length === 0 ? (
            <MediaListEmpty />
          ) : (
            <Reorderable
              enabled={isEditor}
              strategy="vertical"
              ids={order.filter((id) => assetsById.has(id))}
              onReorder={reorder}
              wrap={(items) => <TransitionGroup>{items}</TransitionGroup>}
              renderItem={(id, index, sortable) => {
                // One leaving (deleted) is drawn again as it folds away.
                const mediaAsset = assetsById.get(id) || shownAssets.current.get(id)
                shownAssets.current.set(id, mediaAsset)
                const isActive = mediaAsset.id === mediaId

                return (
                  <Collapse key={mediaAsset.id} {...sortable?.transitionProps} easing={theme.sys.motion.easing.emphasizedAccelerate}>
                    <Box {...sortable?.itemProps} className="oc-media-list--item">
                    <MediaThumbnail
                      mediaAsset={mediaAsset}
                      isActive={isActive}
                      onBeforeDelete={onBeforeDeleteMediaThumbnail}
                      isDragging={sortable?.isDragging}
                      isCover={Boolean(sortable) && index === 0}
                    />
                    </Box>
                  </Collapse>
                )
              }}
            />
          )
        )
      }
    </Scrollbars>
  )
}
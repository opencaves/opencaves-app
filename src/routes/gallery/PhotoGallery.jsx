import { useEffect } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import { useCaveAssetsList } from '@/models/CaveAsset.js'
import MediaPaneDetails from '@/components/MediaPane/MediaPaneDetails.jsx'
import GalleryOverlay from './GalleryOverlay.jsx'

// /caves/:caveId/photos/:mediaId - the cave's photos, over its page (CavePage):
// the map's photo viewer, with its tools (cover, delete) for those allowed.
// Only this cave's photos; the arrow, Escape or the last photo deleted lead
// back to the page.
export default function PhotoGallery() {
  const { caveId, mediaId } = useParams()
  const navigate = useNavigate()
  const [list, loading] = useCaveAssetsList(caveId)
  const location = useLocation()
  // Opened from the page (fromPage): a step back to it, so Back doesn't
  // reopen the gallery; from a link, up to the page.
  const close = () => (location.state?.fromPage ? navigate(-1) : navigate('..'))

  useEffect(() => {
    if (!loading && list?.empty) navigate('..', { replace: true })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, list?.empty])

  // The photo deleted is the one shown: on to the next (the previous, last).
  function onBeforeDelete(item, isActive) {
    if (!isActive || list.size === 1) return
    const index = list.docs.findIndex((doc) => doc.id === item.id)
    const next = list.docs[index < list.size - 1 ? index + 1 : index - 1].id
    navigate(`../${next}`, { replace: true, relative: 'path', state: location.state })
  }

  return (
    <GalleryOverlay className="oc-photo-gallery" onClose={close}>
      {list && !list.empty && <MediaPaneDetails mediaId={mediaId} medias={list} onBeforeDelete={onBeforeDelete} alwaysShowBack onBack={close} showCounter />}
    </GalleryOverlay>
  )
}

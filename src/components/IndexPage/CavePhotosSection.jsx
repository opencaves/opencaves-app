import { useCallback } from 'react'
import { Link as RouterLink } from 'react-router-dom'
import { useSelector } from 'react-redux'
import { useTranslation } from 'react-i18next'
import { Box, ButtonBase } from '@mui/material'
import AddAPhotoOutlined from '@mui/icons-material/AddAPhotoOutlined'
import AddButton from '@/components/AddButton.jsx'
import AddMediasProvider from '@/components/AddMedias/AddMediasProvider.jsx'
import AddMediasButton from '@/components/MediaPane/AddMediasButton.jsx'
import PendingUploadsStrip from '@/components/Offline/PendingUploadsStrip.jsx'
import { useRequireLogin } from '@/hooks/useRequireLogin.jsx'
import { useCaveAssetsList } from '@/models/CaveAsset.js'
import Picture from '@/components/Picture.jsx'
import Carousel from '@/components/Carousel/Carousel.jsx'
import IndexSection from './IndexSection.jsx'

// The photos a cave's page shows (its Show all pane has them all).
const MAX_PHOTOS = 12

// A cave's photos, its cover first, each opening in the page's gallery
// (/caves/:caveId/photos/:id, PhotoGallery): a carousel on phones (a grid
// wider) of the first ones, its Show all pane with every one. Under them,
// the photos added offline still waiting to upload, and Add pictures
// (editors; the others are asked to log in) - shown with no photo yet too.
export default function CavePhotosSection({ caveId, title }) {
  const { t } = useTranslation('indexPages')
  const { t: tEdit } = useTranslation('resultPane', { keyPrefix: 'edit' })
  const isEditor = useSelector((state) => state.session.roles).includes('editor')
  const requireLogin = useRequireLogin('photos')
  const pendingPhotosOf = useCallback((item) => item.kind === 'photo' && item.caveId === caveId, [caveId])
  const [list, loading] = useCaveAssetsList(caveId)
  if (loading || !list) return null
  const photos = list.docs.map((doc) => doc.data())
  const items = photos.map((photo, index) => (
    <li key={photo.id}>
      <ButtonBase component={RouterLink} to={`/caves/${caveId}/photos/${photo.id}`} state={{ fromPage: true }} aria-label={t('cave.openPhoto', { n: index + 1 })} className="oc-carousel--media" sx={{ display: 'block', width: '100%', aspectRatio: '4 / 3', borderRadius: 2, overflow: 'hidden', bgcolor: 'action.hover' }}>
        <Picture sources={photo.getSources('resultThumbnail')} alt="" loading="lazy" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
      </ButtonBase>
    </li>
  ))
  // Editors pick photos (or drop them on the page); the others log in first.
  const addButton = isEditor ? (
    <AddMediasProvider caveId={caveId}>
      <AddMediasButton component={<AddButton startIcon={<AddAPhotoOutlined />} />}>{tEdit('addPictures')}</AddMediasButton>
    </AddMediasProvider>
  ) : (
    <AddButton startIcon={<AddAPhotoOutlined />} onClick={requireLogin}>
      {tEdit('addPictures')}
    </AddButton>
  )
  return (
    <IndexSection id="photos" title={title} count={list.size || undefined} className="oc-cave-page--photos" card>
      {photos.length > 0 && (
        <Carousel allItems={items} gridMinWidth="240px" gridGap={1.5} label={title}>
          {items.slice(0, MAX_PHOTOS)}
        </Carousel>
      )}
      {/* Photos added offline, waiting to upload. */}
      <PendingUploadsStrip filter={pendingPhotosOf} sx={{ mt: photos.length > 0 ? 2 : 0 }} />
      <Box sx={{ display: 'flex', justifyContent: 'center', pt: photos.length > 0 ? 2 : 0 }}>{addButton}</Box>
    </IndexSection>
  )
}

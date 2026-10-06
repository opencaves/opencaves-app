import { Link as RouterLink } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { ButtonBase } from '@mui/material'
import { useCaveAssetsList } from '@/models/CaveAsset.js'
import Picture from '@/components/Picture.jsx'
import Carousel from '@/components/Carousel/Carousel.jsx'
import IndexSection from './IndexSection.jsx'

// The photos a cave's page shows (its Show all pane has them all).
const MAX_PHOTOS = 12

// A cave's photos, its cover first, each opening in the page's gallery
// (/caves/:caveId/photos/:id, PhotoGallery): a
// carousel on phones (a grid wider) of the first ones, its Show all pane
// with every one.
export default function CavePhotosSection({ caveId, title }) {
  const { t } = useTranslation('indexPages')
  const [list] = useCaveAssetsList(caveId)
  const photos = (list?.docs || []).map((doc) => doc.data())
  if (photos.length === 0) return null
  const items = photos.map((photo, index) => (
    <li key={photo.id}>
      <ButtonBase component={RouterLink} to={`/caves/${caveId}/photos/${photo.id}`} state={{ fromPage: true }} aria-label={t('cave.openPhoto', { n: index + 1 })} className="oc-carousel--media" sx={{ display: 'block', width: '100%', aspectRatio: '4 / 3', borderRadius: 2, overflow: 'hidden', bgcolor: 'action.hover' }}>
        <Picture sources={photo.getSources('resultThumbnail')} alt="" loading="lazy" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
      </ButtonBase>
    </li>
  ))
  return (
    <IndexSection title={title} count={list.size} className="oc-cave-page--photos" card>
      <Carousel allItems={items} gridMinWidth="240px" gridGap={1.5} label={title}>
        {items.slice(0, MAX_PHOTOS)}
      </Carousel>
    </IndexSection>
  )
}

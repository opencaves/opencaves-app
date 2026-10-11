import { useCallback } from 'react'
import { Link as RouterLink } from 'react-router-dom'
import { useSelector } from 'react-redux'
import { useTranslation } from 'react-i18next'
import { Box, ButtonBase } from '@mui/material'
import AddAPhotoRounded from '@mui/icons-material/AddAPhotoRounded'
import AddButton from '@/components/AddButton.jsx'
import AddMediasProvider from '@/components/AddMedias/AddMediasProvider.jsx'
import AddMediasButton from '@/components/MediaPane/AddMediasButton.jsx'
import PendingUploadsStrip from '@/components/Offline/PendingUploadsStrip.jsx'
import { useRequireLogin } from '@/hooks/useRequireLogin.jsx'
import { useCaveAssetsList } from '@/models/CaveAsset.js'
import Picture from '@/components/Picture.jsx'
import MediaStrip from '@/components/ResultPane/MediaStrip.jsx'
import StripShowAll from '@/components/ResultPane/StripShowAll.jsx'
import { PAGE_STRIP } from '@/config/resultPane.js'
import IndexSection from './IndexSection.jsx'
import EmptySectionText from './EmptySectionText.jsx'

// The photos a cave's strip shows; its Show all pane has them all.
const MAX_PHOTOS = 12

/**
 * A cave's photos, its cover first, each opening in the page's gallery
 * (/caves/:caveId/photos/:id, PhotoGallery): the first ones on a 3D strip
 * ({@link MediaStrip}, as the map's cave pane), and under it Show all
 * ({@link StripShowAll}) opening every one in a grid. Rendered here (not
 * MediaList, which waits for each image): the server's page has the photos
 * too. Under them,
 * the photos added offline still waiting to upload, and Add pictures
 * (editors; the others are asked to log in) - shown with no photo yet too.
 */
export default function CavePhotosSection({ caveId, title }) {
  const { t } = useTranslation('indexPages')
  const { t: tEdit } = useTranslation('resultPane', { keyPrefix: 'edit' })
  const isEditor = useSelector((/** @type {RootState} */ state) => state.session.roles).includes('editor')
  const requireLogin = useRequireLogin('photos')
  const pendingPhotosOf = useCallback((item) => item.kind === 'photo' && item.caveId === caveId, [caveId])
  const [list, loading] = useCaveAssetsList(caveId)
  if (loading || !list) return null
  const photos = list.docs.map((doc) => doc.data())
  const photoPath = (id) => `/caves/${caveId}/photos/${id}`
  const shown = photos.slice(0, MAX_PHOTOS)
  const { height, gap, itemWidth: width, itemHeight } = PAGE_STRIP
  // One photo a column (a picture: the strip slices its <img>).
  const items = shown.map((photo, index) => (
    <Box key={photo.id} className="oc-cave-page--photo oc-media-strip--picture oc-media-strip--item" sx={{ width, height: itemHeight, flexShrink: 0, borderRadius: '.5rem', overflow: 'hidden' }}>
      <ButtonBase component={RouterLink} to={photoPath(photo.id)} state={{ fromPage: true }} aria-label={t('cave.openPhoto', { n: index + 1 })} sx={{ display: 'block', width: '100%', height: '100%' }}>
        {/* Its tint on the picture, not the box: on the cylinder the box is
            over the photo's slices (its picture hidden), a tint there would
            cover them. */}
        <Picture sources={photo.getSources('resultThumbnail')} alt="" loading="lazy" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block', backgroundColor: 'var(--mui-palette-action-hover)' }} />
      </ButtonBase>
    </Box>
  ))
  // Every photo, for the Show all pane's grid.
  const allItems = photos.map((photo, index) => (
    <li key={photo.id}>
      <ButtonBase component={RouterLink} to={photoPath(photo.id)} state={{ fromPage: true }} aria-label={t('cave.openPhoto', { n: index + 1 })} className="oc-carousel--media" sx={{ display: 'block', width: '100%', aspectRatio: '4 / 3', overflow: 'hidden', bgcolor: 'action.hover' }}>
        <Picture sources={photo.getSources('resultThumbnail')} alt="" loading="lazy" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
      </ButtonBase>
    </li>
  ))

  // Editors pick photos (or drop them on the page); the others log in first.
  const addButton = isEditor ? (
    <AddMediasProvider caveId={caveId}>
      <AddMediasButton component={<AddButton startIcon={<AddAPhotoRounded />} />}>{tEdit('addPictures')}</AddMediasButton>
    </AddMediasProvider>
  ) : (
    <AddButton startIcon={<AddAPhotoRounded />} onClick={requireLogin}>
      {tEdit('addPictures')}
    </AddButton>
  )
  return (
    <IndexSection id="photos" title={title} count={list.size || undefined} className="oc-cave-page--photos" card>
      {photos.length === 0 && <EmptySectionText>{t('empty.photos')}</EmptySectionText>}
      {photos.length > 0 && (
        // The strip's own padding: none sideways (the card's), its block
        // one; its width, the items' measure (cqi).
        <Box sx={{ containerType: 'inline-size', '--oc-pane-padding-inline': '0px', '--oc-pane-padding-block': '16px' }}>
          <MediaStrip start="start" fill className="oc-cave-page--photo-strip" itemHeight={height} height={itemHeight} gap={gap} rebuildKey={shown.map((photo) => photo.id).join(' ')}>
            {items}
          </MediaStrip>
          <StripShowAll title={title} gridMinWidth="240px">
            {allItems}
          </StripShowAll>
        </Box>
      )}
      {/* Photos added offline, waiting to upload. */}
      <PendingUploadsStrip filter={pendingPhotosOf} sx={{ mt: photos.length > 0 ? 2 : 0 }} />
      <Box sx={{ display: 'flex', justifyContent: 'center', pt: photos.length > 0 ? 2 : 0 }}>{addButton}</Box>
    </IndexSection>
  )
}

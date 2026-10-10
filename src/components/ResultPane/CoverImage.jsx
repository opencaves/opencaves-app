import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { Box, ButtonBase } from '@mui/material'
import AddPhotoAlternateRounded from '@mui/icons-material/AddPhotoAlternateRounded'

import { useAddMedias } from '@/components/AddMedias/useAddMedias.jsx'
import UnstyledLink from '@/components/UnstyledLink.jsx'
import Tooltip from '@/components/Tooltip.jsx'
import Picture from '@/components/Picture.jsx'
import { getCoverImage, useCoverImage } from '@/models/CaveAsset.js'
import { COVER_IMAGE_HEIGHT_RATIO } from '@/config/resultPane.js'
import defaultMediaCardImage from '@/images/result-pane/card-media.webp'
import transparentPixel from '@/images/transparentPixel.js'

export async function loadCoverImage(caveId) {
  return getCoverImage(caveId, false)
}

const ASPECT_RATIO = 1 / COVER_IMAGE_HEIGHT_RATIO

// Declared outside CoverImage: a component declared inside it is a new type on
// every render, so React rebuilt the whole picture - the image flickered each
// time the pane re-rendered (e.g. on every map move, which updates the URL).
function Container({ width, children }) {
  return (
    <Box className="oc-cover-image" sx={{ position: 'relative', width, aspectRatio: ASPECT_RATIO }}>
      {children}
    </Box>
  )
}

/**
 * Fluid by default: fills whatever width its container gives it (so it
 * scales with the result pane - e.g. when quick-edit mode doubles the
 * pane's width) rather than being pinned to a fixed pixel size, keeping its
 * aspect ratio via CSS instead of a computed pixel height.
 */
export default function CoverImage({ caveId, width = '100%' }) {
  const { t } = useTranslation('resultPane', { keyPrefix: 'coverImage' })
  const { promptForMedias } = useAddMedias()
  const [coverImage, coverImageLoading, coverImageError] = useCoverImage(caveId)

  const height = '100%'
  const hasCoverImage = !!coverImage
  // Kept while the cover is the same photo: new sources would be a new
  // <source> list for the browser to pick from again.
  const coverKey = coverImage ? `${coverImage.id}-${coverImage.get('thumbnailRevision') || 1}-${coverImage.get('viewThumbnailRevision') || 0}` : null
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const sources = useMemo(() => (coverImage ? coverImage.data().getSources('coverImage') : null), [coverKey])

  if (coverImageLoading) {
    return (
      <Container width={width}>
        <Picture
          src={transparentPixel}
          alt=""
          style={{
            width,
            height,
            objectFit: 'cover',
          }}
        />
      </Container>
    )
  }

  if (coverImageError) {
    return (
      <Container width={width}>
        <Picture
          src={defaultMediaCardImage}
          alt=""
          style={{
            width,
            height,
            objectFit: 'cover',
          }}
        />
      </Container>
    )
  }

  if (!hasCoverImage) {
    return (
      <Container width={width}>
        <Tooltip title={t('addImages.tooltip')}>
          <ButtonBase onClick={promptForMedias}>
            <Picture
              src={defaultMediaCardImage}
              alt=""
              style={{
                width,
                height,
                objectFit: 'cover',
              }}
            />
            <AddPhotoAlternateRounded
              sx={{
                position: 'absolute',
                bottom: '1rem',
                right: '1rem',
                color: '#fff',
                opacity: 'var(--oc-cover-image-add-btn-opacity, .7)',
                cursor: 'pointer',
                transition: 'all var(--mui-transition-duration-shortest) ease-in-out',
              }}
            />
          </ButtonBase>
        </Tooltip>
      </Container>
    )
  }

  return (
    coverImage && (
      <Container width={width}>
        <Tooltip title={t('seeImages.tooltip')}>
          <UnstyledLink
            to={`medias/${coverImage.id}`}
            style={{
              display: 'block',
              ':hover': {
                '--oc-cover-image-add-btn-opacity': '1',
              },
            }}
          >
            <Picture
              src={transparentPixel}
              sources={sources}
              alt=""
              style={{
                width,
                height,
                objectFit: 'cover',
              }}
            />
          </UnstyledLink>
        </Tooltip>
      </Container>
    )
  )
}

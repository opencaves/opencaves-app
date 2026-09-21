import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Box, ButtonBase } from '@mui/material'
import { AddPhotoAlternateRounded } from '@mui/icons-material'

import { useAddMedias } from '@/components/AddMedias/useAddMedias.jsx'
import UnstyledLink from '@/components/UnstyledLink.jsx'
import Tooltip from '@/components/Tooltip.jsx'
import Picture from '@/components/Picture.jsx'
import { getCoverImage, useCoverImage } from '@/models/CaveAsset.js'
import defaultMediaCardImage from '@/images/result-pane/card-media.webp'
import transparentPixel from '@/images/transparentPixel.js'

export async function loadCoverImage(caveId) {
  return getCoverImage(caveId, false)
}

export default function CoverImage({ caveId, width, height }) {
  const { t } = useTranslation('resultPane', { keyPrefix: 'coverImage' })
  const [sources, setSources] = useState(null)
  const [hasCoverImage, setHasCoverImage] = useState(null)
  const { promptForMedias } = useAddMedias()
  const [coverImage, coverImageLoading, coverImageError] = useCoverImage(caveId)

  function Container({ children }) {
    return (
      <Box sx={{ position: 'relative', width, height }}>
        {children}
      </Box>
    )
  }

  useEffect(() => {
    // if (coverImage) {
    setSources(coverImage ? coverImage.data().getSources('coverImage') : null)
    setHasCoverImage(!!coverImage)
    // }
  }, [coverImage])

  if (coverImageLoading) {
    return (
      <Container>
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
      <Container>
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
      <Container>
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
                transition: 'all var(--md-transition-duration-shortest) ease-in-out',
              }}
            />
          </ButtonBase>
        </Tooltip>
      </Container>
    )
  }

  return (
    coverImage && (
      <Container>
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

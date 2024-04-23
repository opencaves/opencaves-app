import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Box, ButtonBase } from '@mui/material'
import { AddPhotoAlternateRounded } from '@mui/icons-material'

import { useAddMedias } from '@/components/AddMedias/useAddMedias'
import UnstyledLink from '@/components/UnstyledLink'
import Tooltip from '@/components/Tooltip'
import Picture from '@/components/Picture'
import ConditionalWrapper from '@/components/utils/ConditionalWrapper'
import { getCoverImage, useCoverImage } from '@/models/CaveAsset'
import useRoles from '@/hooks/useRoles'
import defaultMediaCardImage from '@/images/result-pane/card-media.webp'
import pixel from '@/images/pixel.gif'

export async function loadCoverImage(caveId) {
  return getCoverImage(caveId, false)
}

export default function CoverImage({ caveId, width, height }) {
  const { t } = useTranslation('resultPane', { keyPrefix: 'coverImage' })
  const isEditor = useRoles('editor')
  const [sources, setSources] = useState(null)
  const [hasCoverImage, setHasCoverImage] = useState(null)
  const { promptForMedias } = useAddMedias()
  const [coverImage, coverImageLoading, coverImageError] = useCoverImage(caveId)

  function Container({ children }) {
    return (
      <Box
        position='relative'
        width={width}
        height={height}
      >
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
          src={pixel}
          alt=''
          style={{
            width,
            height,
            objectFit: 'cover'
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
          alt=''
          style={{
            width,
            height,
            objectFit: 'cover'
          }}
        />
      </Container>
    )
  }

  if (!hasCoverImage) {
    return (
      <Container>
        <ConditionalWrapper
          condition={isEditor}
          wrapper={children => (
            <Tooltip title={t('addImages.tooltip')}>
              <ButtonBase onClick={promptForMedias}>
                {children}
              </ButtonBase>
            </Tooltip>
          )}
        >
          <Picture
            src={defaultMediaCardImage}
            alt=''
            style={{
              width,
              height,
              objectFit: 'cover'
            }}
          />
          {
            isEditor && (
              <AddPhotoAlternateRounded
                sx={{
                  position: 'absolute',
                  bottom: '1rem',
                  right: '1rem',
                  color: '#fff',
                  opacity: 'var(--oc-cover-image-add-btn-opacity, .7)',
                  cursor: 'pointer',
                  transition: 'all var(--md-transition-duration-shortest) ease-in-out'
                }}
              />
            )
          }
        </ConditionalWrapper>
      </Container>)
  }

  return coverImage && (
    <Container>
      <Tooltip title={t('seeImages.tooltip')}>
        <UnstyledLink
          to={`medias/${coverImage.id}`}
          style={{
            display: 'block',
            ':hover': {
              '--oc-cover-image-add-btn-opacity': '1'
            }
          }}
        >
          <Picture
            src={pixel}
            sources={sources}
            alt=''
            style={{
              width,
              height,
              objectFit: 'cover'
            }}
          />
        </UnstyledLink>
      </Tooltip>
    </Container>
  )
}

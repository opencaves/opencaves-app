import { useEffect, useRef, useState } from 'react'
import { Link, useLoaderData } from 'react-router-dom'
import { useSelector } from 'react-redux'
import { useTranslation } from 'react-i18next'
import { Box, ButtonBase } from '@mui/material'
import { AddPhotoAlternateRounded } from '@mui/icons-material'

import { useAddMedias } from '@/components/MediaPane/AddMedias/useAddMedias'
import UnstyledLink from '@/components/UnstyledLink'
import Tooltip from '@/components/Tooltip'
import Picture from '@/components/Picture'
import ConditionalWrapper from '@/components/utils/ConditionalWrapper'
import { getCoverImage, getImageAssetUrl, useCoverImage } from '@/models/CaveAsset'
import useSession from '@/hooks/useSession'
import defaultMediaCardImage from '@/images/result-pane/card-media.webp'

export async function loadCoverImage(caveId) {
  return getCoverImage(caveId, false)
}

export default function CoverImage({ caveId, width, height }) {
  const start = Date.now()
  const { t } = useTranslation('resultPane', { keyPrefix: 'coverImage' })
  const hasSession = useSession()
  const [coverImageUrl, setCoverImageUrl] = useState(null)
  const [sources, setSources] = useState(null)
  const [fallbackImage, setFallbackImage] = useState()
  const [hasCoverImage, setHasCoverImage] = useState(null)
  const { promptForMedias } = useAddMedias()
  // const { coverImage: initialCoverImage } = useLoaderData()
  // const coverImage = useLoaderData()
  const [coverImage] = useCoverImage(caveId)

  // useEffect(() => {
  //   console.log('##### [CoverImage] loading time from useLoaderData: %s, %o', Date.now() - start, initialCoverImage)
  // }, [initialCoverImage])

  useEffect(() => {
    setSources(coverImage ? coverImage.data().getSources('coverImage') : null)

    console.log('##### [CoverImage] loading time from useCoverImage: %s, %o', Date.now() - start, coverImage)
    if (coverImage) {
      // const coverImageUrl = getImageAssetUrl(coverImage.fullPath, { width, height })
      setCoverImageUrl(coverImage.data().url)
      setHasCoverImage(true)
    } else {

      setFallbackImage(defaultMediaCardImage)
      setCoverImageUrl(defaultMediaCardImage)
    }
  }, [coverImage])

  return (
    <Box
      position='relative'
      width={width}
      height={height}
    >
      <ConditionalWrapper
        condition={hasCoverImage || hasSession}
        wrapper={children => <Tooltip title={t(`${hasCoverImage ? 'seeImages' : 'addImages'}.tooltip`)} >{children}</Tooltip>}
      >
        <ConditionalWrapper
          condition={hasCoverImage || hasSession}
          wrapper={children => {
            if (!hasCoverImage && hasSession) {
              return (
                <ButtonBase onClick={promptForMedias}>
                  {children}
                </ButtonBase>
              )
            }

            return (
              <UnstyledLink
                to='medias'
                style={{
                  display: 'block',
                  ':hover': {
                    '--oc-cover-image-add-btn-opacity': '1'
                  }
                }}
              >
                {children}
              </UnstyledLink>
            )
          }}>
          <Picture
            src={fallbackImage}
            sources={sources}
            alt=''
            style={{
              width,
              height,
              objectFit: 'cover'
            }}
          />
          <img
            alt=''
            src={coverImageUrl}
            style={{
              width,
              height,
              objectFit: 'cover'
            }}
          />
          {
            hasSession && !hasCoverImage && (
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
      </ConditionalWrapper>
    </Box>
  )
}
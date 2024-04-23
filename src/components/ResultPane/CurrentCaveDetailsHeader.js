import React, { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Box, Typography } from '@mui/material'
import Rating from '@/components/Rating/Rating'
import CoverImage from './CoverImage'
import { useSmall } from '@/hooks/useSmall'
import { ISO6391ToISO6392 } from '@/utils/lang'
import { paneWidth } from '@/config/app'
import { coverImageHeightRatio } from '@/config/resultPane'
import './CurrentCaveDetailsHeader.scss'

export default function CurrentCaveDetailsHeader({ cave }) {
  const coverImageWidth = paneWidth
  const coverImageHeight = Math.round(coverImageWidth * coverImageHeightRatio)
  const { t, i18n } = useTranslation('resultPane')
  const { t: tMap } = useTranslation('map')
  const caveName = cave.name ? cave.name.value : tMap('caveNameUnknown')
  const resolvedLanguage = ISO6391ToISO6392(i18n.resolvedLanguage)
  const caveNameTranslation = (langCode => {
    if (langCode) {
      if (langCode !== resolvedLanguage) {
        return cave.nameTranslations?.[resolvedLanguage]?.join(', ')
      }

      return null
    }

    return cave.nameTranslations?.[resolvedLanguage]?.join(', ') || null
  })(cave.name?.languageCode)

  const isSmall = useSmall()

  return (
    <>
      {
        !isSmall && (
          <CoverImage caveId={cave.id} width={coverImageWidth} height={coverImageHeight} />
        )
      }
      <Box className='oc-result-pane--header'>
        <Typography variant='caveDetailsHeader'>{caveName}</Typography>
        {
          caveNameTranslation && <Typography variant='caveDetailsSubHeader'>{caveNameTranslation}</Typography>
        }
        {
          cave.aka && cave.aka.length && <Typography variant='caveDetailsSubHeader'>{t('aka')} {cave.aka.join(', ')}</Typography>
        }
        <Rating caveId={cave.id} sx={{ pt: '0.5rem' }} />
      </Box >
    </>
  )
}

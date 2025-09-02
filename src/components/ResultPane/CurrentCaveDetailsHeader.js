import { useContext, useEffect } from 'react'
import { useDispatch } from 'react-redux'
import { useTranslation } from 'react-i18next'
import { Box, IconButton, Typography, styled } from '@mui/material'
import { Close } from '@mui/icons-material'
import Rating from '@/components/Rating/Rating'
import CoverImage from './CoverImage'
import { ResultPaneSmContext } from './ResultPaneSm'
import { clearCurrentCave } from '@/redux/slices/mapSlice'
import { useSmall } from '@/hooks/useSmall'
import { ISO6391ToISO6392 } from '@/utils/lang'
import { paneWidth } from '@/config/app'
import { coverImageHeightRatio } from '@/config/resultPane'
import './CurrentCaveDetailsHeader.scss'
import ConditionalWrapper from '../utils/ConditionalWrapper.js'
import { useNavigate } from 'react-router-dom'

export default function CurrentCaveDetailsHeader({ cave }) {

  const paneData = useContext(ResultPaneSmContext)
  const dispatch = useDispatch()
  const navigate = useNavigate()

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

  function onClear() {
    // dispatch(clearCurrentCave())
    navigate('/map')
  }

  function getSubHeaders() {
    return (
      <>
        {
          caveNameTranslation && <Typography variant='caveDetailsSubHeader'>{caveNameTranslation}</Typography>
        }
        {
          cave.aka && cave.aka.length && <Typography variant='caveDetailsSubHeader'>{t('aka')} {cave.aka.join(', ')}</Typography>
        }
        <Rating caveId={cave.id} sx={{ pt: '0.5rem' }} />
      </>
    )
  }

  useEffect(() => { console.log(paneData) }, [paneData])

  return (
    <>
      {
        !isSmall && (
          <CoverImage caveId={cave.id} width={coverImageWidth} height={coverImageHeight} />
        )
      }
      <Box className='oc-result-pane--header'>
        <Box className='oc-cave-details-header'>
          <Typography variant='caveDetailsHeader'>{caveName}</Typography>
          {
            isSmall && paneData.paneOpenFactor < 1 && (
              <Box>
                <StyledIconButton size="small" sx={{ opacity: 1 - paneData.paneOpenFactor }} onClick={onClear}>
                  <Close fontSize='small' />
                </StyledIconButton>
              </Box>
            )
          }
        </Box>
        {
          isSmall ? (
            paneData.paneMinimizeFactor > .25 && getSubHeaders()
          ) : (
            getSubHeaders()
          )
        }
        {/* {
            caveNameTranslation && <Typography variant='caveDetailsSubHeader'>{caveNameTranslation}</Typography>
          }
          {
            cave.aka && cave.aka.length && <Typography variant='caveDetailsSubHeader'>{t('aka')} {cave.aka.join(', ')}</Typography>
          }
          <Rating caveId={cave.id} sx={{ pt: '0.5rem' }} /> */}
      </Box >
    </>
  )
}

const StyledIconButton = styled(IconButton)({
  backgroundColor: '#f2f2f2'
})
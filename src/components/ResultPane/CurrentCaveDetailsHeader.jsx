import { useContext, useEffect, useRef } from 'react'
import { useDispatch } from 'react-redux'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Box, Collapse, Fade, IconButton, Typography, styled, useTheme } from '@mui/material'
import Close from '@mui/icons-material/Close'
import Rating from '@/components/Rating/Rating.jsx'
import CoverImage from './CoverImage.jsx'
import { ResultPaneSmContext } from './ResultPaneSmContext.js'
import { clearCurrentCave } from '@/redux/slices/mapSlice.jsx'
import { useSmall } from '@/hooks/useSmall.jsx'
import { toContentLanguage } from '@/utils/lang.js'
import { RESULT_PANE_SM_HEAD_HEIGHT } from '@/config/resultPane.js'
import ConditionalWrapper from '../utils/ConditionalWrapper.jsx'
import './CurrentCaveDetailsHeader.scss'

export default function CurrentCaveDetailsHeader({ cave }) {
  const paneData = useContext(ResultPaneSmContext)
  const dispatch = useDispatch()
  const navigate = useNavigate()
  const titleRef = useRef(null)

  const { t, i18n } = useTranslation('resultPane')
  const { t: tMap } = useTranslation('map')
  const caveName = cave.name ? cave.name.value : tMap('caveNameUnknown')
  const resolvedLanguage = toContentLanguage(i18n.resolvedLanguage)
  const caveNameTranslation = ((langCode) => {
    if (langCode) {
      if (langCode !== resolvedLanguage) {
        return cave.nameTranslations?.[resolvedLanguage]?.join(', ')
      }

      return null
    }

    return cave.nameTranslations?.[resolvedLanguage]?.join(', ') || null
  })(cave.name?.languageCode)

  const isSmall = useSmall()

  // Reveal the compact title in the sticky head bar once this title has
  // scrolled up behind it, and hide it again once this title is back in view.
  useEffect(() => {
    if (!isSmall || !paneData?.setTitleHidden || !titleRef.current) {
      return
    }

    const observer = new IntersectionObserver(([entry]) => paneData.setTitleHidden(!entry.isIntersecting), { rootMargin: `-${RESULT_PANE_SM_HEAD_HEIGHT}px 0px 0px 0px` })

    observer.observe(titleRef.current)

    return () => observer.disconnect()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSmall])

  const theme = useTheme()
  const motion = theme.oc.sys.motion.duration

  function onClear() {
    // SearchBar.jsx watches currentCave and resets its own value/search
    // results back to empty once it goes null - this is what makes the
    // close button also reset the search bar, not just navigate away.
    dispatch(clearCurrentCave())
    navigate('/map')
  }

  function getSubHeaders() {
    return (
      <>
        {caveNameTranslation && <Typography variant="caveDetailsSubHeader">{caveNameTranslation}</Typography>}
        {cave.aka && cave.aka.length && (
          <Typography variant="caveDetailsSubHeader">
            {t('aka')} {cave.aka.join(', ')}
          </Typography>
        )}
        <Rating caveId={cave.id} sx={{ pt: '0.5rem' }} />
      </>
    )
  }

  return (
    <>
      {!isSmall && <CoverImage caveId={cave.id} />}
      <Box className="oc-current-cave-details-header oc-result-pane--header">
        <Box className="oc-cave-details-header">
          {/* The page's h1 (the map's own hidden h1 steps aside while a cave is
              open); its sections are h2. ResultPaneSm.scss styles this h1 on
              phones (flex-grow, ellipsis when minimized). */}
          <Typography ref={titleRef} variant="caveDetailsHeader" component="h1">
            {caveName}
          </Typography>
          {isSmall && paneData.paneOpenFactor < 1 && (
            <Box>
              <StyledIconButton size="small" aria-label={t('closePane')} sx={{ opacity: 1 - paneData.paneOpenFactor }} onClick={onClear}>
                <Close fontSize="small" />
              </StyledIconButton>
            </Box>
          )}
        </Box>
        {/* On phones, the other names and the stars show once the sheet is a
            quarter open: they slide open and fade in (and out), rather than
            popping in mid-drag. */}
        {isSmall ? (
          <Collapse in={paneData.paneMinimizeFactor > 0.25} timeout={{ enter: motion.standardDecelerate, exit: motion.standardAccelerate }} easing={{ enter: theme.sys.motion.easing.standardDecelerate, exit: theme.sys.motion.easing.standardAccelerate }}>
            <Fade in={paneData.paneMinimizeFactor > 0.25} timeout={{ enter: motion.standardDecelerate, exit: motion.standardAccelerate }}>
              <div>{getSubHeaders()}</div>
            </Fade>
          </Collapse>
        ) : (
          getSubHeaders()
        )}
        {/* {
            caveNameTranslation && <Typography variant='caveDetailsSubHeader'>{caveNameTranslation}</Typography>
          }
          {
            cave.aka && cave.aka.length && <Typography variant='caveDetailsSubHeader'>{t('aka')} {cave.aka.join(', ')}</Typography>
          }
          <Rating caveId={cave.id} sx={{ pt: '0.5rem' }} /> */}
      </Box>
    </>
  )
}

// A tonal close button: the theme's tints, so it follows the light and dark
// modes (a fixed light grey stayed light in dark mode).
const StyledIconButton = styled(IconButton)(({ theme }) => ({
  backgroundColor: theme.vars.palette.action.selected,
  color: theme.vars.palette.text.secondary,
  '&:hover': {
    backgroundColor: theme.vars.palette.action.focus,
  },
}))

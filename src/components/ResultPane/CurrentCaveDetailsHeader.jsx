import { useContext, useEffect, useRef } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { useLocation, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Box, Collapse, Fade, IconButton, Typography, styled, useTheme } from '@mui/material'
import Close from '@mui/icons-material/Close'
import Rating from '@/components/Rating/Rating.jsx'
import CoverImage from './CoverImage.jsx'
import { ResultPaneSmContext } from './ResultPaneSmContext.js'
import { clearCurrentCave } from '@/redux/slices/mapSlice.jsx'
import { useSmall } from '@/hooks/useSmall.jsx'
import { RESULT_PANE_SM_HEAD_HEIGHT } from '@/config/resultPane.js'
import ConditionalWrapper from '../utils/ConditionalWrapper.jsx'
import './CurrentCaveDetailsHeader.scss'
import { TOUCH_TARGET_SX } from '@/components/touchTarget.js'
import { nameTranslationLines } from '@/utils/nameTranslations.js'

export default function CurrentCaveDetailsHeader({ cave }) {
  const paneData = useContext(ResultPaneSmContext)
  const location = useLocation()
  const dispatch = useDispatch()
  const navigate = useNavigate()
  const titleRef = useRef(null)

  const { t, i18n } = useTranslation('resultPane')
  const { t: tMap } = useTranslation('map')
  const caveName = cave.name?.value || tMap('caveNameUnknown')
  const languages = useSelector((state) => state.data.languages)
  // Its translations, each labelled with its language (as the cave page).
  const nameTranslations = nameTranslationLines(cave, i18n.resolvedLanguage, languages, (language, names) => t('nameTranslation', { language, names }))

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
    // Opened from the map in this history: back to that entry, so Back
    // afterwards doesn't reopen the cave.
    if (location.state?.fromMap) navigate(-1)
    else navigate('/map')
  }

  function getSubHeaders() {
    return (
      <>
        {nameTranslations.map((line) => (
          <Typography key={line} variant="caveDetailsSubHeader">
            {line}
          </Typography>
        ))}
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
              <StyledIconButton size="small" aria-label={t('closePane')} sx={{ ...TOUCH_TARGET_SX, opacity: 1 - paneData.paneOpenFactor }} onClick={onClear}>
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

import { useEffect, useLayoutEffect, useState } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import { useSelector } from 'react-redux'
import { useTranslation } from 'react-i18next'
import { Box, Card, Dialog, IconButton, Typography, useTheme } from '@mui/material'
import ArrowBackRounded from '@mui/icons-material/ArrowBackRounded'
import ArrowForwardRounded from '@mui/icons-material/ArrowForwardRounded'
import { PANE_WIDTH } from '@/config/app'
import { useSmall } from '@/hooks/useSmall.jsx'
import { usePaneSwap } from '@/hooks/usePaneSwap.js'
import FurtherReadingSection from './FurtherReadingSection.jsx'

// The space between the cave's pane and this one, and below it.
const PANE_GAP = 8

/**
 * Where the cave's pane (.oc-result-pane-lg) is on screen, kept up to date as it
 * grows, shrinks or the window changes: this pane opens beside it.
 *
 * @returns {{top: number, right: number}|null}
 */
function useResultPanePlace() {
  const [place, setPlace] = useState(/** @type {{top: number, right: number}|null} */ (null))
  useLayoutEffect(() => {
    // Its class: the desktop card's id is the page's main landmark's (#main).
    const pane = document.querySelector('.oc-result-pane-lg')
    if (!pane) return undefined
    const measure = () => {
      const { top, right } = pane.getBoundingClientRect()
      setPlace((current) => (current?.top === top && current?.right === right ? current : { top, right }))
    }
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(pane)
    window.addEventListener('resize', measure)
    return () => {
      observer.disconnect()
      window.removeEventListener('resize', measure)
    }
  }, [])
  return place
}

/**
 * Further reading's own pane on the map (/map/<caveId>/reading), opened from
 * the cave's pane's Further reading row: the cave's documents and its
 * systems', with Add for editors (FurtherReadingSection's `panel`). On a
 * computer, a pane beside the cave's, as tall as the window allows; on a
 * phone, full screen, swapped in as Show all's panes are ({@link usePaneSwap}).
 * Back returns to the cave's pane (the history's step when it came from
 * there; else its address).
 */
export default function FurtherReadingPane() {
  const { t } = useTranslation('furtherReading')
  const { t: tApp } = useTranslation('app')
  const theme = useTheme()
  const isPhone = useSmall()
  const navigate = useNavigate()
  const location = useLocation()
  const { caveId } = useParams()
  const cave = useSelector((/** @type {RootState} */ state) => state.map.currentCave)
  const sistemas = useSelector((/** @type {RootState} */ state) => state.data.sistemas)
  const connections = useSelector((/** @type {RootState} */ state) => state.data.connections)
  const place = useResultPanePlace()
  const { swap, paperRef, enter, close: swapClose } = usePaneSwap(isPhone)

  const leave = () => (location.state?.fromPane ? navigate(-1) : navigate(`/map/${caveId}`, { replace: true }))
  const close = () => swapClose(leave)

  // Escape closes it on a computer (a phone's dialog handles its own).
  useEffect(() => {
    if (isPhone) return undefined
    const onKey = (event) => event.key === 'Escape' && !event.defaultPrevented && !document.querySelector('.MuiDialog-root') && leave()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPhone, caveId])

  if (!cave || cave.id !== caveId) return null

  const header = (
    <Box className="oc-further-reading-pane--header" sx={{ display: 'flex', alignItems: 'center', gap: 1, px: 0.5, minHeight: 64, flexShrink: 0, borderBottom: 1, borderColor: 'divider' }}>
      <IconButton onClick={close} aria-label={tApp('back')} sx={{ width: 48, height: 48 }}>
        {theme.direction === 'rtl' ? <ArrowForwardRounded /> : <ArrowBackRounded />}
      </IconButton>
      <Box sx={{ minWidth: 0 }}>
        <Typography id="oc-further-reading-pane-title" component="h2" variant="h6" noWrap>
          {t('title')}
        </Typography>
        <Typography variant="body2" noWrap sx={{ color: 'text.secondary' }}>
          {cave.name?.value}
        </Typography>
      </Box>
    </Box>
  )
  const content = (
    <Box sx={{ overflowY: 'auto', overflowX: 'hidden', px: 2, py: 2, flex: 1, minHeight: 0 }}>
      <FurtherReadingSection cave={cave} sistemaId={cave.sistemaId} sistemas={sistemas} connections={connections} pagePath={`/map/${cave.id}`} variant="panel" />
    </Box>
  )

  if (isPhone) {
    return (
      <Dialog
        className="oc-further-reading-pane"
        open
        onClose={close}
        fullScreen
        aria-labelledby="oc-further-reading-pane-title"
        {...(swap && {
          hideBackdrop: true,
          transitionDuration: 0,
          slotProps: { paper: { ref: paperRef }, transition: { onEntering: enter } },
        })}
      >
        {header}
        {content}
      </Dialog>
    )
  }

  if (!place) return null
  return (
    <Card
      component="aside"
      className="oc-further-reading-pane"
      aria-labelledby="oc-further-reading-pane-title"
      sx={(muiTheme) => ({
        position: 'fixed',
        zIndex: 2,
        top: place.top,
        left: place.right + PANE_GAP,
        width: `min(${PANE_WIDTH}px, calc(100vw - ${place.right + 2 * PANE_GAP}px))`,
        maxHeight: `calc(100dvh - ${place.top + PANE_GAP}px)`,
        display: 'flex',
        flexDirection: 'column',
        boxShadow: 5,
        bgcolor: muiTheme.vars.sys.color.surface,
        backgroundImage: 'none',
        // Out from the cave's pane: M3's emphasized decelerate.
        animation: `oc-further-reading-pane-in ${muiTheme.oc.sys.motion.duration.emphasizedDecelerate}ms ${muiTheme.sys.motion.easing.emphasizedDecelerate}`,
        '@keyframes oc-further-reading-pane-in': { from: { opacity: 0, transform: 'translateX(-24px)' }, to: { opacity: 1, transform: 'none' } },
        '@media (prefers-reduced-motion: reduce)': { animation: 'none' },
      })}
    >
      {header}
      {content}
    </Card>
  )
}

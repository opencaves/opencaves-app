import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import { useSelector } from 'react-redux'
import { useTranslation } from 'react-i18next'
import { Box, Card, Dialog, IconButton, Typography, useTheme } from '@mui/material'
import ArrowBackRounded from '@mui/icons-material/ArrowBackRounded'
import ArrowForwardRounded from '@mui/icons-material/ArrowForwardRounded'
import { useSmall } from '@/hooks/useSmall.jsx'
import { usePaneSwap } from '@/hooks/usePaneSwap.js'
import FurtherReadingSection from './FurtherReadingSection.jsx'
import { READING_PANE_CLOSE_EVENT } from './readingPane.js'

// The space between the cave's pane and this one, and below it.
const PANE_GAP = 8
// Its width, the cave pane's times this: room for long titles and summaries.
const WIDTH_RATIO = 1.5
const prefersReducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches
// A computer's pane emerging from the cave pane's edge (M3's side sheet: in
// with emphasized decelerate, out - shorter - with emphasized accelerate):
// revealed from its left edge as it moves out. Clipped only while it moves
// (its shadow kept, but on the cave pane's side).
const HIDDEN = { clipPath: 'inset(-24px 100% -24px 0)', transform: 'translateX(-24px)' }
const SHOWN = { clipPath: 'inset(-24px -24px -24px 0)', transform: 'none' }

/**
 * Where the cave's pane (.oc-result-pane-lg) is on screen, kept up to date as it
 * grows, shrinks or the window changes: this pane opens beside it.
 *
 * @returns {{top: number, right: number, width: number}|null}
 */
function useResultPanePlace() {
  const [place, setPlace] = useState(/** @type {{top: number, right: number, width: number}|null} */ (null))
  useLayoutEffect(() => {
    // Its class: the desktop card's id is the page's main landmark's (#main).
    const pane = document.querySelector('.oc-result-pane-lg')
    if (!pane) return undefined
    const measure = () => {
      const { top, right, width } = pane.getBoundingClientRect()
      setPlace((current) => (current?.top === top && current?.right === right && current?.width === width ? current : { top, right, width }))
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
 * computer, a pane beside the cave's, half as wide again ({@link WIDTH_RATIO}),
 * as tall as the window allows; on a
 * phone, full screen, swapped in as Show all's panes are ({@link usePaneSwap}).
 * Its back arrow, Escape and the row's toggle ({@link READING_PANE_CLOSE_EVENT})
 * close it - animated ({@link HIDDEN}, {@link SHOWN}) - back to the cave's
 * pane (the history's step when it came from there; else its address).
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

  // A computer's pane playing its exit, before it leaves.
  const [closing, setClosing] = useState(false)

  // Once: the exit's end and its safety timer both call it (two steps back
  // would leave the cave too).
  const leftRef = useRef(false)
  function leave() {
    if (leftRef.current) return
    leftRef.current = true
    if (location.state?.fromPane) navigate(-1)
    else navigate(`/map/${caveId}`, { replace: true })
  }
  function close() {
    if (isPhone) return swapClose(leave)
    if (prefersReducedMotion()) return leave()
    setClosing(true)
  }
  const closeRef = useRef(close)
  closeRef.current = close

  // On a computer: Escape (a phone's dialog handles its own), and the row's
  // toggle.
  useEffect(() => {
    if (isPhone) return undefined
    const onKey = (event) => event.key === 'Escape' && !event.defaultPrevented && !document.querySelector('.MuiDialog-root') && closeRef.current()
    const onClose = () => closeRef.current()
    window.addEventListener('keydown', onKey)
    window.addEventListener(READING_PANE_CLOSE_EVENT, onClose)
    return () => {
      window.removeEventListener('keydown', onKey)
      window.removeEventListener(READING_PANE_CLOSE_EVENT, onClose)
    }
  }, [isPhone])
  // The exit played: gone (should it never end - a hidden tab - all the same).
  useEffect(() => {
    if (!closing) return undefined
    const timer = window.setTimeout(leave, theme.oc.sys.motion.duration.emphasizedAccelerate + 300)
    return () => window.clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [closing])

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
      id="oc-further-reading-pane"
      className="oc-further-reading-pane"
      aria-labelledby="oc-further-reading-pane-title"
      sx={(muiTheme) => ({
        position: 'fixed',
        zIndex: 2,
        top: place.top,
        left: place.right + PANE_GAP,
        // Wider than the cave's pane (WIDTH_RATIO), within the window.
        width: `min(${Math.round(place.width * WIDTH_RATIO)}px, calc(100vw - ${place.right + 2 * PANE_GAP}px))`,
        maxHeight: `calc(100dvh - ${place.top + PANE_GAP}px)`,
        display: 'flex',
        flexDirection: 'column',
        boxShadow: 5,
        bgcolor: muiTheme.vars.sys.color.surface,
        backgroundImage: 'none',
        animation: closing
          ? `oc-further-reading-pane-out ${muiTheme.oc.sys.motion.duration.emphasizedAccelerate}ms ${muiTheme.sys.motion.easing.emphasizedAccelerate} forwards`
          : `oc-further-reading-pane-in ${muiTheme.oc.sys.motion.duration.emphasizedDecelerate}ms ${muiTheme.sys.motion.easing.emphasizedDecelerate}`,
        '@keyframes oc-further-reading-pane-in': { from: HIDDEN, to: SHOWN },
        '@keyframes oc-further-reading-pane-out': { from: SHOWN, to: HIDDEN },
        '@media (prefers-reduced-motion: reduce)': { animation: 'none' },
      })}
      onAnimationEnd={(event) => closing && event.target === event.currentTarget && leave()}
    >
      {header}
      {content}
    </Card>
  )
}

import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { ResultPaneSmContext } from './ResultPaneSmContext.js'
import { registerPhoneSheet } from './phoneSheetControl.js'
import { Scrollbars } from 'react-custom-scrollbars-3'
import { useTranslation } from 'react-i18next'
import { Box, Card, CardContent, IconButton, Slide, Typography } from '@mui/material'
import { Grid } from '@mui/material'
import ExpandMoreRounded from '@mui/icons-material/ExpandMoreRounded'
import { setResultPaneSmCurrentBreakpoint, setSearchBarOff } from '@/redux/slices/appSlice'
import AppMenu from '@/components/App/AppMenu.jsx'
import EditCaveButtons from '@/components/Map/EditCaveButtons.jsx'
import BottomSheet from '@/components/BottomSheet/BottomSheet.jsx'
import { PANE_BREAKPOINTS, PANE_INITIAL_BREAKPOINT, PANE_OPEN_THRESHOLD } from '@/config/app.js'
import './ResultPaneSm.scss'

// Sheet position (fraction of its height) above which the map's
// bottom-right controls fade out rather than keep riding up over the details.
const mapControlsHideThreshold = 0.5

// M3 icon buttons in the expanded pane's top bar: 48dp touch targets around
// 24dp icons (the account avatar is 32dp), spaced 8dp apart via the bar's
// columnGap.
const headerIconButtonSx = { width: 48, height: 48, p: 0 }

function easeOutQuad(t, b = 0, c = 1, d = 1) {
  return -c * (t /= d) * (t - 2) + b
}

// How close to the screen's bottom edge a focused control may sit before
// the sheet scrolls it up.
const FOCUS_EDGE_MARGIN = 32

const firstBreakpoint = PANE_BREAKPOINTS[0]
const topBreakpoint = PANE_BREAKPOINTS[PANE_BREAKPOINTS.length - 1]
const paneBreakpointsThreshold = PANE_BREAKPOINTS[PANE_BREAKPOINTS.length - 2]

/**
 * The map's result pane on a phone: a bottom sheet ({@link BottomSheet}) over
 * the map, at the snap points PANE_BREAKPOINTS, opening where it was left
 * (redux's resultPaneSmCurrentBreakpoint). Its position drives the rest as
 * it moves: the open and minimize factors it provides
 * ({@link ResultPaneSmContext}), the top bar fading in as it nears the top
 * (back button, the cave's name, the edit and account buttons) while the
 * search bar slides away, and the map controls riding above it, then fading
 * out (--oc-result-pane-sm-height, --oc-map-controls-*). The tours move it
 * through {@link registerPhoneSheet}.
 *
 * @param {object} props
 * @param {React.ReactNode} props.children - The pane's content (header, details or edit form).
 * @param {Cave} props.cave - The cave shown.
 * @param {string} [props.id] - The other props go to the sheet.
 */
export default function ResultPaneSm({ children, cave, ...props }) {
  const sheetRef = useRef(/** @type {import('@/components/BottomSheet/BottomSheet.jsx').BottomSheetHandle} */ (null))
  const paneRef = useRef(/** @type {HTMLDivElement} */ (null))
  const paneHeadRef = useRef(/** @type {HTMLDivElement} */ (null))

  const dispatch = useDispatch()
  const { t: tMap } = useTranslation('map')
  const { t: tApp } = useTranslation('app')
  const caveName = cave.name?.value || tMap('caveNameUnknown')

  const initialBreakpoint = useSelector((/** @type {RootState} */ state) => state.app.resultPaneSmCurrentBreakpoint)
  const resultPaneOpen = useSelector((/** @type {RootState} */ state) => state.app.resultPaneSmOpen)
  const filterMenuOpen = useSelector((/** @type {RootState} */ state) => state.app.filterMenuOpen)
  const searchBarOff = useSelector((/** @type {RootState} */ state) => state.app.searchBarOff)
  const visible = resultPaneOpen && !filterMenuOpen

  // A snap point stored by another screen (the lowest one depends on its
  // height) isn't one of these: the nearest one instead.
  const openingBreakpoint = PANE_BREAKPOINTS.reduce((nearest, point) => (Math.abs(point - initialBreakpoint) < Math.abs(nearest - initialBreakpoint) ? point : nearest))
  const [breakpoint, setBreakpoint] = useState(openingBreakpoint)
  // The sheet's position, to the hundredth (what's drawn from it needs no
  // more, and it re-renders less while the sheet moves).
  const [modalPosition, setModalPosition] = useState(openingBreakpoint)
  const [titleHidden, setTitleHidden] = useState(false)

  // 0 below PANE_OPEN_THRESHOLD, eased up to 1 at full height: the top bar
  // fading in, the corners squaring off.
  const paneOpenFactor = modalPosition < PANE_OPEN_THRESHOLD ? 0 : easeOutQuad((modalPosition - PANE_OPEN_THRESHOLD) / (1 - PANE_OPEN_THRESHOLD))
  // 0 at the lowest snap point, 1 from the next one up.
  const paneMinimizeFactor = Math.min(Math.max((modalPosition - PANE_BREAKPOINTS[0]) / (PANE_BREAKPOINTS[1] - PANE_BREAKPOINTS[0]), 0), 1)

  const contextData = useMemo(
    () => ({
      modalPosition,
      paneOpenFactor,
      paneMinimizeFactor,
      titleHidden,
      setTitleHidden,
    }),
    [modalPosition, paneOpenFactor, paneMinimizeFactor, titleHidden],
  )

  // Every frame of a move: the map's bottom-right controls (geolocate, the
  // editors' edit FAB) sit just above the sheet's shown height, following
  // drags instead of being covered.
  const onPositionChange = useCallback((position, height) => {
    document.documentElement.style.setProperty('--oc-result-pane-sm-height', `${Math.max(0, height)}px`)
    setModalPosition(Math.round(position * 100) / 100)
  }, [])

  const onSnapChange = useCallback(
    (point) => {
      setBreakpoint(point)
      dispatch(setResultPaneSmCurrentBreakpoint(point))
    },
    [dispatch],
  )

  function onBackBtnClick() {
    sheetRef.current?.setSnap(PANE_INITIAL_BREAKPOINT)
  }

  // The tours raise the sheet for a step (phoneSheetControl.js): resolved
  // once it's there.
  useEffect(() => {
    if (!visible) return undefined
    return registerPhoneSheet({
      setCurrentBreakpoint: (point) => sheetRef.current?.setSnap(point) ?? Promise.resolve(),
      getCurrentBreakpoint: () => sheetRef.current?.getSnap() ?? openingBreakpoint,
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible])

  useEffect(() => {
    const dY = 0.5
    const y = (1 - paneOpenFactor) * dY * 50
    paneHeadRef.current?.style?.setProperty('--oc-result-pane-head-surface-opacity', String(paneOpenFactor))
    paneHeadRef.current?.style?.setProperty('transform', `translate3d(0, -${y}px, 0)`)
    // Fully faded out, it's gone for taps, the keyboard and screen readers
    // too - the search bar is back in its place.
    paneHeadRef.current?.style?.setProperty('visibility', paneOpenFactor > 0 ? 'visible' : 'hidden')
  }, [paneOpenFactor])

  // The corners square off as the sheet nears the top.
  const borderRadius = `${1 - paneOpenFactor}rem`

  // Past the midpoint the map's controls would float over the details, so
  // they fade out. No sheet (the filter menu over it): none to clear.
  useEffect(() => {
    const root = document.documentElement.style
    const hidden = visible && modalPosition > mapControlsHideThreshold
    if (!visible) root.setProperty('--oc-result-pane-sm-height', '0px')
    root.setProperty('--oc-map-controls-opacity', hidden ? '0' : '1')
    root.setProperty('--oc-map-controls-visibility', hidden ? 'hidden' : 'visible')
  }, [modalPosition, visible])

  // Keyboard focus moving to something below the screen (the sheet low):
  // the sheet opens fully and scrolls it into view - Tab otherwise wandered
  // through controls nobody could see. Pointer focus (a tap) leaves it be,
  // and so does the handle (it moves the sheet itself).
  function onFocus(event) {
    const target = event.target
    if (!target.matches?.(':focus-visible') || target.classList.contains('oc-bottom-sheet--handle')) return
    // Below the screen, or pressed against its bottom edge.
    if (target.getBoundingClientRect().bottom <= window.innerHeight - FOCUS_EDGE_MARGIN) return
    sheetRef.current?.setSnap(topBreakpoint).then(() => target.scrollIntoView({ block: 'center' }))
  }

  // Another cave opens at the top of the sheet, not where the last one was
  // scrolled to.
  useLayoutEffect(() => {
    const view = paneRef.current?.querySelector('.oc-result-pane--scroll-view')
    if (view) view.scrollTop = 0
  }, [cave?.id])

  // The phone edit form's "place on map" mode (PlaceOnMapOverlay): minimize
  // the sheet so the map shows, then put it back exactly where it was -
  // same height, same scroll position in the form - when the mode ends.
  const placeOnMap = useSelector((/** @type {RootState} */ state) => state.map.placeOnMap)
  const placeOnMapReturnRef = useRef(null)
  useEffect(() => {
    const sheet = sheetRef.current
    if (!sheet) return
    const scrollView = () => paneRef.current?.querySelector('.oc-result-pane--scroll-view')

    if (placeOnMap && !placeOnMapReturnRef.current) {
      placeOnMapReturnRef.current = { breakpoint: sheet.getSnap(), scrollTop: scrollView()?.scrollTop ?? 0 }
      sheet.setSnap(firstBreakpoint)
    } else if (!placeOnMap && placeOnMapReturnRef.current) {
      const { breakpoint: returnBreakpoint, scrollTop } = placeOnMapReturnRef.current
      placeOnMapReturnRef.current = null
      sheet.setSnap(returnBreakpoint).then(() => {
        const view = scrollView()
        if (view) view.scrollTop = scrollTop
      })
    }
  }, [placeOnMap])

  useEffect(
    () => () => {
      const root = document.documentElement.style
      ;['--oc-result-pane-sm-height', '--oc-map-controls-opacity', '--oc-map-controls-visibility'].forEach((name) => root.removeProperty(name))
      // Gone while fully up (a cave closed, its edit pane left): the search
      // bar it slid away comes back.
      dispatch(setSearchBarOff(false))
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  )

  useEffect(() => {
    if (paneOpenFactor > 0) {
      if (!searchBarOff) {
        dispatch(setSearchBarOff(true))
      }
    } else {
      if (searchBarOff) {
        dispatch(setSearchBarOff(false))
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paneOpenFactor])

  return (
    visible && (
      <ResultPaneSmContext.Provider value={contextData}>
        {modalPosition > paneBreakpointsThreshold && (
          <Grid className="oc-result-pane--head" container ref={paneHeadRef} sx={{ alignItems: 'center', columnGap: 1 }}>
            <Grid>
              <IconButton
                className="oc-back-btn"
                aria-label={tApp('back')}
                onClick={onBackBtnClick}
                sx={headerIconButtonSx}
              >
                <ExpandMoreRounded />
              </IconButton>
            </Grid>
            <Grid size="grow" sx={{ overflow: 'hidden' }}>
              <Slide in={titleHidden} direction="down" appear={false} mountOnEnter unmountOnExit>
                <Typography variant="caveDetailsHeader" component="p" noWrap sx={{ fontSize: '1.125rem', lineHeight: '1.5rem' }}>
                  {caveName}
                </Typography>
              </Slide>
            </Grid>
            {/* Take over the editors' edit FAB while it's hidden (same
                threshold), so it's always reachable exactly once. The
                geolocate control has no stand-in: locating yourself only
                makes sense with the map in view. */}
            {modalPosition > mapControlsHideThreshold && (
              <Grid sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <EditCaveButtons sx={headerIconButtonSx} />
              </Grid>
            )}
            <Grid>
              {/* The same account button and card as the search bar's, which
                  this bar stands in for while the sheet is up. */}
              <AppMenu sx={{ ...headerIconButtonSx, bgcolor: 'transparent', ':hover': { bgcolor: 'transparent' } }} />
            </Grid>
          </Grid>
        )}
        <BottomSheet
          {...props}
          ref={sheetRef}
          snapPoints={PANE_BREAKPOINTS}
          initialSnap={openingBreakpoint}
          label={caveName}
          expandLabel={tMap('sheetHandle.expand')}
          collapseLabel={tMap('sheetHandle.collapse')}
          onPositionChange={onPositionChange}
          onSnapChange={onSnapChange}
          onFocus={onFocus}
          className={`oc-result-pane oc-result-pane-sm${paneMinimizeFactor < 0.5 ? ' oc-result-pane--minimize' : ''}`}
          style={{ '--oc-result-pane-border-radius': `${borderRadius} ${borderRadius} 0 0` }}
        >
          <Box id="oc-result-pane" ref={paneRef} sx={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
            <Card className={`oc-result-pane--card${breakpoint === topBreakpoint ? ' oc-full-height' : ''}`} component="main" id="main" sx={{ flex: 1, minHeight: 0 }}>
              {/* One tree at every snap point: rendering the children under a
                  different wrapper per snap point (as this once did) made
                  React remount the whole pane whenever the sheet left or
                  reached full height - dropping the edit form's unsaved
                  changes, and any coordinate picked on the map while the
                  sheet was minimized. Below full height the view just
                  doesn't scroll (drags move the sheet: BottomSheet). */}
              <Scrollbars
                autoHide
                hideTracksWhenNotNeeded={true}
                renderView={({ className, style, ...viewProps }) => <div {...viewProps} style={breakpoint === topBreakpoint ? { ...style, overscrollBehavior: 'contain' } : { ...style, overflow: 'hidden' }} className={`oc-result-pane--scroll-view ${className || ''}`.trim()} />}
                renderThumbVertical={({ style, ...props }) => (
                  <div
                    {...props}
                    style={{
                      ...style,
                      cursor: 'pointer',
                      borderRadius: '50%',
                      backgroundColor: 'var(--oc-scrollbar-thumb)',
                    }}
                  />
                )}
              >
                <CardContent
                  sx={{
                    p: 0,
                    // MUI's CardContent applies its own padding-bottom via a
                    // `&:last-child` rule, whose specificity beats a plain
                    // `pb` override here, so it has to be targeted directly.
                    // The sheet ends at the screen's bottom edge (sized with
                    // CSS: BottomSheet), so only the gesture bar's inset is
                    // added.
                    '&:last-child': {
                      pb: 'calc(var(--oc-pane-padding-inline) + env(safe-area-inset-bottom, 0px))',
                    },
                  }}
                >
                  {children}
                </CardContent>
              </Scrollbars>
            </Card>
          </Box>
        </BottomSheet>
      </ResultPaneSmContext.Provider>
    )
  )
}

import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { IonModal } from '@/utils/ionic.js'
import { ResultPaneSmContext } from './ResultPaneSmContext.js'
import { Scrollbars } from 'react-custom-scrollbars-3'
import waitFor from 'p-wait-for'
import { useTranslation } from 'react-i18next'
import { Box, Card, CardContent, IconButton, Slide, Typography } from '@mui/material'
import { Grid } from '@mui/material'
import ExpandMoreRounded from '@mui/icons-material/ExpandMoreRounded'
import { setResultPaneSmCurrentBreakpoint, setSearchBarOff } from '@/redux/slices/appSlice'
import AppMenu from '@/components/App/AppMenu.jsx'
import EditCaveButtons from '@/components/Map/EditCaveButtons.jsx'
import { PANE_BREAKPOINTS, PANE_INITIAL_BREAKPOINT, PANE_OPEN_THRESHOLD } from '@/config/app.js'
import { RESULT_PANE_SM_UPPER_HEIGHT } from '@/config/resultPane.js'
import './ResultPaneSm.scss'

// Sheet position (fraction of the screen) above which the map's bottom-right
// controls fade out rather than keep riding up over the details.
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

export default function ResultPaneSm({ children, cave, ...props }) {
  const modalRef = useRef({})
  const paneHeadRef = useRef({})

  const dispatch = useDispatch()
  const { t: tMap } = useTranslation('map')
  const { t: tApp } = useTranslation('app')
  const caveName = cave.name?.value || tMap('caveNameUnknown')

  const firstBreakpoint = PANE_BREAKPOINTS[0]
  const initialBreakpoint = useSelector((state) => state.app.resultPaneSmCurrentBreakpoint)
  const resultPaneOpen = useSelector((state) => state.app.resultPaneSmOpen)
  const filterMenuOpen = useSelector((state) => state.app.filterMenuOpen)

  const [breakpoints, setBreakpoints] = useState(PANE_BREAKPOINTS)
  const [breakpoint, setBreakpoint] = useState(0)
  const [modalPosition, setModalPosition] = useState(breakpoint)
  const [paneOpenFactor, setPaneOpenFactor] = useState(modalPosition)
  const [paneTransitionDirection, setPaneTransitionDirection] = useState('out')

  const [paneMinimizeFactor, setPaneMinimizeFactor] = useState(modalPosition)
  const [titleHidden, setTitleHidden] = useState(false)

  const searchBarOff = useSelector((state) => state.app.searchBarOff)

  const paneBreakpointsThreshold = PANE_BREAKPOINTS[PANE_BREAKPOINTS.length - 2]

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

  function onModalBreakpointDidChange(event) {
    const currentBreakpoint = event.detail.breakpoint
    setBreakpoint(currentBreakpoint)
    dispatch(setResultPaneSmCurrentBreakpoint(currentBreakpoint))
    // modalPosition is inferred continuously from the modal's CSS transform
    // matrix, which is only needed to animate smoothly *during* a drag. On
    // some real devices (e.g. when the mobile browser's toolbar hides/shows
    // mid-drag and shifts window.innerHeight) that inference can drift and
    // settle short of the breakpoint Ionic itself actually landed on,
    // leaving the pane visually fully open while modalPosition (and
    // everything derived from it: border-radius, the head bar, hiding the
    // search bar) still thinks it isn't. Resync to Ionic's own authoritative
    // settled breakpoint here.
    setModalPosition(currentBreakpoint)
  }

  function onBackBtnClick() {
    modalRef.current.setCurrentBreakpoint(PANE_INITIAL_BREAKPOINT)
  }

  function observeStyle(target, property, callback, initialValue = null) {
    let frameId, value

    const css = getComputedStyle(target)

    const observer = () => {
      frameId = requestAnimationFrame(observer)

      value = css.getPropertyValue(property).trim()

      if (value !== initialValue) {
        callback((initialValue = value))
      }
    }

    observer()

    return () => cancelAnimationFrame(frameId)
  }

  useEffect(() => {
    ;(async () => {
      await waitFor(() => modalRef.current?.shadowRoot?.querySelectorAll('.modal-wrapper').length > 0)

      const modalContent = modalRef.current.shadowRoot.querySelector('.modal-wrapper')
      let actualModalPosition = null

      observeStyle(modalContent, 'transform', function (matrix) {
        if (matrix.trim().startsWith('matrix')) {
          const modalContainerHeight = modalContent.getBoundingClientRect().height
          const ty =
            1 -
            parseFloat(
              matrix
                .substring(7, matrix.length - 1)
                .split(',')
                .pop(),
            ) /
              modalContainerHeight
          const newModalPosition = Math.round(ty * 100) / 100

          if (newModalPosition !== actualModalPosition) {
            // console.log('actualModalPosition: %o, newModalPosition: %o', actualModalPosition, newModalPosition)
            setModalPosition(newModalPosition)

            const newPaneTransitionDirection = newModalPosition < actualModalPosition ? 'in' : 'out'
            if (paneTransitionDirection !== newPaneTransitionDirection) {
              setPaneTransitionDirection(newPaneTransitionDirection)
              // console.log('[paneTransitionDirection] old : %s, new: %s', paneTransitionDirection, newPaneTransitionDirection)
            }

            actualModalPosition = newModalPosition
          }
        }
      })
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  /*
   * Open factor calculation
   */
  useEffect(() => {
    if (modalPosition < PANE_OPEN_THRESHOLD) {
      if (paneOpenFactor > 0) {
        setPaneOpenFactor(0)
      }
      return
    }

    const paneThreshold = PANE_OPEN_THRESHOLD * 100
    const openFactor = (modalPosition * 100 - paneThreshold) / (100 - paneThreshold)
    setPaneOpenFactor(easeOutQuad(openFactor))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [modalPosition])

  /*
   * Minimize factor calculation
   */
  useEffect(() => {
    function clamp(num) {
      return Math.min(Math.max(num, 0), 1)
    }

    const intervalHeight = breakpoints[1] - breakpoints[0]
    const minimizeFactor = clamp((modalPosition - breakpoints[0]) / intervalHeight)

    setPaneMinimizeFactor(minimizeFactor)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [modalPosition])

  useEffect(() => {
    const dY = 0.5
    const y = (1 - paneOpenFactor) * dY * 50
    paneHeadRef.current?.style?.setProperty('--oc-result-pane-head-surface-opacity', paneOpenFactor)
    paneHeadRef.current?.style?.setProperty('transform', `translate3d(0, -${y}px, 0)`)
    // Fully faded out, it's gone for taps, the keyboard and screen readers
    // too - the search bar is back in its place.
    paneHeadRef.current?.style?.setProperty('visibility', paneOpenFactor > 0 ? 'visible' : 'hidden')
  }, [paneOpenFactor])

  useEffect(() => {
    const borderRadius = `${1 - paneOpenFactor}rem`
    modalRef.current?.style?.setProperty('--oc-result-pane-border-radius', `${borderRadius} ${borderRadius} 0 0`)
  }, [paneOpenFactor])

  // Publishes the sheet's live height so the map's bottom-right controls
  // (geolocate, the editors' edit FAB) sit just above it, following drags
  // instead of being covered. Past the midpoint they'd float over the
  // details, so they fade out. The sheet is sized to window.innerHeight
  // (see AGENTS.md), matching modalPosition's fraction.
  useEffect(() => {
    const root = document.documentElement.style
    const visible = resultPaneOpen && !filterMenuOpen
    const hidden = visible && modalPosition > mapControlsHideThreshold
    root.setProperty('--oc-result-pane-sm-height', visible ? `${Math.max(0, modalPosition) * window.innerHeight}px` : '0px')
    root.setProperty('--oc-map-controls-opacity', hidden ? '0' : '1')
    root.setProperty('--oc-map-controls-visibility', hidden ? 'hidden' : 'visible')
  }, [modalPosition, resultPaneOpen, filterMenuOpen])

  // Keyboard focus moving to something below the screen (the sheet low):
  // the sheet opens fully and scrolls it into view - Tab otherwise wandered
  // through controls nobody could see. Pointer focus (a tap) leaves it be.
  useEffect(() => {
    const modal = modalRef.current
    if (!modal) return undefined
    function onFocusIn(event) {
      const target = event.target
      if (!target.matches?.(':focus-visible') || target === modal) return
      // Below the screen, or pressed against its bottom edge.
      if (target.getBoundingClientRect().bottom <= window.innerHeight - FOCUS_EDGE_MARGIN) return
      modal.setCurrentBreakpoint(1).then(() => target.scrollIntoView({ block: 'center' }))
    }
    modal.addEventListener('focusin', onFocusIn)
    return () => modal.removeEventListener('focusin', onFocusIn)
  }, [])

  // Another cave opens at the top of the sheet, not where the last one was
  // scrolled to.
  useLayoutEffect(() => {
    const view = modalRef.current?.querySelector('.oc-result-pane--scroll-view')
    if (view) view.scrollTop = 0
  }, [cave?.id])

  // The phone edit form's "place on map" mode (PlaceOnMapOverlay): minimize
  // the sheet so the map shows, then put it back exactly where it was -
  // same height, same scroll position in the form - when the mode ends.
  const placeOnMap = useSelector((state) => state.map.placeOnMap)
  const placeOnMapReturnRef = useRef(null)
  useEffect(() => {
    const modal = modalRef.current
    if (!modal) return
    const scrollView = () => modal.querySelector('.oc-result-pane--scroll-view')

    if (placeOnMap && !placeOnMapReturnRef.current) {
      // initialBreakpoint mirrors the sheet's current breakpoint (updated on
      // every breakpoint change); the local `breakpoint` state is 0 until
      // the first one.
      placeOnMapReturnRef.current = { breakpoint: initialBreakpoint, scrollTop: scrollView()?.scrollTop ?? 0 }
      modal.setCurrentBreakpoint(firstBreakpoint)
    } else if (!placeOnMap && placeOnMapReturnRef.current) {
      const { breakpoint: returnBreakpoint, scrollTop } = placeOnMapReturnRef.current
      placeOnMapReturnRef.current = null
      modal.setCurrentBreakpoint(returnBreakpoint).then(() => {
        const view = scrollView()
        if (view) view.scrollTop = scrollTop
      })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [placeOnMap])

  useEffect(
    () => () => {
      const root = document.documentElement.style
      ;['--oc-result-pane-sm-height', '--oc-map-controls-opacity', '--oc-map-controls-visibility'].forEach((name) => root.removeProperty(name))
      // Gone while fully up (a cave closed, its edit pane left): the search
      // bar it slid away comes back.
      dispatch(setSearchBarOff(false))
    },
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
    resultPaneOpen &&
    !filterMenuOpen && (
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
        <IonModal
          {...props}
          // Ionic copies it onto its role="dialog" wrapper, naming the pane.
          aria-label={caveName}
          ref={modalRef}
          isOpen={true}
          animated={false}
          breakpoints={breakpoints}
          handleBehavior="cycle"
          initialBreakpoint={initialBreakpoint}
          // keepContentsMounted={true}
          showBackdrop={false}
          backdropDismiss={false}
          backdropBreakpoint={1}
          // handle={breakpoint !== 1}
          mode="md"
          className={`oc-result-pane oc-result-pane-sm ${paneMinimizeFactor < 0.5 && 'oc-result-pane--minimize'}`}
          onIonBreakpointDidChange={onModalBreakpointDidChange}
        >
          <Box
            id="oc-result-pane"
            sx={{
              height: () => (breakpoint === 1 ? '100%' : null),
            }}
          >
            <Card className={`oc-result-pane--card${breakpoint === 1 ? ' oc-full-height' : ''}`} component="main">
              {/* One tree at every breakpoint: rendering the children under a
                  different wrapper per breakpoint (as this used to) made React
                  remount the whole pane whenever the sheet left or reached
                  full height - dropping the edit form's unsaved changes, and
                  any coordinate picked on the map while the sheet was
                  minimized. Below full height the view just doesn't scroll. */}
              <Scrollbars
                autoHide
                autoHeight
                autoHeightMax="100vh"
                hideTracksWhenNotNeeded={true}
                // ion-content-scroll-host: Ionic's sheet gesture only
                // defers to a scrolled container it recognizes (ion-content
                // or this class). Without it, dragging down in scrolled
                // content of the fully open pane moved the whole pane
                // instead of scrolling back up.
                renderView={({ className, style, ...viewProps }) => <div {...viewProps} style={breakpoint === 1 ? style : { ...style, overflow: 'hidden' }} className={`ion-content-scroll-host oc-result-pane--scroll-view ${className || ''}`.trim()} />}
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
                    //
                    // At full height, this pane's top offset
                    // (--oc-result-pane-sm-upper-height, to clear the search
                    // bar) pushes its own bottom edge past the viewport by the
                    // same amount, since Ionic's sheet modal sizes itself to
                    // window.innerHeight regardless of that offset. No amount
                    // of scrolling can reveal that permanently off-screen
                    // band, so pad it out here instead. window.innerHeight
                    // itself is unreliable on mobile Chrome (it can reflect
                    // the toolbar-hidden viewport even while the toolbar is
                    // shown), and Android's gesture-nav bar eats further space
                    // env(safe-area-inset-bottom) accounts for — so this is
                    // intentionally more generous than the precise offset
                    // value, confirmed insufficient on a real device (Pixel 10
                    // Pro) at exactly that value.
                    '&:last-child': {
                      pb: breakpoint === 1 ? `calc(var(--oc-pane-padding-inline) + ${RESULT_PANE_SM_UPPER_HEIGHT * 2}px + env(safe-area-inset-bottom, 0px))` : 'var(--oc-pane-padding-inline)',
                    },
                  }}
                >
                  {children}
                </CardContent>
              </Scrollbars>
            </Card>
          </Box>
        </IonModal>
      </ResultPaneSmContext.Provider>
    )
  )
}


import React, { createContext, useEffect, useMemo, useRef, useState } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { IonModal } from '@ionic/react'
import { Scrollbars } from 'react-custom-scrollbars-3'
import waitFor from 'p-wait-for'
import { useTranslation } from 'react-i18next'
import { Box, Card, CardContent, IconButton, Slide, Typography } from '@mui/material'
import { Grid } from '@mui/material'
import { useTheme } from '@mui/material/styles'
import { ExpandMoreRounded } from '@mui/icons-material'
import { setResultPaneSmCurrentBreakpoint, setSearchBarOff } from '@/redux/slices/appSlice'
import ResultPaneMenu from './ResultPaneMenu.jsx'
import { paneBreakpoints, paneInitialBreakpoint, paneOpenThreshold } from '@/config/app.js'
import { resultPaneSmUpperHeight } from '@/config/resultPane.js'
import './ResultPaneSm.scss'

function easeOutQuad(t, b = 0, c = 1, d = 1) {
  return -c * (t /= d) * (t - 2) + b
}

export const ResultPaneSmContext = createContext()

export default function ResultPaneSm({ children, cave, ...props }) {
  const modalRef = useRef({})
  const paneHeadRef = useRef({})

  const theme = useTheme()
  const dispatch = useDispatch()
  const { t: tMap } = useTranslation('map')
  const caveName = cave.name ? cave.name.value : tMap('caveNameUnknown')

  const firstBreakpoint = paneBreakpoints[0]
  const initialBreakpoint = useSelector((state) => state.app.resultPaneSmCurrentBreakpoint)
  const resultPaneOpen = useSelector((state) => state.app.resultPaneSmOpen)
  const filterMenuOpen = useSelector((state) => state.app.filterMenuOpen)

  const [breakpoints, setBreakpoints] = useState(paneBreakpoints)
  const [breakpoint, setBreakpoint] = useState(0)
  const [modalPosition, setModalPosition] = useState(breakpoint)
  const [paneOpenFactor, setPaneOpenFactor] = useState(modalPosition)
  const [paneTransitionDirection, setPaneTransitionDirection] = useState('out')

  const [paneMinimizeFactor, setPaneMinimizeFactor] = useState(modalPosition)
  const [titleHidden, setTitleHidden] = useState(false)

  const searchBarOff = useSelector((state) => state.app.searchBarOff)

  const paneBreakpointsThreshold = paneBreakpoints[paneBreakpoints.length - 2]

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
    modalRef.current.setCurrentBreakpoint(paneInitialBreakpoint)
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
    if (modalPosition < paneOpenThreshold) {
      if (paneOpenFactor > 0) {
        setPaneOpenFactor(0)
      }
      return
    }

    const paneThreshold = paneOpenThreshold * 100
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
  }, [paneOpenFactor])

  useEffect(() => {
    const borderRadius = `${1 - paneOpenFactor}rem`
    modalRef.current?.style?.setProperty('--oc-result-pane-border-radius', `${borderRadius} ${borderRadius} 0 0`)
  }, [paneOpenFactor])

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
          <Grid className="oc-result-pane--head" container ref={paneHeadRef} sx={{ alignItems: 'center' }}>
            <Grid>
              <IconButton
                className="oc-back-btn"
                aria-label="Back"
                onClick={onBackBtnClick}
                sx={{
                  p: 0,
                }}
              >
                <ExpandMoreRounded fontSize="large" />
              </IconButton>
            </Grid>
            <Grid size="grow" sx={{ overflow: 'hidden', pl: '8px' }}>
              <Slide in={titleHidden} direction="down" appear={false} mountOnEnter unmountOnExit>
                <Typography variant="caveDetailsHeader" component="p" noWrap sx={{ fontSize: '1.125rem', lineHeight: '1.5rem' }}>
                  {caveName}
                </Typography>
              </Slide>
            </Grid>
            <Grid>
              <ResultPaneMenu
                sx={{
                  p: 0,
                }}
              />
            </Grid>
          </Grid>
        )}
        <IonModal
          {...props}
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
              {breakpoint === 1 ? (
                <Scrollbars
                  autoHide
                  autoHeight
                  autoHeightMax="100vh"
                  hideTracksWhenNotNeeded={true}
                  renderThumbVertical={({ style, ...props }) => (
                    <div
                      {...props}
                      style={{
                        ...style,
                        cursor: 'pointer',
                        borderRadius: '50%',
                        backgroundColor: theme.palette.mode === 'light' ? 'rgba(0, 0, 0, 0.2)' : 'rgba(255, 255, 255, 0.12)',
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
                      // This pane's top offset (--oc-result-pane-sm-upper-height,
                      // to clear the search bar) pushes its own bottom edge past
                      // the viewport by the same amount, since Ionic's sheet
                      // modal sizes itself to window.innerHeight regardless of
                      // that offset. No amount of scrolling can reveal that
                      // permanently off-screen band, so pad it out here instead.
                      // window.innerHeight itself is unreliable on mobile Chrome
                      // (it can reflect the toolbar-hidden viewport even while
                      // the toolbar is shown), and Android's gesture-nav bar
                      // eats further space env(safe-area-inset-bottom) accounts
                      // for — so this is intentionally more generous than the
                      // precise offset value, confirmed insufficient on a real
                      // device (Pixel 10 Pro) at exactly that value.
                      '&:last-child': {
                        pb: `calc(var(--oc-pane-padding-inline) + ${resultPaneSmUpperHeight * 2}px + env(safe-area-inset-bottom, 0px))`,
                      },
                    }}
                  >
                    {children}
                  </CardContent>
                </Scrollbars>
              ) : (
                <CardContent
                  sx={{
                    p: 0,
                    pb: 'var(--oc-pane-padding-inline)',
                  }}
                >
                  {children}
                </CardContent>
              )}
            </Card>
          </Box>
        </IonModal>
      </ResultPaneSmContext.Provider>
    )
  )
}


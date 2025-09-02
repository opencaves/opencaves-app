import React, { createContext, useEffect, useMemo, useRef, useState } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { IonModal } from '@ionic/react'
import { Scrollbars } from 'react-custom-scrollbars-2'
import waitFor from 'p-wait-for'
import { Box, Card, CardContent, IconButton } from '@mui/material'
import Grid from '@mui/material/Unstable_Grid2'
import { useTheme } from '@mui/material/styles'
import { ExpandMoreRounded } from '@mui/icons-material'
import { setResultPaneSmCurrentBreakpoint, setSearchBarOff } from '@/redux/slices/appSlice'
import ResultPaneMenu from './ResultPaneMenu'
import { paneBreakpoints, paneInitialBreakpoint, paneOpenThreshold } from '@/config/app'
import './ResultPaneSm.scss'

function easeOutQuad(t, b = 0, c = 1, d = 1) {
  return -c * (t /= d) * (t - 2) + b
}

export const ResultPaneSmContext = createContext()

export default function ResultPaneSm({ children, ...props }) {

  const modalRef = useRef({})
  const paneHeadRef = useRef({})

  const theme = useTheme()
  const dispatch = useDispatch()

  const firstBreakpoint = paneBreakpoints[0]
  const initialBreakpoint = useSelector(state => state.app.resultPaneSmCurrentBreakpoint)
  const resultPaneOpen = useSelector(state => state.app.resultPaneSmOpen)
  const filterMenuOpen = useSelector(state => state.app.filterMenuOpen)

  const [breakpoints, setBreakpoints] = useState(paneBreakpoints)
  const [breakpoint, setBreakpoint] = useState(0)
  const [modalPosition, setModalPosition] = useState(breakpoint)
  const [paneOpenFactor, setPaneOpenFactor] = useState(modalPosition)
  const [paneTransitionDirection, setPaneTransitionDirection] = useState('out')

  const [paneMinimizeFactor, setPaneMinimizeFactor] = useState(modalPosition)

  const searchBarOff = useSelector(state => state.app.searchBarOff)

  const paneBreakpointsThreshold = paneBreakpoints[paneBreakpoints.length - 2]

  const contextData = useMemo(() => ({
    modalPosition,
    paneOpenFactor,
    paneMinimizeFactor
  }), [modalPosition, paneOpenFactor, paneMinimizeFactor])

  function onModalBreakpointDidChange(event) {
    const currentBreakpoint = event.detail.breakpoint
    setBreakpoint(currentBreakpoint)
    dispatch(setResultPaneSmCurrentBreakpoint(currentBreakpoint))
  }

  function onBackBtnClick() {
    modalRef.current.setCurrentBreakpoint(paneInitialBreakpoint)
  }

  function observeStyle(
    target,
    property,
    callback,
    initialValue = null
  ) {
    let frameId, value

    const css = getComputedStyle(target)

    const observer = () => {
      frameId = requestAnimationFrame(observer)

      value = css.getPropertyValue(property).trim()

      if (value !== initialValue) {
        callback(initialValue = value)
      }
    }

    observer()

    return () => cancelAnimationFrame(frameId)
  }

  useEffect(() => {
    (async () => {

      await waitFor(() => modalRef.current?.shadowRoot?.querySelectorAll('.modal-wrapper').length > 0)

      const modalContent = modalRef.current.shadowRoot.querySelector('.modal-wrapper')
      let actualModalPosition = null

      observeStyle(modalContent, 'transform', function (matrix) {
        if (matrix.trim().startsWith('matrix')) {
          const modalContainerHeight = modalContent.getBoundingClientRect().height
          const ty = 1 - (parseFloat(matrix.substring(7, matrix.length - 1).split(',').pop()) / modalContainerHeight)
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
    const openFactor = ((modalPosition * 100) - paneThreshold) / (100 - paneThreshold)
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
    const dY = .5
    const y = (1 - paneOpenFactor) * dY * 50
    paneHeadRef.current?.style?.setProperty('opacity', paneOpenFactor)
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
  }, [modalPosition])

  return resultPaneOpen && !filterMenuOpen && (
    <ResultPaneSmContext.Provider value={contextData}>
      {
        modalPosition > paneBreakpointsThreshold && (
          <Grid
            className='oc-result-pane--head'
            container
            alignItems='center'
            ref={paneHeadRef}
          >
            <Grid>
              <IconButton
                className='oc-back-btn'
                aria-label='Back'
                onClick={onBackBtnClick}
                sx={{
                  p: 0
                }}
              >
                <ExpandMoreRounded fontSize='large' />
              </IconButton>
            </Grid>
            <Grid xs></Grid>
            <Grid>
              <ResultPaneMenu
                sx={{
                  p: 0
                }} />
            </Grid>
          </Grid>
        )
      }
      <IonModal
        {...props}
        ref={modalRef}
        isOpen={true}
        animated={false}
        breakpoints={breakpoints}
        handleBehavior='cycle'
        initialBreakpoint={initialBreakpoint}
        // keepContentsMounted={true}
        showBackdrop={false}
        backdropDismiss={false}
        backdropBreakpoint={1}
        // handle={breakpoint !== 1}
        mode='md'
        className={`oc-result-pane oc-result-pane-sm ${paneMinimizeFactor < .5 && 'oc-result-pane--minimize'}`}
        onIonBreakpointDidChange={onModalBreakpointDidChange}
      >
        <Box
          id="oc-result-pane"
          sx={{
            height: () => breakpoint === 1 ? '100%' : null,
          }}
        >
          <Card
            className={`oc-result-pane--card${breakpoint === 1 ? ' oc-full-height' : ''}`}
            component='main'
          >
            {
              breakpoint === 1 ? (
                <Scrollbars
                  autoHide
                  autoHeight
                  autoHeightMax='100vh'
                  hideTracksWhenNotNeeded={true}
                  renderThumbVertical={({ style, ...props }) =>
                    <div
                      {...props}
                      style={{
                        ...style,
                        cursor: 'pointer',
                        borderRadius: '50%',
                        backgroundColor: theme.palette.mode === 'light' ? 'rgba(0, 0, 0, 0.2)' : 'rgba(255, 255, 255, 0.12)'
                      }} />
                  }
                >
                  <CardContent
                    sx={{
                      p: 0
                    }}
                  >
                    {children}
                  </CardContent>
                </Scrollbars>

              ) : (

                <CardContent
                  sx={{
                    p: 0
                  }}
                >
                  {children}
                </CardContent>
              )
            }
          </Card>
        </Box>
      </IonModal>
    </ResultPaneSmContext.Provider>
  )
}
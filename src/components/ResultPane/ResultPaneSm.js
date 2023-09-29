import React, { useEffect, useRef, useState } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { IonModal } from '@ionic/react'
import { Scrollbars } from 'react-custom-scrollbars-2'
import waitFor from 'p-wait-for'
import { Box, Card, CardContent, IconButton } from '@mui/material'
import Grid from '@mui/material/Unstable_Grid2'
import { useTheme } from '@mui/material/styles'
import { ExpandMoreRounded } from '@mui/icons-material'
import { setResultPaneSmInitialBreakpoint, setSearchBarOff } from '@/redux/slices/appSlice'
import ResultPaneMenu from './ResultPaneMenu'
import { paneBreakpoints, paneOpenThreshold } from '@/config/resultPane'
import './ResultPaneSm.scss'
import { useMatches } from 'react-router-dom'

// function easeInQuad(t, b = 0, c = 1, d = 1) {
//   return c * (t /= d) * t + b
// }

function easeOutQuad(t, b = 0, c = 1, d = 1) {
  return -c * (t /= d) * (t - 2) + b
}

export default function ResultPaneSm({ children }) {

  const modal = useRef({})
  const paneHead = useRef({})

  const theme = useTheme()
  const dispatch = useDispatch()
  const matches = useMatches()

  const firstBreakpoint = paneBreakpoints[0]
  const initialBreakpoint = useSelector(state => state.app.resultPaneSmInitialBreakpoint)
  const resultPaneOpen = useSelector(state => state.app.resultPaneSmOpen)
  const filterMenuOpen = useSelector(state => state.app.filterMenuOpen)

  const [breakpoint, setBreakpoint] = useState(0)
  const [modalPosition, setModalPosition] = useState(breakpoint)
  const [paneOpenFactor, setPaneOpenFactor] = useState(modalPosition)
  const [paneTransitionDirection, setPaneTransitionDirection] = useState('out')
  const searchBarOff = useSelector(state => state.app.searchBarOff)

  const paneBreakpointsThreshold = paneBreakpoints[paneBreakpoints.length - 2]

  function onModalBreakpointDidChange(event) {
    const actualBreakpoint = event.detail.breakpoint
    setBreakpoint(actualBreakpoint)
    dispatch(setResultPaneSmInitialBreakpoint(actualBreakpoint))
    console.log('[onModalBreakpointDidChange] actualBreakpoint: %o', actualBreakpoint)
  }

  function onBackBtnClick() {
    modal.current.setCurrentBreakpoint(firstBreakpoint)
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

      await waitFor(() => modal.current?.shadowRoot?.querySelectorAll('.modal-wrapper').length > 0)

      const modalContent = modal.current.shadowRoot.querySelector('.modal-wrapper')
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
    // console.log('========= open factor: %s', openFactor)
    // console.log('========= easeOutQuad: %s', easeOutQuad(openFactor))
  }, [modalPosition])

  useEffect(() => {
    const dY = .5
    const y = (1 - paneOpenFactor) * dY * 50
    paneHead.current?.style?.setProperty('opacity', paneOpenFactor)
    paneHead.current?.style?.setProperty('transform', `translate3d(0, -${y}px, 0)`)
  }, [paneOpenFactor])

  useEffect(() => {
    const borderRadius = `${1 - paneOpenFactor}rem`
    modal.current?.style?.setProperty('--oc-result-pane-border-radius', `${borderRadius} ${borderRadius} 0 0`)
  }, [paneOpenFactor])

  useEffect(() => {
    // if (modalPosition > paneBreakpointsThreshold) {
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
    <>
      {
        modalPosition > paneBreakpointsThreshold && (
          <Grid
            className='oc-result-pane--head'
            container
            alignItems='center'
            ref={paneHead}
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
        ref={modal}
        isOpen={true}
        handleBehavior='cycle'
        initialBreakpoint={initialBreakpoint}
        animated={false}
        breakpoints={paneBreakpoints}
        showBackdrop={false}
        backdropDismiss={false}
        backdropBreakpoint={1}
        // handle={breakpoint !== 1}
        mode='md'
        className='oc-result-pane oc-result-pane-sm'
        onIonBreakpointDidChange={onModalBreakpointDidChange}
      >
        <Box
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
    </>
  )
}
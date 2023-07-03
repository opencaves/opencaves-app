import React, { useEffect, useMemo, useRef, useState } from 'react'
import { useSelector } from 'react-redux'
import { IonModal } from '@ionic/react'
import { Scrollbars } from 'react-custom-scrollbars-2'
import waitFor from 'p-wait-for'
import { Box, Card, CardContent } from '@mui/material'
import Grid from '@mui/material/Unstable_Grid2'
import { useTheme } from '@mui/material/styles'
import IconButton from '@mui/material/IconButton'
import './ResultPaneSm.scss'
import { ExpandMoreRounded } from '@mui/icons-material'

export default function ResultPaneSm({ children }) {
  const PANE_OPEN_THRESHOLD = useSelector(state => state.app.resultPaneSmOpenThreshold)

  const modal = useRef({})
  const pane = useRef(null)
  const paneHead = useRef({})

  const theme = useTheme()
  console.log('theme: %o', theme)
  const firstBreakpoint = useSelector(state => state.app.resultPaneSmFirstBreakpoint)
  const restBreakpoints = useSelector(state => state.app.resultPaneSmRestBreakpoints)
  const resultPaneOpen = useSelector(state => state.app.resultPaneSmOpen)
  const filterMenuOpen = useSelector(state => state.app.filterMenuOpen)

  const [breakpoint, setBreakpoint] = useState(0)
  const [modalPosition, setModalPosition] = useState(breakpoint)
  const [paneOpenFactor, setPaneOpenFactor] = useState(modalPosition)

  function onModalBreakpointDidChange(event) {
    setBreakpoint(event.detail.breakpoint)
  }

  function onBackBtnClick() {
    modal.current.setCurrentBreakpoint(firstBreakpoint)
  }

  function observeStyle(
    target,
    property,
    callback,
    initialValue = ''
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
      await waitFor(() => modal.current.shadowRoot.querySelectorAll('.modal-wrapper').length > 0)
      const modalContent = modal.current.shadowRoot.querySelector('.modal-wrapper')
      // console.log('modalContent: %o', modalContent)
      let actualModalPosition = null
      observeStyle(modalContent, 'transform', function (matrix) {
        if (matrix.trim().startsWith('matrix')) {
          const modalContainerHeight = modalContent.getBoundingClientRect().height
          const ty = 1 - (parseFloat(matrix.substring(7, matrix.length - 1).split(',').pop()) / modalContainerHeight)
          const newModalPosition = Math.round(ty * 100) / 100

          if (newModalPosition !== actualModalPosition) {
            // console.log('ty: %s', ty)
            // console.log('newModalPosition: %s', newModalPosition)
            setModalPosition(newModalPosition)
            actualModalPosition = newModalPosition
          }
        }

      })
    })()
  })

  useEffect(() => {
    // console.log('========= modal position : %s', modalPosition)
    if (modalPosition < PANE_OPEN_THRESHOLD) {
      // setPaneHeadOpacity()
      return
    }

    const paneThreshold = PANE_OPEN_THRESHOLD * 100
    const openFactor = ((modalPosition * 100) - paneThreshold) / (100 - paneThreshold)
    setPaneOpenFactor(openFactor)
    console.log('========= open factor: %s', openFactor)
  }, [modalPosition, PANE_OPEN_THRESHOLD])

  useEffect(() => {
    paneHead.current?.style?.setProperty('opacity', paneOpenFactor)
  }, [paneOpenFactor])

  useEffect(() => {
    const borderRadius = `${1 - paneOpenFactor}rem`
    // console.log('========= pane: %o', pane)
    pane.current?.style?.setProperty('border-radius', `${borderRadius} ${borderRadius} 0 0`)
  }, [paneOpenFactor])


  return resultPaneOpen && !filterMenuOpen && (
    <>
      {
        modalPosition > restBreakpoints[0] && (
          <Grid
            className='pane-head'
            container
            alignItems='center'
            ref={paneHead}
            sx={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              height: '49px',
              bgcolor: 'background.paper',
              px: 'var(--oc-details-padding-inline)',
              zIndex: 1000,
              // transition: 'opacity',
              opacity: 0
            }}
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
          </Grid>
        )
      }
      <IonModal
        ref={modal}
        isOpen={true}
        handleBehavior='cycle'
        initialBreakpoint={firstBreakpoint}
        breakpoints={[firstBreakpoint, ...restBreakpoints]}
        showBackdrop={false}
        backdropDismiss={false}
        backdropBreakpoint={0.5}
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
            ref={pane}
            sx={{
              borderRadius: `1rem 1rem 0 0`,
              height: '100%'
            }}
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
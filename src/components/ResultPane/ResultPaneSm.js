import React, { useRef, useState } from 'react'
import { useSelector } from 'react-redux'
import { IonModal } from '@ionic/react'
import { Box, Card, CardContent } from '@mui/material'
import IconButton from '@mui/material/IconButton'
import ArrowBackRoundedIcon from '@mui/icons-material/ArrowBackRounded'
import './ResultPaneSm.scss'

export default function ResultPaneSm({ children }) {
  const modal = useRef(null)
  const firstBreakpoint = useSelector(state => state.app.resultPaneSmFirstBreakpoint)
  const restBreakpoints = useSelector(state => state.app.resultPaneSmRestBreakpoints)
  const resultPaneOpen = useSelector(state => state.app.resultPaneSmOpen)

  const [breakpoint, setBreakpoint] = useState(0)

  function onModalBreakpointDidChange(event) {
    setBreakpoint(event.detail.breakpoint)
  }

  function onBackBtnClick(event) {
    modal.current.setCurrentBreakpoint(firstBreakpoint)
  }

  return resultPaneOpen && (

    <IonModal
      ref={modal}
      isOpen={true}
      handleBehavior='cycle'
      initialBreakpoint={firstBreakpoint}
      breakpoints={[firstBreakpoint, ...restBreakpoints]}
      showBackdrop={false}
      backdropDismiss={false}
      backdropBreakpoint={0.25}
      mode='md'
      className='oc-result-pane oc-result-pane-sm'
      onIonBreakpointDidChange={onModalBreakpointDidChange}
    >
      <Box id='box'
        sx={{
          height: () => breakpoint === 1 ? '100%' : null,
        }}
      >
        <Card id='card'
          className={`oc-result-pane--card${breakpoint === 1 ? ' oc-full-height' : ''}`}
          sx={{
            borderRadius: () => breakpoint === 1 ? '0' : '1rem 1rem 0 0',
            height: '100%'
          }}
          component='main'
        >
          <CardContent
            sx={{
              p: 0
            }}
          >
            {
              breakpoint === 1 &&
              <IconButton aria-label='Back' className='oc-back-btn' onClick={onBackBtnClick}>
                <ArrowBackRoundedIcon />
              </IconButton>
            }
            {children}
          </CardContent>
        </Card>
      </Box>
    </IonModal>
  )
}
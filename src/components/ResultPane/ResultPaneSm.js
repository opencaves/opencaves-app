import React, { useRef, useState } from 'react'
import { useSelector } from 'react-redux'
import { IonModal, IonContent } from '@ionic/react'
import { Card, CardContent } from '@mui/material'
import IconButton from '@mui/material/IconButton'
import ArrowBackRoundedIcon from '@mui/icons-material/ArrowBackRounded'
// import { setResultPaneSmFirstBreakpoint } from '../../redux/slices/appSlice'
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
      <IonContent>
        <Card
          className={`oc-result-pane--card${breakpoint === 1 ? ' oc-full-height' : ''}`}
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
      </IonContent>
    </IonModal>
  )
}
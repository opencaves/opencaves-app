import React, { useRef, useState } from 'react'
import { IonCard, IonModal, IonContent, IonButton } from '@ionic/react'
import IconButton from '@mui/material/IconButton'
import ArrowBackRoundedIcon from '@mui/icons-material/ArrowBackRounded'
import './ResultPaneSm.scss'

export default function ResultPaneSm({ children }) {
  const modal = useRef(null)
  const [breakpoint, setBreakpoint] = useState(0)

  function onModalBreakpointDidChange(event) {
    setBreakpoint(event.detail.breakpoint)
  }

  function onBackBtnClick(event) {
    modal.current.setCurrentBreakpoint(.25)
  }

  return (

    <IonModal
      ref={modal}
      isOpen={true}
      handleBehavior='cycle'
      initialBreakpoint={0.25}
      breakpoints={[0.25, .5, 1]}
      backdropDismiss={false}
      backdropBreakpoint={0.5}
      className='oc-result-pane oc-result-pane-sm'
      onIonBreakpointDidChange={onModalBreakpointDidChange}
    >
      <IonContent>
        <IonCard className={`oc-result-pane--card${breakpoint === 1 ? ' oc-full-height' : ''}`}>
          {
            breakpoint === 1 &&
            <IconButton aria-label='Back' className='oc-back-btn' onClick={onBackBtnClick}>
              <ArrowBackRoundedIcon />
            </IconButton>
          }
          {children}
        </IonCard>
      </IonContent>
    </IonModal>
  )
}
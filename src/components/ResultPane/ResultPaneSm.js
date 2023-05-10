import React, { useRef } from 'react'
import { IonCard, IonModal, IonContent } from '@ionic/react'
import './ResultPaneSm.scss'

export default function ResultPaneSm({ children }) {
  const modal = useRef(null)

  return (

    <IonModal
      ref={modal}
      isOpen={true}
      initialBreakpoint={0.25}
      breakpoints={[0.25, 0.5, 0.75]}
      backdropDismiss={false}
      backdropBreakpoint={0.5}
      className='oc-result-pane oc-result-pane-sm'
    >
      <IonContent>
        <IonCard className='oc-result-pane--card'>
          {children}
        </IonCard>
      </IonContent>
    </IonModal>
  )
}
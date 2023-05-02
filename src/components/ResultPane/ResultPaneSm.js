import React, { useRef, useState } from 'react'
import { IonCard, IonCardHeader, IonCardTitle, IonCardSubtitle, IonModal, IonContent, IonCardContent } from '@ionic/react'
import './ResultPaneSm.scss'

export default function ResultPaneSm({ cave, children }) {
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
          {/* <IonCardHeader className='oc-result-pane--header'>
            <IonCardTitle>{cave.name}</IonCardTitle>
            {
              cave.aka && cave.aka.length && <IonCardSubtitle>{cave.aka.join(', ')}</IonCardSubtitle>
            }
          </IonCardHeader>
          <IonCardContent className='oc-result-pane--content'>
            <QuickActions cave={cave}></QuickActions>
          </IonCardContent> */}
        </IonCard>
      </IonContent>
    </IonModal>
  )
}
import React from 'react'
import { IonCard } from '@ionic/react'
import './ResultPaneLg.scss'

export default function ResultPaneLg({ children }) {

  return (
    <IonCard className='oc-result-pane oc-result-pane-lg'>
      {children}
    </IonCard>
  )
}
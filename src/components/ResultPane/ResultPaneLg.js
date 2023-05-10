import React from 'react'
import { IonCard } from '@ionic/react'
import './ResultPaneLg.scss'

export default function ResultPaneLg({ children }) {

  return (
    <IonCard className='oc-result-pane oc-result-pane-lg'>
      <img alt="" src="https://ionicframework.com/docs/img/demos/card-media.png" />
      {children}
    </IonCard>
  )
}
import React, { useRef, useState } from 'react'
import { IonCard, IonCardContent, IonCardHeader, IonCardSubtitle, IonCardTitle } from '@ionic/react'
import { useTranslation } from 'react-i18next'
import QuickActions from './QuickActions.js'
import Rating from '../Rating/Rating'
import './ResultPaneLg.scss'

export default function ResultPaneLg({ cave }) {
  const modal = useRef(null)
  const [count, setCount] = useState(0)
  const { t } = useTranslation()

  return (
    <IonCard className='oc-result-pane oc-result-pane-lg'>
      <img alt="" src="https://ionicframework.com/docs/img/demos/card-media.png" />
      <IonCardHeader className='oc-result-pane--header'>
        <IonCardTitle>{cave.name}</IonCardTitle>
        {
          cave.aka && cave.aka.length && <IonCardSubtitle>{cave.aka.join(', ')}</IonCardSubtitle>
        }
        <Rating value={cave.rating}></Rating>
        <p>{cave.color}</p>
      </IonCardHeader>

      <IonCardContent className='oc-result-pane--content'>
        <QuickActions cave={cave}></QuickActions>
      </IonCardContent>
    </IonCard>
  )
}
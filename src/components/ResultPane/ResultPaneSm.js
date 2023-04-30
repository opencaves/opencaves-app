import React, { useRef, useState } from 'react'
import {
  IonButton,
  IonCard,
  IonCardHeader,
  IonCardTitle,
  IonCardSubtitle,
  IonModal,
  IonHeader,
  IonContent,
  IonToolbar,
  IonTitle,
  IonPage,
  IonList,
  IonItem,
  IonLabel,
  IonAvatar,
  IonImg,
  IonSearchbar,
  IonCardContent,
} from '@ionic/react'
import QuickActions from './QuickActions.js'
import './ResultPaneSm.scss'

export default function ResultPaneSm({ cave }) {
  const modal = useRef(null)
  const [count, setCount] = useState(0)

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
          <IonCardHeader className='oc-result-pane--header'>
            <IonCardTitle>{cave.name}</IonCardTitle>
            {
              cave.aka && cave.aka.length && <IonCardSubtitle>{cave.aka.join(', ')}</IonCardSubtitle>
            }
          </IonCardHeader>
          <IonCardContent className='oc-result-pane--content'>
            <QuickActions cave={cave}></QuickActions>
          </IonCardContent>
        </IonCard>
        <div className="oc-result-pane--header">
          <h1 className='oc-result-header'>{cave.name}</h1>
          {
            cave.aka && cave.aka.length && <IonCardSubtitle>{cave.aka.join(', ')}</IonCardSubtitle>
          }
        </div>
        <div className="oc-result-pane--content">
          {/* <IonSearchbar onClick={() => modal.current?.setCurrentBreakpoint(0.75)} placeholder="Search"></IonSearchbar> */}
          <QuickActions></QuickActions>
          <IonList>
            <IonItem>
              <IonAvatar slot="start">
                <IonImg src="https://i.pravatar.cc/300?u=b" />
              </IonAvatar>
              <IonLabel>
                <h2>Connor Smith</h2>
                <p>Sales Rep</p>
              </IonLabel>
            </IonItem>
            <IonItem>
              <IonAvatar slot="start">
                <IonImg src="https://i.pravatar.cc/300?u=a" />
              </IonAvatar>
              <IonLabel>
                <h2>Daniel Smith</h2>
                <p>Product Designer</p>
              </IonLabel>
            </IonItem>
            <IonItem>
              <IonAvatar slot="start">
                <IonImg src="https://i.pravatar.cc/300?u=d" />
              </IonAvatar>
              <IonLabel>
                <h2>Greg Smith</h2>
                <p>Director of Operations</p>
              </IonLabel>
            </IonItem>
            <IonItem>
              <IonAvatar slot="start">
                <IonImg src="https://i.pravatar.cc/300?u=e" />
              </IonAvatar>
              <IonLabel>
                <h2>Zoey Smith</h2>
                <p>CEO</p>
              </IonLabel>
            </IonItem>
          </IonList>
        </div>
      </IonContent>
    </IonModal>
  )
}
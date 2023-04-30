import React from 'react'
import { IonPage, IonHeader, IonToolbar, IonTitle, IonContent } from '@ionic/react'

const SettingsPage = () => {
  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
          <IonTitle>Settings</IonTitle>
        </IonToolbar>
      </IonHeader>
      <IonContent>
        <h1>Settings</h1>
      </IonContent>
    </IonPage>
  )
}

export default SettingsPage
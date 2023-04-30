import { IonContent, IonPage } from '@ionic/react'
import Map from '../components/Map'
import SearchBar from '../components/SearchBar/SearchBar'
import './MapPage.scss'
import MapFilterMenu from '../components/MapFilterMenu.js'
import ResultPane from '../components/ResultPane/ResultPane.js'

export default function MapPage() {
  return (
    <>
      <IonPage id="main-content">
        <IonContent>
          <SearchBar />
          <Map />
          <ResultPane></ResultPane>
        </IonContent>
      </IonPage>
      <MapFilterMenu />
    </>
  )
}

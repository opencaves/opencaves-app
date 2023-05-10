import { IonContent, IonPage, IonRouterOutlet } from '@ionic/react'
import { Route, Redirect } from 'react-router-dom'
import Map from '../components/Map/Map'
import SearchBar from '../components/SearchBar/SearchBar'
import MapFilterMenu from '../components/Map/MapFilterMenu.js'
import ResultPane from '../components/ResultPane/ResultPane.js'
import './MapPage.scss'

export default function MapPage(props) {
  return (
    <>
      <IonPage id="main-content">
        <IonContent>
          <SearchBar />
          <Map />
          <ResultPane caveId={props.match.params.id} />
        </IonContent>
      </IonPage>
      <MapFilterMenu />
    </>
  )
}

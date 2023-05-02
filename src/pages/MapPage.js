import { IonContent, IonPage, IonRouterOutlet } from '@ionic/react'
import { Route, Redirect } from 'react-router-dom'
import Map from '../components/Map'
import SearchBar from '../components/SearchBar/SearchBar'
import MapFilterMenu from '../components/MapFilterMenu.js'
import ResultPane from '../components/ResultPane/ResultPane.js'
import './MapPage.scss'

export default function MapPage(props) {
  console.log('[MapPage] props: %o', props)
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

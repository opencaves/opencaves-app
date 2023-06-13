import { IonContent, IonPage } from '@ionic/react'
import { useMediaQuery } from '@mui/material'
import { useTheme } from '@mui/material/styles'
import Map from '../components/Map/Map'
import SearchBar from '../components/SearchBar/SearchBar'
import FilterMenu from '../components/Map/FilterMenu'
import ResultPane from '../components/ResultPane/ResultPane'
import './MapPage.scss'

export default function MapPage(props) {
  const theme = useTheme()
  const isXs = useMediaQuery(theme.breakpoints.only('xs'))
  const isSm = useMediaQuery(theme.breakpoints.only('sm'))
  const isMd = useMediaQuery(theme.breakpoints.only('md'))
  const isLg = useMediaQuery(theme.breakpoints.only('lg'))
  const dev = process.env.NODE_ENV === 'development'
  const breakpoint = isXs ? 'xs' : isSm ? 'sm' : isMd ? 'md' : isLg ? 'lg' : 'xl'

  return (
    <>
      <IonPage id="main-content">
        <IonContent>
          <SearchBar />
          <Map />
          <ResultPane caveId={props.match.params.id} />
        </IonContent>
      </IonPage>
      <FilterMenu />
      {
        dev && <div style={{
          position: 'absolute',
          left: '.5em',
          top: '.5em',
          fontSize: '.75rem',
          color: '#fff',
          backgroundColor: 'red',
          lineHeight: 1,
          padding: '.2em',
          opacity: .75,
          zIndex: 1000000
        }}>{breakpoint}</div>
      }
    </>
  )
}

import { useParams } from 'react-router-dom'
import { Fab, useMediaQuery, useTheme } from '@mui/material'
import { IonApp } from '@ionic/react'
import Map from '../components/Map/Map'
import SearchBar from '../components/SearchBar/SearchBar'
import FilterMenu from '../components/Map/FilterMenu'
import ResultPane from '../components/ResultPane/ResultPane'
import AppMenu from '../components/App/AppMenu'
import About from '../components/App/About'
import ModeSwitcher from '../components/ModeSwitcher'
import DebugBreakpoints from '../components/DebugBreakpoints'
import './MapPage.scss'

export default function MapPage() {
  const params = useParams()
  const dev = process.env.NODE_ENV === 'development'
  const theme = useTheme()
  const isLarge = useMediaQuery(theme.breakpoints.up('md'))

  return (
    <IonApp>
      <SearchBar />
      <Map />
      <ResultPane caveId={params.id} />
      <FilterMenu />
      {
        isLarge && (
          <AppMenu
            component={Fab}
            sx={{
              position: 'absolute',
              top: '1rem',
              right: '1rem',
              width: '50px',
              height: '50px',
              '> .MuiSvgIcon-root': {
                fontSize: '1.719rem'
              }
            }}
          />
        )
      }
      <About />
      {
        dev && <ModeSwitcher />
      }
      {
        dev && <DebugBreakpoints />
      }
    </IonApp>
  )
}

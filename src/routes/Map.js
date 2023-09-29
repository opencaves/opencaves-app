import { Outlet } from 'react-router-dom'
import { IonApp } from '@ionic/react'
import { useMediaQuery, useTheme } from '@mui/material'
import Map from '@/components/Map/Map'
import SearchBar from '@/components/SearchBar/SearchBar'
import FilterMenu from '@/components/Map/FilterMenu'
import AppMenu from '@/components/App/AppMenu'
import AddMediasProvider from '@/components/MediaPane/AddMedias/AddMediasProvider'
import Dev from '@/components/utils/Dev'
import './Map.scss'

export default function MapPage() {
  const theme = useTheme()
  const isLarge = useMediaQuery(theme.breakpoints.up('sm'))

  return (
    <IonApp>
      <AddMediasProvider>
        <SearchBar />
        <Map />
        <FilterMenu />
        {
          isLarge && (
            <AppMenu
              sx={{
                position: 'absolute',
                top: '1rem',
                right: '1rem',
                width: '40px',
                height: '40px',
                p: 0,
                '> .MuiSvgIcon-root': {
                  fontSize: '1.719rem'
                }
              }}
            />
          )
        }
        <Outlet />
        <Dev
          sx={{
            '--oc-mode-switcher-right': isLarge ? 'calc(40px + 2rem)' : '.5rem',
            '--oc-mode-switcher-top': isLarge ? '1rem' : 'calc(48px + 1rem)'
          }}
        />
      </AddMediasProvider>
    </IonApp>
  )
}

import { IonApp, setupIonicReact } from '@ionic/react'
import { Helmet, HelmetProvider } from 'react-helmet-async'
import { Fragment } from 'react'
import { useSelector, useDispatch } from 'react-redux'
import { CssVarsProvider } from "@mui/material-next/styles"
import { ThemeProvider } from '@mui/material/styles'
import { getData } from './services/data-service.js'
import { setDataLoadingState } from './redux/slices/dataSlice.js'
import Nav from './components/Nav'
import getDevicePixelRatio from './utils/getDevicePixelRatio.js'
import { theme, nextTheme } from './Theme.js'

import '@fontsource/open-sans/600.css'

/* Core CSS required for Ionic components to work properly */
import '@ionic/react/css/core.css'

/* Basic CSS for apps built with Ionic */
import '@ionic/react/css/normalize.css'
import '@ionic/react/css/structure.css'
import '@ionic/react/css/typography.css'

/* Optional CSS utils that can be commented out */
import '@ionic/react/css/padding.css'
import '@ionic/react/css/float-elements.css'
import '@ionic/react/css/text-alignment.css'
import '@ionic/react/css/text-transformation.css'
import '@ionic/react/css/flex-utils.css'
import '@ionic/react/css/display.css'

/* Theme variables */
import './theme/variables.scss'

import './App.scss'

setupIonicReact({
  mode: 'md'
})

document.addEventListener('DOMContentLoaded', () => {
  document.documentElement.style.setProperty('--oc-device-pixel-ratio', getDevicePixelRatio())
})

// console.log('theme: %o', theme)

const App = () => {

  const title = useSelector(state => state.navigation.title)

  const dispatch = useDispatch()

  getData()
    .then(() => {
      dispatch(setDataLoadingState({ state: 'loaded' }))
    })
    .catch(error => {
      dispatch(setDataLoadingState({ state: 'error', error }))
    })

  return (
    <Fragment>
      <ThemeProvider theme={theme}>
        {/* <ThemeProvider theme={nextTheme}> */}
        <CssVarsProvider theme={theme} />
        <HelmetProvider>
          <Helmet>
            <title>{title}</title>
          </Helmet>
          <IonApp>
            <Nav></Nav>
          </IonApp>
        </HelmetProvider>
        {/* </ThemeProvider> */}
      </ThemeProvider>
    </Fragment>
  )
}

export default App

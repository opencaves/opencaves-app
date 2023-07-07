import { IonApp, setupIonicReact } from '@ionic/react'
import { Helmet, HelmetProvider } from 'react-helmet-async'
import { Fragment, useMemo } from 'react'
import { useSelector, useDispatch } from 'react-redux'
import { Experimental_CssVarsProvider as CssVarsProvider } from '@mui/material/styles'
import { CssBaseline, GlobalStyles } from '@mui/material'
import { getData } from './services/data-service.js'
import { setDataLoadingState } from './redux/slices/dataSlice.js'
import Nav from './components/Nav'
import getDevicePixelRatio from './utils/getDevicePixelRatio.js'
import { theme } from './Theme.js'
import './utils/splash'

import '@fontsource/roboto/latin-300.css'
import '@fontsource/roboto/latin-400.css'
import '@fontsource/roboto/latin-500.css'
import '@fontsource/roboto/latin-700.css'

/* Core CSS required for Ionic components to work properly */
import '@ionic/react/css/core.css'

/* Basic CSS for apps built with Ionic */
// import '@ionic/react/css/normalize.css'
import '@ionic/react/css/structure.css'
// import '@ionic/react/css/typography.css'

/* Optional CSS utils that can be commented out */
// import '@ionic/react/css/padding.css'
// import '@ionic/react/css/float-elements.css'
// import '@ionic/react/css/text-alignment.css'
// import '@ionic/react/css/text-transformation.css'
// import '@ionic/react/css/flex-utils.css'
// import '@ionic/react/css/display.css'

// /* Theme variables */
import './theme/variables.scss'

import './App.scss'

setupIonicReact({
  mode: 'md'
})

document.addEventListener('DOMContentLoaded', () => {
  document.documentElement.style.setProperty('--oc-device-pixel-ratio', getDevicePixelRatio())
})

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
      <CssVarsProvider theme={theme}>
        <GlobalStyles
          styles={theme => ({
            ':root': {
              ...Object.entries(theme.transitions.duration).reduce((styles, style) => ({
                ...styles, [`--${theme.cssVarPrefix
                  }-transition-duration-${style[0]}`]: `${style[1]}ms`
              }), {})
            }
          })}
        />
        <CssBaseline />
        <HelmetProvider>
          <Helmet>
            <title>{title}</title>
            <link rel="apple-touch-icon" sizes="180x180" href="/pwa/icons/apple-touch-icon.png" />
            <link rel="icon" type="image/png" sizes="32x32" href="/pwa/icons/favicon-32x32.png" />
            <link rel="icon" type="image/png" sizes="16x16" href="/pwa/icons/favicon-16x16.png" />
            <link rel="manifest" href="/pwa/icons/site.webmanifest" />
            <link rel="mask-icon" href="/pwa/icons/safari-pinned-tab.svg" color="#1b4859" />
            <link rel="shortcut icon" href="/favicon.ico" />
            <meta name="apple-mobile-web-app-title" content="Open Caves" />
            <meta name="application-name" content="Open Caves" />
            <meta name="msapplication-TileColor" content="#da532c" />
            <meta name="msapplication-config" content="/pwa/icons/browserconfig.xml" />
            <meta name="theme-color" content="#1b4859" />
            {/* <style>`
              :root {
                ${theme.transitions.duration}
              }
              `</style> */}
          </Helmet>
          <IonApp>
            <Nav></Nav>
          </IonApp>
        </HelmetProvider>
      </CssVarsProvider>
    </Fragment>
  )
}

export default App

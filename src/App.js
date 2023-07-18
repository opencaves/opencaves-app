import { Helmet, HelmetProvider } from 'react-helmet-async'
import { Fragment } from 'react'
import { useSelector, useDispatch } from 'react-redux'
import { Experimental_CssVarsProvider as CssVarsProvider } from '@mui/material/styles'
import { Box, CssBaseline, GlobalStyles, useMediaQuery } from '@mui/material'
import { getData } from './services/data-service.js'
import { setDataLoadingState } from './redux/slices/dataSlice'
import Nav from './components/Nav'
import AppMenu from './components/App/AppMenu'
import ManageAppReload from './components/ManageAppReload'
import getDevicePixelRatio from './utils/getDevicePixelRatio'
import { theme } from './theme/Theme.js'
import './utils/splash'

import '@fontsource/roboto/latin-300.css'
import '@fontsource/roboto/latin-400.css'
import '@fontsource/roboto/latin-500.css'
import '@fontsource/roboto/latin-700.css'

// /* Theme variables */
import './theme/variables.scss'

import './App.scss'

document.addEventListener('DOMContentLoaded', () => {
  document.documentElement.style.setProperty('--oc-device-pixel-ratio', getDevicePixelRatio())
})

const App = () => {

  const dispatch = useDispatch()
  const title = useSelector(state => state.navigation.title)
  const isSmall = useMediaQuery(theme.breakpoints.down('sm'))

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
          </Helmet>
          {
            !isSmall && (
              <Box
                position='absolute'
                right='1rem'
                top='1rem'
                zIndex='var(--oc-app-menu-z-index)'
              >
                <AppMenu />
              </Box>
            )
          }
          <Nav></Nav>
          <ManageAppReload />
        </HelmetProvider>
      </CssVarsProvider>
    </Fragment>
  )
}

export default App

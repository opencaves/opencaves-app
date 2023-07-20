import { Helmet, HelmetProvider } from 'react-helmet-async'
import { Fragment } from 'react'
import { useSelector, useDispatch } from 'react-redux'
import { Experimental_CssVarsProvider as CssVarsProvider, useTheme } from '@mui/material/styles'
import { Box, CssBaseline, GlobalStyles, useMediaQuery } from '@mui/material'
import { getData } from './services/data-service.js'
import { setDataLoadingState } from './redux/slices/dataSlice'
import Nav from './components/Nav'
import TitleBar from './components/App/TitleBar'
import ManageAppReload from './components/ManageAppReload'
import getDevicePixelRatio from './utils/getDevicePixelRatio'
import { theme as themeProps } from './theme/Theme.js'
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
  const theme = useTheme()
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
      <CssVarsProvider theme={themeProps}>
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
          </Helmet>
          <TitleBar />
          <Nav></Nav>
          <ManageAppReload />
        </HelmetProvider>
      </CssVarsProvider>
    </Fragment>
  )
}

export default App

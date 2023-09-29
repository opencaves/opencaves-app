import { Helmet, HelmetProvider } from 'react-helmet-async'
import { Fragment } from 'react'
import { useDispatch } from 'react-redux'
import { RouterProvider } from 'react-router-dom'
import { Experimental_CssVarsProvider as CssVarsProvider } from '@mui/material/styles'
import { CssBaseline, GlobalStyles } from '@mui/material'
import router from './router'
import SnackbarProvider from '@/components/Snackbar/SnackbarProvider'
import { getData } from '@/services/data-service'
import { setDataLoadingState } from '@/redux/slices/dataSlice'
import TitleBar from '@/components/App/TitleBar'
import ManageAppUpdate from '@/components/App/ManageAppUpdate'
import ManageAuth from '@/components/auth/ManageAuth'
import Splash from '@/components/utils/Splash'
import getDevicePixelRatio from '@/utils/getDevicePixelRatio'
import { useTitle } from '@/hooks/useTitle'
import { theme } from '@/theme/Theme'
import { appTitle } from '@/config/app'

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
  const { title } = useTitle()

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
        <Splash />
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
          <Helmet
            defaultTitle={appTitle}
          >
            <title>{title}</title>
          </Helmet>
          <TitleBar />
          <SnackbarProvider>
            <RouterProvider router={router} />
          </SnackbarProvider>
          <ManageAppUpdate />
          <ManageAuth />
        </HelmetProvider>
      </CssVarsProvider>
    </Fragment>
  )
}

export default App

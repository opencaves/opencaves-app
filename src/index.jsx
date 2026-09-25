import React, { StrictMode } from 'react'
import { Provider } from 'react-redux'
import ReactDOM from 'react-dom/client'
import { setupIonicReact } from '@ionic/react'
import { PersistGate } from 'redux-persist/integration/react'
import { store, persistor } from '@/redux/store.jsx'
import App from './App.jsx'
import Profiler from '@/components/utils/Profiler.jsx'
import './i18n.js'
// import reportWebVitals from './reportWebVitals'

setupIonicReact({
  // mode: 'ios'
})

const root = ReactDOM.createRoot(document.getElementById('root'))
root.render(
  // <StrictMode>
  <Profiler name='App'>
    <Provider store={store}>
      <PersistGate loading={null} persistor={persistor}>
        <App />
      </PersistGate>
    </Provider>
  </Profiler>
  // </StrictMode >
)

// Google Tag Manager has no bearing on the app being usable - load and
// initialize it once the browser is idle instead of having it compete with
// the app's own bundle for bandwidth and parse time during initial load.
function initTagManager() {
  import('react-gtm-module').then(({ default: TagManager }) => {
    TagManager.initialize({ gtmId: 'GTM-WBL7VM3' })
  })
}

if ('requestIdleCallback' in window) {
  requestIdleCallback(initTagManager)
} else {
  setTimeout(initTagManager, 2000)
}

// If you want to start measuring performance in your app, pass a function
// to log results (for example: reportWebVitals(console.log))
// or send to an analytics endpoint. Learn more: https://bit.ly/CRA-vitals
// reportWebVitals(console.log)
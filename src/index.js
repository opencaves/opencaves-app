import React, { StrictMode } from 'react'
import { Provider } from 'react-redux'
import ReactDOM from 'react-dom/client'
import { setupIonicReact } from '@ionic/react'
import { PersistGate } from 'redux-persist/integration/react'
import TagManager from 'react-gtm-module'
import { store, persistor } from '@/redux/store'
import App from './App'
import Profiler from '@/components/utils/Profiler'
import './i18n'
// import reportWebVitals from './reportWebVitals'

setupIonicReact({
  // mode: 'ios'
})

TagManager.initialize({ gtmId: 'GTM-WBL7VM3' })

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

console.log('------------------------- test 12')

// If you want to start measuring performance in your app, pass a function
// to log results (for example: reportWebVitals(console.log))
// or send to an analytics endpoint. Learn more: https://bit.ly/CRA-vitals
// reportWebVitals(console.log)

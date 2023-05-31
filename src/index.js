import React from 'react'
import { Provider } from 'react-redux'
import ReactDOM from 'react-dom/client'
import { setupIonicReact } from '@ionic/react'
import { PersistGate } from 'redux-persist/integration/react'
import TagManager from 'react-gtm-module'
import { store, persistor } from './redux/store'
import App from './App'
import './i18n'
import './index.css'
import * as serviceWorkerRegistration from './serviceWorkerRegistration'
import reportWebVitals from './reportWebVitals'

setupIonicReact({
  // mode: 'ios'
})

TagManager.initialize({ gtmId: 'GTM-WBL7VM3' })

const root = ReactDOM.createRoot(document.getElementById('root'))
root.render(
  <React.StrictMode>
    <Provider store={store}>
      <PersistGate loading={null} persistor={persistor}>
        <App />
      </PersistGate>
    </Provider>
  </React.StrictMode>
)

// If you want your app to work offline and load faster, you can change
// unregister() to register() below. Note this comes with some pitfalls.
// Learn more about service workers: https://cra.link/PWA
serviceWorkerRegistration.register()

// If you want to start measuring performance in your app, pass a function
// to log results (for example: reportWebVitals(console.log))
// or send to an analytics endpoint. Learn more: https://bit.ly/CRA-vitals
reportWebVitals(console.log)

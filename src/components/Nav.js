import React from 'react'
import { IonRouterOutlet } from '@ionic/react'
import { Route, Redirect } from 'react-router-dom'
import { IonReactRouter } from '@ionic/react-router'
import { useSelector } from 'react-redux'
import { useTranslation } from 'react-i18next'

// import HomePage from '../pages/Home'
// import HomePageLeaflet from '../pages/HomeLeaflet'
import HomePage from '../pages/HomePage'
import MapPage from '../pages/MapPage'
import ProfilePage from '../pages/ProfilePage'
import SignInPage from '../pages/SignInPage'
import SettingsPage from '../pages/SettingsPage'

export default function Nav() {

  const isLoggedIn = useSelector(state => state.isLoggedIn)
  const { t } = useTranslation()

  return (
    <IonReactRouter>
      {/* <IonTabs>
        <IonTabBar slot="bottom">

          <IonTabButton tab="home" href="/">
            <IonIcon icon={home} aria-hidden="true" />
            <IonLabel>{t('nav.home')}</IonLabel>
          </IonTabButton>

          <IonTabButton tab="map" href="/map">
            <IonIcon icon={map} aria-hidden="true" />
            <IonLabel>{t('nav.map')}</IonLabel>
          </IonTabButton>

          <IonTabButton tab="settings" href="/settings">
            <IonIcon icon={settings} aria-hidden="true" />
            <IonLabel>{t('nav.settings')}</IonLabel>
          </IonTabButton>

          <IonTabButton tab="signin" href="/signin">
            <IonIcon icon={logInOutline} aria-hidden="true" />
            <IonLabel>{t('nav.signIn')}</IonLabel>
          </IonTabButton>

        </IonTabBar>
      </IonTabs> */}

      <IonRouterOutlet>
        <Route path='/' exact render={() => <Redirect to='/map' />} />
        {/* <Route path="/" exact={true} component={MapPage} /> */}
        <Route path="/settings" component={SettingsPage} />
        <Route path="/signin" render={props => {
          return isLoggedIn ? <Redirect to='/' /> : <SignInPage />
          // {/* <Route path='/:id' render={props => <MapPage {...props} />} /> */}
        }
        } />
        <Route path="/map" component={MapPage} />
        <Route path='/map/:id' render={props => <MapPage {...props} />} />

      </IonRouterOutlet>
    </IonReactRouter>
  )
}

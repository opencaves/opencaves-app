import React from 'react'
import { IonRouterOutlet } from '@ionic/react'
import { Route, Redirect } from 'react-router-dom'
import { IonReactRouter } from '@ionic/react-router'
import { useSelector } from 'react-redux'

// import HomePage from '../pages/Home'
// import HomePageLeaflet from '../pages/HomeLeaflet'
import HomePage from '../pages/HomePage'
import MapPage from '../pages/MapPage'
import ProfilePage from '../pages/ProfilePage'
import SignInPage from '../pages/SignInPage'
import SettingsPage from '../pages/SettingsPage'
import NoMatch from '../pages/NoMatch'

export default function Nav() {

  const isLoggedIn = useSelector(state => state.isLoggedIn)

  return (
    <IonReactRouter>

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
        {/* <Route path='/map/:id' render={props => <MapPage {...props} />} /> */}

        {/* <Route path="*" component={NoMatch} /> */}

      </IonRouterOutlet>
    </IonReactRouter>
  )
}

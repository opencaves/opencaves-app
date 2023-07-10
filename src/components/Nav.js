import React from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useSelector } from 'react-redux'

import HomePage from '../pages/HomePage'
import MapPage from '../pages/MapPage'
import ProfilePage from '../pages/ProfilePage'
import SignInPage from '../pages/SignInPage'
import SettingsPage from '../pages/SettingsPage'
import LoadingPage from '../pages/LoadingPage'
import NoMatch from '../pages/NoMatch'

export default function Nav() {

  const isLoggedIn = useSelector(state => state.isLoggedIn)

  return (
    <BrowserRouter>
      <Routes>
        <Route path='/' element={<Navigate to='/map' />} />
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="/signin" element={props => {
          return isLoggedIn ? <Navigate to='/' /> : <SignInPage />
          // {/* <Route path='/:id' render={props => <MapPage {...props} />} /> */}
        }
        } />
        <Route path="/map/:id?" element={<MapPage />} />
        {/* <Route path='/map/:id' render={props => <MapPage {...props} />} /> */}

        <Route path="/loading" element={<LoadingPage />} />
        <Route path="*" element={<NoMatch />} />
      </Routes>

    </BrowserRouter >
  )
}

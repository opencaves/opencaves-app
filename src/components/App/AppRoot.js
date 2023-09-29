import { useEffect } from 'react'
import { Outlet, Route, Routes, useLocation } from 'react-router-dom'
import { debounce } from 'lodash'
import AboutDialog from './AboutDialog'

export default function AppRoot() {
  const location = useLocation()
  const state = location.state

  useEffect(() => {
    function setVhUnit() {
      const vh = window.innerHeight * 0.01
      document.documentElement.style.setProperty('--vh', `${vh}px`)
    }
    const debounced = debounce(setVhUnit, 100)

    window.addEventListener('resize', debounced)

    setVhUnit()

    return () => {
      window.removeEventListener('resize', debounced)
    }
  }, [])

  return (
    <>
      {
        state?.backgroundLocation && (
          <Routes>
            <Route path='/about' element={<AboutDialog open={true} />} />
          </Routes>
        )
      }
      <Outlet />
    </>
  )
}
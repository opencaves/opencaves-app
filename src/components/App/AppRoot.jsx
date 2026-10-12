import { useEffect } from 'react'
import { Outlet } from 'react-router-dom'
import debounce from 'lodash/debounce'
import AboutDialog from './AboutDialog.jsx'
import FeedbackDialog from '@/components/Feedback/FeedbackDialog.jsx'
import ToursDialog from '@/components/Tours/ToursDialog.jsx'
import TourPrompt from '@/components/Tours/TourPrompt.jsx'
import AuthPromptDialog from '@/components/auth/AuthPromptDialog.jsx'
import FeedbackTab from '@/components/Feedback/FeedbackTab.jsx'
import RouteSeo from '@/components/Seo/RouteSeo.jsx'
import RouteFocus from './RouteFocus.jsx'
import SkipLink from './SkipLink.jsx'

export default function AppRoot() {
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
      {/* First in the page: the keyboard's first stop. */}
      <SkipLink />
      <RouteSeo />
      {/* The focus on the new page's heading after a navigation. */}
      <RouteFocus />
      {/* A first visit's offer of the guided tour (once per device). */}
      <TourPrompt />
      {/* About, over any page (openAboutDialog). */}
      <AboutDialog />
      {/* Send feedback, over any page (openFeedback). */}
      <FeedbackDialog />
      {/* Take the tour, over any page (openToursDialog). */}
      <ToursDialog />
      <AuthPromptDialog />
      <FeedbackTab />
      <Outlet />
    </>
  )
}
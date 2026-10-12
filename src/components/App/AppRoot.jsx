import { useEffect } from 'react'
import { Outlet } from 'react-router-dom'
import { debounce } from 'lodash'
import AboutDialog from './AboutDialog.jsx'
import FeedbackDialog from '@/components/Feedback/FeedbackDialog.jsx'
import AuthPromptDialog from '@/components/auth/AuthPromptDialog.jsx'
import FeedbackTab from '@/components/Feedback/FeedbackTab.jsx'
import RouteSeo from '@/components/Seo/RouteSeo.jsx'
import RouteFocus from './RouteFocus.jsx'
import SkipLink from './SkipLink.jsx'
import WelcomeDialog from './WelcomeDialog.jsx'

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
      {/* A first visit's welcome (once per device). */}
      <WelcomeDialog />
      {/* About, over any page (openAboutDialog). */}
      <AboutDialog />
      {/* Send feedback, over any page (openFeedback). */}
      <FeedbackDialog />
      <AuthPromptDialog />
      <FeedbackTab />
      <Outlet />
    </>
  )
}
import { useEffect, useRef, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Box, Dialog, DialogContent, IconButton } from '@mui/material'
import CloseRounded from '@mui/icons-material/CloseRounded'
import About from './About.jsx'
import { APP_NAME } from '@/config/app.js'
import { OPEN_ABOUT_EVENT } from '@/utils/aboutDialog.js'

/**
 * About, over the page shown (openAboutDialog): the address says /about
 * while it's open - a history entry of its own, outside the router, so the
 * page under it stays as it is - and Back or closing it returns to the
 * page's. A visit straight to /about gets the About page instead.
 */
export default function AboutDialog() {
  const [open, setOpen] = useState(false)
  const { t } = useTranslation('about', { keyPrefix: 'dialog' })
  const location = useLocation()
  // Whether the /about entry is still in the history (to go back from it on close).
  const pushed = useRef(false)

  useEffect(() => {
    function onOpen() {
      // The router's own state, one step further, so it counts Back right.
      const idx = typeof window.history.state?.idx === 'number' ? window.history.state.idx + 1 : undefined
      window.history.pushState({ ...window.history.state, idx, key: 'about' }, '', '/about')
      pushed.current = true
      setOpen(true)
    }
    window.addEventListener(OPEN_ABOUT_EVENT, onOpen)
    return () => window.removeEventListener(OPEN_ABOUT_EVENT, onOpen)
  }, [])

  // Back while it's open: the address is the page's again; it closes.
  useEffect(() => {
    if (!open) return undefined
    function onPopState() {
      pushed.current = false
      setOpen(false)
    }
    window.addEventListener('popstate', onPopState)
    return () => window.removeEventListener('popstate', onPopState)
  }, [open])

  // Going to another page (a link in it): it closes, its entry left behind.
  useEffect(() => {
    pushed.current = false
    setOpen(false)
  }, [location.pathname])

  function onExited() {
    if (!pushed.current) return
    pushed.current = false
    window.history.back()
  }

  return (
    <Dialog
      className="oc-about-dialog dialog"
      open={open}
      onClose={() => setOpen(false)}
      aria-label={t('ariaLabel', { name: APP_NAME })}
      maxWidth={false}
      slotProps={{ transition: { onExited } }}
    >
      <IconButton aria-label={t('close')} onClick={() => setOpen(false)} sx={{ position: 'absolute', right: '1rem', top: '1rem', color: 'text.secondary' }}>
        <CloseRounded />
      </IconButton>
      <DialogContent>
        <Box sx={{ mt: 6, pb: 1.5 }}>
          <About />
        </Box>
      </DialogContent>
    </Dialog>
  )
}

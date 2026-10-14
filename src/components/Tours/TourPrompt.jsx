import { useEffect, useRef, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { useSelector } from 'react-redux'
import { useTranslation } from 'react-i18next'
import { Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, Typography } from '@mui/material'
import { APP_NAME } from '@/config/app.js'
import LogoIcon from '@/components/App/LogoIcon.jsx'
import DialogCloseButton from '@/components/DialogCloseButton.jsx'
import { MAIN_TOUR_ID } from '@/tours/tourList.js'
import { useStartTour } from './ToursDialog.jsx'
import { track } from '@/utils/track.js'

// The browser's note that this device was asked. Its own key, not the
// welcome dialog's (oc-welcome-seen) it replaced: the beta testers, who saw
// that dialog, are offered the tours once too.
const SEEN_KEY = 'oc-tour-prompt-seen'
// How long after the page shows before it opens (the page first).
const DELAY_MS = 1200
// Pages it never opens over: signing in or up is already the next step; and
// a link to one cave or system (a shared link: what was asked for comes first,
// the prompt waits for a later visit).
const SKIPPED_PATHS = /^\/(login|signup|dev)(\/|$)|^\/(caves|sistemas|map)\/[^/]+/
// ?no-welcome-splash=true: not this visit, nothing noted - for measuring the
// pages themselves (Lighthouse), the prompt being temporary.
const SKIP_PARAM = 'no-welcome-splash'

// Whether to ask: a device not asked yet. A browser that keeps nothing
// (private mode, blocked storage) is never asked - better than on every visit.
function firstVisit() {
  try {
    return window.localStorage.getItem(SEEN_KEY) === null
  } catch {
    return false
  }
}

function markSeen() {
  try {
    window.localStorage.setItem(SEEN_KEY, new Date().toISOString())
  } catch {
    // Nowhere to keep it: it simply won't open again this visit.
  }
}

/**
 * On a first visit (once per device), a moment after the page shows: would
 * they like the guided tour? Take the tour starts Discover OpenCaves (the
 * only tour that starts without the menus' Take the tour); Not now or
 * closing it lets them be. Either way it isn't asked again. Not on a link to
 * one cave or system, nor with ?no-welcome-splash=true (for measuring the
 * page itself): a later visit asks.
 */
export default function TourPrompt() {
  const { t } = useTranslation('tours', { keyPrefix: 'prompt' })
  const location = useLocation()
  const startTour = useStartTour()
  // Whether the account is known yet (a signed-in user looks signed out
  // until Firebase Auth restores the session).
  const authResolved = useSelector((/** @type {RootState} */ state) => state.session.authResolved)
  const [open, setOpen] = useState(false)
  // Decided once per visit: asked, or not to ask.
  const decided = useRef(false)
  // The tour chosen, started once the dialog has gone.
  const takeTour = useRef(false)

  useEffect(() => {
    if (decided.current || !authResolved) return undefined
    // Arrived on a skipped page: not this visit (nothing noted, so a later
    // visit asks).
    if (!firstVisit() || SKIPPED_PATHS.test(location.pathname) || new URLSearchParams(location.search).get(SKIP_PARAM) === 'true') {
      decided.current = true
      return undefined
    }
    const timer = setTimeout(() => {
      decided.current = true
      // Noted once it actually shows: a reload doesn't bring it back.
      markSeen()
      setOpen(true)
    }, DELAY_MS)
    return () => clearTimeout(timer)
    // Once the account is known, on arrival - not on every page change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authResolved])

  // How it was answered: the tour taken, Not now, or closed.
  function close(withTour, answer) {
    takeTour.current = withTour
    track('tour_prompt', { tour_answer: answer })
    setOpen(false)
  }

  function onExited() {
    if (!takeTour.current) return
    takeTour.current = false
    startTour(MAIN_TOUR_ID)
  }

  // M3's dialog with a hero icon: its container (surface container high,
  // extra-large 28dp corners, 24dp in), the icon and the headline centred
  // (headline small), the text in body large in the full text colour for
  // easy reading, the menu's hint a step quieter, the actions at the end.
  return (
    <Dialog
      className="oc-tour-prompt"
      open={open}
      onClose={() => close(false, 'close')}
      fullWidth
      aria-labelledby="oc-tour-prompt-title"
      aria-describedby="oc-tour-prompt-text"
      slotProps={{
        transition: { onExited },
        paper: { sx: (theme) => ({ maxWidth: 440, borderRadius: '28px', bgcolor: theme.vars.sys.color.surfaceContainerHigh, backgroundImage: 'none' }) },
      }}
    >
      {/* The app's rule: an X on every dialog. */}
      <DialogCloseButton onClick={() => close(false, 'close')} />
      <Box sx={{ display: 'flex', justifyContent: 'center', pt: 4 }}>
        <LogoIcon sx={{ width: 56, height: 56 }} />
      </Box>
      <DialogTitle id="oc-tour-prompt-title" sx={{ textAlign: 'center', px: 3, pt: 2, pb: 2, fontSize: '1.5rem', lineHeight: '2rem', fontWeight: 400 }}>
        {t('title', { name: APP_NAME })}
      </DialogTitle>
      <DialogContent sx={{ px: 3, pb: 1 }}>
        <Typography id="oc-tour-prompt-text" sx={{ fontSize: '1rem', lineHeight: 1.5, color: 'text.primary', textAlign: 'center' }}>
          {t('text')}
        </Typography>
        <Typography sx={{ mt: 2, fontSize: '0.875rem', lineHeight: 1.43, color: 'text.secondary', textAlign: 'center' }}>
          {t('hint')}
        </Typography>
      </DialogContent>
      {/* Side by side; stacked on a narrow phone, the main action on top. */}
      <DialogActions sx={{ px: 3, pt: 3, pb: 3, gap: 1, flexDirection: { xs: 'column-reverse', sm: 'row' }, alignItems: 'stretch', '& > :not(style) ~ :not(style)': { ml: 0 }, '& .MuiButton-root': { whiteSpace: 'nowrap', minHeight: 40, px: 3, fontSize: '0.875rem', borderRadius: '20px', textTransform: 'none' } }}>
        <Button onClick={() => close(false, 'not_now')} sx={{ color: 'var(--mui-sys-color-primary)' }}>
          {t('notNow')}
        </Button>
        <Button variant="contained" disableElevation onClick={() => close(true, 'take')}>
          {t('start')}
        </Button>
      </DialogActions>
    </Dialog>
  )
}

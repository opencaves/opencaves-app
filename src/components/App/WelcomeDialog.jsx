import { useEffect, useRef, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useDispatch, useSelector } from 'react-redux'
import { Trans, useTranslation } from 'react-i18next'
import { Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, Typography } from '@mui/material'
import ScienceRounded from '@mui/icons-material/ScienceRounded'
import { APP_NAME } from '@/config/app.js'
import { buildContinueUrl, setContinueUrl } from '@/redux/slices/sessionSlice.jsx'
import LogoIcon from './LogoIcon.jsx'
import DialogCloseButton from '@/components/DialogCloseButton.jsx'

// The browser's note that this device has seen the welcome.
const SEEN_KEY = 'oc-welcome-seen'
// How long after the page shows before it opens (the page first, then the
// welcome).
const DELAY_MS = 1200
// Pages it never opens over: signing in or up is already the next step; and
// a link to one cave or system (a shared link: what was asked for comes first,
// the welcome waits for a later visit).
const SKIPPED_PATHS = /^\/(login|signup|dev)(\/|$)|^\/(caves|sistemas|map)\/[^/]+/

// Whether it's to show: a device that hasn't seen it. A browser that keeps
// nothing (private mode, blocked storage) never sees it - better than on
// every visit.
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
 * A welcome on a first visit (once per device): what OpenCaves is, an
 * invitation to help complete the cave data - with an account to create, or
 * thanks for the one they have - and the beta's warning: edits aren't kept
 * for good yet, so it's the time to try.
 */
export default function WelcomeDialog() {
  const { t } = useTranslation('welcome')
  const dispatch = useDispatch()
  const location = useLocation()
  const isLoggedIn = useSelector((state) => state.session.isLoggedIn)
  // Whether the account is known yet (a signed-in user looks signed out
  // until Firebase Auth restores the session): the welcome waits for it, to
  // say the right thing.
  const authResolved = useSelector((state) => state.session.authResolved)
  const [open, setOpen] = useState(false)
  // Decided once per visit: shown, or not to show.
  const decided = useRef(false)

  useEffect(() => {
    if (decided.current || !authResolved) return undefined
    // Arrived on the sign-in pages: not this visit (nothing noted, so a later
    // visit gets it).
    if (!firstVisit() || SKIPPED_PATHS.test(location.pathname)) {
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

  const close = () => setOpen(false)

  return (
    <Dialog className="oc-welcome-dialog" open={open} onClose={close} maxWidth="xs" fullWidth aria-labelledby="oc-welcome-dialog-title" aria-describedby="oc-welcome-dialog-text">
      {/* The app's rule: an X on every dialog. */}
      <DialogCloseButton onClick={close} />
      <Box sx={{ display: 'flex', justifyContent: 'center', pt: 3 }}>
        <LogoIcon sx={{ width: 48, height: 48 }} />
      </Box>
      <DialogTitle id="oc-welcome-dialog-title" sx={{ textAlign: 'center', pb: 1 }}>
        {t('title', { name: APP_NAME })}
      </DialogTitle>
      {/* dividers: when it scrolls (a phone), lines above and below say so. */}
      <DialogContent id="oc-welcome-dialog-text" dividers>
        <Typography sx={{ mb: 2 }}>{t('intro', { name: APP_NAME })}</Typography>
        <Typography sx={{ mb: 2 }}>{t(isLoggedIn ? 'inviteMember' : 'invite')}</Typography>
        {/* The beta's warning, apart on a tonal surface. */}
        <Box className="oc-welcome-dialog--beta" sx={{ display: 'flex', gap: 1.5, p: 2, borderRadius: 3, bgcolor: 'var(--mui-sys-color-surfaceContainerHighest)' }}>
          <ScienceRounded sx={{ color: 'text.secondary', flexShrink: 0, mt: 0.25 }} />
          <Typography variant="body2">
            <Trans t={t} i18nKey={isLoggedIn ? 'betaMember' : 'beta'} components={{ strong: <strong /> }} />
          </Typography>
        </Box>
      </DialogContent>
      {/* Side by side; stacked on a narrow phone, the main action on top. */}
      <DialogActions sx={{ px: 3, pt: 2.5, pb: 3, gap: 1, flexDirection: { xs: 'column-reverse', sm: 'row' }, alignItems: 'stretch', '& > :not(style) ~ :not(style)': { ml: 0 }, '& .MuiButton-root': { whiteSpace: 'nowrap' } }}>
        {isLoggedIn ? (
          <Button variant="contained" disableElevation onClick={close}>
            {t('start')}
          </Button>
        ) : (
          <>
            <Button onClick={close} sx={{ color: 'var(--mui-sys-color-primary)' }}>
              {t('later')}
            </Button>
            <Button
              variant="contained"
              disableElevation
              component={Link}
              to="/signup"
              onClick={() => {
                dispatch(setContinueUrl(buildContinueUrl(location)))
                close()
              }}
            >
              {t('signup')}
            </Button>
          </>
        )}
      </DialogActions>
    </Dialog>
  )
}

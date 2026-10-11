import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useStore } from 'react-redux'
import { useTranslation } from 'react-i18next'
import { Dialog, DialogContent, DialogTitle, List, ListItemButton, ListItemIcon, ListItemText, Typography } from '@mui/material'
import ExploreRounded from '@mui/icons-material/ExploreRounded'
import InstallMobileRounded from '@mui/icons-material/InstallMobileRounded'
import CloudOffRounded from '@mui/icons-material/CloudOffRounded'
import NewReleasesRounded from '@mui/icons-material/NewReleasesRounded'
import DialogCloseButton from '@/components/DialogCloseButton.jsx'
import { OPEN_TOURS_EVENT, TOUR_IDS, startTour } from '@/tours/tourList.js'

const TOUR_ICONS = {
  discover: <ExploreRounded />,
  install: <InstallMobileRounded />,
  offline: <CloudOffRounded />,
  whatsNew: <NewReleasesRounded />,
}

/**
 * Starts a tour from a component: the router's navigate, the translations
 * and the store handed to the engine.
 *
 * @returns {(tourId: string) => void}
 */
export function useStartTour() {
  const navigate = useNavigate()
  const store = useStore()
  const { t } = useTranslation('tours')
  return (tourId) => {
    startTour(tourId, { navigate, t, store }).catch((error) => console.error(error))
  }
}

/**
 * "Take the tour", over any page (openToursDialog, from the menus): the
 * guided tours, each with its title and what it shows; picking one closes
 * the dialog and starts it.
 */
export default function ToursDialog() {
  const { t } = useTranslation('tours')
  const [open, setOpen] = useState(false)
  const startTourNow = useStartTour()
  // The tour picked, started once the dialog has gone (its focus trap and
  // the page's aria-hidden with it).
  const picked = useRef(null)

  useEffect(() => {
    const onOpen = () => setOpen(true)
    window.addEventListener(OPEN_TOURS_EVENT, onOpen)
    return () => window.removeEventListener(OPEN_TOURS_EVENT, onOpen)
  }, [])

  function pick(tourId) {
    picked.current = tourId
    setOpen(false)
  }

  function onExited() {
    const tourId = picked.current
    picked.current = null
    if (tourId) startTourNow(tourId)
  }

  return (
    <Dialog className="oc-tours-dialog" open={open} onClose={() => setOpen(false)} maxWidth="xs" fullWidth aria-labelledby="oc-tours-dialog-title" aria-describedby="oc-tours-dialog-text" slotProps={{ transition: { onExited } }}>
      {/* The app's rule: an X on every dialog. */}
      <DialogCloseButton onClick={() => setOpen(false)} />
      <DialogTitle id="oc-tours-dialog-title" sx={{ pr: 7 }}>
        {t('dialog.title')}
      </DialogTitle>
      <DialogContent sx={{ px: 1.5, pb: 2 }}>
        <Typography id="oc-tours-dialog-text" variant="body2" color="text.secondary" sx={{ px: 1.5, mb: 1 }}>
          {t('dialog.text')}
        </Typography>
        <List disablePadding>
          {TOUR_IDS.map((tourId) => (
            <ListItemButton key={tourId} className={`oc-tours-dialog--tour oc-tours-dialog--tour-${tourId}`} onClick={() => pick(tourId)} sx={{ borderRadius: 3, alignItems: 'flex-start', py: 1.25 }}>
              <ListItemIcon sx={{ color: 'var(--mui-sys-color-primary)', mt: 0.25 }}>{TOUR_ICONS[tourId]}</ListItemIcon>
              <ListItemText primary={t(`list.${tourId}.title`)} secondary={t(`list.${tourId}.description`)} slotProps={{ primary: { sx: { fontWeight: 500 } } }} sx={{ my: 0 }} />
            </ListItemButton>
          ))}
        </List>
      </DialogContent>
    </Dialog>
  )
}

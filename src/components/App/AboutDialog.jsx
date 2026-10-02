
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Box, Dialog, DialogContent, IconButton } from '@mui/material'
import CloseRounded from '@mui/icons-material/CloseRounded'
import About from './About.jsx'
import { APP_NAME } from '@/config/app.js'


export default function AboutDialog({ open = false }) {

  const [aboutDialogOpen, setAboutDialogOpen] = useState(open)
  const navigate = useNavigate()
  const { t } = useTranslation('about', { keyPrefix: 'dialog' })

  function onDialogClose() {
    setAboutDialogOpen(false)
  }

  function onDialogExited() {
    navigate(-1)
  }

  return (
    <Dialog
      className='oc-about-dialog dialog'
      open={aboutDialogOpen}
      onClose={onDialogClose}
      aria-label={t('ariaLabel', { name: APP_NAME })}
      maxWidth={false}
      slotProps={{
        transition: {
          onExited: onDialogExited,
        },
      }}
    >
      <IconButton
        aria-label={t('close')}
        onClick={onDialogClose}
        sx={{
          position: 'absolute',
          right: '1rem',
          top: '1rem',
          color: (theme) => theme.palette.grey[500]
        }}
      >
        <CloseRounded />
      </IconButton>
      <DialogContent>
        <Box
          sx={{
            mt: 6,
            pb: 1.5
          }} >
          <About />
        </Box>
      </DialogContent>
    </Dialog>
  )
}
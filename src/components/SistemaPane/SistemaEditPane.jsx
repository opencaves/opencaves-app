import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Box, Drawer, IconButton, Typography, styled, useTheme } from '@mui/material'
import { ArrowBackRounded, ArrowForwardRounded } from '@mui/icons-material'
import SistemaEditForm from './SistemaEditForm.jsx'
import { useSmall } from '@/hooks/useSmall.jsx'
import { paneWidth as baseWidth } from '@/config/app.js'

const DrawerHeader = styled('div')(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  padding: theme.spacing(0, 1),
  borderBottom: `1px solid ${theme.palette.divider}`,
  ...theme.mixins.toolbar
}))

export default function SistemaEditPane() {
  const { sistemaId } = useParams()
  const theme = useTheme()
  const navigate = useNavigate()
  const isSmall = useSmall()
  const paneWidth = isSmall ? '100vw' : `min(${baseWidth * 2}px, 80vw)`
  const { t } = useTranslation('sistemaPane')
  const [title, setTitle] = useState(t('header'))
  const [open, setOpen] = useState(false)

  useEffect(() => {
    document.title = title
  }, [title])

  useEffect(() => {
    setOpen(true)
  }, [])

  function handleBack() {
    setOpen(false)
  }

  return (
    <Box
      className="oc-sistema-edit-pane"
      sx={{
        display: 'flex',
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
      }}
    >
      <Drawer
        className="oc-sistema-edit-pane--drawer"
        sx={{
          width: paneWidth,
          flexShrink: 0,
          '& > .MuiDrawer-paper': {
            width: paneWidth,
            boxSizing: 'border-box',
            border: 0,
            overflow: 'hidden',
          },
        }}
        variant="persistent"
        anchor="left"
        open={open}
        transitionDuration={{ enter: theme.oc.sys.motion.duration.emphasizedDecelerate, exit: theme.oc.sys.motion.duration.emphasizedAccelerate }}
        slotProps={{
          transition: {
            easing: { enter: theme.sys.motion.easing.emphasizedDecelerate, exit: theme.sys.motion.easing.emphasizedAccelerate },
            onExited: () => navigate(-1),
          },
        }}
      >
        <DrawerHeader className="oc-sistema-edit-pane--header">
          <IconButton
            aria-label={t('backBtn.ariaLabel')}
            onClick={handleBack}
            disableRipple
          >
            {theme.direction === 'ltr' ? <ArrowBackRounded /> : <ArrowForwardRounded />}
          </IconButton>

          <Typography
            variant="fontTitleLarge"
            sx={{
              flexGrow: 1,
              textAlign: 'center',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap'
            }}
          >
            {title}
          </Typography>
        </DrawerHeader>

        <Box
          className="oc-sistema-edit-pane--content"
          sx={{
            p: 'var(--oc-pane-padding-inline)',
            mt: 'var(--oc-pane-padding-block)',
            overflowY: 'auto',
            height: '100%',
            boxSizing: 'border-box',
          }}
        >
          <SistemaEditForm sistemaId={sistemaId} onTitleChange={setTitle} onDone={handleBack} />
        </Box>
      </Drawer>
    </Box>
  )
}

import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Dialog, DialogContent, DialogTitle, IconButton, Typography, useMediaQuery, useTheme } from '@mui/material'
import Grid from '@mui/material/Unstable_Grid2'
import { ArrowBack, Close } from '@mui/icons-material'
import Logo from '../App/Logo'
import { useTitle } from '@/hooks/useTitle'
import { useSmall } from '@/hooks/useSmall'
import './SignupWithEmail.scss'

const gap = 2

export default function AuthPrompt({ open: initialOpen, title, dialogTitle, children, onClose }) {

  const logoHeight = 100
  const logoWidth = 185

  const { t } = useTranslation('auth', { keyPrefix: 'dialog' })
  const theme = useTheme()
  const isMd = useMediaQuery(theme.breakpoints.down('md'))
  const isSmall = useSmall()
  const { setTitle } = useTitle()

  const [open, setOpen] = useState(initialOpen)

  function onDialogClose() {
    setOpen(false)
  }

  function onTransitionExited() {
    if (!open) {
      onClose()
    }
  }

  //
  // Init
  //

  useEffect(() => {
    setTitle(title)

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <Dialog
      fullScreen={isSmall}
      fullWidth
      maxWidth={isMd ? 'sm' : 'md'}
      open={open}
      sx={{
        '--swiper-pagination-color': 'var(--md-palette-secondary-main)'
      }}
      // TransitionComponent={Grow}
      transitionDuration={{
        enter: theme.oc.sys.motion.duration.emphasizedDecelerate,
        exit: theme.oc.sys.motion.duration.emphasizedAccelerate
      }}
      TransitionProps={{
        mountOnEnter: true,
        unmountOnExit: true
      }}
      onClose={onDialogClose}
      // onTransitionEnter={onTransitionEnter}
      onTransitionExited={onTransitionExited}
    >
      {
        dialogTitle && (
          <DialogTitle>
            <AuthDialogTitleBar dialogTitle={dialogTitle} onClose={onDialogClose} />
          </DialogTitle>
        )
      }
      <DialogContent
        sx={{
          position: 'relative',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: isSmall ? 'flex-start' : 'center',
          alignItems: 'center',
          // px: {
          //   xs: 3,
          //   md: 6
          // },
          // pt: 0,
          // pb: 0,
        }}
      >
        {
          !dialogTitle && (
            <AuthDialogCloseBtn
              onClose={onClose}
              sx={{
                position: 'absolute',
                top: 20,
                left: isSmall ? 24 : null,
                right: !isSmall ? 24 : null
              }}
            />
          )
        }
        <Grid
          container
          direction='column'
          alignItems='center'
          width={{
            xs: '100%',
            sm: '80%'
          }}
          sx={{
            py: {
              xs: 4,
              sm: 6,
              md: 7
            },
          }}
        >
          <Logo
            variant='brand-short'
            width={logoWidth}
            height={logoHeight}
            sx={{
              mb: {
                xs: 6,
                md: 8,
                lg: 10
              }
            }}
          />
          {children}
        </Grid>
      </DialogContent>
    </Dialog>
  )
}

function AuthDialogTitleBar({ dialogTitle, onClose }) {
  const isSmall = useSmall()
  const { t } = useTranslation('auth', { keyPrefix: 'dialog' })

  return (
    <Grid
      container
      xs
      alignItems='center'
      gap={2}
      position={!dialogTitle ?? 'absolute'}
    >
      <Grid
        xs
        order={isSmall && 1}>
        {dialogTitle}
      </Grid>

      <Grid
      >
        <AuthDialogCloseBtn
          onClose={onClose}
          sx={{
            p: 0
          }}
        />
      </Grid>
    </Grid>
  )
}

function AuthDialogCloseBtn({ onClose, ...props }) {
  const isSmall = useSmall()
  const { t } = useTranslation('auth', { keyPrefix: 'dialog' })

  return (
    <IconButton
      aria-label={isSmall ? t('closeBtnSm.ariaLabel') : t('closeBtn.ariaLabel')}
      onClick={onClose}
      {...props}
    >
      {
        isSmall ? (
          <ArrowBack />
        ) : (
          <Close />
        )
      }
    </IconButton>
  )
}

export function Step({ instructions, fields, actions, gap = 2, children, ...props }) {
  function Container({ children }) {
    return actions || fields || instructions ? (

      <Grid
        container
        direction='column'
        rowGap={gap}
        width={{
          xs: '100%',
          sm: '42ch'
        }}
      >
        {children}
      </Grid>
    ) : null
  }

  return (
    <Grid
      {...props}
      container
      direction='column'
      alignContent='center'
      alignItems='center'
      mb={{
        xs: 2,
        lg: 8
      }}
      xs
      rowGap={gap}
    >
      {children}
      <Container>
        {instructions}
        {
          fields && (
            <Grid
              container
              direction='column'
              xs
              rowGap={gap}
              sx={{ pt: .75 }}
            >
              {fields}
            </Grid>
          )
        }
        {
          actions && (
            <Grid
              container
              direction='column'
              rowGap={gap}
              alignItems='sretch'

              mt={gap * .75}

            >
              {actions}
            </Grid>
          )
        }
      </Container>
    </Grid>
  )
}

export function Header({ children }) {
  return (
    <Typography
      variant='h1'
      component='h1'
      fontSize={{
        xs: 30,
        md: 32,
        lg: 36
      }}
      mb={4}
      textAlign='center'
    >
      {children}
    </Typography>
  )
}
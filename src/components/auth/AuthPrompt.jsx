import { createContext, useContext, useEffect, useId, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Dialog, DialogContent, DialogTitle, IconButton, Typography, useMediaQuery, useTheme } from '@mui/material'
import { Grid } from '@mui/material'
import ArrowBack from '@mui/icons-material/ArrowBackRounded'
import Close from '@mui/icons-material/CloseRounded'
import Logo from '../App/Logo.jsx'
import { useTitle } from '@/hooks/useTitle.jsx'
import { useSmall } from '@/hooks/useSmall.jsx'
import './SignupWithEmail.scss'
import OfflineAuthNote from './OfflineAuthNote.jsx'

const gap = 2

// The dialog is named after the Header rendered inside it (when there's no
// dialogTitle bar): the Header takes this id, the Dialog points at it.
const HeaderIdContext = createContext(undefined)

/**
 * The auth forms' dialog (full screen on phones), with the logo above its
 * content; it's named after the Header inside it.
 *
 * @param {object} props
 * @param {boolean} props.open
 * @param {string} [props.title] - The page title while it's open.
 * @param {import('react').ReactNode} [props.dialogTitle] - A title bar's content.
 * @param {import('react').ReactNode} [props.children]
 * @param {() => void} [props.onClose]
 * @param {string} [props.className]
 */
export default function AuthPrompt({ open: initialOpen, title, dialogTitle, children, onClose, className }) {
  const logoHeight = 100
  const logoWidth = 185

  const { t } = useTranslation('auth', { keyPrefix: 'dialog' })
  const theme = useTheme()
  const isMd = useMediaQuery(theme.breakpoints.down('md'))
  const isSmall = useSmall()
  const { setTitle } = useTitle()

  const [open, setOpen] = useState(initialOpen)
  const headerId = useId()

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
  }, [title])

  return (
    <Dialog
      className={`oc-auth-prompt ${className || ''}`.trim()}
      fullScreen={isSmall}
      fullWidth
      maxWidth={isMd ? 'sm' : 'md'}
      open={open}
      sx={{
        '--swiper-pagination-color': 'var(--mui-palette-secondary-main)',
      }}
      // TransitionComponent={Grow}
      transitionDuration={{
        enter: theme.oc.sys.motion.duration.emphasizedDecelerate,
        exit: theme.oc.sys.motion.duration.emphasizedAccelerate,
      }}
      slotProps={{
        transition: {
          mountOnEnter: true,
          unmountOnExit: true,
        },
      }}
      onClose={onDialogClose}
      aria-labelledby={dialogTitle ? undefined : headerId}
      // onTransitionEnter={onTransitionEnter}
      onTransitionExited={onTransitionExited}
    >
      {dialogTitle && (
        <DialogTitle>
          <AuthDialogTitleBar dialogTitle={dialogTitle} onClose={onDialogClose} />
        </DialogTitle>
      )}
      <HeaderIdContext.Provider value={headerId}>
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
        {!dialogTitle && (
          <AuthDialogCloseBtn
            onClose={onClose}
            sx={{
              position: 'absolute',
              top: 20,
              left: isSmall ? 24 : null,
              right: !isSmall ? 24 : null,
            }}
          />
        )}
        <Grid
          container
          sx={{
            flexDirection: 'column',
            width: {
              xs: '100%',
              sm: '80%',
            },
            alignItems: 'center',
            py: {
              xs: 4,
              sm: 6,
              md: 7,
            },
          }}
        >
          <Logo
            variant="brand-short"
            width={logoWidth}
            height={logoHeight}
            sx={{
              mb: {
                xs: 6,
                md: 8,
                lg: 10,
              },
            }}
          />
          <OfflineAuthNote sx={{ mb: 3 }} />
          {children}
        </Grid>
      </DialogContent>
      </HeaderIdContext.Provider>
    </Dialog>
  )
}

function AuthDialogTitleBar({ dialogTitle, onClose }) {
  const isSmall = useSmall()
  const { t } = useTranslation('auth', { keyPrefix: 'dialog' })

  return (
    <Grid className="oc-auth-prompt--title-bar" container size="grow" sx={{ gap: 2, alignItems: 'center', position: !dialogTitle ? 'absolute' : undefined }}>
      <Grid size="grow" sx={{ order: isSmall ? 1 : undefined }}>
        {dialogTitle}
      </Grid>

      <Grid>
        <AuthDialogCloseBtn
          onClose={onClose}
          sx={{
            p: 0,
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
    <IconButton className="oc-auth-prompt--close-btn" aria-label={isSmall ? t('closeBtnSm.ariaLabel') : t('closeBtn.ariaLabel')} onClick={onClose} {...props}>
      {isSmall ? <ArrowBack /> : <Close />}
    </IconButton>
  )
}

/**
 * An auth dialog's heading, which names it.
 *
 * @param {object} props
 * @param {import('react').ReactNode} props.children
 */
export function Header({ children }) {
  const headerId = useContext(HeaderIdContext)
  return (
    <Typography
      id={headerId}
      className="oc-header"
      variant="h1"
      component="h1"
      sx={{
        fontSize: {
          xs: 30,
          md: 32,
          lg: 36,
        },
        mb: 4,
        textAlign: 'center',
      }}
    >
      {children}
    </Typography>
  )
}

import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Box, Button, ButtonBase, Dialog, DialogActions, DialogContent, DialogContentText, DialogTitle, Typography, useMediaQuery } from '@mui/material'
import Grid from '@mui/material/Unstable_Grid2'
import { useTheme } from '@mui/material/styles'
import DirectionsIcon from '@mui/icons-material/Directions'
import BookmarkBorderIcon from '@mui/icons-material/BookmarkBorder'
import ShareIcon from '@mui/icons-material/Share'
import { Share } from '@capacitor/share'
import Divider from './Divider'
import './QuickActions.scss'

function openDirections(cave) {
  const url = new URL('https://www.google.com/maps/dir/?api=1&travelmode=driving')
  url.searchParams.append('destination', `${cave.location.latitude},${cave.location.longitude}`)
  if (cave.entranceCoordinates) {
    url.searchParams.append('waypoints', `${cave.entranceCoordinates.latitude},${cave.entranceCoordinates.longitude}`)
  }
  if /* if we're on iOS, open in Apple Maps */
    ((navigator.platform.indexOf("iPhone") !== -1) ||
    (navigator.platform.indexOf("iPad") !== -1) ||
    (navigator.platform.indexOf("iPod") !== -1)) {
    url.protocol = 'maps:'
    // window.open("maps://maps.google.com/maps?daddr=<lat>,<long>&amp;ll=")
  }
  window.open(url)
}

function ButtonLg({ children, ...props }) {
  return <ButtonBase {...props} disableRipple sx={{
    '&:hover': {
      '--_shadow': '0 1px 2px rgba(60,64,67,0.3), 0 1px 3px 1px rgba(60,64,67,0.15)',
      '--_background-color': 'rgba(26,115,232,0.04)'
    }
  }}>{children}</ButtonBase>
}

function IconLg({ primary, children, ...props }) {
  return <Box {...props} sx={{
    backgroundColor: () => primary ? 'primary.main' : 'var(--_background-color)',
    color: () => primary ? '#fff' : null,
    borderWidth: '1px',
    borderStyle: 'solid',
    borderColor: 'primary.main',
    display: 'inline-flex',
    justifyContent: 'center',
    alignItems: 'center',
    width: '36px',
    height: '36px',
    borderRadius: '36px',
    m: '6px',
    boxShadow: () => primary ? 'var(--_shadow)' : null,
    '& .MuiSvgIcon-root': {
      fontSize: '1.25rem'
    }
  }}>
    {children}
  </Box>
}

function LabelLg(props) {
  return <Typography sx={{
    color: 'primary.main',
    fontSize: '0.75rem'
  }}>
    {props.children}
  </Typography>
}

function QuickActionsItem({ children, ...props }) {
  return <Box {...props}>
    {children}
  </Box>
}

export default function QuickActions({ cave }) {
  const { t } = useTranslation('quickActions')
  const { t: tMap } = useTranslation('map')
  const [dialogOpen, setDialogOpen] = useState(false)
  const theme = useTheme()

  const caveName = cave.name ? cave.name.value : tMap('caveNameUnknown')
  const isSmall = useMediaQuery(theme.breakpoints.down('sm'))

  async function handleShareOpen() {
    const shareURL = new URL(window.location)
    shareURL.hash = ''
    await Share.share({
      title: t('shareTitle', { name: caveName }),
      text: t('shareText', { name: caveName }),
      url: shareURL.href,
      dialogTitle: t('shareDialogTitle'),
    })
  }

  function onSaveClick() { }

  function handleDialogOpen() {
    console.log('[handleDialogOpen]')
    setDialogOpen(true)
  }

  function handleDialogClose() {
    setDialogOpen(false)
  }

  return (
    <>
      {
        !isSmall && <Divider />
      }

      {isSmall ? (
        <Box
          className={`oc-quick-actions oc-quick-actions-${isSmall ? `sm` : `lg`}`}
          sx={{
            pt: 'var(--oc-details-padding-block)',
            pb: 'var(--oc-details-padding-block)',
          }}
          role='region'
          aria-label={t('ariaLabel', { name: cave.name })}
        >
          <Box
            display='flex'
            gap={1.5}
            sx={{
              pl: 'var(--oc-details-padding-inline)',
              pr: 'var(--oc-details-padding-inline)',
              overflowX: 'auto',

              msOverflowStyle: 'none', // Edge / Opera
              scrollbarWidth: 'none', // Firefox
              '&::-webkit-scrollbar': {
                display: 'none' // Chrome
              }
            }}
          >
            {
              cave.location &&
              <QuickActionsItem>
                <Button aria-label={t('directions')} color='primary' variant="contained" startIcon={<DirectionsIcon />} className='oc-quick-actions--btn primary' onClick={() => openDirections(cave)}>
                  {t('directions')}
                </Button>
              </QuickActionsItem>
            }
            <QuickActionsItem>
              <Button aria-label={t('save')} color="primary" variant="outlined" startIcon={<BookmarkBorderIcon />} className='oc-quick-actions--btn' onClick={handleDialogOpen}>
                {t('save')}
              </Button>
            </QuickActionsItem>
            <QuickActionsItem>
              <Button aria-label={t('share')} color="primary" variant="outlined" startIcon={<ShareIcon />} className='oc-quick-actions--btn' onClick={handleShareOpen}>
                {t('share')}
              </Button>
            </QuickActionsItem>
          </Box>
        </Box>
      ) : (
        <Box
          className={`oc-quick-actions oc-quick-actions-${isSmall ? `sm` : `lg`}`}
          sx={{
            pl: 'var(--oc-details-padding-inline)',
            pr: 'var(--oc-details-padding-inline)',
            pt: 'var(--oc-details-padding-block)',
            pb: 'var(--oc-details-padding-block)'
          }}
          role='region'
          aria-label={t('ariaLabel', { name: cave.name.value })}
        >
          <Grid container>
            {
              cave.location &&
              <Grid xs display="flex" justifyContent="center">
                <Grid container>
                  <ButtonLg aria-label={t('directions')} onClick={() => openDirections(cave)}>
                    <Grid container direction='column'>
                      <Grid><IconLg primary><DirectionsIcon /></IconLg></Grid>
                      <Grid><LabelLg>{t('directions')}</LabelLg></Grid>
                    </Grid>
                  </ButtonLg>
                </Grid>
              </Grid>
            }
            <Grid xs display="flex" justifyContent="center">
              <Grid container>
                <ButtonLg id='save-btn' aria-label={t('save')} onClick={handleDialogOpen}>
                  <Grid container direction='column'>
                    <Grid><IconLg><BookmarkBorderIcon color='primary' /></IconLg></Grid>
                    <Grid><LabelLg>{t('save')}</LabelLg></Grid>
                  </Grid>
                </ButtonLg>
              </Grid>
            </Grid>

            <Grid xs display="flex" justifyContent="center">
              <Grid container>
                <ButtonLg id='save-btn' aria-label={t('share')} onClick={handleShareOpen}>
                  <Grid container direction='column'>
                    <Grid><IconLg><ShareIcon color='primary' /></IconLg></Grid>
                    <Grid><LabelLg>{t('share')}</LabelLg></Grid>
                  </Grid>
                </ButtonLg>
              </Grid>
            </Grid>
          </Grid>
        </Box>
      )}

      <Dialog
        open={dialogOpen}
        onClose={handleDialogClose}
        aria-labelledby="alert-dialog-title"
        aria-describedby="alert-dialog-description"
      >
        <DialogTitle id="alert-dialog-title">Argh!</DialogTitle>
        <DialogContent>
          <DialogContentText id="alert-dialog-description">To be implemented...</DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button
            onClick={handleDialogClose}
            autoFocus
          >
            OK
          </Button>

        </DialogActions>
      </Dialog>
    </>
  )
}
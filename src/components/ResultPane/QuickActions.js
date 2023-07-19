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
import Scrollbars from 'react-custom-scrollbars-2'

function openDirections(cave) {
  console.log('[onClick] cave: %o',)
  const url = new URL('https://www.google.com/maps/dir/?api=1&travelmode=driving')
  url.searchParams.append('destination', `${cave.location.latitude},${cave.location.longitude}`)
  if (cave.entranceCoordinates) {
    url.searchParams.append('waypoints', `${cave.entranceCoordinates.latitude},${cave.entranceCoordinates.longitude}`)
  }

  if ('platform' in navigator) {
    if /* if we're on iOS, open in Apple Maps */
      ((navigator.platform.indexOf("iPhone") !== -1) ||
      (navigator.platform.indexOf("iPad") !== -1) ||
      (navigator.platform.indexOf("iPod") !== -1)) {
      url.protocol = 'maps:'
    }
  }

  window.open(url)
}

function ButtonLg({ primary, children, ...props }) {
  return (
    <ButtonBase
      {...props}
      disableRipple
      sx={{
        '--_color': theme => theme.palette.primary.main,
        '--_icon-color': theme => primary ? '#fff' : theme.palette.primary.main,
        '--_icon-background-color': primary ? '#fff' : null,
        '--_border-color': theme => theme.palette.primary.main,
        '--_background-color': theme => primary ? theme.palette.primary.main : null,
        '&:hover': {
          '--_color': theme => theme.palette.mode === 'light' ? theme.palette.primary.dark : theme.palette.primary.light,
          '--_icon-color': theme => {
            if (primary) {
              return '#fff'
            }

            return theme.palette.mode === 'light' ? theme.palette.primary.dark : theme.palette.primary.light
          },
          '--_border-color': theme => theme.palette.mode === 'light' ? theme.palette.primary.dark : theme.palette.primary.light,
          '--_shadow': primary ? 'var(--md-shadows-1)' : null,
          '--_background-color': theme => {
            if (primary) {
              return theme.palette.mode === 'light' ? theme.palette.primary.dark : theme.palette.primary.light
            }

            const onColorChannel = theme.palette.mode === 'light' ? theme.palette.primary.darkChannel : theme.palette.primary.lightChannel
            return `rgba(${onColorChannel} / 0.06)`
          }
        }
      }}>
      {children}
    </ButtonBase>
  )
}

function IconLg({ children, ...props }) {
  return (
    <Box
      {...props}
      sx={{
        backgroundColor: 'var(--_background-color)',
        color: 'var(--_icon-color)',
        borderWidth: '1px',
        borderStyle: 'solid',
        borderColor: 'var(--_border-color)',
        display: 'inline-flex',
        justifyContent: 'center',
        alignItems: 'center',
        width: '36px',
        height: '36px',
        borderRadius: '36px',
        m: '6px',
        boxShadow: 'var(--_shadow)',
        '& .MuiSvgIcon-root': {
          fontSize: '1.25rem'
        }
      }}>
      {children}
    </Box>
  )
}

function LabelLg(props) {
  return <Typography sx={{
    color: 'var(--_color)',
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

      {
        isSmall ? (
          <Box
            className={`oc-quick-actions oc-quick-actions-${isSmall ? `sm` : `lg`}`}
            sx={{
              pt: 'var(--oc-details-padding-block)',
              pb: 'calc(var(--oc-details-padding-block) - 11px)',
            }}
            role='region'
            aria-label={t('ariaLabel', { name: cave.name.value })}
          >
            <Box
              sx={{
                overflowX: 'visible',

                msOverflowStyle: 'none', // Edge / Opera
                scrollbarWidth: 'none', // Firefox
                '&::-webkit-scrollbar': {
                  display: 'none' // Chrome
                }
              }}
            >
              <Scrollbars
                autoHeight
                hideTracksWhenNotNeeded={true}
                renderThumbHorizontal={({ style, ...props }) =>
                  <div {...props} style={{
                    ...style,
                    cursor: 'pointer',
                    borderRadius: 'inherit',
                    backgroundColor: theme.palette.mode === 'light' ? 'rgba(0, 0, 0, 0.2)' : 'rgba(255, 255, 255, 0.12)'
                  }} />
                }
              >
                <Box
                  display='flex'
                  gap={1.5}
                  sx={{
                    pl: 'var(--oc-details-padding-inline)',
                    pr: 'var(--oc-details-padding-inline)',
                    pb: '11px',
                    overflow: 'visible',
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
              </Scrollbars>
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
                    <ButtonLg primary aria-label={t('directions')} onClick={() => openDirections(cave)}>
                      <Grid container direction='column'>
                        <Grid><IconLg><DirectionsIcon /></IconLg></Grid>
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
                      <Grid><IconLg><BookmarkBorderIcon /></IconLg></Grid>
                      <Grid><LabelLg>{t('save')}</LabelLg></Grid>
                    </Grid>
                  </ButtonLg>
                </Grid>
              </Grid>

              <Grid xs display="flex" justifyContent="center">
                <Grid container>
                  <ButtonLg id='save-btn' aria-label={t('share')} onClick={handleShareOpen}>
                    <Grid container direction='column'>
                      <Grid><IconLg><ShareIcon /></IconLg></Grid>
                      <Grid><LabelLg>{t('share')}</LabelLg></Grid>
                    </Grid>
                  </ButtonLg>
                </Grid>
              </Grid>
            </Grid>
          </Box>
        )
      }

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
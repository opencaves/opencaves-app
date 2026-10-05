import { useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useDispatch } from 'react-redux'
import { useTranslation } from 'react-i18next'
import { Box, Button, ButtonBase, CircularProgress, Dialog, DialogActions, DialogContent, DialogContentText, DialogTitle, Divider, Typography } from '@mui/material'
import { Grid } from '@mui/material'
import { useTheme } from '@mui/material/styles'
import DirectionsIcon from '@mui/icons-material/Directions'
import BookmarkBorderIcon from '@mui/icons-material/BookmarkBorder'
import BookmarkIcon from '@mui/icons-material/Bookmark'
import ShareIcon from '@mui/icons-material/Share'
import { Share } from '@capacitor/share'
import { Scrollbars } from 'react-custom-scrollbars-3'
import { useSmall } from '@/hooks/useSmall.jsx'
import { useSavedCaves } from '@/hooks/useSavedCaves.jsx'
import { useSnackbar } from '@/components/Snackbar/useSnackbar.jsx'
import { requestPersistentStorage } from '@/utils/persistentStorage.js'
import { useOfflineStatus } from '@/hooks/useOfflineStatus.jsx'
import { isMeteredConnection, markJustSaved, offlineSupported, savedCaveStatusKey } from '@/services/offline/offlineMedia.js'
import { buildContinueUrl, setContinueUrl } from '@/redux/slices/sessionSlice.jsx'
import { openDirections } from '@/utils/directions.js'
import './QuickActions.scss'

function ButtonLg({ primary, children, ...props }) {
  return (
    <ButtonBase
      {...props}
      disableRipple
      // On hover the primary's darker tone, its lighter one in dark mode.
      sx={(theme) => {
        const hover = (tone) => ({
          '--_color': theme.vars.palette.primary[tone],
          '--_icon-color': primary ? '#fff' : theme.vars.palette.primary[tone],
          '--_border-color': theme.vars.palette.primary[tone],
          '--_background-color': primary ? theme.vars.palette.primary[tone] : `rgba(${theme.vars.palette.primary[`${tone}Channel`]} / 0.06)`,
        })
        return {
          '--_color': theme.vars.palette.primary.main,
          '--_icon-color': primary ? '#fff' : theme.vars.palette.primary.main,
          '--_icon-background-color': primary ? '#fff' : null,
          '--_border-color': theme.vars.palette.primary.main,
          '--_background-color': primary ? theme.vars.palette.primary.main : null,
          '&:hover': { ...hover('dark'), '--_shadow': primary ? 'var(--mui-shadows-1)' : null },
          ...theme.applyStyles('dark', { '&:hover': hover('light') }),
        }
      }}
    >
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
          fontSize: '1.25rem',
        },
      }}
    >
      {children}
    </Box>
  )
}

function LabelLg(props) {
  return (
    <Typography
      sx={{
        color: 'var(--_color)',
        fontSize: '0.75rem',
      }}
    >
      {props.children}
    </Typography>
  )
}

// Determinate ring shown in place of the Save icon while the saved cenote
// downloads for offline use; sized like the icon it replaces.
function DownloadProgressIcon({ value, label }) {
  return <CircularProgress variant="determinate" value={value} size={18} thickness={5} aria-label={label} sx={{ color: 'inherit' }} />
}

function QuickActionsItem({ children, ...props }) {
  return <Box {...props}>{children}</Box>
}

export default function QuickActions({ cave }) {
  const { t } = useTranslation('quickActions')
  const { t: tMap } = useTranslation('map')
  const [accountPromptOpen, setAccountPromptOpen] = useState(false)
  const theme = useTheme()
  const location = useLocation()
  const navigate = useNavigate()
  const dispatch = useDispatch()
  const [openSnackbar] = useSnackbar()
  const { canSave, isSaved, saveCave, unsaveCave } = useSavedCaves()
  const saved = isSaved(cave.id)
  const offlineStatus = useOfflineStatus(savedCaveStatusKey(cave.id))
  // While this saved cenote's pictures and maps download for offline use, a
  // progress ring replaces the bookmark icon.
  const downloading = saved && offlineStatus?.state === 'downloading' && offlineStatus.total > 0
  const downloadProgress = downloading ? Math.round((offlineStatus.done / offlineStatus.total) * 100) : 0
  const saveIcon = downloading ? <DownloadProgressIcon value={downloadProgress} label={t('downloadingOffline', { progress: downloadProgress })} /> : saved ? <BookmarkIcon /> : <BookmarkBorderIcon />
  const saveLabel = saved ? t('saved') : t('save')

  const caveName = cave.name ? cave.name.value : tMap('caveNameUnknown')
  const isSmall = useSmall()

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

  // Toggles the cave in the user's saved caves. Anonymous/signed-out
  // sessions get an invitation to create an account instead, since saved
  // caves live on the account.
  //
  // Not awaited: Firestore applies the write to its local cache right away
  // (so the button and the map's bookmark update immediately) but only
  // resolves once the server acknowledges it - offline, that's whenever the
  // connection comes back. A rejection (e.g. denied by the rules) rolls the
  // local change back on its own; just report it.
  function handleSaveClick() {
    if (!canSave) {
      setAccountPromptOpen(true)
      return
    }

    // Saving a cenote signals intent to rely on the app offline.
    if (!saved) {
      requestPersistentStorage()
      markJustSaved(cave.id)
    }
    const write = saved ? unsaveCave(cave.id) : saveCave(cave.id)
    // Its offline download (OfflineMediaSync) is held back without a
    // connection or on cellular - say so rather than implying it's ready.
    const savedMessage = !offlineSupported ? t('savedMessage') : !navigator.onLine ? t('savedDownloadWhenOnline') : isMeteredConnection() ? t('savedDownloadOnWifi') : t('savedMessage')
    openSnackbar(saved ? t('unsavedMessage') : savedMessage, { severity: 'success' })
    write.catch((error) => {
      console.error(error)
      openSnackbar(t('saveError'))
    })
  }

  // Comes back to this cave once the account is created / signed in to.
  function goToAuth(path) {
    setAccountPromptOpen(false)
    dispatch(setContinueUrl(buildContinueUrl(location)))
    navigate(path)
  }

  return (
    <>
      {!isSmall && <Divider />}

      {isSmall ? (
        <Box
          className={`oc-quick-actions oc-quick-actions-${isSmall ? `sm` : `lg`}`}
          sx={{
            pt: 'var(--oc-pane-padding-block)',
            pb: 'calc(var(--oc-pane-padding-block) - 11px)',
          }}
          role="region"
          aria-label={t('ariaLabel', { name: caveName })}
        >
          <Box
            sx={{
              overflowX: 'visible',

              msOverflowStyle: 'none', // Edge / Opera
              scrollbarWidth: 'none', // Firefox
              '&::-webkit-scrollbar': {
                display: 'none', // Chrome
              },
            }}
          >
            <Scrollbars
              autoHeight
              hideTracksWhenNotNeeded={true}
              renderThumbHorizontal={({ style, ...props }) => (
                <div
                  {...props}
                  style={{
                    ...style,
                    cursor: 'pointer',
                    borderRadius: 'inherit',
                    backgroundColor: 'var(--oc-scrollbar-thumb)',
                  }}
                />
              )}
            >
              <Box
                sx={{
                  display: 'flex',
                  gap: 1.5,
                  pl: 'var(--oc-pane-padding-inline)',
                  pr: 'var(--oc-pane-padding-inline)',
                  pb: '11px',
                  overflow: 'visible',
                }}
              >
                {cave.location && (
                  <QuickActionsItem>
                    <Button aria-label={t('directions')} color="primary" variant="contained" startIcon={<DirectionsIcon />} className="oc-quick-actions--btn primary" onClick={() => openDirections(cave.location, cave.entrance)}>
                      {t('directions')}
                    </Button>
                  </QuickActionsItem>
                )}
                <QuickActionsItem>
                  <Button aria-label={saveLabel} aria-pressed={saved} color="primary" variant="outlined" startIcon={saveIcon} className="oc-quick-actions--btn" onClick={handleSaveClick}>
                    {saveLabel}
                  </Button>
                </QuickActionsItem>
                <QuickActionsItem>
                  <Button aria-label={t('share')} color="primary" variant="outlined" startIcon={<ShareIcon />} className="oc-quick-actions--btn" onClick={handleShareOpen}>
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
            pl: 'var(--oc-pane-padding-inline)',
            pr: 'var(--oc-pane-padding-inline)',
            pt: 'var(--oc-pane-padding-block)',
            pb: 'var(--oc-pane-padding-block)',
          }}
          role="region"
          aria-label={t('ariaLabel', { name: caveName })}
        >
          <Grid container>
            {cave.location && (
              <Grid size="grow" sx={{ display: 'flex', justifyContent: 'center' }}>
                <Grid container sx={{ justifyContent: 'center' }}>
                  <ButtonLg primary aria-label={t('directions')} onClick={() => openDirections(cave.location, cave.entrance)}>
                    <Grid container direction="column">
                      <Grid>
                        <IconLg>
                          <DirectionsIcon />
                        </IconLg>
                      </Grid>
                      <Grid>
                        <LabelLg>{t('directions')}</LabelLg>
                      </Grid>
                    </Grid>
                  </ButtonLg>
                </Grid>
              </Grid>
            )}
            <Grid size="grow" sx={{ display: 'flex', justifyContent: 'center' }}>
              <Grid container sx={{ justifyContent: 'center' }}>
                <ButtonLg id="save-btn" aria-label={saveLabel} aria-pressed={saved} onClick={handleSaveClick}>
                  <Grid container direction="column">
                    <Grid>
                      <IconLg>
                        {saveIcon}
                      </IconLg>
                    </Grid>
                    <Grid>
                      <LabelLg>{saveLabel}</LabelLg>
                    </Grid>
                  </Grid>
                </ButtonLg>
              </Grid>
            </Grid>

            <Grid size="grow" sx={{ display: 'flex', justifyContent: 'center' }}>
              <Grid container sx={{ justifyContent: 'center' }}>
                <ButtonLg id="share-btn" aria-label={t('share')} onClick={handleShareOpen}>
                  <Grid container direction="column">
                    <Grid>
                      <IconLg>
                        <ShareIcon />
                      </IconLg>
                    </Grid>
                    <Grid>
                      <LabelLg>{t('share')}</LabelLg>
                    </Grid>
                  </Grid>
                </ButtonLg>
              </Grid>
            </Grid>
          </Grid>
        </Box>
      )}

      <Dialog className="oc-quick-actions--account-prompt" open={accountPromptOpen} onClose={() => setAccountPromptOpen(false)} aria-labelledby="oc-account-prompt-title" aria-describedby="oc-account-prompt-text">
        <DialogTitle id="oc-account-prompt-title">{t('accountPrompt.title')}</DialogTitle>
        <DialogContent>
          <DialogContentText id="oc-account-prompt-text">{t('accountPrompt.text', { name: caveName })}</DialogContentText>
        </DialogContent>
        {/* Three actions don't fit side by side on a phone (labels wrapped
            word by word): stack them full-width there, main action on top. */}
        <DialogActions sx={{ flexDirection: { xs: 'column-reverse', sm: 'row' }, alignItems: 'stretch', gap: 1, '& > :not(style) ~ :not(style)': { ml: { xs: 0, sm: 1 } } }}>
          <Button onClick={() => setAccountPromptOpen(false)}>{t('accountPrompt.notNow')}</Button>
          <Button onClick={() => goToAuth('/login')}>{t('accountPrompt.logIn')}</Button>
          <Button variant="contained" onClick={() => goToAuth('/signup')} autoFocus>
            {t('accountPrompt.signUp')}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  )
}

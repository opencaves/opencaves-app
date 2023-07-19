import React, { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { CopyToClipboard } from 'react-copy-to-clipboard'
import { Box, IconButton, List, ListItem, ListItemButton, ListItemIcon, ListItemText, Portal, Snackbar, Tooltip, Typography, useMediaQuery } from '@mui/material'
import Slide from '@mui/material/Slide'
import { useTheme } from '@mui/material/styles'
import { Close } from '@mui/icons-material'
import ContentCopyIcon from '@mui/icons-material/ContentCopy'
import LocationOnOutlinedIcon from '@mui/icons-material/LocationOnOutlined'
import MyLocationOutlinedIcon from '@mui/icons-material/MyLocationOutlined'
import LocationDisabledOutlinedIcon from '@mui/icons-material/LocationDisabledOutlined'
import FenceRoundedIcon from '@mui/icons-material/FenceRounded'
import KeyRoundedIcon from '@mui/icons-material/KeyRounded'
import ConditionalWrapper from '../ConditionalWrapper'
import Markdown from '../Markdown/Markdown'
import Address from './Address'
import Divider from './Divider'
import QuickActions from './QuickActions'
import Rating from '../Rating/Rating'
import Access from './Access'
import SistemaHistory from './SistemaHistory'
import { ISO6391ToISO6392 } from '../../utils/lang'
import { getOS } from '../../utils/getOS'
import mediaCardImage from '../../images/card-media.png'
import './CurrentCaveDetails.scss'

function SlideUp(props) {
  return <Slide {...props} direction='up' />
}

export function CurrentCaveDetailsHeader({ cave }) {
  const { t, i18n } = useTranslation('resultPane')
  const { t: tMap } = useTranslation('map')
  const [rating, setRating] = useState(-1)
  const theme = useTheme()
  const caveName = cave.name ? cave.name.value : tMap('caveNameUnknown')
  const resolvedLanguage = ISO6391ToISO6392(i18n.resolvedLanguage)
  const caveNameTranslation = (langCode => {
    if (langCode) {
      if (langCode !== resolvedLanguage) {
        return cave.nameTranslations?.[resolvedLanguage]?.join(', ')
      }

      return null
    }

    return cave.nameTranslations?.[resolvedLanguage]?.join(', ') || null
  })(cave.name?.languageCode)

  const isSmall = useMediaQuery(theme.breakpoints.down('sm'))

  useEffect(() => setRating(Reflect.has(cave, 'rating') ? cave.rating : -1), [cave])

  return (
    <>
      {
        !isSmall && (
          <img
            alt=""
            src={mediaCardImage}
          />
        )
      }
      <Box className='oc-result-pane--header'>
        <Typography variant='caveDetailsHeader'>{caveName}</Typography>
        {
          caveNameTranslation && <Typography variant='caveDetailsSubHeader'>{caveNameTranslation}</Typography>
        }
        {
          cave.aka && cave.aka.length && <Typography variant='caveDetailsSubHeader'>{t('aka')} {cave.aka.join(', ')}</Typography>
        }
        <Rating value={rating} sx={{ pt: '0.5rem' }} ></Rating>
      </Box >
    </>
  )
}

export function CurrentCaveDetailsContent({ cave }) {
  const { t } = useTranslation('resultPane')
  const theme = useTheme()

  const isSmall = useMediaQuery(theme.breakpoints.down('sm'))

  const [snackbarMessage, setSnackbarMessage] = useState()
  const [snackbarOpen, setSnackbarOpen] = useState(false)

  const [addressTooltipOpen, setAddressTooltipOpen] = useState(false)
  const [coordinatesTooltipOpen, setCoordinatesTooltipOpen] = useState(false)
  const [keyCoordinatesTooltipOpen, setKeyCoordinatesTooltipOpen] = useState(false)
  const [entranceCoordinatesTooltipOpen, setEntranceCoordinatesTooltipOpen] = useState(false)

  const isAndroid = getOS() === 'Android'

  let hasAddressOrCoordinates = false
  let address, addressText, coordinatesText, coordinatesTextCopy, keysTexts, entranceText

  if (cave.location) {

    address = <Address longitude={cave.location.longitude} latitude={cave.location.latitude} />
    addressText = `${cave.location.latitude}, ${cave.location.longitude}`
    coordinatesText = `${cave.location.latitude}, ${cave.location.longitude}${cave.location.validity === 'unknown' ? ` (${t('coordinateValidityUnknown')})` : ``}`
    coordinatesTextCopy = `${cave.location.latitude}, ${cave.location.longitude}`
    hasAddressOrCoordinates = true

  }

  if (cave.keys) {
    keysTexts = cave.keys.map(key => `${key.latitude}, ${key.longitude}`)
  }

  if (cave.entrance) {
    entranceText = `${cave.entrance.latitude}, ${cave.entrance.longitude}`
  }

  function handleAddressTooltipOpen() {
    setAddressTooltipOpen(true)
  }

  function handleAddressTooltipClose() {
    setAddressTooltipOpen(false)
  }

  function handleAddressCopy() {
    setAddressTooltipOpen(false)
    setSnackbarMessage(t('copiedToClipboard'))
    setSnackbarOpen(true)
  }

  function handleCoordinatesTooltipOpen() {
    setCoordinatesTooltipOpen(true)
  }

  function handleCoordinatesTooltipClose() {
    setCoordinatesTooltipOpen(false)
  }

  function handleCoordinatesCopy() {
    setCoordinatesTooltipOpen(false)
    setSnackbarMessage(t('copiedToClipboard'))
    setSnackbarOpen(true)
  }

  function handleKeyCoordinatesTooltipOpen() {
    setKeyCoordinatesTooltipOpen(true)
  }

  function handleKeyCoordinatesTooltipClose() {
    setKeyCoordinatesTooltipOpen(false)
  }

  function handleKeyCoordinatesCopy() {
    setKeyCoordinatesTooltipOpen(false)
    setSnackbarMessage(t('copiedToClipboard'))
    setSnackbarOpen(true)
  }

  function handleEntranceCoordinatesTooltipOpen() {
    setEntranceCoordinatesTooltipOpen(true)
  }

  function handleEntranceCoordinatesTooltipClose() {
    setEntranceCoordinatesTooltipOpen(false)
  }

  function handleEntranceCoordinatesCopy() {
    setEntranceCoordinatesTooltipOpen(false)
    setSnackbarMessage(t('copiedToClipboard'))
    setSnackbarOpen(true)
  }

  function handleSnackbarClose(event, reason) {
    if (reason === 'clickaway') {
      return
    }
    setSnackbarOpen(false)
    setSnackbarMessage('')
  }

  return (
    <Box className='oc-result-pane--content'>

      <QuickActions cave={cave}></QuickActions>

      <Divider />

      <List dense className='oc-results-copy-list'>

        {

          hasAddressOrCoordinates &&

          <>
            {
              address && (
                <CopyToClipboard text={addressText} placement='bottom-end' onCopy={handleAddressCopy}>
                  <ListItem disablePadding>
                    <ConditionalWrapper
                      condition={!isSmall}
                      wrapper={children =>
                        <Tooltip title={t('copyAddress')} open={addressTooltipOpen} onOpen={handleAddressTooltipOpen} onClose={handleAddressTooltipClose}>{children}</Tooltip>}
                    >
                      <ListItemButton>
                        <ListItemIcon>
                          <LocationOnOutlinedIcon color='primary' />
                        </ListItemIcon>
                        <ListItemText primary={address} />
                        <ListItemIcon className='oc-icon-copy-container'>
                          <ContentCopyIcon className='oc-icon-copy' style={{ fontSize: '1.125rem' }} />
                        </ListItemIcon>
                      </ListItemButton>
                    </ConditionalWrapper>
                  </ListItem>
                </CopyToClipboard>
              )
            }

            {
              coordinatesText && (
                <CopyToClipboard text={coordinatesTextCopy} placement='bottom-end' onCopy={handleCoordinatesCopy}>
                  <ListItem disablePadding>
                    <ConditionalWrapper
                      condition={!isSmall}
                      wrapper={children => <Tooltip title={t('copyCoordinates')} open={coordinatesTooltipOpen} onOpen={handleCoordinatesTooltipOpen} onClose={handleCoordinatesTooltipClose}>{children}</Tooltip>}
                    >
                      <ListItemButton>
                        <ListItemIcon>
                          <MyLocationOutlinedIcon color='primary' />
                        </ListItemIcon>
                        <ListItemText primary={coordinatesText} />
                        <ListItemIcon className='oc-icon-copy-container'>
                          <ContentCopyIcon className='oc-icon-copy' style={{ fontSize: '1.125rem' }} />
                        </ListItemIcon>
                      </ListItemButton>

                    </ConditionalWrapper>
                  </ListItem>
                </CopyToClipboard>
              )
            }
          </>
        }

        {

          !hasAddressOrCoordinates && (
            <ListItem disablePadding>
              <ListItemButton disabled>
                <ListItemIcon>
                  <LocationDisabledOutlinedIcon color='primary' />
                </ListItemIcon>
                <ListItemText primary={t('locationNotAvailable')} />
              </ListItemButton>
            </ListItem>
          )
        }

        {
          keysTexts && keysTexts.map(keyText =>
            <CopyToClipboard key={keyText} text={keyText} placement='bottom-end' onCopy={handleKeyCoordinatesCopy}>
              <ListItem disablePadding>
                <ConditionalWrapper
                  condition={!isSmall}
                  wrapper={children => <Tooltip title={t('copyCoordinates')} open={keyCoordinatesTooltipOpen} onOpen={handleKeyCoordinatesTooltipOpen} onClose={handleKeyCoordinatesTooltipClose}>{children}</Tooltip>}
                >
                  <ListItemButton>
                    <ListItemIcon>
                      <KeyRoundedIcon color='primary' />
                    </ListItemIcon>
                    <ListItemText primary={keyText} />
                    <ListItemIcon className='oc-icon-copy-container'>
                      <ContentCopyIcon className='oc-icon-copy' style={{ fontSize: '1.125rem' }} />
                    </ListItemIcon>
                  </ListItemButton>
                </ConditionalWrapper>
              </ListItem>
            </CopyToClipboard>
          )
        }

        {
          entranceText && (
            <CopyToClipboard text={entranceText} placement='bottom-end' onCopy={handleEntranceCoordinatesCopy}>
              <ListItem disablePadding>
                <ConditionalWrapper
                  condition={!isSmall}
                  wrapper={children => <Tooltip title={t('copyEntranceCoordinates')} open={entranceCoordinatesTooltipOpen} onOpen={handleEntranceCoordinatesTooltipOpen} onClose={handleEntranceCoordinatesTooltipClose}>{children}</Tooltip>}
                >
                  <ListItemButton>
                    <ListItemIcon>
                      <FenceRoundedIcon color='primary' />
                    </ListItemIcon>
                    <ListItemText primary={entranceText} />
                    <ListItemIcon className='oc-icon-copy-container'>
                      <ContentCopyIcon className='oc-icon-copy' style={{ fontSize: '1.125rem' }} />
                    </ListItemIcon>
                  </ListItemButton>
                </ConditionalWrapper>
              </ListItem>
            </CopyToClipboard>
          )
        }

      </List>

      {
        cave.sistemas && cave.sistemas.length > 0 && <>
          <Divider />
          <SistemaHistory sistemaHistory={cave.sistemas} />
        </>
      }

      <Divider />

      <Access cave={cave} />

      {
        cave.description && <>
          <Divider />
          <div className='details-container details-text'>
            <Markdown>{cave.description}</Markdown>
          </div>
        </>
      }

      {
        cave.direction && <>
          <Divider />
          <div className='details-container'>
            <h2 className='h2'>{t('directionsHeader')}</h2>
          </div>
          <div className='details-container details-text'>
            <Markdown>{cave.direction}</Markdown>
          </div>
        </>
      }

      {
        !isAndroid && (
          <Portal>
            <Snackbar
              autoHideDuration={6000}
              message={snackbarMessage}
              open={snackbarOpen}
              anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
              action={
                <IconButton
                  size='small'
                  color='inherit'
                  onClick={handleSnackbarClose}
                >
                  <Close />
                </IconButton>
              }
              TransitionComponent={SlideUp}
              onClose={() => { setSnackbarOpen(false) }}
            />
          </Portal>
        )
      }
    </Box>
  )
}
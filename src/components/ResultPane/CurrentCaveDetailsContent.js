import React, { useState } from 'react'
import { useLoaderData } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { CopyToClipboard } from 'react-copy-to-clipboard'
import { Box, Button, Divider, IconButton, List, ListItem, ListItemButton, ListItemIcon, ListItemText, Portal, Slide, Snackbar, Tooltip } from '@mui/material'
import { Close, ContentCopy, LocationOnOutlined, MyLocationOutlined, LocationDisabledOutlined, FenceRounded, KeyRounded, AddAPhotoOutlined } from '@mui/icons-material'
import Markdown from '@/components/Markdown/Markdown'
import AddMediasButton from '@/components/MediaPane/AddMediasButton'
import ConditionalWrapper from '@/components/utils/ConditionalWrapper'
import { useSmall } from '@/hooks/useSmall'
import { getOS } from '@/utils/getOS'
import Address from './Address'
import QuickActions from './QuickActions'
import Access from './Access'
import SistemaHistory from './SistemaHistory'
import MediaList from './MediaList'
import { snackbarAutoHideDuration } from '@/config/app'
import './CurrentCaveDetailsContent.scss'

function SlideUp(props) {
  return <Slide {...props} direction='up' />
}

export default function CurrentCaveDetailsContent({ cave }) {
  const { t } = useTranslation('resultPane')
  const { mediaCount } = useLoaderData()

  const isSmall = useSmall()

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

      <MediaList caveId={cave.id} hasMedia={mediaCount > 0} />

      <Box
        my='var(--oc-pane-padding-block)'
        textAlign='center'
      >
        <AddMediasButton
          color='inherit'
          variant='outlined'
          size='small'
          startIcon={<AddAPhotoOutlined color='primary' />}
        />
      </Box>

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
                          <LocationOnOutlined color='primary' />
                        </ListItemIcon>
                        <ListItemText primary={address} />
                        <ListItemIcon className='oc-icon-copy-container'>
                          <ContentCopy className='oc-icon-copy' style={{ fontSize: '1.125rem' }} />
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
                          <MyLocationOutlined color='primary' />
                        </ListItemIcon>
                        <ListItemText primary={coordinatesText} />
                        <ListItemIcon className='oc-icon-copy-container'>
                          <ContentCopy className='oc-icon-copy' style={{ fontSize: '1.125rem' }} />
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
                  <LocationDisabledOutlined color='primary' />
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
                      <KeyRounded color='primary' />
                    </ListItemIcon>
                    <ListItemText primary={keyText} />
                    <ListItemIcon className='oc-icon-copy-container'>
                      <ContentCopy className='oc-icon-copy' style={{ fontSize: '1.125rem' }} />
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
                      <FenceRounded color='primary' />
                    </ListItemIcon>
                    <ListItemText primary={entranceText} />
                    <ListItemIcon className='oc-icon-copy-container'>
                      <ContentCopy className='oc-icon-copy' style={{ fontSize: '1.125rem' }} />
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
              autoHideDuration={snackbarAutoHideDuration}
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
import React, { useEffect, useRef, useState } from 'react'
import { IonCardContent, IonCardHeader, IonCardSubtitle, IonCardTitle, IonList, IonItem, IonLabel, IonToast } from '@ionic/react'
import { useTranslation } from 'react-i18next'
import { CopyToClipboard } from 'react-copy-to-clipboard'
import { Box, CardContent, CardHeader, Tooltip, Typography, useMediaQuery } from '@mui/material'
import { useTheme } from '@mui/material/styles'
import { close } from 'ionicons/icons'
import ContentCopyIcon from '@mui/icons-material/ContentCopy'
import LocationOnOutlinedIcon from '@mui/icons-material/LocationOnOutlined'
import MyLocationOutlinedIcon from '@mui/icons-material/MyLocationOutlined'
import LocationDisabledOutlinedIcon from '@mui/icons-material/LocationDisabledOutlined'
import FenceRoundedIcon from '@mui/icons-material/FenceRounded'
import KeyRoundedIcon from '@mui/icons-material/KeyRounded'
import Markdown from '../Markdown/Markdown'
import Address from './Address'
import Divider from './Divider'
import QuickActions from './QuickActions'
import Rating from '../Rating/Rating'
import Access from './Access'
import SistemaHistory from './SistemaHistory.js'
import mediaCardImage from '../../images/card-media.png'
import './CurrentCaveDetails.scss'

export function CurrentCaveDetailsHeader({ cave }) {
  const { t, i18n } = useTranslation('resultPane')
  const [rating, setRating] = useState(-1)
  const theme = useTheme()

  const isSmall = useMediaQuery(theme.breakpoints.down('sm'))

  useEffect(() => setRating(Reflect.has(cave, 'rating') ? cave.rating : -1), [cave])

  return (
    <>
      {
        !isSmall && <img alt="" src={mediaCardImage} />
      }
      <Box className='oc-result-pane--header'>
        <Typography variant='caveDetailsHeader'>{cave.name}</Typography>
        {
          cave.nameTranslations?.[i18n.resolvedLanguage] && <Typography variant='body2' className='oc-result-pane--header-subtitle'>{cave.nameTranslations[i18n.resolvedLanguage]}</Typography>
        }
        {
          cave.aka && cave.aka.length && <Typography variant='caveDetailsSubHeader' className='oc-result-pane--header-subtitle'>{cave.aka.join(', ')}</Typography>
        }
        <Rating value={rating}></Rating>
      </Box>
    </>
  )
}

export function CurrentCaveDetailsContent({ cave }) {
  const { t } = useTranslation('resultPane')
  const theme = useTheme()

  const addressTooltip = useRef()
  const [toastIsOpen, setToastIsOpen] = useState(false)
  const [toastMessage, setToastMessage] = useState()

  const [addressTooltipOpen, setAddressTooltipOpen] = useState(false)
  const [coordinatesTooltipOpen, setCoordinatesTooltipOpen] = useState(false)
  const [keyCoordinatesTooltipOpen, setKeyCoordinatesTooltipOpen] = useState(false)
  const [entranceCoordinatesTooltipOpen, setEntranceCoordinatesTooltipOpen] = useState(false)
  const [toastButtons, setToastButtons] = useState([])

  let hasAddressOrCoordinates = false
  let address, addressText, coordinatesText, keysTexts, entranceText

  if (cave.location) {

    address = <Address longitude={cave.location.longitude} latitude={cave.location.latitude} />
    addressText = `${cave.location.latitude}, ${cave.location.longitude}`
    coordinatesText = `${cave.location.latitude}, ${cave.location.longitude}`
    hasAddressOrCoordinates = true
  }

  if (cave.keys) {
    keysTexts = cave.keys.map(key => `${key.latitude}, ${key.longitude}`)
  }

  if (cave.entrance) {
    entranceText = `${cave.entrance.latitude}, ${cave.entrance.longitude}`
  }

  const isSmall = useMediaQuery(theme.breakpoints.down('sm'))

  useEffect(() => {
    if (isSmall) {
      setToastButtons([])
    } else {
      setToastButtons([{
        role: 'cancel',
        side: 'end',
        icon: close
      }])
    }
  }, [isSmall])

  function handleAddressTooltipOpen() {
    setAddressTooltipOpen(true)
  }

  function handleAddressTooltipClose() {
    setAddressTooltipOpen(false)
  }

  function handleAddressCopy(text, success) {
    setAddressTooltipOpen(false)
    setToastMessage(t('copiedToClipboard'))
    setToastIsOpen(true)
  }

  function onToastDidDismiss() {
    setToastIsOpen(false)
    setToastMessage('')
  }

  function handleCoordinatesTooltipOpen() {
    setCoordinatesTooltipOpen(true)
  }

  function handleCoordinatesTooltipClose() {
    setCoordinatesTooltipOpen(false)
  }

  function handleCoordinatesCopy(text, success) {
    setCoordinatesTooltipOpen(false)
    setToastMessage(t('copiedToClipboard'))
    setToastIsOpen(true)
  }

  function handleKeyCoordinatesTooltipOpen() {
    setKeyCoordinatesTooltipOpen(true)
  }

  function handleKeyCoordinatesTooltipClose() {
    setKeyCoordinatesTooltipOpen(false)
  }

  function handleKeyCoordinatesCopy(text, success) {
    setKeyCoordinatesTooltipOpen(false)
    setToastMessage(t('copiedToClipboard'))
    setToastIsOpen(true)
  }

  function handleEntranceCoordinatesTooltipOpen() {
    setEntranceCoordinatesTooltipOpen(true)
  }

  function handleEntranceCoordinatesTooltipClose() {
    setEntranceCoordinatesTooltipOpen(false)
  }

  function handleEntranceCoordinatesCopy(text, success) {
    setEntranceCoordinatesTooltipOpen(false)
    setToastMessage(t('copiedToClipboard'))
    setToastIsOpen(true)
  }

  return (
    <IonCardContent className='oc-result-pane--content'>

      <QuickActions cave={cave}></QuickActions>

      <Divider />

      <IonList lines="none" className='oc-results-copy-items'>

        {

          hasAddressOrCoordinates &&

          <>
            {
              address &&
              <CopyToClipboard text={addressText} placement='bottom-end' onCopy={handleAddressCopy}>
                <Tooltip title={t('copyAddress')} open={addressTooltipOpen} onOpen={handleAddressTooltipOpen} onClose={handleAddressTooltipClose}>
                  <IonItem button detail={false}>
                    <LocationOnOutlinedIcon slot='start' color='primary' />
                    <IonLabel>{address}</IonLabel>
                    <ContentCopyIcon slot='end' />
                  </IonItem>
                </Tooltip>
              </CopyToClipboard>
            }

            {
              coordinatesText &&
              <CopyToClipboard text={coordinatesText} placement='bottom-end' onCopy={handleCoordinatesCopy}>
                <Tooltip title={t('copyCoordinates')} open={coordinatesTooltipOpen} onOpen={handleCoordinatesTooltipOpen} onClose={handleCoordinatesTooltipClose}>
                  <IonItem button detail={false}>
                    <MyLocationOutlinedIcon slot='start' color='primary' />
                    <IonLabel>{coordinatesText}</IonLabel>
                    <ContentCopyIcon slot='end' className='icon' />
                  </IonItem>
                </Tooltip>
              </CopyToClipboard>
            }
          </>
        }

        {

          !hasAddressOrCoordinates &&
          <IonItem disabled={true}>
            <LocationDisabledOutlinedIcon slot='start' color='disabled' />
            <IonLabel>{t('locationNotAvailable')}</IonLabel>
          </IonItem>
        }

        {
          keysTexts && keysTexts.map(keyText =>
            <CopyToClipboard key={keyText} text={keyText} placement='bottom-end' onCopy={handleKeyCoordinatesCopy}>
              <Tooltip title={t('copyKeyCoordinates')} open={keyCoordinatesTooltipOpen} onOpen={handleKeyCoordinatesTooltipOpen} onClose={handleKeyCoordinatesTooltipClose}>
                <IonItem button detail={false}>
                  <KeyRoundedIcon slot='start' color='primary' />
                  <IonLabel>{keyText}</IonLabel>
                  <ContentCopyIcon slot='end' className='icon' />
                </IonItem>
              </Tooltip>
            </CopyToClipboard>
          )
        }

        {
          entranceText &&
          <CopyToClipboard text={entranceText} placement='bottom-end' onCopy={handleEntranceCoordinatesCopy}>
            <Tooltip title={t('copyEntranceCoordinates')} open={entranceCoordinatesTooltipOpen} onOpen={handleEntranceCoordinatesTooltipOpen} onClose={handleEntranceCoordinatesTooltipClose}>
              <IonItem button detail={false}>
                <FenceRoundedIcon slot='start' color='primary' />
                <IonLabel>{entranceText}</IonLabel>
                <ContentCopyIcon slot='end' className='icon' />
              </IonItem>
            </Tooltip>
          </CopyToClipboard>
        }

      </IonList>

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
            <h2>{t('directionsHeader')}</h2>
          </div>
          <div className='details-container details-text'>
            <Markdown>{cave.direction}</Markdown>
          </div>
        </>
      }

      <IonToast className='toast' duration={7000} isOpen={toastIsOpen} message={toastMessage} onDidDismiss={onToastDidDismiss} buttons={toastButtons} />
    </IonCardContent>
  )
}
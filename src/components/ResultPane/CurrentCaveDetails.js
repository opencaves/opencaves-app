import React, { useEffect, useRef, useState } from 'react'
import { IonCardContent, IonCardHeader, IonCardSubtitle, IonCardTitle, IonList, IonItem, IonLabel, IonToast, IonAccordionGroup, IonAccordion, IonIcon, IonNote } from '@ionic/react'
import { useMediaQuery } from 'react-responsive'
import { useTranslation } from 'react-i18next'
import { CopyToClipboard } from 'react-copy-to-clipboard'
import { Tooltip } from '@mui/material'
import ContentCopyIcon from '@mui/icons-material/ContentCopy'
import { close, returnDownForward } from 'ionicons/icons'
import LocationOnOutlinedIcon from '@mui/icons-material/LocationOnOutlined'
import MyLocationOutlinedIcon from '@mui/icons-material/MyLocationOutlined'
import LocationDisabledOutlinedIcon from '@mui/icons-material/LocationDisabledOutlined'
import Markdown from '../Markdown/Markdown'
import Address from './Address'
import QuickActions from './QuickActions'
import Rating from '../Rating/Rating'
import Access from './Access'
import { ReactComponent as CaveSystemIcon } from '../../images/cave-system.svg'
import mediaCardImage from '../../images/card-media.webp'
import './CurrentCaveDetails.scss'

export function CurrentCaveDetailsHeader({ cave }) {
  const { t, i18n } = useTranslation('resultPane')
  const [rating, setRating] = useState(-1)

  const isSmall = useMediaQuery({
    query: '(max-width: 767px)'
  })

  useEffect(() => setRating(Reflect.has(cave, 'rating') ? cave.rating : -1), [cave])

  return (
    <>
      {
        !isSmall && <img alt="" src={mediaCardImage} />
      }
      <IonCardHeader className='oc-result-pane--header'>
        <IonCardTitle><h1>{cave.name}</h1></IonCardTitle>
        {
          cave.nameTranslations?.[i18n.resolvedLanguage] && <IonCardSubtitle className='oc-result-pane--header-subtitle'>{cave.nameTranslations[i18n.resolvedLanguage]}</IonCardSubtitle>
        }
        {
          cave.aka && cave.aka.length && <IonCardSubtitle className='oc-result-pane--header-subtitle'>{cave.aka.join(', ')}</IonCardSubtitle>
        }
        <Rating value={rating}></Rating>
      </IonCardHeader>
    </>
  )
}

export function CurrentCaveDetailsContent({ cave }) {
  const { t } = useTranslation('resultPane')

  const addressTooltip = useRef()
  const [toastIsOpen, setToastIsOpen] = useState(false)
  const [toastMessage, setToastMessage] = useState()
  let hasAddressOrCoordinates = false
  let address, addressText, coordinatesText

  if (cave.location) {

    address = <Address longitude={cave.location.longitude} latitude={cave.location.latitude} />
    addressText = `${cave.location.latitude}, ${cave.location.longitude}`
    coordinatesText = `${cave.location.latitude}, ${cave.location.longitude}`
    hasAddressOrCoordinates = true
  }

  const [addressTooltipOpen, setAddressTooltipOpen] = useState(false)
  const [coordinatesTooltipOpen, setCoordinatesTooltipOpen] = useState(false)
  const [toastButtons, setToastButtons] = useState([])

  const isSmall = useMediaQuery({
    query: '(max-width: 767px)'
  })

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

  return (
    <IonCardContent className='oc-result-pane--content'>

      <QuickActions cave={cave}></QuickActions>

      <hr />

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

      </IonList>

      {
        cave.sistemas && cave.sistemas.length > 0 && <>
          <hr />
          <Sistema sistemaHistory={cave.sistemas} />
        </>
      }

      <hr />

      <Access cave={cave} />

      {
        cave.description && <>
          <hr />
          <div className='details-container'><Markdown>{cave.description}</Markdown></div>
        </>
      }

      {
        cave.direction && <>
          <hr />
          <div className='details-container'>
            <h2>{t('directionsHeader')}</h2>
          </div>
          <div className='details-container'>
            <Markdown>{cave.direction}</Markdown>
          </div>
        </>
      }

      <IonToast className='toast' duration={7000} isOpen={toastIsOpen} message={toastMessage} onDidDismiss={onToastDidDismiss} buttons={toastButtons} />
    </IonCardContent>
  )
}

function Sistema({ sistemaHistory }) {

  const { t } = useTranslation('resultPane')

  const hasSistemaAncestry = sistemaHistory.length > 1

  if (hasSistemaAncestry) {
    const currentSistema = sistemaHistory.at(-1)
    return (
      <IonAccordionGroup className='oc-results-sistemas'>
        <IonAccordion>
          <IonItem slot='header'>
            <IonLabel>{t('sistema', { system: currentSistema.name })}</IonLabel>
            <CaveSystemIcon slot='start' className='cave-system-icon' style={{ color: currentSistema.color }} />
          </IonItem>
          <IonItem slot='content' className='oc-results-sistemas--sistemas' color='light'>
            <div>
              {
                sistemaHistory.map((sistema, i) => {
                  const sistemaName = i === 0 ? `${t('sistema', { system: sistema.name })}` : <><IonIcon icon={returnDownForward} /> {t('sistema', { system: sistema.name })} {sistema.date && <IonNote className='oc-results-sistemas--item-note'>{sistema.date}</IonNote>}</>
                  return <div key={i} className='oc-results-sistemas--item' style={{ paddingInlineStart: `calc(var(--oc-results-sistemas--item-padding) * ${i})` }}>{sistemaName}</div>
                })
              }
            </div>
          </IonItem>
        </IonAccordion>
      </IonAccordionGroup>
    )
  }

  return (
    <IonItem className='oc-results-sistemas'>
      <IonLabel>{t('sistema', { system: sistemaHistory[0].name })}</IonLabel>
      <CaveSystemIcon slot='start' className='cave-system-icon' style={{ color: sistemaHistory[0].color }} />
    </IonItem>
  )
}
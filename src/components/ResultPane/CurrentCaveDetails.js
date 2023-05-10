import React, { useEffect, useRef, useState } from 'react'
import { IonCardContent, IonCardHeader, IonCardSubtitle, IonCardTitle, IonList, IonItem, IonAvatar, IonImg, IonLabel, IonToast, IonAccordionGroup, IonAccordion, IonIcon, IonNote } from '@ionic/react'
import { useMediaQuery } from 'react-responsive'
import { useTranslation } from 'react-i18next'
import { CopyToClipboard } from 'react-copy-to-clipboard'
import ContentCopyIcon from '@mui/icons-material/ContentCopy'
import { close, returnDownForward } from 'ionicons/icons'
import LocationOnOutlinedIcon from '@mui/icons-material/LocationOnOutlined'
import MyLocationOutlinedIcon from '@mui/icons-material/MyLocationOutlined'
import Markdown from '../Markdown/Markdown'
import Tooltip from '../Tooltip'
import Address from './Address'
import QuickActions from './QuickActions'
import Rating from '../Rating/Rating'
import { ReactComponent as CaveSystemIcon } from '../../images/cave-system.svg'
import './CurrentCaveDetails.scss'

export function CurrentCaveDetailsHeader({ cave }) {
  const { t } = useTranslation('resultPane')
  const [rating, setRating] = useState(-1)

  useEffect(() => setRating(Reflect.has(cave, 'rating') ? cave.rating : -1), [cave])

  return (
    <IonCardHeader className='oc-result-pane--header'>
      <IonCardTitle>{cave.name}</IonCardTitle>
      {
        cave.aka && cave.aka.length && <IonCardSubtitle>{cave.aka.join(', ')}</IonCardSubtitle>
      }
      <Rating value={rating}></Rating>
      <div><small>{cave.color}</small></div>
    </IonCardHeader>
  )
}

export function CurrentCaveDetailsContent({ cave }) {
  const { t } = useTranslation('resultPane')

  const addressTooltip = useRef()
  const [toastIsOpen, setToastIsOpen] = useState(false)
  const [toastMessage, setToastMessage] = useState()

  const address = <Address longitude={cave.location.longitude} latitude={cave.location.latitude} />
  const addressText = `${cave.location.longitude}, ${cave.location.latitude}`

  const coordinatesText = `${cave.location.longitude}, ${cave.location.latitude}`

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

      <hr />

      <QuickActions cave={cave}></QuickActions>

      <hr />

      <IonList lines="none" className='oc-results-copy-items'>
        {
          address &&
          <CopyToClipboard text={addressText} placement='bottom-end' onCopy={handleAddressCopy}>
            <Tooltip ref={addressTooltip} title={t('copyAddress')} className='oc-results-tooltip' open={addressTooltipOpen} onOpen={handleAddressTooltipOpen} onClose={handleAddressTooltipClose}>
              <IonItem button detail={false}>
                <LocationOnOutlinedIcon slot='start' color='primary' />
                <IonLabel>{address}</IonLabel>
                <ContentCopyIcon slot='end' />
              </IonItem>
            </Tooltip>
          </CopyToClipboard>
        }
        <CopyToClipboard text={coordinatesText} placement='bottom-end' onCopy={handleCoordinatesCopy}>
          <Tooltip title={t('copyCoordinates')} className='oc-results-tooltip' open={coordinatesTooltipOpen} onOpen={handleCoordinatesTooltipOpen} onClose={handleCoordinatesTooltipClose}>
            <IonItem button detail={false}>
              <MyLocationOutlinedIcon slot='start' color='primary' />
              <IonLabel>{coordinatesText}</IonLabel>
              <ContentCopyIcon slot='end' className='icon' />
            </IonItem>
          </Tooltip>
        </CopyToClipboard>
      </IonList>

      <hr />

      {
        cave.description && <>
          <div className='details-container'><Markdown>{cave.description}</Markdown></div>
          <hr />
        </>
      }

      <Sistema cave={cave} />

      <IonList>
        <IonItem>
          <IonAvatar slot="start">
            <IonImg src="https://i.pravatar.cc/300?u=b" />
          </IonAvatar>
          <IonLabel>
            <h2>Connor Smith</h2>
            <p>Sales Rep</p>
          </IonLabel>
        </IonItem>
        <IonItem>
          <IonAvatar slot="start">
            <IonImg src="https://i.pravatar.cc/300?u=a" />
          </IonAvatar>
          <IonLabel>
            <h2>Daniel Smith</h2>
            <p>Product Designer</p>
          </IonLabel>
        </IonItem>
        <IonItem>
          <IonAvatar slot="start">
            <IonImg src="https://i.pravatar.cc/300?u=d" />
          </IonAvatar>
          <IonLabel>
            <h2>Greg Smith</h2>
            <p>Director of Operations</p>
          </IonLabel>
        </IonItem>
        <IonItem>
          <IonAvatar slot="start">
            <IonImg src="https://i.pravatar.cc/300?u=e" />
          </IonAvatar>
          <IonLabel>
            <h2>Zoey Smith</h2>
            <p>CEO</p>
          </IonLabel>
        </IonItem>
      </IonList>

      <IonToast className='toast' duration={700000} isOpen={toastIsOpen} message={toastMessage} onDidDismiss={onToastDidDismiss} buttons={toastButtons} />
    </IonCardContent>
  )
}

function Sistema({ cave }) {
  const { t } = useTranslation('resultPane')

  const hasSistemaAncestry = cave.sistemas.length > 1

  if (hasSistemaAncestry) {
    return (
      // <IonItem button detail={true} detailIcon={chevronDown}>
      //   <IonLabel>{t('sistema')} {cave.sistemas.at(-1).name}</IonLabel>
      // </IonItem>
      <IonAccordionGroup className='oc-results-sistemas'>
        <IonAccordion>
          <IonItem slot='header'>
            <IonLabel>{t('sistema', { system: cave.sistemas.at(-1).name })}</IonLabel>
            {/* <IonIcon slot='start' src='' /> */}
            <CaveSystemIcon slot='start' className='cave-system-icon' />
          </IonItem>
          <IonItem slot='content' className='oc-results-sistemas--sistemas' color='light'>
            <div>
              {
                cave.sistemas.map((sistema, i) => {
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
    <IonItem>
      <IonLabel>{t('sistema')} {cave.sistemas[0].name}</IonLabel>
    </IonItem>
  )
}
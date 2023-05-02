import React, { useEffect, useRef, useState } from 'react'
import { IonCardContent, IonCardHeader, IonCardSubtitle, IonCardTitle, IonList, IonItem, IonAvatar, IonImg, IonLabel } from '@ionic/react'
import { useTranslation } from 'react-i18next'
import { CopyToClipboard } from 'react-copy-to-clipboard'
import ContentCopyIcon from '@mui/icons-material/ContentCopy'
import LocationOnOutlinedIcon from '@mui/icons-material/LocationOnOutlined'
import MyLocationOutlinedIcon from '@mui/icons-material/MyLocationOutlined'
import Markdown from '../Markdown/Markdown'
import Tooltip from '../Tooltip'
import Address from './Address'
import QuickActions from './QuickActions'
import Rating from '../Rating/Rating'
import './CurrentCaveDetails.scss'

export function CurrentCaveDetailsHeader({ cave }) {
  const { t } = useTranslation()
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
  const { t } = useTranslation()

  const addressTooltip = useRef()

  const address = <Address longitude={cave.location.longitude} latitude={cave.location.latitude} />
  const addressText = `${cave.location.longitude}, ${cave.location.latitude}`

  const coordinatesText = `${cave.location.longitude}, ${cave.location.latitude}`

  const [addressTooltipOpen, setAddressTooltipOpen] = useState(false)

  function handleAddressTooltipOpen() {
    setAddressTooltipOpen(true)
  }

  function handleAddressTooltipClose() {
    setAddressTooltipOpen(false)
  }

  function handleAddressCopy() {
    console.log('addressTooltip: %o', addressTooltip)
  }

  return (
    <IonCardContent className='oc-result-pane--content'>

      <hr />

      <QuickActions cave={cave}></QuickActions>

      <hr />

      <IonList lines="none">
        {
          address &&
          <CopyToClipboard text={addressText} placement='bottom-end' onCopy={handleAddressCopy}>
            <Tooltip ref={addressTooltip} title={t('resultPane.copyAddress')} className='oc-results-tooltip' open={addressTooltipOpen} onOpen={handleAddressTooltipOpen} onClose={handleAddressTooltipClose}>
              <IonItem button detail={false}>
                <LocationOnOutlinedIcon slot='start' color='primary' />
                <IonLabel>{address}</IonLabel>
                <ContentCopyIcon slot='end' />
              </IonItem>
            </Tooltip>
          </CopyToClipboard>
        }
        <CopyToClipboard text={coordinatesText} placement='bottom-end'>
          <Tooltip title={t('resultPane.copyCoordinates')} className='oc-results-tooltip'>
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
        cave.description && <div className='details-container'><Markdown>{cave.description}</Markdown></div>
      }

      <hr />

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
    </IonCardContent>
  )
}
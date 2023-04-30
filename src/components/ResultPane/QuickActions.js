import { IonButton, IonCol, IonGrid, IonIcon, IonRow } from '@ionic/react'
import { useMediaQuery } from 'react-responsive'
import DirectionsIcon from '@mui/icons-material/Directions'
import BookmarkBorderIcon from '@mui/icons-material/BookmarkBorder'
import ShareIcon from '@mui/icons-material/Share'
import { Share } from '@capacitor/share'
import { useTranslation } from 'react-i18next'
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

export default function QuickActions({ cave }) {
  const { t } = useTranslation()
  const isSmall = useMediaQuery({
    query: '(max-width: 767px)'
  })

  async function onShareClick() {
    console.log('share')
    await Share.share({
      title: 'See cool stuff',
      text: 'Really awesome thing you need to see right meow',
      url: 'http://ionicframework.com/',
      dialogTitle: 'Share with buddies',
    })
  }

  return (
    <IonGrid className={`oc-quick-actions oc-quick-actions-${isSmall ? `sm` : `lg`}`}>
      {isSmall ? (
        <IonRow className='oc-quick-actions--row'>
          <IonCol className='oc-quick-actions--col'>
            <IonButton aria-label={t('directions')} shape="round" className='oc-quick-actions--btn primary' onClick={() => openDirections(cave)}>
              <DirectionsIcon slot='start'></DirectionsIcon>
              {t('directions')}
            </IonButton>
          </IonCol>
          <IonCol className='oc-quick-actions--col'>
            <IonButton aria-label={t('save')} shape="round" fill="outline" className='oc-quick-actions--btn'>
              <BookmarkBorderIcon slot='start'></BookmarkBorderIcon>
              {t('save')}
            </IonButton>
          </IonCol>
          <IonCol className='oc-quick-actions--col'>
            <IonButton aria-label={t('share')} shape="round" fill="outline" className='oc-quick-actions--btn' onClick={onShareClick}>
              <ShareIcon slot='start'></ShareIcon>
              {t('share')}
            </IonButton>
          </IonCol>
        </IonRow>
      ) : (
        <IonRow>
          <IonCol className='oc-quick-actions--col'>
            <button aria-label={t('directions')} className='oc-quick-actions--btn primary' onClick={() => openDirections(cave)}>
              <span className='oc-quick-actions--btn-icon'>
                <DirectionsIcon></DirectionsIcon>
              </span>
              <span className='oc-quick-actions--btn-label'>
                {t('directions')}
              </span>
            </button>
          </IonCol>
          <IonCol className='oc-quick-actions--col'>
            <button aria-label={t('save')} className='oc-quick-actions--btn'>
              <span className='oc-quick-actions--btn-icon'>
                <BookmarkBorderIcon></BookmarkBorderIcon>
              </span>
              <span className='oc-quick-actions--btn-label'>
                {t('save')}
              </span>
            </button>
          </IonCol>
          <IonCol className='oc-quick-actions--col'>
            <button aria-label={t('share')} className='oc-quick-actions--btn' onClick={onShareClick}>
              <span className='oc-quick-actions--btn-icon'>
                <ShareIcon></ShareIcon>
              </span>
              <span className='oc-quick-actions--btn-label'>
                {t('share')}
              </span>
            </button>
          </IonCol>
        </IonRow>
      )}
    </IonGrid>
  )
}
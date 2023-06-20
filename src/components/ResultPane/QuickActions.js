import { IonAlert, IonCol, IonGrid, IonRow, IonToast } from '@ionic/react'
import { Button } from '@mui/material'
import { useMediaQuery } from '@mui/material'
import { useTheme } from '@mui/material/styles'
import DirectionsIcon from '@mui/icons-material/Directions'
import BookmarkBorderIcon from '@mui/icons-material/BookmarkBorder'
import ShareIcon from '@mui/icons-material/Share'
import { Share } from '@capacitor/share'
import { useTranslation } from 'react-i18next'
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

export default function QuickActions({ cave }) {
  const { t } = useTranslation('quickActions')
  const { t: tMap } = useTranslation('map')
  const theme = useTheme()

  const caveName = cave.name ? cave.name.value : tMap('caveNameUnknown')
  const isSmall = useMediaQuery(theme.breakpoints.down('sm'))

  async function onShareClick() {
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

  return (
    <>
      {
        !isSmall && <Divider />
      }

      <IonGrid className={`oc-quick-actions oc-quick-actions-${isSmall ? `sm` : `lg`}`}>
        {isSmall ? (
          <IonRow className='oc-quick-actions--row'>
            {
              cave.location &&
              <IonCol className='oc-quick-actions--col'>
                <Button aria-label={t('directions')} color='primary' variant="contained" startIcon={<DirectionsIcon />} className='oc-quick-actions--btn primary' onClick={() => openDirections(cave)}>
                  {t('directions')}
                </Button>
              </IonCol>
            }
            <IonCol className='oc-quick-actions--col'>
              <Button id='save-btn' aria-label={t('save')} color="primary" variant="outlined" startIcon={<BookmarkBorderIcon />} className='oc-quick-actions--btn'>
                {t('save')}
              </Button>
            </IonCol>
            <IonCol className='oc-quick-actions--col'>
              <Button aria-label={t('share')} color="primary" variant="outlined" startIcon={<ShareIcon />} className='oc-quick-actions--btn' onClick={onShareClick}>
                {t('share')}
              </Button>
            </IonCol>
          </IonRow>
        ) : (
          <IonRow>
            {
              cave.location &&
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
            }
            <IonCol className='oc-quick-actions--col'>
              <button id='save-btn' aria-label={t('save')} className='oc-quick-actions--btn' onClick={onSaveClick}>
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
      {/* <IonToast className='toast' duration={7000} trigger='save-btn' message="To be implemented..."></IonToast> */}
      <IonAlert trigger='save-btn' header='Argh!' message='To be implemented...' buttons={['OK']} className='oc-dialog'></IonAlert>
    </>
  )
}
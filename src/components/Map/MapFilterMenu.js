import React from 'react'
import { IonContent, IonHeader, IonMenu, IonTitle, IonToolbar, IonToggle, IonList, IonItem, IonButtons, IonButton, IonMenuToggle, IonLabel, IonListHeader, IonNote } from '@ionic/react'
import { useDispatch, useSelector } from 'react-redux'
import { useTranslation } from 'react-i18next'
import CloseIcon from '@mui/icons-material/Close'
import { setShowValidCoordinates, setShowInvalidCoordinates, setShowUnknownCoordinates, setShowAccesses, setShowAccessibilities } from '../../redux/slices/searchSlice'
import './MapFilterMenu.scss'

export default function MapFilterMenu() {

  const showValidCoordinates = useSelector(state => state.search.showValidCoordinates)
  const showInvalidCoordinates = useSelector(state => state.search.showInvalidCoordinates)
  const showUnconfirmedCoordinates = useSelector(state => state.search.showUnconfirmedCoordinates)
  const showAccesses = useSelector(state => state.search.showAccesses)
  const showAccessibilities = useSelector(state => state.search.showAccessibilities)

  const dataStats = useSelector(state => state.map.dataStats)

  const dispatch = useDispatch()
  const { t } = useTranslation('filter')

  const handleShowValidCoordinates = (event) => {
    dispatch(setShowValidCoordinates(event.target.checked))
  }

  const handleShowInvalidCoordinates = (event) => {
    dispatch(setShowInvalidCoordinates(event.target.checked))
  }

  const handleShowUnknownCoordinates = (event) => {
    dispatch(setShowUnknownCoordinates(event.target.checked))
  }

  function handleShowAccesses(checked, accessKey) {
    const newAccesses = showAccesses.map(access => {
      if (access.key === accessKey) {
        return { ...access, checked }
      }
      return access
    })
    // console.log('newAccessibilities: %o', newAccessibilities)
    dispatch(setShowAccesses(newAccesses))
  }

  // function accessesNoteOnClick(accessKey, checked) {
  //   console.log('[accessesNoteOnClick¸%o', event)
  //   dispatch(setShowAccesses(!showAccesses))
  // }

  function handleShowAccessibilities(checked, accessKey) {
    console.log('checked: %s', checked)
    // const newAccessibilities = checked ? [...showAccessibilities, accessKey] : showAccessibilities.filter(key => key !== accessKey)
    const newAccessibilities = showAccessibilities.map(access => {
      if (access.key === accessKey) {
        return { ...access, checked }
      }
      return access
    })
    console.log('newAccessibilities: %o', newAccessibilities)
    dispatch(setShowAccessibilities(newAccessibilities))
  }

  function accessibilitiesNoteOnClick(event) {
    console.log(event)
  }

  function getDataStat(prop, value) {
    return dataStats?.[prop]?.[value] || 0
  }

  const accessibilities = t('accessibility.items', { returnObjects: true })
  const accesses = t('access.items', { returnObjects: true })

  return (
    <>
      <IonMenu contentId="main-content" side="end" className='map-filter-menu'>
        <IonHeader>
          <IonToolbar>
            <IonTitle>{t('windowTitle')}</IonTitle>
            <IonButtons slot="start">
              <IonMenuToggle>
                <IonButton aria-label={t('close')}>
                  <CloseIcon slot='icon-only'></CloseIcon>
                </IonButton>
              </IonMenuToggle>
            </IonButtons>
          </IonToolbar>
        </IonHeader>
        <IonContent className="map-filter-menu--panel ion-padding">
          <IonList className='list'>
            <IonListHeader>
              <ion-label>{t('coordinate.heading')}</ion-label>
            </IonListHeader>
            <IonItem className='oc-filter-coordinate-item'>
              <IonLabel className='oc-filter-coordinate-item--label'>
                <IonToggle labelPlacement="start" justify="space-between" onClick={handleShowValidCoordinates} checked={showValidCoordinates}>
                  {t('coordinate.showValidCoordinates')}
                  <IonNote className='oc-filter-accessibility-item--nb'>({getDataStat('location.validity', 'valid')})</IonNote>
                </IonToggle>
              </IonLabel>
            </IonItem>
            <IonItem className='oc-filter-coordinate-item'>
              <IonLabel className='oc-filter-coordinate-item--label'>
                <IonToggle labelPlacement="start" justify="space-between" onClick={handleShowInvalidCoordinates} checked={showInvalidCoordinates}>
                  {t('coordinate.showInvalidCoordinates')}
                  <IonNote className='oc-filter-accessibility-item--nb'>({getDataStat('location.validity', 'invalid')})</IonNote>
                </IonToggle>
              </IonLabel>
            </IonItem>
            <IonItem lines="none" className='oc-filter-coordinate-item'>
              <IonLabel className='oc-filter-coordinate-item--label'>
                <IonToggle labelPlacement="start" justify="space-between" onClick={handleShowUnknownCoordinates} checked={showUnconfirmedCoordinates}>
                  {t('coordinate.showUnconfirmedCoordinates')}
                  <IonNote className='oc-filter-accessibility-item--nb'>({getDataStat('location.validity', 'unknown')})</IonNote>
                </IonToggle>
              </IonLabel>
            </IonItem>
          </IonList>
          <IonList className='list'>
            <IonListHeader>
              <ion-label>{t('access.heading')}</ion-label>
            </IonListHeader>
            {
              showAccesses.map(({ key, checked }, index) => {
                return (
                  <IonItem button detail="false" key={key} lines={index === accesses.length - 1 ? 'none' : null} className='oc-filter-accessibility-item'>
                    <IonLabel className="ion-text-wrap oc-filter-accessibility-item--inner">
                      <IonToggle className='oc-filter-accessibility-item--checkbox' labelPlacement="start" justify='space-between' checked={checked} onIonChange={() => handleShowAccesses(!checked, key)}>
                        <div className="oc-filter-accessibility-item--label">
                          {accesses.find(a => a.key === key).label}
                          <IonNote className='oc-filter-accessibility-item--nb'>({getDataStat('access', key)})</IonNote>
                        </div>
                      </IonToggle>
                      <IonNote className='oc-filter-accessibility-item--note' onClick={(e) => handleShowAccesses(!checked, key)}>{accesses.find(a => a.key === key).desc}</IonNote>
                    </IonLabel>
                  </IonItem>
                )
              })
            }
          </IonList>
          <IonList className='list'>
            <IonListHeader>
              <ion-label>{t('accessibility.heading')}</ion-label>
            </IonListHeader>
            {
              showAccessibilities.map(({ key, checked }, index) => {
                return (
                  <IonItem button detail="false" key={key} lines={index === accessibilities.length - 1 ? 'none' : null} className='oc-filter-accessibility-item'>
                    <IonLabel className="ion-text-wrap oc-filter-accessibility-item--inner">
                      <IonToggle className='oc-filter-accessibility-item--checkbox' labelPlacement="start" justify='space-between' checked={checked} onIonChange={(e) => handleShowAccessibilities(e.target.checked, key)}>
                        <div className="oc-filter-accessibility-item--label">
                          {accessibilities.find(a => a.key === key).label}
                          <IonNote className='oc-filter-accessibility-item--nb'>({getDataStat('accessibility', key)})</IonNote>
                        </div>
                      </IonToggle>
                      <IonNote className='oc-filter-accessibility-item--note' onClick={accessibilitiesNoteOnClick}>{accessibilities.find(a => a.key === key).desc}</IonNote>
                    </IonLabel>
                  </IonItem>
                )
              })
            }
          </IonList>
        </IonContent>
        <IonMenuToggle>
          <IonButton fill="clear" className='handle' ariaLabel={t('close')} mode='ios'></IonButton>
        </IonMenuToggle>
      </IonMenu>
    </>
  )
}
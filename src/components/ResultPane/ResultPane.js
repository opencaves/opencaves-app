import React, { useRef, useState } from 'react'
import { useMediaQuery } from 'react-responsive'
import { useDispatch, useSelector } from 'react-redux'
import {
  IonButton,
  IonModal,
  IonHeader,
  IonContent,
  IonToolbar,
  IonTitle,
  IonPage,
  IonList,
  IonItem,
  IonLabel,
  IonAvatar,
  IonImg,
  IonSearchbar,
} from '@ionic/react'
import { setShowPopup } from '../../redux/slices/mapSlice.js'
import ResultPaneSm from './ResultPaneSm'
import ResultPaneLg from './ResultPaneLg'
import './ResultPane.scss'

export default function ResultPane() {
  const dispatch = useDispatch
  const modal = useRef(null)
  const popupData = useSelector(state => state.map.popupData)
  const showPopup = useSelector(state => state.map.showPopup)
  const isSmall = useMediaQuery({
    query: '(max-width: 767px)'
  })

  function hide() {
    console.log('hide')
    dispatch(setShowPopup(false))
  }

  return showPopup && (isSmall ? (<ResultPaneSm cave={popupData}></ResultPaneSm>) : (<ResultPaneLg cave={popupData}></ResultPaneLg>))
}
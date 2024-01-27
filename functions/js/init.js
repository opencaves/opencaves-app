import { initializeApp } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import { getAuth } from 'firebase-admin/auth'
// import { region } from 'firebase-functions/v1'
import { setGlobalOptions } from 'firebase-functions/v2'
import { region } from './constants.js'

setGlobalOptions({ region })

initializeApp()
// region('northamerica-northeast1')

export const db = getFirestore()
export const auth = getAuth()
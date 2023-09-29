import { initializeApp } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import { getAuth } from 'firebase-admin/auth'
import { region } from 'firebase-functions/v1'

initializeApp()
region('northamerica-northeast1')

export const db = getFirestore()
export const auth = getAuth()
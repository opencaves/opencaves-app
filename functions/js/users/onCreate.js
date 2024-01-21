import { auth, logger } from 'firebase-functions/v1'
import { db } from '../init.js'
import { USERS_COLL_NAME } from '../assets/constants.js'


export const onUserCreate = auth.user().onCreate(async user => {
  await db.collection(USERS_COLL_NAME).doc(user.uid).set({
    ratings: []
  })
})
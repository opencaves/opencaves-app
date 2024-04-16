import functions from 'firebase-functions'
import { db } from '../init.js'
import { REGION, USERS_COLL_NAME } from '../constants.js'


export const onUserCreate = functions
  .region(REGION)
  .auth
  .user()
  .onCreate(async user => {
    await db.collection(USERS_COLL_NAME).doc(user.uid).set({
      ratings: []
    })
  })
import functions from 'firebase-functions'
import { db } from '../init.js'
import { USERS_COLL_NAME } from '../assets/constants.js'
import { region } from '../constants.js'


export const onUserCreate = functions
  .region(region)
  .auth
  .user()
  .onCreate(async user => {
    await db.collection(USERS_COLL_NAME).doc(user.uid).set({
      ratings: []
    })
  })
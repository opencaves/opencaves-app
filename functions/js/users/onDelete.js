import * as functions from 'firebase-functions/v1'
import { db } from '../init.js'
import { REGION, USERS_COLL_NAME } from '../constants.js'


export const onUserDelete = functions
  .region(REGION)
  .auth
  .user()
  .onDelete(async user => {
    // recursiveDelete (not delete) so the user's savedCaves subcollection
    // goes too - deleting a doc never removes its subcollections.
    await db.recursiveDelete(db.collection(USERS_COLL_NAME).doc(user.uid))
  })
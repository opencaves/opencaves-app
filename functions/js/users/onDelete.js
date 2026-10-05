import * as functions from 'firebase-functions/v1'
import { db } from '../init.js'
import { RATINGS_COLL_NAME, REGION, USERS_COLL_NAME } from '../constants.js'


export const onUserDelete = functions
  .region(REGION)
  .auth
  .user()
  .onDelete(async user => {
    // recursiveDelete (not delete) so the user's savedCaves subcollection
    // goes too - deleting a doc never removes its subcollections.
    await db.recursiveDelete(db.collection(USERS_COLL_NAME).doc(user.uid))
    // Their ratings, under each cave they rated (onRatingWritten then updates
    // those caves' summaries).
    const ratings = await db.collectionGroup(RATINGS_COLL_NAME).where('userId', '==', user.uid).get()
    await Promise.all(ratings.docs.map(rating => rating.ref.delete()))
  })
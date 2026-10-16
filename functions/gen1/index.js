// The functions with no second-generation trigger, in their own codebase:
// Gen1 runs Node 22 at most, while functions/js runs Node 24 (a deploy with
// a Gen1 function there fails, and skips Hosting). Kept to the one trigger
// Gen2 lacks - an Auth account deleted; everything else goes in functions/js.
import { initializeApp } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import * as functions from 'firebase-functions/v1'

// As in functions/js/constants.js (a codebase can't import from another).
const REGION = 'northamerica-northeast1'
const USERS_COLL_NAME = '_users'
const RATINGS_COLL_NAME = 'ratings'

initializeApp()
const db = getFirestore()

/**
 * A deleted account's data: its `_users` document with its subcollections
 * (saved caves), and its ratings under each cave (`onRatingWritten` then
 * updates those caves' summaries).
 */
export const onUserDeleted = functions
  .region(REGION)
  .auth
  .user()
  .onDelete(async user => {
    // recursiveDelete (not delete) so the user's savedCaves subcollection
    // goes too - deleting a doc never removes its subcollections.
    await db.recursiveDelete(db.collection(USERS_COLL_NAME).doc(user.uid))
    const ratings = await db.collectionGroup(RATINGS_COLL_NAME).where('userId', '==', user.uid).get()
    await Promise.all(ratings.docs.map(rating => rating.ref.delete()))
  })

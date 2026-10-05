import { onDocumentCreated } from 'firebase-functions/v2/firestore'
import { Timestamp } from 'firebase-admin/firestore'
import { CAVES_ASSETS_COLL_NAME } from '../constants.js'

// Firestore's NOT_FOUND: the record was deleted in the meantime.
const ignoreDeleted = (error) => {
  if (error.code !== 5) throw error
}

export const onAssetCreated = onDocumentCreated(`${CAVES_ASSETS_COLL_NAME}/{assetId}`, event => {
  const snapshot = event.data

  if (!snapshot) {
    return
  }

  const now = Timestamp.now()

  // update, not set with merge: a record deleted before this runs stays
  // deleted instead of coming back as an empty stub.
  return snapshot.ref.update({
    _created: now,
    _modified: now
  }).catch(ignoreDeleted)

})
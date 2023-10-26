import { onDocumentCreated } from 'firebase-functions/v2/firestore'
import { Timestamp } from 'firebase-admin/firestore'
import { COLL_NAME } from './constants.js'

export const onAssetCreated = onDocumentCreated(`${COLL_NAME}/{assetId}`, event => {
  const snapshot = event.data

  if (!snapshot) {
    return
  }

  return snapshot.ref.set({
    created: Timestamp.now()
  }, {
    merge: true
  })

})
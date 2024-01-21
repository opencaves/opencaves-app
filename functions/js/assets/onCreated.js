import { onDocumentCreated } from 'firebase-functions/v2/firestore'
import { Timestamp } from 'firebase-admin/firestore'
import { CAVES_ASSETS_COLL_NAME } from './constants.js'

export const onAssetCreated = onDocumentCreated(`${CAVES_ASSETS_COLL_NAME}/{assetId}`, event => {
  const snapshot = event.data

  if (!snapshot) {
    return
  }

  const now = Timestamp.now()

  return snapshot.ref.set({
    _created: now,
    _modified: now
  }, {
    merge: true
  })

})
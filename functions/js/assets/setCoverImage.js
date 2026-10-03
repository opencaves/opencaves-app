import { Filter } from 'firebase-admin/firestore'
import { onDocumentCreated } from 'firebase-functions/v2/firestore'
import { db } from '../init.js'

// Create and deploy your first functions
// https://firebase.google.com/docs/functions/get-started

export const setCoverImage = onDocumentCreated('/cavesAssets/{assetId}', async event => {
  const snapshot = event.data
  if (!snapshot) {
    // No data associated with the event
    return
  }

  const data = snapshot.data()
  const { caveId, isCover } = data

  if (isCover) {
    return
  }

  if (caveId) {
    const { and, where } = Filter
    const collRef = db.collection('cavesAssets')

    const filter = and(where('caveId', '==', caveId), where('isCover', '==', true))
    const countSnapshot = await collRef.where(filter).count().get()

    if (countSnapshot.data().count === 0) {
      // update, not set with merge: a record deleted in the meantime stays deleted.
      return snapshot.ref.update({ isCover: true }).catch((error) => {
        if (error.code !== 5) throw error
      })
    }
  }

})

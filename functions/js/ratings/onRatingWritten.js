import { onDocumentWritten } from 'firebase-functions/v2/firestore'
import { AggregateField, FieldValue } from 'firebase-admin/firestore'
import { db } from '../init.js'
import { CAVE_RATINGS_COLL_NAME, CAVES_COLL_NAME, RATINGS_COLL_NAME, REGION } from '../constants.js'

/**
 * A cave's ratings summary - caveRatings/{caveId} = { average, count } - is
 * what everyone reads: the ratings themselves (caves/{caveId}/ratings/{uid})
 * are private to their author. Recounted from the cave's ratings at each
 * change, so it never drifts; removed when a cave has no rating left.
 *
 * @param {string} caveId
 * @returns {Promise<void>}
 */
export async function updateCaveRatingSummary(caveId) {
  const ratings = db.collection(CAVES_COLL_NAME).doc(caveId).collection(RATINGS_COLL_NAME)
  const summary = (await ratings.aggregate({ count: AggregateField.count(), average: AggregateField.average('value') }).get()).data()
  const ref = db.collection(CAVE_RATINGS_COLL_NAME).doc(caveId)
  if (!summary.count) {
    await ref.delete()
    return
  }
  await ref.set({ average: summary.average, count: summary.count, updatedAt: FieldValue.serverTimestamp() })
}

export const onRatingWritten = onDocumentWritten({ document: `${CAVES_COLL_NAME}/{caveId}/${RATINGS_COLL_NAME}/{uid}`, region: REGION }, async (event) => {
  await updateCaveRatingSummary(event.params.caveId)
})

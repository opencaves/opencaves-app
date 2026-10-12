import { onDocumentUpdated } from 'firebase-functions/v2/firestore'
import { db } from '../init.js'
import { CAVES_ASSETS_COLL_NAME, CAVES_COLL_NAME } from '../constants.js'
import { orderPhotos } from './photoOrder.js'

/**
 * A cave keeps a cover among its photos outside the trash: a cover deleted
 * to the trash (deletedAt set) hands it to the photo shown next (the first
 * photo is the cover: {@link orderPhotos}, by the cave's photoOrder), and a
 * photo restored to a cave left without a cover becomes it.
 * Only reacts to deletedAt appearing or going: its own isCover writes
 * don't come back here.
 */
export const onAssetTrashChanged = onDocumentUpdated(`${CAVES_ASSETS_COLL_NAME}/{assetId}`, async (event) => {
  const wasTrashed = !!event.data.before.get('deletedAt')
  const isTrashed = !!event.data.after.get('deletedAt')
  if (wasTrashed === isTrashed) return

  const ref = event.data.after.ref
  const caveId = event.data.after.get('caveId')
  if (!caveId) return

  await db.runTransaction(async (transaction) => {
    const photo = await transaction.get(ref)
    if (!photo.exists || !!photo.get('deletedAt') !== isTrashed) return
    const others = (await transaction.get(db.collection(CAVES_ASSETS_COLL_NAME).where('caveId', '==', caveId)))
      .docs.filter((doc) => doc.id !== ref.id && !doc.get('deletedAt'))
    const cave = isTrashed && photo.get('isCover') ? await transaction.get(db.collection(CAVES_COLL_NAME).doc(caveId)) : null

    if (isTrashed) {
      if (!photo.get('isCover')) return
      transaction.update(ref, { isCover: false })
      if (others.some((doc) => doc.get('isCover'))) return
      const [next] = orderPhotos(others.filter((doc) => (doc.get('type') ?? 'image') === 'image'), cave?.get('photoOrder'))
      if (next) transaction.update(next.ref, { isCover: true })
    } else if (!photo.get('isCover') && !others.some((doc) => doc.get('isCover'))) {
      transaction.update(ref, { isCover: true })
    }
  })
})

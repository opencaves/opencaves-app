import { getStorage } from 'firebase-admin/storage'
import { onDocumentDeleted } from 'firebase-functions/v2/firestore'
import config from '../resize-images/config.js'
import { db } from '../init.js'
import { CAVES_ASSETS_COLL_NAME, THUMBNAILS_FOLDER, BUCKET_NAME } from '../constants.js'

export const onAssetDeleted = onDocumentDeleted('cavesAssets/{assetId}', async event => {
  const snap = event.data
  if (!snap) return

  const data = snap.data()
  const { imageSizes, imageTypes } = config
  const { caveId, fullPath, id: assetId = event.params.assetId, thumbnailRevision } = data
  // Redone copies carry a revision in their name (scripts/redo-thumbnails.js).
  const revision = thumbnailRevision > 1 ? `-r${thumbnailRevision}` : ''
  if (!caveId || !fullPath) return

  const assets = db.collection(CAVES_ASSETS_COLL_NAME)
  // Originals are shared by path; thumbnails are addressed by cave and asset ID.
  const [originalReferences, thumbnailReferences] = await Promise.all([
    assets.where('fullPath', '==', fullPath).limit(1).get(),
    assets.where('id', '==', assetId).get()
  ])
  const bucket = getStorage().bucket(BUCKET_NAME)
  const deleteFilesPromises = []

  // A missing thumbnail or repeated deletion event must not block cleanup.
  if (originalReferences.empty) {
    deleteFilesPromises.push(bucket.file(fullPath).delete({ ignoreNotFound: true }))
  }

  if (!thumbnailReferences.docs.some(doc => doc.data().caveId === caveId)) {
    for (const imageSize of Object.keys(imageSizes)) {
      for (const type of imageTypes) {
        const thumbFullPath = `caves/${caveId}/${THUMBNAILS_FOLDER}/${assetId}_${imageSize}${revision}.${type}`
        deleteFilesPromises.push(bucket.file(thumbFullPath).delete({ ignoreNotFound: true }))
      }
    }
  }

  await Promise.all(deleteFilesPromises)
})
import admin from 'firebase-admin'
import config from '../resize-images/config.js'
import { BUCKET_NAME } from './constants.js'
import { THUMBNAILS_FOLDER } from '../constants.js'
import { onDocumentDeleted } from 'firebase-functions/v2/firestore'
import { logger } from 'firebase-functions/v1'

export const onAssetDeleted = onDocumentDeleted('cavesAssets/{assetId}', async event => {
  const snap = event.data
  const data = snap.data()
  const { imageSizes, imageTypes } = config
  const assetId = event.params.assetId
  const { caveId, fullPath } = data
  const bucket = admin.storage().bucket(BUCKET_NAME)
  const deleteFilesPromises = []

  deleteFilesPromises.push(bucket.file(fullPath).delete())

  for (const imageSize of Object.keys(imageSizes)) {
    for (const type of imageTypes) {
      const thumbFullPath = `caves/${caveId}/${THUMBNAILS_FOLDER}/${assetId}_${imageSize}.${type}`
      deleteFilesPromises.push(bucket.file(thumbFullPath).delete())
    }
  }

  await Promise.all(deleteFilesPromises)
})
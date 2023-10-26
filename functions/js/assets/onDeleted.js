import admin from 'firebase-admin'
import { onObjectDeleted } from 'firebase-functions/v2/storage'
import config from '../resize-images/config.js'
import { BUCKET_NAME } from './constants.js'
import { RE_IMAGE_NAME, THUMBNAILS_FOLDER } from '../constants.js'

export const onAssetDeleted = onObjectDeleted(BUCKET_NAME, async event => {
  const { data } = event
  const { imageSizes, imageTypes } = config
  const imageName = RE_IMAGE_NAME.exec(data.name)
  if (imageName) {
    const { caveId, assetId } = imageName.groups
    const bucket = admin.storage().bucket(BUCKET_NAME)
    const deleteFilesPromises = []

    for (const imageSize of Object.keys(imageSizes)) {
      for (const type of imageTypes) {
        const thumbFullPath = `caves/${caveId}/images/${THUMBNAILS_FOLDER}/${assetId}_${imageSize}.${type}`
        deleteFilesPromises.push(bucket.file(thumbFullPath).delete())
      }
    }

    await Promise.all(deleteFilesPromises)
  }

})
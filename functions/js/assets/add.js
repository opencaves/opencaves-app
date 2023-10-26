import admin from 'firebase-admin'
import { onObjectFinalized } from 'firebase-functions/v2/storage'
import { db } from '../init.js'
import { generateResizedImageHandler } from '../resize-images/index.js'
import { COLL_NAME } from './constants.js'
import { THUMBNAILS_FOLDER } from '../constants.js'

export const add = onObjectFinalized(async event => {
  const { data } = event
  const { metadata } = data

  await admin.storage().bucket(data.bucket).file(data.name).setMetadata({ metadata: { assetData: null } })

  if (data.name.indexOf(`/${THUMBNAILS_FOLDER}/`) > -1) {
    return
  }

  await generateResizedImageHandler(data)

  if (metadata.assetData) {
    const assetData = JSON.parse(metadata.assetData)
    const docRef = db.collection(COLL_NAME).doc(assetData.id)
    await docRef.create(assetData)
  }
})
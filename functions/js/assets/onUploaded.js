import admin from 'firebase-admin'
import { onObjectFinalized } from 'firebase-functions/v2/storage'
import { create } from 'exif-parser'
import exifr from 'exifr/dist/lite.esm.mjs'
import logger from 'firebase-functions/logger'
import { Timestamp } from 'firebase-admin/firestore'
import { generateResizedImageHandler } from '../resize-images/index.js'
import { db } from '../init.js'
import { CAVES_ASSETS_COLL_NAME, THUMBNAILS_FOLDER } from '../constants.js'
import { supportedXMP } from '../config.js'

function supportsXMP(mediaType) {
  return supportedXMP.includes(mediaType)
}

function getUploadTimestamp(data, event) {
  if (data.timeCreated) {
    return Timestamp.fromDate(new Date(data.timeCreated))
  }

  if (event.time) {
    return Timestamp.fromDate(new Date(event.time))
  }

  return Timestamp.now()
}

export const onAssetUploaded = onObjectFinalized(async event => {
  logger.log('[onAssetUploaded] Initializing function onObjectFinalized')
  try {
    logger.log('[onAssetUploaded] TRY BEGIN')
    const { data } = event
    const { metadata } = data
    const bucket = admin.storage().bucket(data.bucket)
    const filePath = data.name

    logger.log('[onAssetUploaded] filePath: %s', filePath)
    logger.log('[onAssetUploaded] data: %o', data)

    await bucket.file(filePath).setMetadata({ metadata: { originalName: null, userId: null } })

    logger.log('[onAssetUploaded] setMetadata done')

    if (filePath.indexOf(`/${THUMBNAILS_FOLDER}/`) > -1) {
      logger.log('[onAssetUploaded] filePath.indexOf(`/${THUMBNAILS_FOLDER}/`) > -1')
      return
    }

    // caves/{caveId}/{type}s/{assetId} - identity comes from the upload path, not client-supplied metadata.
    const [, caveId, typePlural, assetId] = filePath.split('/')

    if (caveId && typePlural && assetId) {

      logger.log('[onAssetUploaded] Detected an asset upload')

      const assetData = {
        id: assetId,
        caveId,
        type: typePlural.endsWith('s') ? typePlural.slice(0, -1) : typePlural,
        isCover: false,
        mediaType: data.contentType,
        fullPath: filePath,
      }

      if (metadata?.originalName) {
        assetData.originalName = metadata.originalName
      }

      if (metadata?.userId) {
        assetData.userId = metadata.userId
      }

      logger.log('[onAssetUploaded] Generating resized images')

      await generateResizedImageHandler(data)

      logger.log('[onAssetUploaded] ... done generating resized images')

      logger.log('[onAssetUploaded] Reading asset file metadatas')

      const downloadResponse = await bucket.file(filePath).download()
      const imageBuffer = downloadResponse[0]

      const parser = create(imageBuffer)
      parser.enableImageSize(true)

      const result = parser.parse()


      logger.log('[onAssetUploaded] Found metadatas: %o', result)

      const { DateTime, DateTimeOriginal, ModifyDate, ImageHeight, ImageWidth, GPSLongitude, GPSLatitude, GPSAltitude, Orientation } = result.tags

      if (ImageHeight) {
        assetData.width = ImageWidth
        assetData.height = ImageHeight
      }

      if (DateTimeOriginal) {
        assetData.date = new Timestamp(DateTimeOriginal, 0)
      } else if (DateTime) {
        assetData.date = new Timestamp(DateTime, 0)
      } else if (ModifyDate) {
        assetData.date = new Timestamp(ModifyDate, 0)
      } else {
        assetData.date = getUploadTimestamp(data, event)
      }

      if (GPSLongitude) {
        assetData.position = {
          latitude: GPSLatitude,
          longitude: GPSLongitude,
          altitude: GPSAltitude || null
        }
      }

      if (Orientation) {
        assetData.orientation = Orientation
      }

      if (supportsXMP(assetData.mediaType)) {
        const xmp = await exifr.parse(imageBuffer, { ifd0: true, tiff: false, xmp: true })

        if (xmp) {
          const { UsePanoramaViewer, ProjectionType, PoseHeadingDegrees } = xmp

          if (UsePanoramaViewer) {
            assetData.usePanoramaViewer = true
            assetData.projectionType = ProjectionType
            assetData.poseHeadingDegrees = PoseHeadingDegrees
          }

        }
      }

      const docRef = db.collection(CAVES_ASSETS_COLL_NAME).doc(assetData.id)
      await docRef.create(assetData)
    }
  } catch (error) {
    logger.error('[onObjectFinalized] Error: ', error)
  }
})
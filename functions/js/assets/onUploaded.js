import { getStorage } from 'firebase-admin/storage'
import { onObjectFinalized } from 'firebase-functions/v2/storage'
import { create } from 'exif-parser'
import exifr from 'exifr/dist/lite.esm.mjs'
import { logger } from 'firebase-functions/logger'
import { Timestamp } from 'firebase-admin/firestore'
import { generateResizedImageHandler } from '../resize-images/index.js'
import { db } from '../init.js'
import { CAVES_ASSETS_COLL_NAME, CAVES_ASSETS_PRIVATE_COLL_NAME, THUMBNAILS_FOLDER } from '../constants.js'
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

// Resizing a full-size phone photo into every thumbnail size (in parallel)
// takes hundreds of MiB; past the limit the instance is killed and no asset
// document is created. One upload per instance, so a batch of uploads
// doesn't share - and exceed - one instance's memory.
export const onAssetUploaded = onObjectFinalized({ memory: '2GiB', concurrency: 1, timeoutSeconds: 300 }, async event => {
  logger.log('[onAssetUploaded] Initializing function onObjectFinalized')
  try {
    logger.log('[onAssetUploaded] TRY BEGIN')
    const { data } = event
    const { metadata } = data
    const bucket = getStorage().bucket(data.bucket)
    const filePath = data.name

    logger.log('[onAssetUploaded] filePath: %s', filePath)
    logger.log('[onAssetUploaded] data: %o', data)

    // Map previews must retain their download tokens; only cave originals need metadata cleanup.
    // Only caves/{caveId}/{type}s/{assetId}: the resize also copies originals it
    // fails on to caves/{caveId}/images/failed/{assetId}, which would otherwise
    // come back here as an asset with the id "failed".
    // A file copied by scripts/sync-to-production.js (its record and resized
    // copies come with it): nothing to do.
    if (metadata?.ocSync === 'true') {
      return
    }
    if (!filePath?.startsWith('caves/') || filePath.includes(`/${THUMBNAILS_FOLDER}/`) || filePath.split('/').length !== 4) {
      return
    }

    await bucket.file(filePath).setMetadata({ metadata: { originalName: null, userId: null } })

    logger.log('[onAssetUploaded] setMetadata done')

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

      // Who uploaded it and the file's name aren't public (a name can be a
      // person's): kept apart, for admins only (cavesAssetsPrivate).
      const privateData = {}
      if (metadata?.originalName) {
        privateData.originalName = metadata.originalName
      }
      if (metadata?.userId) {
        privateData.userId = metadata.userId
      }

      logger.log('[onAssetUploaded] Generating resized images')

      await generateResizedImageHandler(data)

      logger.log('[onAssetUploaded] ... done generating resized images')

      logger.log('[onAssetUploaded] Reading asset file metadatas')

      const downloadResponse = await bucket.file(filePath).download()
      const imageBuffer = downloadResponse[0]

      // exif-parser only understands the JPEG/TIFF marker structure; it throws
      // on other formats (e.g. webp, png), which must not block asset creation.
      let tags = null

      if (assetData.mediaType === 'image/jpeg' || assetData.mediaType === 'image/jpg') {
        try {
          const parser = create(imageBuffer)
          parser.enableImageSize(true)

          const result = parser.parse()

          logger.log('[onAssetUploaded] Found metadatas: %o', result)

          tags = result.tags
        } catch (error) {
          logger.warn('[onAssetUploaded] Could not read EXIF metadata: %o', error)
        }
      }

      if (tags) {
        const { DateTime, DateTimeOriginal, ModifyDate, ImageHeight, ImageWidth, GPSLongitude, GPSLatitude, GPSAltitude, Orientation } = tags

        // The size as shown: orientations 5-8 turn the photo a quarter, so
        // the sensor's width is its height.
        if (ImageHeight) {
          const quarterTurned = Orientation >= 5 && Orientation <= 8
          assetData.width = quarterTurned ? ImageHeight : ImageWidth
          assetData.height = quarterTurned ? ImageWidth : ImageHeight
        }

        if (DateTimeOriginal) {
          assetData.date = new Timestamp(DateTimeOriginal, 0)
        } else if (DateTime) {
          assetData.date = new Timestamp(DateTime, 0)
        } else if (ModifyDate) {
          assetData.date = new Timestamp(ModifyDate, 0)
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
      }

      if (!assetData.date) {
        assetData.date = getUploadTimestamp(data, event)
      }

      if (supportsXMP(assetData.mediaType)) {
        const xmp = await exifr.parse(imageBuffer, { ifd0: true, tiff: false, xmp: true })

        if (xmp) {
          const { UsePanoramaViewer, ProjectionType, PoseHeadingDegrees } = xmp

          // Some panoramas (e.g. cylindrical ones) have no heading: an undefined
          // field would make Firestore reject the whole document.
          if (UsePanoramaViewer) {
            assetData.usePanoramaViewer = true
            if (ProjectionType !== undefined) assetData.projectionType = ProjectionType
            if (PoseHeadingDegrees !== undefined) assetData.poseHeadingDegrees = PoseHeadingDegrees
          }

        }
      }

      const docRef = db.collection(CAVES_ASSETS_COLL_NAME).doc(assetData.id)
      await docRef.create(assetData)
      if (Object.keys(privateData).length) {
        await db.collection(CAVES_ASSETS_PRIVATE_COLL_NAME).doc(assetData.id).set(privateData)
      }
    }
  } catch (error) {
    logger.error('[onObjectFinalized] Error: ', error)
  }
})
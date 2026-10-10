import { getStorage } from 'firebase-admin/storage'
import { onCall, HttpsError } from 'firebase-functions/v2/https'
import { logger } from 'firebase-functions/v2'
import sharp from 'sharp'
import { db } from '../init.js'
import { BUCKET_NAME, CAVES_ASSETS_COLL_NAME, ENFORCE_APP_CHECK, REGION, THUMBNAILS_FOLDER, VIEW_THUMBNAIL_SIZES } from '../constants.js'
import config from '../resize-images/config.js'
import { resize, convertType } from '../resize-images/resize-image.js'

// The captured view: a JPEG, PNG or WebP of the viewer's canvas.
const MAX_BYTES = 6 * 1024 * 1024
const MAX_SIDE = 4096
const FORMATS = ['jpeg', 'png', 'webp']

export const viewThumbnailName = (caveId, assetId, size, type, revision) =>
  `caves/${caveId}/${THUMBNAILS_FOLDER}/${assetId}_${size}-v${revision}.${type}`

/**
 * A panorama's small copies (cover, result list, media list) made from the
 * view an editor took in the viewer, instead of the whole flattened sphere.
 * They're saved under
 * new names (<id>_<size>-v<revision>: a new URL, past every cache - copies are
 * cached for a year), the record gets viewThumbnailRevision (the app builds
 * their URLs from it) and the view, and the previous view copies are deleted.
 * The large copies stay the panorama's.
 *
 * @param {CallableRequest} request - Its data: { assetId, image (base64), view: { yaw, pitch, zoom } }.
 * @throws {HttpsError} permission-denied when the caller isn't an editor; invalid-argument for an unknown
 *   photo or an unusable image; not-found for a photo gone or in the trash; failed-precondition for a
 *   photo that isn't a panorama, or without a cave.
 */
export const setViewThumbnail = onCall({ region: REGION, enforceAppCheck: ENFORCE_APP_CHECK, memory: '1GiB' }, async (request) => {
  const roles = request.auth?.token?.roles
  if (!request.auth || !Array.isArray(roles) || !(roles.includes('editor') || roles.includes('admin'))) {
    throw new HttpsError('permission-denied', 'Only editors can change a photo\'s thumbnail.')
  }
  const { assetId, image, view } = request.data ?? {}
  if (typeof assetId !== 'string' || !/^[A-Za-z0-9_-]{1,64}$/.test(assetId)) {
    throw new HttpsError('invalid-argument', 'Unknown photo.')
  }
  if (typeof image !== 'string' || image.length > Math.ceil(MAX_BYTES * 4 / 3)) {
    throw new HttpsError('invalid-argument', 'The view image is missing or too large.')
  }
  const buffer = Buffer.from(image, 'base64')
  const meta = await sharp(buffer).metadata().catch(() => null)
  if (!meta || !FORMATS.includes(meta.format) || !(meta.width <= MAX_SIDE && meta.height <= MAX_SIDE)) {
    throw new HttpsError('invalid-argument', 'The view image isn\'t a usable picture.')
  }
  const number = (value) => (Number.isFinite(value) ? Math.round(value * 1e4) / 1e4 : null)
  const thumbnailView = view && typeof view === 'object' ? { yaw: number(view.yaw), pitch: number(view.pitch), zoom: number(view.zoom) } : null

  const docRef = db.collection(CAVES_ASSETS_COLL_NAME).doc(assetId)
  const snap = await docRef.get()
  if (!snap.exists || snap.get('deletedAt')) throw new HttpsError('not-found', 'Unknown photo.')
  const { caveId, usePanoramaViewer, viewThumbnailRevision } = snap.data()
  if (!usePanoramaViewer) throw new HttpsError('failed-precondition', 'Only a panorama\'s thumbnail can show a view.')
  if (typeof caveId !== 'string' || /[/.]/.test(caveId)) throw new HttpsError('failed-precondition', 'Unknown cave.')

  const revision = (viewThumbnailRevision || 0) + 1
  const bucket = getStorage().bucket(BUCKET_NAME)
  for (const size of VIEW_THUMBNAIL_SIZES) {
    for (const type of config.imageTypes) {
      const copy = await convertType(await resize(buffer, config.imageSizes[size]), type)
      const name = viewThumbnailName(caveId, assetId, size, type, revision)
      const file = bucket.file(name)
      await file.save(copy, {
        resumable: false,
        metadata: {
          contentType: `image/${type}`,
          cacheControl: config.cacheControlHeader,
          contentDisposition: `inline; filename*=utf-8''${name.split('/').pop()}`,
          metadata: { resizedImage: 'true' },
        },
      })
      // The emulator has no public objects (it serves them all).
      if (config.makePublic && !process.env.FUNCTIONS_EMULATOR) await file.makePublic()
    }
  }
  await docRef.update({ viewThumbnailRevision: revision, ...(thumbnailView && { thumbnailView }) })
  if (revision > 1) {
    await Promise.all(VIEW_THUMBNAIL_SIZES.flatMap((size) => config.imageTypes.map((type) =>
      bucket.file(viewThumbnailName(caveId, assetId, size, type, revision - 1)).delete({ ignoreNotFound: true }))))
  }
  logger.info('[setViewThumbnail] %s: view copies revision %d', assetId, revision)
  return { revision }
})

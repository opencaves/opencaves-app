import { randomBytes } from 'node:crypto'
import { getStorage } from 'firebase-admin/storage'
import { logger } from 'firebase-functions/logger'
import { onObjectFinalized } from 'firebase-functions/v2/storage'
import { PDFDocument } from 'pdf-lib'
import { convertPdfToSvg } from 'pdf-into-svg'
import sharp from 'sharp'
import pushId from 'unique-push-id'
import { db } from '../init.js'

// Derived files live in a subfolder so writing them never matches the
// maps/{mapId} upload triggers below.
const DERIVED_FOLDER = 'maps/derived'
const IMMUTABLE_CACHE_CONTROL = 'public, max-age=31536000, immutable'

// Survey maps carry fine lines and small labels, so the viewing copy keeps a
// high quality and a large width (sharp never enlarges smaller scans).
const VIEW_WIDTH = 4096
const VIEW_QUALITY = 80
// Covers the Maps tab/MapsPicker cards at high-DPI.
const THUMBNAIL_WIDTH = 640
const THUMBNAIL_QUALITY = 70
// Large scans exceed sharp's default ~268 MP safety limit.
const MAX_INPUT_PIXELS = 1_000_000_000

// Saves `data` and returns a Firebase Storage download URL for it (the same
// token-based URL shape getDownloadURL() gives the client), so the app can
// load it without going through storage rules.
async function saveWithDownloadUrl(bucket, path, data, contentType) {
  const token = randomBytes(32).toString('base64url')
  await bucket.file(path).save(data, {
    metadata: {
      contentType,
      cacheControl: IMMUTABLE_CACHE_CONTROL,
      metadata: { firebaseStorageDownloadTokens: token }
    }
  })

  const host = process.env.FIREBASE_STORAGE_EMULATOR_HOST
    ? `http://${process.env.FIREBASE_STORAGE_EMULATOR_HOST}`
    : 'https://firebasestorage.googleapis.com'
  return `${host}/v0/b/${bucket.name}/o/${encodeURIComponent(path)}?alt=media&token=${token}`
}

// An SVG rasterizes at its own size, in points at 72 DPI - often narrower
// than THUMBNAIL_WIDTH (a letter page is 612 wide), and a thumbnail is never
// enlarged. Rendered at this density first, it has pixels to spare.
const SVG_THUMBNAIL_DENSITY = 300

function webpThumbnail(input, { svg = false } = {}) {
  return sharp(input, { limitInputPixels: MAX_INPUT_PIXELS, ...(svg && { density: SVG_THUMBNAIL_DENSITY }) })
    .rotate()
    .resize({ width: THUMBNAIL_WIDTH, withoutEnlargement: true })
    .webp({ quality: THUMBNAIL_QUALITY, effort: 4 })
    .toBuffer()
}

export const onMapPdfUploaded = onObjectFinalized({ memory: '1GiB', timeoutSeconds: 300 }, async event => {
  const { bucket: bucketName, name: originalPath, contentType } = event.data
  const match = /^maps\/original-pdf\/([^/]+)$/.exec(originalPath || '')
  if (!match || contentType !== 'application/pdf') return

  const [, mapId] = match
  const bucket = getStorage().bucket(bucketName)
  const [pdf] = await bucket.file(originalPath).download()
  let title
  try {
    title = (await PDFDocument.load(pdf, { ignoreEncryption: true })).getTitle()?.trim()
  } catch (error) {
    logger.warn('Could not read PDF map title', { mapId, error })
  }
  const { pages } = await convertPdfToSvg(pdf, { includeAnnotations: false, includeLinks: false })
  if (pages.length === 0) throw new Error(`Map ${mapId} has no pages to convert`)

  const mapRef = db.collection('maps').doc(mapId)
  // Reserve page IDs before writing files so retries reuse the same Storage paths.
  const svgIds = await db.runTransaction(async transaction => {
    const map = await transaction.get(mapRef)
    const existingIds = map.data()?.svgIds || []
    const ids = pages.map((_, index) => existingIds[index] || pushId())
    transaction.set(mapRef, { svgIds: ids }, { merge: true })
    return ids
  })

  const previewUrls = []
  for (const [index, { svg }] of pages.entries()) {
    // Keep the PDF intact; each SVG retains the page's vector paths and text.
    previewUrls.push(await saveWithDownloadUrl(bucket, `maps/${svgIds[index]}`, svg, 'image/svg+xml'))
  }

  // A small raster of the first page for the map cards - a full SVG page can
  // be heavy to render at card size. Optional: a page sharp can't rasterize
  // just leaves the cards on the SVG.
  let thumbnailUrl
  try {
    thumbnailUrl = await saveWithDownloadUrl(bucket, `${DERIVED_FOLDER}/${mapId}_thumb.webp`, await webpThumbnail(Buffer.from(pages[0].svg), { svg: true }), 'image/webp')
  } catch (error) {
    logger.warn('Could not rasterize a thumbnail for PDF map', { mapId, error })
  }

  await mapRef.set({ previewUrl: previewUrls[0], previewUrls, ...(thumbnailUrl && { thumbnailUrl }), ...(title && { name: title }) }, { merge: true })
  logger.info('Converted PDF map to vector SVG pages', { mapId, pages: previewUrls.length })
})

// Image maps (scans, usually large JPEG/PNG) get a WebP viewing copy and
// thumbnail, stored as previewUrl/thumbnailUrl - which the app already
// prefers over the original `url` for display (and offline downloads). The
// original upload stays untouched as `url`, for the "Original file" download.
// SVG uploads get only the thumbnail: the SVG itself is the best viewing copy
// (sharp at any zoom), but can weigh megabytes - too much for a card.
export const onMapImageUploaded = onObjectFinalized({ memory: '2GiB', timeoutSeconds: 300 }, async event => {
  const { bucket: bucketName, name: originalPath, contentType } = event.data
  const match = /^maps\/([^/]+)$/.exec(originalPath || '')
  if (!match || !contentType?.startsWith('image/')) return

  const [, mapId] = match
  const bucket = getStorage().bucket(bucketName)

  if (contentType === 'image/svg+xml') {
    // The PDF function's own pages (maps/{svgId}) are SVGs too: their map
    // already gets its thumbnail there.
    const pdfPage = await db.collection('maps').where('svgIds', 'array-contains', mapId).limit(1).get()
    if (!pdfPage.empty) return
    const [svg] = await bucket.file(originalPath).download()
    try {
      const thumbnailUrl = await saveWithDownloadUrl(bucket, `${DERIVED_FOLDER}/${mapId}_thumb.webp`, await webpThumbnail(svg, { svg: true }), 'image/webp')
      await db.collection('maps').doc(mapId).set({ thumbnailUrl }, { merge: true })
      logger.info('Made a WebP thumbnail for SVG map', { mapId, svgBytes: svg.length })
    } catch (error) {
      // Cards fall back to the SVG itself.
      logger.warn('Could not rasterize a thumbnail for SVG map', { mapId, error })
    }
    return
  }

  const [original] = await bucket.file(originalPath).download()

  const view = await sharp(original, { limitInputPixels: MAX_INPUT_PIXELS })
    // Applies EXIF orientation (phone photos of paper maps).
    .rotate()
    .resize({ width: VIEW_WIDTH, withoutEnlargement: true })
    .webp({ quality: VIEW_QUALITY, effort: 5, smartSubsample: true })
    .toBuffer()

  const previewUrl = await saveWithDownloadUrl(bucket, `${DERIVED_FOLDER}/${mapId}_view.webp`, view, 'image/webp')
  const thumbnailUrl = await saveWithDownloadUrl(bucket, `${DERIVED_FOLDER}/${mapId}_thumb.webp`, await webpThumbnail(original), 'image/webp')

  // merge: the client writes the map doc's own fields (name, url, ...) around
  // the same time, in either order.
  await db.collection('maps').doc(mapId).set({ previewUrl, thumbnailUrl }, { merge: true })
  logger.info('Converted image map to WebP', { mapId, originalBytes: original.length, viewBytes: view.length })
})

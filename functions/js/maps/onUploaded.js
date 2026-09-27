import { randomBytes } from 'node:crypto'
import { getStorage } from 'firebase-admin/storage'
import { logger } from 'firebase-functions/logger'
import { onObjectFinalized } from 'firebase-functions/v2/storage'
import { PDFDocument } from 'pdf-lib'
import { convertPdfToSvg } from 'pdf-into-svg'
import pushId from 'unique-push-id'
import { db } from '../init.js'

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
    const previewPath = `maps/${svgIds[index]}`
    const token = randomBytes(32).toString('base64url')
    await bucket.file(previewPath).save(svg, {
      metadata: {
        contentType: 'image/svg+xml',
        metadata: { firebaseStorageDownloadTokens: token }
      }
    })

    const host = process.env.FIREBASE_STORAGE_EMULATOR_HOST
      ? `http://${process.env.FIREBASE_STORAGE_EMULATOR_HOST}`
      : 'https://firebasestorage.googleapis.com'
    previewUrls.push(`${host}/v0/b/${bucketName}/o/${encodeURIComponent(previewPath)}?alt=media&token=${token}`)
  }

  await mapRef.set({ previewUrl: previewUrls[0], previewUrls, ...(title && { name: title }) }, { merge: true })
  logger.info('Converted PDF map to vector SVG pages', { mapId, pages: previewUrls.length })
})
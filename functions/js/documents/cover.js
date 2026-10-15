import { randomBytes } from 'node:crypto'
import { documentCoverPath } from './files.js'

// A Further reading PDF's cover: its first page as a small picture, which
// the app shows beside the document. Drawn from the page's SVG
// (pdf-into-svg, as the PDF maps are) by sharp. The PDF's own fonts aren't
// used (sharp's SVG renderer has none of them): at this size, the page's
// layout and pictures are what make it recognisable.
// The libraries are imported when a cover is made, not with this file
// (every function of the codebase loads every file at its start).

// Twice the app's largest (a high-density screen's pixels).
const COVER_WIDTH = 240
const COVER_QUALITY = 80
// A cover is never changed in place: a new one has a new download token.
const COVER_CACHE_CONTROL = 'public, max-age=31536000, immutable'

/**
 * A PDF's first page as a WebP picture, {@link COVER_WIDTH} pixels wide, on
 * white (a page with no background of its own).
 *
 * @param {Uint8Array} bytes - The PDF.
 * @returns {Promise<Buffer>}
 * @throws {Error} When the page can't be drawn.
 */
export async function drawDocumentCover(bytes) {
  const [{ convertPdfToSvg }, { default: sharp }] = await Promise.all([import('pdf-into-svg'), import('sharp')])
  const { pages } = await convertPdfToSvg(bytes, { includeAnnotations: false, includeLinks: false, pages: [1] })
  if (!pages[0]?.svg) throw new Error('no first page')
  return sharp(Buffer.from(pages[0].svg), { density: 72 })
    .resize({ width: COVER_WIDTH })
    .flatten({ background: '#ffffff' })
    .webp({ quality: COVER_QUALITY })
    .toBuffer()
}

/**
 * A PDF's cover ({@link drawDocumentCover}) saved next to it (documents/{id}_cover.webp),
 * with a download token: its download link (as getDownloadURL() gives the app's).
 *
 * @param {import('@google-cloud/storage').Bucket} bucket
 * @param {string} documentId
 * @param {Uint8Array} bytes - The PDF.
 * @returns {Promise<string>}
 * @throws {Error} When the page can't be drawn or saved.
 */
export async function saveDocumentCover(bucket, documentId, bytes) {
  const path = documentCoverPath(documentId)
  const token = randomBytes(32).toString('base64url')
  await bucket.file(path).save(await drawDocumentCover(bytes), {
    resumable: false,
    metadata: { contentType: 'image/webp', cacheControl: COVER_CACHE_CONTROL, metadata: { firebaseStorageDownloadTokens: token } },
  })
  const host = process.env.FIREBASE_STORAGE_EMULATOR_HOST ? `http://${process.env.FIREBASE_STORAGE_EMULATOR_HOST}` : 'https://firebasestorage.googleapis.com'
  return `${host}/v0/b/${bucket.name}/o/${encodeURIComponent(path)}?alt=media&token=${token}`
}

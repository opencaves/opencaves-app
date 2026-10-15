import { getStorage } from 'firebase-admin/storage'
import { logger } from 'firebase-functions/logger'
import { onObjectFinalized } from 'firebase-functions/v2/storage'
import { db } from '../init.js'
import { DOCUMENTS_COLL_NAME, DOCUMENT_MAX_BYTES } from '../constants.js'
import { inlineDisposition } from './files.js'

// pdf-lib (sanitizePdf.js) is imported when a PDF comes in, not with this
// file: every function of the codebase loads every file at its start (see
// maps/onUploaded.js).

// documents/{documentId}.pdf: the file a `documents` record of kind file
// names (fullPath), uploaded by the person who created that record.
const PATH = /^documents\/([-_A-Za-z0-9]{1,64})\.pdf$/

/**
 * A Further reading PDF uploaded (documents/{id}.pdf): checked and cleaned
 * before anyone else sees it - a PDF, readable, not encrypted, its
 * JavaScript, automatic actions, attachments and forms taken out
 * (sanitizePdf.js) - then saved again in its place, inline (its link opens
 * the browser's PDF viewer), with the same download
 * token (its record's `url` keeps working), marked ocChecked so this run's
 * own save isn't checked again. Its record (`documents/{id}`) then says
 * `ready`, with the cleaned file's size and its cover (its first page,
 * cover.js: `coverUrl`); a refused file is deleted, its
 * record `rejected` with why (`rejectReason`, which the app explains to its
 * uploader). A file without a record (deleted meanwhile) is deleted. Files
 * copied by the sync scripts (ocSync) come checked: they're only made to
 * open inline when they wouldn't.
 */
export const onDocumentUploaded = onObjectFinalized({ memory: '1GiB', timeoutSeconds: 300 }, async (event) => {
  const { bucket: bucketName, name: path, metadata, size } = event.data
  const match = PATH.exec(path || '')
  if (!match) return

  const [, documentId] = match
  const bucket = getStorage().bucket(bucketName)
  const file = bucket.file(path)
  const docRef = db.collection(DOCUMENTS_COLL_NAME).doc(documentId)
  // Checked already (this run's own save, a copy from the sync scripts): only
  // made to open inline when it wouldn't (metadata alone: no new upload).
  if (metadata?.ocChecked === 'true' || metadata?.ocSync === 'true') {
    if (!event.data.contentDisposition?.startsWith('inline')) {
      await file.setMetadata({ contentDisposition: inlineDisposition((await docRef.get()).get('title')) })
      logger.info('[documents] PDF set to open inline', { documentId })
    }
    return
  }
  const record = await docRef.get()
  if (!record.exists || record.get('kind') !== 'file' || record.get('deletedAt')) {
    logger.warn('[documents] a PDF without its record, deleted', { documentId, path })
    await file.delete({ ignoreNotFound: true })
    return
  }

  const reject = async (reason, error) => {
    logger.warn('[documents] PDF refused', { documentId, reason, error: error?.cause?.message || error?.message })
    await file.delete({ ignoreNotFound: true })
    await docRef.update({ status: 'rejected', rejectReason: reason })
  }

  if (Number(size) > DOCUMENT_MAX_BYTES) return reject('tooLarge')
  const { PdfRejectedError, sanitizePdf } = await import('./sanitizePdf.js')
  const [bytes] = await file.download()
  let result
  try {
    result = await sanitizePdf(bytes)
  } catch (error) {
    if (error instanceof PdfRejectedError) return reject(error.reason, error)
    throw error
  }

  // In its place, as uploaded (its type, its download token), marked checked;
  // inline, so its link opens it in the browser's PDF viewer.
  await file.save(Buffer.from(result.bytes), {
    resumable: false,
    metadata: {
      contentType: 'application/pdf',
      contentDisposition: inlineDisposition(record.get('title')),
      ...(event.data.cacheControl && { cacheControl: event.data.cacheControl }),
      metadata: { ...metadata, ocChecked: 'true' },
    },
  })
  // Its cover (its first page): a PDF without one is shown all the same.
  let coverUrl = null
  try {
    const { saveDocumentCover } = await import('./cover.js')
    coverUrl = await saveDocumentCover(bucket, documentId, result.bytes)
  } catch (error) {
    logger.warn('[documents] no cover for the PDF', { documentId, error: error?.message })
  }
  await docRef.update({ status: 'ready', size: result.bytes.length, ...(coverUrl && { coverUrl }) })
  logger.info('[documents] PDF checked', { documentId, pages: result.pages, uploadedBytes: bytes.length, savedBytes: result.bytes.length, removed: result.removed, cover: Boolean(coverUrl) })
})

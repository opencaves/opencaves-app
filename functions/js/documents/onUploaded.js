import { getStorage } from 'firebase-admin/storage'
import { logger } from 'firebase-functions/logger'
import { onObjectFinalized } from 'firebase-functions/v2/storage'
import { db } from '../init.js'
import { DOCUMENTS_COLL_NAME, DOCUMENT_MAX_BYTES } from '../constants.js'

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
 * (sanitizePdf.js) - then saved again in its place, with the same download
 * token (its record's `url` keeps working), marked ocChecked so this run's
 * own save isn't checked again. Its record (`documents/{id}`) then says
 * `ready`, with the cleaned file's size; a refused file is deleted, its
 * record `rejected` with why (`rejectReason`, which the app explains to its
 * uploader). A file without a record (deleted meanwhile) is deleted. Files
 * copied by the sync scripts (ocSync) come checked.
 */
export const onDocumentUploaded = onObjectFinalized({ memory: '1GiB', timeoutSeconds: 300 }, async (event) => {
  const { bucket: bucketName, name: path, metadata, size } = event.data
  const match = PATH.exec(path || '')
  if (!match || metadata?.ocChecked === 'true' || metadata?.ocSync === 'true') return

  const [, documentId] = match
  const bucket = getStorage().bucket(bucketName)
  const file = bucket.file(path)
  const docRef = db.collection(DOCUMENTS_COLL_NAME).doc(documentId)
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

  // In its place, as uploaded (its type, its download token), marked checked.
  await file.save(Buffer.from(result.bytes), {
    resumable: false,
    metadata: {
      contentType: 'application/pdf',
      ...(event.data.cacheControl && { cacheControl: event.data.cacheControl }),
      metadata: { ...metadata, ocChecked: 'true' },
    },
  })
  await docRef.update({ status: 'ready', size: result.bytes.length })
  logger.info('[documents] PDF checked', { documentId, pages: result.pages, uploadedBytes: bytes.length, savedBytes: result.bytes.length, removed: result.removed })
})

import { DOCUMENTS_FOLDER } from '../constants.js'

/**
 * A Further reading PDF's path in Storage: documents/{documentId}.pdf (its
 * record's fullPath).
 *
 * @param {string} documentId
 * @returns {string}
 */
export const documentFilePath = (documentId) => `${DOCUMENTS_FOLDER}/${documentId}.pdf`

/**
 * A PDF's Content-Disposition: inline, so its link opens it in the browser's
 * PDF viewer rather than downloading it (Storage serves `attachment` to a
 * file without one), named after its title - an ASCII name for every
 * browser, and the title itself (RFC 5987) for those that read it. The app's
 * upload sets the same (src/utils/documents.js).
 *
 * @param {string} [title]
 * @returns {string}
 */
export function inlineDisposition(title) {
  const name = String(title || '').trim().slice(0, 100) || 'document'
  const ascii = name.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^\w .-]+/g, '').replace(/\s+/g, ' ').trim() || 'document'
  return `inline; filename="${ascii}.pdf"; filename*=UTF-8''${encodeURIComponent(`${name}.pdf`)}`
}

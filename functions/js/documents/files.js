import { DOCUMENTS_FOLDER } from '../constants.js'

/**
 * A Further reading PDF's path in Storage: documents/{documentId}.pdf (its
 * record's fullPath).
 *
 * @param {string} documentId
 * @returns {string}
 */
export const documentFilePath = (documentId) => `${DOCUMENTS_FOLDER}/${documentId}.pdf`

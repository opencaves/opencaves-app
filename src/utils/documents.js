import { DOI_PATTERN } from '@/config/documents.js'
import { isTrashed } from '@/utils/trash.js'

// Further reading (`documents`): the papers, reports and links a cave or a
// cave system lists (its `documents`, in its `documentOrder`). Shared by the
// pages, the map's pane and the server's rendering (ssr/pageState.js).

/**
 * One record's Further reading, as {@link getDocumentHolders} gives it.
 *
 * @typedef {object} DocumentHolder
 * @property {'caves'|'sistemas'} collection
 * @property {string} id
 * @property {string[]} ids - Its documents' ids, in its order ({@link orderDocumentIds}).
 */

/**
 * A record's documents' ids in the order its lists show them: those its
 * `documentOrder` names, in that order, then the others in the order they
 * were added (its `documents`).
 *
 * @param {string[]} [ids] - The record's `documents`.
 * @param {string[]} [order] - Its `documentOrder`.
 * @returns {string[]}
 */
export function orderDocumentIds(ids, order) {
  const list = (Array.isArray(ids) ? ids : []).filter((id) => typeof id === 'string' && id)
  const rank = new Map((Array.isArray(order) ? order : []).map((id, index) => [id, index]))
  const named = list.filter((id) => rank.has(id)).sort((a, b) => rank.get(a) - rank.get(b))
  return [...named, ...list.filter((id) => !rank.has(id))]
}

/**
 * The records whose Further reading a page lists, in order: the cave's own
 * (on a cave's page), then its system's and those of the systems it joined
 * (walking `connections`, as the maps) - each document once, under the first
 * record listing it.
 *
 * @param {object} options
 * @param {Cave|null} [options.cave] - A cave's page: the cave.
 * @param {string} [options.sistemaId] - The system (the cave's, or the system page's).
 * @param {Sistema[]} options.sistemas
 * @param {Connection[]} options.connections
 * @returns {DocumentHolder[]}
 */
export function getDocumentHolders({ cave, sistemaId, sistemas, connections }) {
  const sistemasById = new Map(sistemas.map((sistema) => [sistema.id, sistema]))
  const parentById = new Map(connections.filter((c) => c.sistemaId && c.parentSistemaId).map((c) => [c.sistemaId, c.parentSistemaId]))
  const seen = new Set()
  const holders = []
  const add = (collection, record) => {
    const ids = orderDocumentIds(record.documents, record.documentOrder).filter((id) => !seen.has(id))
    ids.forEach((id) => seen.add(id))
    holders.push({ collection, id: record.id, ids })
  }
  if (cave) add('caves', cave)
  // Guards against a connection cycle looping forever.
  const visited = new Set()
  for (let id = sistemaId; id && !visited.has(id); id = parentById.get(id)) {
    visited.add(id)
    if (sistemasById.has(id)) add('sistemas', sistemasById.get(id))
  }
  return holders
}

/**
 * Whether everyone sees a document: not in the trash, and a PDF only once the
 * server has checked it (`ready`).
 *
 * @param {CaveDocument} document
 * @returns {boolean}
 */
export function isPublicDocument(document) {
  return Boolean(document) && !isTrashed(document) && (document.kind !== 'file' || document.status === 'ready')
}

/**
 * Whether this account sees a document: {@link isPublicDocument}, or, outside
 * the trash, its own PDF being checked or refused - and every one for admins.
 *
 * @param {CaveDocument} document
 * @param {{uid?: string|null, isAdmin?: boolean}} viewer
 * @returns {boolean}
 */
export function isVisibleDocument(document, { uid, isAdmin = false }) {
  if (isPublicDocument(document)) return true
  return Boolean(document) && !isTrashed(document) && (isAdmin || (Boolean(uid) && document.userId === uid))
}

/**
 * The DOI in a text (a PDF's page, a doi.org link), without trailing
 * punctuation, or null.
 *
 * @param {string} [text]
 * @returns {string|null}
 */
export function findDoi(text) {
  const match = DOI_PATTERN.exec(text || '')?.[0]
  return match ? match.replace(/[.,;:)\]]+$/, '') : null
}

/**
 * A document's address to open: a PDF's file, a link's page - and a DOI's
 * page when a link has none.
 *
 * @param {CaveDocument} document
 * @returns {string|null}
 */
export function documentHref(document) {
  return document.url || (document.doi ? `https://doi.org/${document.doi}` : null)
}

/**
 * A PDF's Content-Disposition, set as it's uploaded: inline, so its link
 * opens it in the browser's PDF viewer rather than downloading it (Storage
 * serves `attachment` to a file without one), named after its title - an
 * ASCII name, and the title itself (RFC 5987). The server keeps the same
 * (functions/js/documents/files.js).
 *
 * @param {string} [title]
 * @returns {string}
 */
export function inlineDisposition(title) {
  const name = String(title || '').trim().slice(0, 100) || 'document'
  const ascii = name.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^\w .-]+/g, '').replace(/\s+/g, ' ').trim() || 'document'
  return `inline; filename="${ascii}.pdf"; filename*=UTF-8''${encodeURIComponent(`${name}.pdf`)}`
}

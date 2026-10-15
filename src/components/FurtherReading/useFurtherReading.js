import { useMemo } from 'react'
import { useSelector } from 'react-redux'
import documentsModel from '@/models/DocumentModel.js'
import CaveModel from '@/models/CaveModel.js'
import SistemaModel from '@/models/SistemaModel.js'
import { useReorder } from '@/hooks/useReorder.js'
import { getDocumentHolders, isVisibleDocument } from '@/utils/documents.js'

/**
 * A Further reading item as its list shows it: the document, and the record
 * listing it (a cave or a system - which its order and removal change).
 *
 * @typedef {object} FurtherReadingItem
 * @property {CaveDocument} document
 * @property {{collection: 'caves'|'sistemas', id: string}} holder
 */

/**
 * The Further reading a cave's or a system's page (or the map's pane) lists
 * ({@link getDocumentHolders}: the cave's own, then its systems'), as this
 * account sees them ({@link isVisibleDocument}: its own PDFs being checked
 * too), in their order - and the editors' reordering, each document among its
 * own record's ({@link useReorder}: the record saved with its new
 * `documentOrder`).
 *
 * @param {object} options
 * @param {Cave|null} [options.cave] - A cave's page or pane: the cave.
 * @param {string} [options.sistemaId] - Its system, or the system page's.
 * @param {Sistema[]} options.sistemas
 * @param {Connection[]} options.connections
 * @param {CaveDocument[]} [options.pageDocuments] - Every document, from the page that waited for them.
 * @returns {{items: FurtherReadingItem[], loading: boolean, reorder: (ids: string[]) => Promise<void>, groupOf: (id: string) => string}}
 */
export function useFurtherReading({ cave, sistemaId, sistemas, connections, pageDocuments }) {
  const [ownDocuments, ownLoading] = documentsModel.useAll()
  const documents = pageDocuments || ownDocuments
  const loading = pageDocuments ? false : ownLoading
  const uid = useSelector((/** @type {RootState} */ state) => state.session.user?.uid ?? null)
  const isAdmin = useSelector((/** @type {RootState} */ state) => state.session.roles.includes('admin'))

  const sorted = useMemo(() => {
    const byId = new Map(documents.map((document) => [document.id, document]))
    return getDocumentHolders({ cave, sistemaId, sistemas, connections }).flatMap(({ collection, id: holderId, ids }) =>
      ids
        .map((id) => byId.get(id))
        .filter((document) => document && isVisibleDocument(document, { uid, isAdmin }))
        .map((document) => ({ document, holder: { collection, id: holderId } })),
    )
  }, [documents, cave, sistemaId, sistemas, connections, uid, isAdmin])

  const ids = sorted.map(({ document }) => document.id)
  const holderOf = new Map(sorted.map(({ document, holder }) => [document.id, holder]))
  const groupOf = (id) => `${holderOf.get(id)?.collection}/${holderOf.get(id)?.id}`
  // The records whose documents changed places (one, a drop moving a
  // document within its own): each saved with its documents' new order.
  const save = (next) => {
    const groups = [...new Set(ids.map(groupOf))].filter((group) => next.filter((id) => groupOf(id) === group).join(' ') !== ids.filter((id) => groupOf(id) === group).join(' '))
    return Promise.all(
      groups.map((group) => {
        const { collection, id } = holderOf.get(next.find((documentId) => groupOf(documentId) === group))
        return (collection === 'caves' ? CaveModel : SistemaModel).save(id, { documentOrder: next.filter((documentId) => groupOf(documentId) === group) })
      }),
    )
  }
  const [order, reorder] = useReorder(ids, save, { name: cave?.name?.value || sistemas.find((sistema) => sistema.id === sistemaId)?.name || '' })
  const byId = new Map(sorted.map((item) => [item.document.id, item]))
  return { items: order.map((id) => byId.get(id)).filter(Boolean), loading, reorder, groupOf }
}

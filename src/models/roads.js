import { useMemo } from 'react'
import { ROADS_COLLECTION, ROADS_META_DOC_ID } from '@/config/collections.js'
import { useSsrCollection } from '@/hooks/useSsrCollection.js'

/**
 * The roads the caves' distances were measured on (_roads/meta, kept by the
 * server: functions/js/roads/): { asOf ('YYYY-MM'), source }, null when
 * there are none yet (or while loading). On /caves the server rendered, the
 * server's (`roads`, ssr/pageState.js) until Firestore's own.
 *
 * @param {boolean} [enabled=true] - Read only when the page shows it.
 * @returns {{asOf?: string, source?: string}|null}
 */
export function useRoadsMeta(enabled = true) {
  // A query on its id rather than the document: useSsrCollection's.
  const makeQuery = useMemo(() => (enabled ? ({ db, collection, documentId, query, where }) => query(collection(db, ROADS_COLLECTION), where(documentId(), '==', ROADS_META_DOC_ID)) : null), [enabled])
  const [snapshot] = useSsrCollection('roads', makeQuery)
  return useMemo(() => {
    const data = snapshot?.docs[0]?.data()
    return data?.asOf ? { asOf: data.asOf, source: data.source } : null
  }, [snapshot])
}

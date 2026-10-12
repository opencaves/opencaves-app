import { useMemo } from 'react'
import { collection, documentId, query, where } from 'firebase/firestore'
import { db } from '@/config/firebase.js'
import { CAVE_REPORTS_COLLECTION } from '@/config/collections.js'
import { CAVE_WARNING_REPORTS } from '@/config/caveReview.js'
import { useSsrCollection } from '@/hooks/useSsrCollection.js'

/**
 * A cave's open "closed" and "now private" reports (_caveReports/{caveId},
 * kept by the server's onCaveReportChanged), oldest first: the warnings it
 * shows. On a cave's page the server rendered, the server's
 * (`caveReports:<caveId>`, ssr/pageState.js) until Firestore's own.
 *
 * @param {string} caveId
 * @returns {[CaveReports['reports'], boolean]} [reports, loading].
 */
export function useCaveReports(caveId) {
  // A query on its id rather than the document: useSsrCollection's.
  const q = useMemo(() => (caveId ? query(collection(db, CAVE_REPORTS_COLLECTION), where(documentId(), '==', caveId)) : null), [caveId])
  const [snapshot, loading] = useSsrCollection(`caveReports:${caveId}`, q)
  const reports = useMemo(() => {
    const data = snapshot?.docs[0]?.data()
    return Array.isArray(data?.reports) ? data.reports.filter((report) => CAVE_WARNING_REPORTS.includes(report?.kind) && report.feedbackId) : []
  }, [snapshot])
  return [reports, loading]
}

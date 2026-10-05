import { collection, doc, getDoc, getDocs, limit, orderBy, query, startAfter, Timestamp, where } from 'firebase/firestore'
import { httpsCallable } from 'firebase/functions'
import { db, functions } from '@/config/firebase.js'
import { AUDIT_LOG_COLLECTION, USERS_COLLECTION } from '@/config/collections.js'
import { AUDIT_BATCH_LIMIT, AUDIT_PAGE_SIZE } from '@/config/audits.js'

// The audit log (_auditLog, written by the server's audit trigger), read by
// admins on the Audits page, and the server's undo and trash callables.

const auditLog = collection(db, AUDIT_LOG_COLLECTION)
const undoAuditEntriesFn = httpsCallable(functions, 'undoAuditEntries')
const emptyTrashFn = httpsCallable(functions, 'emptyTrash')

// What an undo can reverse: the app's own edits to the data. The admins'
// user management (_users) and permanent deletions (purge) can't be undone.
const UNDOABLE_ACTIONS = ['create', 'update', 'delete', 'undo']

export function isUndoable(entry) {
  return entry.collection !== USERS_COLLECTION && UNDOABLE_ACTIONS.includes(entry.action) && !entry.undoneAt
}

function toEntry(snapshot) {
  return { id: snapshot.id, ...snapshot.data() }
}

// filters: { authorId, collection, action, from, to } (from/to: Dates), each
// optional.
function filterConstraints({ authorId, collection: collectionName, action, from, to } = {}) {
  return [
    authorId && where('authorId', '==', authorId),
    collectionName && where('collection', '==', collectionName),
    action && where('action', '==', action),
    from && where('at', '>=', Timestamp.fromDate(from)),
    to && where('at', '<=', Timestamp.fromDate(to)),
    orderBy('at', 'desc'),
  ].filter(Boolean)
}

// One page of entries, newest first; `cursor` (the previous page's) for the
// next one.
export async function getAuditPage(filters, cursor = null, pageSize = AUDIT_PAGE_SIZE) {
  const constraints = [...filterConstraints(filters), cursor && startAfter(cursor), limit(pageSize)].filter(Boolean)
  const { docs } = await getDocs(query(auditLog, ...constraints))
  return { entries: docs.map(toEntry), cursor: docs[docs.length - 1] ?? null, hasMore: docs.length === pageSize }
}

// Every entry of one author since a date, newest first (page after page).
export async function getAllAuthorEntriesSince(authorId, since) {
  const entries = []
  let cursor = null
  for (;;) {
    const page = await getAuditPage({ authorId, from: since }, cursor, AUDIT_BATCH_LIMIT)
    entries.push(...page.entries)
    if (!page.hasMore) return entries
    cursor = page.cursor
  }
}

function chunks(items, size = AUDIT_BATCH_LIMIT) {
  const result = []
  for (let i = 0; i < items.length; i += size) result.push(items.slice(i, i + size))
  return result
}

// Undoes entries (ids, newest first), AUDIT_BATCH_LIMIT at a time, the newest
// chunk first. force: undo even where the record changed since (conflicts).
// onProgress(done, total) after each chunk. The results of every chunk:
// [{ id, status: 'undone'|'conflict'|'skipped'|'error', reason?, conflicts? }]
export async function undoAuditEntries(ids, { force = false, onProgress } = {}) {
  const results = []
  for (const chunk of chunks(ids)) {
    try {
      const { data } = await undoAuditEntriesFn({ ids: chunk, ...(force && { force: true }) })
      results.push(...(data?.results ?? []))
    } catch (error) {
      // The whole call failed: every entry of this chunk is an error.
      results.push(...chunk.map((id) => ({ id, status: 'error', reason: error.message })))
    }
    onProgress?.(results.length, ids.length)
  }
  return results
}

// Deletes trash items for good ([{ collection, id }]), AUDIT_BATCH_LIMIT at a
// time: { deleted: [...], errors: [{ collection, id, reason }] }.
export async function emptyTrash(items, { onProgress } = {}) {
  const deleted = []
  const errors = []
  let done = 0
  for (const chunk of chunks(items)) {
    try {
      const { data } = await emptyTrashFn({ items: chunk })
      deleted.push(...(data?.deleted ?? []))
      errors.push(...(data?.errors ?? []))
    } catch (error) {
      errors.push(...chunk.map((item) => ({ ...item, reason: error.message })))
    }
    done += chunk.length
    onProgress?.(done, items.length)
  }
  return { deleted, errors }
}

// A record as it is now (null when it no longer exists), for the entries'
// links.
export async function getRecord(collectionName, id) {
  const snapshot = await getDoc(doc(db, collectionName, id))
  return snapshot.exists() ? snapshot.data() : null
}

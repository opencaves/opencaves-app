import { onCall } from 'firebase-functions/v2/https'
import { logger } from 'firebase-functions/v2'
import { auth, db } from '../init.js'
import { ENFORCE_APP_CHECK, REGION } from '../constants.js'
import { AUDIT_LOG_COLL_NAME } from '../audit/log.js'

// The records the What's new page (/whats-new) lists.
const COLLECTIONS = ['caves', 'sistemas', 'connections', 'maps']
// How many of the audit log's latest "create" entries are looked at (other
// collections' too), and how many items the page gets at most.
const ENTRIES_READ = 600
const MAX_ITEMS = 300
// The answer is kept this long, for every visitor: the page is public, and
// each call reads the audit log and the records.
const CACHE_MS = 5 * 60 * 1000

let cached = null

// A record as the page shows it - its current name, what it belongs to (a
// cave's system, a connection's two systems), a map's thumbnail - or null when
// it's hidden (a map in the trash, a system not public).
function summary(collection, data) {
  if (data.deletedAt || (collection === 'sistemas' && data.public === false)) return null
  const name = collection === 'caves' ? data.name?.value : collection === 'connections' ? null : data.name
  return {
    name: typeof name === 'string' && name.trim() ? name.trim() : null,
    sistemaId: (collection === 'caves' || collection === 'connections') && typeof data.sistemaId === 'string' ? data.sistemaId : null,
    parentSistemaId: collection === 'connections' && typeof data.parentSistemaId === 'string' ? data.parentSistemaId : null,
    thumbnailUrl: collection === 'maps' && typeof data.thumbnailUrl === 'string' ? data.thumbnailUrl : null,
  }
}

// The authors' display names by uid (the page shows them: public).
async function displayNames(uids) {
  const names = new Map()
  const ids = [...new Set(uids)].filter((uid) => uid && uid !== 'emulator')
  for (let i = 0; i < ids.length; i += 100) {
    const { users } = await auth.getUsers(ids.slice(i, i + 100).map((uid) => ({ uid })))
    for (const user of users) names.set(user.uid, user.displayName || null)
  }
  return names
}

// What's new, built from the audit log as it is now: the caves, cave systems,
// connections and maps people added in the app (its "create" entries), newest
// first - each still there and shown, with its current name, the date it was
// added and its author's display name. Anyone may call it (the page is public).
export const getWhatsNew = onCall({ region: REGION, enforceAppCheck: ENFORCE_APP_CHECK }, async () => {
  if (cached && Date.now() - cached.time < CACHE_MS) return cached.answer

  const entries = (await db.collection(AUDIT_LOG_COLL_NAME).where('action', '==', 'create').orderBy('at', 'desc').limit(ENTRIES_READ).get()).docs
    .map((doc) => doc.data())
    .filter((entry) => COLLECTIONS.includes(entry.collection) && entry.docId)
  // One item per record (an undone, then redone, create logs it twice).
  const seen = new Set()
  const unique = entries.filter((entry) => !seen.has(`${entry.collection}/${entry.docId}`) && seen.add(`${entry.collection}/${entry.docId}`))

  const records = unique.length ? await db.getAll(...unique.map((entry) => db.collection(entry.collection).doc(entry.docId))) : []
  const names = await displayNames(unique.map((entry) => entry.authorId))
  const items = []
  unique.forEach((entry, index) => {
    const record = records[index]
    const shown = record.exists ? summary(entry.collection, record.data()) : null
    if (!shown || items.length >= MAX_ITEMS) return
    items.push({ kind: entry.collection, docId: entry.docId, ...shown, at: entry.at?.toDate?.().toISOString() || null, authorName: names.get(entry.authorId) || null })
  })

  const answer = { items }
  cached = { time: Date.now(), answer }
  logger.debug('[whatsNew] built', { entries: entries.length, items: items.length })
  return answer
})

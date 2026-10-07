import { onCall } from 'firebase-functions/v2/https'
import { logger } from 'firebase-functions/v2'
import { auth, db } from '../init.js'
import { CAVES_ASSETS_COLL_NAME, ENFORCE_APP_CHECK, REGION } from '../constants.js'
import { AUDIT_LOG_COLL_NAME } from '../audit/log.js'

// The records the What's new page (/whats-new) lists one by one, and the
// photos, listed by cave (an upload's audit entry, onAssetUploaded).
const RECORDS = ['caves', 'sistemas', 'connections', 'maps']
// How many of the audit log's latest entries are looked at (creates; the
// caves' changes, for their videos), and how many items the page gets at most.
const ENTRIES_READ = 600
const MAX_ITEMS = 300
// Photos and videos shown per item (the item says how many there are).
const MEDIA_SHOWN = 4
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

const docs = async (refs) => (refs.length ? db.getAll(...refs) : [])
const dayOf = (date) => date?.toISOString().slice(0, 10) || ''

// Photos or videos added to a cave, one item per cave, author and day.
function groupMedia(additions, kind, caves) {
  const groups = new Map()
  for (const { caveId, authorId, at, media } of additions) {
    const cave = caves.get(caveId)
    if (!cave) continue
    const key = `${caveId}|${authorId}|${dayOf(at)}`
    const group = groups.get(key) || { kind, docId: `${caveId}-${dayOf(at)}-${groups.size}`, caveId, name: cave.name?.value?.trim() || null, sistemaId: cave.sistemaId || null, authorId, at, media: [] }
    group.media.push(...media)
    if (at > group.at) group.at = at
    groups.set(key, group)
  }
  return [...groups.values()].map(({ media, ...group }) => ({ ...group, count: media.length, media: media.slice(0, MEDIA_SHOWN) }))
}

// What's new, built from the audit log as it is now: the caves, cave systems,
// connections and maps people added in the app (its "create" entries), the
// photos uploaded and the videos added to caves, newest first - each still
// there and shown, with its current name, the date it was added and its
// author's display name. Anyone may call it (the page is public).
export const getWhatsNew = onCall({ region: REGION, enforceAppCheck: ENFORCE_APP_CHECK }, async () => {
  if (cached && Date.now() - cached.time < CACHE_MS) return cached.answer

  const [creates, caveChanges] = await Promise.all([
    db.collection(AUDIT_LOG_COLL_NAME).where('action', '==', 'create').orderBy('at', 'desc').limit(ENTRIES_READ).get(),
    db.collection(AUDIT_LOG_COLL_NAME).where('collection', '==', 'caves').orderBy('at', 'desc').limit(ENTRIES_READ).get(),
  ])
  const at = (entry) => entry.at?.toDate?.() || null

  // One entry per record (an undone, then redone, create logs it twice).
  const seen = new Set()
  const createEntries = creates.docs
    .map((doc) => doc.data())
    .filter((entry) => [...RECORDS, CAVES_ASSETS_COLL_NAME].includes(entry.collection) && entry.docId)
    .filter((entry) => !seen.has(`${entry.collection}/${entry.docId}`) && seen.add(`${entry.collection}/${entry.docId}`))
  const recordEntries = createEntries.filter((entry) => RECORDS.includes(entry.collection))
  const photoEntries = createEntries.filter((entry) => entry.collection === CAVES_ASSETS_COLL_NAME)
  // The videos a cave's change added (its videos before and after).
  const videoEntries = caveChanges.docs
    .map((doc) => doc.data())
    .filter((entry) => entry.action === 'update' && entry.changedFields?.includes('videos'))
    .map((entry) => {
      const before = new Set(Array.isArray(entry.before?.videos) ? entry.before.videos : [])
      return { ...entry, added: (Array.isArray(entry.after?.videos) ? entry.after.videos : []).filter((url) => !before.has(url)) }
    })
    .filter((entry) => entry.added.length)

  const [records, photos] = await Promise.all([docs(recordEntries.map((e) => db.collection(e.collection).doc(e.docId))), docs(photoEntries.map((e) => db.collection(CAVES_ASSETS_COLL_NAME).doc(e.docId)))])
  const shownPhotos = photoEntries.map((entry, i) => ({ entry, photo: photos[i].exists ? photos[i].data() : null })).filter(({ photo }) => photo && !photo.deletedAt)
  // The caves the photos and videos belong to: their names, their videos now.
  const caveIds = [...new Set([...shownPhotos.map(({ photo }) => photo.caveId), ...videoEntries.map((e) => e.docId)])].filter(Boolean)
  const caveDocs = await docs(caveIds.map((id) => db.collection('caves').doc(id)))
  const caves = new Map(caveDocs.filter((d) => d.exists).map((d) => [d.id, d.data()]))

  const items = []
  recordEntries.forEach((entry, index) => {
    const shown = records[index].exists ? summary(entry.collection, records[index].data()) : null
    if (shown) items.push({ kind: entry.collection, docId: entry.docId, ...shown, authorId: entry.authorId, at: at(entry) })
  })
  items.push(
    ...groupMedia(
      shownPhotos.map(({ entry, photo }) => ({ caveId: photo.caveId, authorId: entry.authorId, at: at(entry), media: [{ id: photo.id || entry.docId, thumbnailRevision: photo.thumbnailRevision || null, viewThumbnailRevision: photo.viewThumbnailRevision || null }] })),
      'photos',
      caves,
    ),
    ...groupMedia(
      // Only the videos the cave still has.
      videoEntries.map((entry) => ({ caveId: entry.docId, authorId: entry.authorId, at: at(entry), media: entry.added.filter((url) => (caves.get(entry.docId)?.videos || []).includes(url)) })).filter((a) => a.media.length),
      'videos',
      caves,
    ),
  )

  items.sort((a, b) => (b.at?.getTime() || 0) - (a.at?.getTime() || 0))
  const shown = items.slice(0, MAX_ITEMS)
  const names = await displayNames(shown.map((item) => item.authorId))
  const answer = { items: shown.map(({ authorId, at: date, ...item }) => ({ ...item, at: date ? date.toISOString() : null, authorName: names.get(authorId) || null })) }
  cached = { time: Date.now(), answer }
  logger.debug('[whatsNew] built', { items: answer.items.length })
  return answer
})

import { onCall } from 'firebase-functions/v2/https'
import { logger } from 'firebase-functions/v2'
import { auth, db } from '../init.js'
import { CAVES_ASSETS_COLL_NAME, ENFORCE_APP_CHECK, REGION } from '../constants.js'
import { AUDIT_LOG_COLL_NAME, SERVER_FIELDS } from '../audit/log.js'

// The records the What's new page (/whats-new) lists one by one - added,
// modified or removed - and the photos, listed by cave (an upload's audit
// entry, onAssetUploaded).
const RECORDS = ['caves', 'sistemas', 'connections', 'maps']
// How many of the audit log's latest entries are looked at: the creates,
// deletes, undos and purges together; the records' updates on their own (so a
// busy day of edits can't push the additions out); the caves' changes, for
// their videos.
const ENTRIES_READ = 600
const UPDATES_READ = 600
// How many items the page gets at most, and how many of them may be
// modifications and removals: most of the page stays additions.
const MAX_ITEMS = 300
const MAX_MODIFIED = 100
const MAX_REMOVED = 50
// Photos and videos shown per item (the item says how many there are).
const MEDIA_SHOWN = 4
// The answer is kept this long, for every visitor: the page is public, and
// each call reads the audit log and the records.
const CACHE_MS = 5 * 60 * 1000

// Fields whose change alone isn't a modification: the server's, the trash's
// (a record moved there is a removal), a cave's stale copy of its system's
// colour, and the media lists whose additions are items of their own (a
// cave's videos, a system's maps).
const IGNORED_FIELDS = new Set([...SERVER_FIELDS, 'deletedAt', 'deletedBy', 'sistemaColor'])
const MEDIA_FIELDS = { caves: ['videos'], sistemas: ['maps'] }

let cached = null

// Hidden from the public: a map in the trash, a system not public.
const isHidden = (collection, data) => Boolean(data.deletedAt) || (collection === 'sistemas' && data.public === false)

// A record as the page shows it: its name, what it belongs to (a cave's
// system, a connection's two systems), a map's thumbnail.
function describe(collection, data) {
  const name = collection === 'caves' ? data.name?.value : collection === 'connections' ? null : data.name
  return {
    name: typeof name === 'string' && name.trim() ? name.trim() : null,
    sistemaId: (collection === 'caves' || collection === 'connections') && typeof data.sistemaId === 'string' ? data.sistemaId : null,
    parentSistemaId: collection === 'connections' && typeof data.parentSistemaId === 'string' ? data.parentSistemaId : null,
    thumbnailUrl: collection === 'maps' && typeof data.thumbnailUrl === 'string' ? data.thumbnailUrl : null,
  }
}

// A record as the page shows it now, or null when it's hidden.
const summary = (collection, data) => (isHidden(collection, data) ? null : describe(collection, data))

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
const atOf = (entry) => entry.at?.toDate?.() || null
const recordKey = (entry) => `${entry.collection}/${entry.docId}`
// What an entry did: an undo's own entry says it in undoAction.
const actionOf = (entry) => (entry.action === 'undo' ? entry.undoAction : entry.action)
// An update (or an undo that updated) moving a record to the trash, or out of it.
const trashes = (entry) => actionOf(entry) === 'update' && entry.changedFields?.includes('deletedAt') && Boolean(entry.after?.deletedAt) && !entry.before?.deletedAt
const restores = (entry) => actionOf(entry) === 'update' && entry.changedFields?.includes('deletedAt') && !entry.after?.deletedAt && Boolean(entry.before?.deletedAt)

// The fields an update changed that the page lists (none: not a modification).
function shownFields(entry) {
  const media = MEDIA_FIELDS[entry.collection] || []
  return (Array.isArray(entry.changedFields) ? entry.changedFields : []).filter((field) => !IGNORED_FIELDS.has(field) && !media.includes(field))
}

// Photos or videos added to a cave, one item per cave, author and day.
function groupMedia(additions, kind, caves) {
  const groups = new Map()
  for (const { caveId, authorId, at, media } of additions) {
    const cave = caves.get(caveId)
    if (!cave) continue
    const key = `${caveId}|${authorId}|${dayOf(at)}`
    const group = groups.get(key) || { change: 'added', kind, docId: `${caveId}-${dayOf(at)}-${groups.size}`, caveId, name: cave.name?.value?.trim() || null, sistemaId: cave.sistemaId || null, authorId, at, media: [] }
    group.media.push(...media)
    if (at > group.at) group.at = at
    groups.set(key, group)
  }
  return [...groups.values()].map(({ media, ...group }) => ({ ...group, count: media.length, media: media.slice(0, MEDIA_SHOWN) }))
}

// The records' updates, one per record, author and (UTC) day, with the
// fields they changed that day - newest first. A record's edits by its own
// author the day they added it are part of that addition (`added`: the
// record/author/day keys of the additions shown).
function groupUpdates(entries, added) {
  const groups = new Map()
  for (const entry of entries) {
    const fields = shownFields(entry)
    const at = atOf(entry)
    const key = `${recordKey(entry)}|${entry.authorId}|${dayOf(at)}`
    if (!fields.length || added.has(key)) continue
    const group = groups.get(key) || { collection: entry.collection, docId: entry.docId, authorId: entry.authorId, at, fields: new Set() }
    fields.forEach((field) => group.fields.add(field))
    if (at > group.at) group.at = at
    groups.set(key, group)
  }
  return [...groups.values()].sort((a, b) => (b.at?.getTime() || 0) - (a.at?.getTime() || 0))
}

// The records removed and not back since, from the entries oldest first: a
// delete, a purge, an undo of a creation, or a move to the trash removes; a
// creation (an undone delete) or a restore from the trash brings back. The
// first removal since it was last there is kept (a map moved to the trash,
// then purged, was removed when it left the site).
function findRemovals(entries) {
  const removed = new Map()
  for (const entry of [...entries].sort((a, b) => (atOf(a)?.getTime() || 0) - (atOf(b)?.getTime() || 0))) {
    const key = recordKey(entry)
    const action = actionOf(entry)
    if (action === 'create' || restores(entry)) removed.delete(key)
    else if ((action === 'delete' || entry.action === 'purge' || trashes(entry)) && !removed.has(key)) removed.set(key, entry)
  }
  return [...removed.values()]
}

/**
 * What's new, built from the audit log as it is now: the caves, cave systems,
 * connections and maps people added, modified and removed in the app, the
 * photos uploaded and the videos added to caves, newest first - with the date,
 * the author's display name and what changed. Anyone may call it (the page is
 * public).
 *
 * - **added**: a record's creation, if it's still there and shown (with its
 *   current name); a cave's photos or videos, one item per cave, author and day.
 * - **modified**: a record's updates (and undos that updated it), one item per
 *   record, author and UTC day, with the union of the fields changed
 *   (`fields`) - leaving out the server's fields, the trash's, and the media
 *   lists shown as items of their own; folded into the addition when the
 *   author added the record that day. At most {@link MAX_MODIFIED}.
 * - **removed**: a record deleted, purged, moved to the trash or whose
 *   creation was undone, and not back since - named from its last values
 *   (a system that wasn't public isn't listed). At most {@link MAX_REMOVED}.
 *
 * Cached {@link CACHE_MS} for everyone.
 *
 * @returns {Promise<{items: WhatsNewItem[]}>}
 */
export const getWhatsNew = onCall({ region: REGION, enforceAppCheck: ENFORCE_APP_CHECK }, async () => {
  if (cached && Date.now() - cached.time < CACHE_MS) return cached.answer

  const log = db.collection(AUDIT_LOG_COLL_NAME)
  const [events, updates, caveChanges] = await Promise.all([
    log.where('action', 'in', ['create', 'delete', 'undo', 'purge']).orderBy('at', 'desc').limit(ENTRIES_READ).get(),
    log.where('action', '==', 'update').where('collection', 'in', RECORDS).orderBy('at', 'desc').limit(UPDATES_READ).get(),
    log.where('collection', '==', 'caves').orderBy('at', 'desc').limit(ENTRIES_READ).get(),
  ])
  const eventEntries = events.docs.map((doc) => doc.data()).filter((entry) => entry.docId)
  const updateEntries = updates.docs.map((doc) => doc.data()).filter((entry) => entry.docId)

  // One entry per record (an undone, then redone, create logs it twice).
  const seen = new Set()
  const createEntries = eventEntries
    .filter((entry) => entry.action === 'create' && [...RECORDS, CAVES_ASSETS_COLL_NAME].includes(entry.collection))
    .filter((entry) => !seen.has(recordKey(entry)) && seen.add(recordKey(entry)))
  const recordEntries = createEntries.filter((entry) => RECORDS.includes(entry.collection))
  const photoEntries = createEntries.filter((entry) => entry.collection === CAVES_ASSETS_COLL_NAME)
  // The records' updates: the app's, and an admin's undo that updated.
  const recordUpdates = [...updateEntries, ...eventEntries.filter((entry) => entry.action === 'undo' && entry.undoAction === 'update' && RECORDS.includes(entry.collection))]
  const removals = findRemovals([...eventEntries, ...recordUpdates].filter((entry) => RECORDS.includes(entry.collection)))
  // The videos a cave's change added (its videos before and after).
  const videoEntries = caveChanges.docs
    .map((doc) => doc.data())
    .filter((entry) => entry.action === 'update' && entry.changedFields?.includes('videos'))
    .map((entry) => {
      const before = new Set(Array.isArray(entry.before?.videos) ? entry.before.videos : [])
      return { ...entry, added: (Array.isArray(entry.after?.videos) ? entry.after.videos : []).filter((url) => !before.has(url)) }
    })
    .filter((entry) => entry.added.length)

  // The additions shown, by record, author and day: their same-day edits fold into them.
  const addedKeys = new Set(recordEntries.map((entry) => `${recordKey(entry)}|${entry.authorId}|${dayOf(atOf(entry))}`))
  const updateGroups = groupUpdates(recordUpdates, addedKeys)
  const recordRef = ({ collection, docId }) => db.collection(collection).doc(docId)

  const [records, photos, updated, removedNow] = await Promise.all([
    docs(recordEntries.map(recordRef)),
    docs(photoEntries.map((e) => db.collection(CAVES_ASSETS_COLL_NAME).doc(e.docId))),
    // The modified records as they are now (their names, whether still shown).
    docs(updateGroups.map(recordRef)),
    // The removed records, if they're there at all (in the trash, or back).
    docs(removals.map(recordRef)),
  ])
  const shownPhotos = photoEntries.map((entry, i) => ({ entry, photo: photos[i].exists ? photos[i].data() : null })).filter(({ photo }) => photo && !photo.deletedAt)
  // The caves the photos and videos belong to: their names, their videos now.
  const caveIds = [...new Set([...shownPhotos.map(({ photo }) => photo.caveId), ...videoEntries.map((e) => e.docId)])].filter(Boolean)
  const caveDocs = await docs(caveIds.map((id) => db.collection('caves').doc(id)))
  const caves = new Map(caveDocs.filter((d) => d.exists).map((d) => [d.id, d.data()]))

  const items = []
  recordEntries.forEach((entry, index) => {
    const shown = records[index].exists ? summary(entry.collection, records[index].data()) : null
    if (shown) items.push({ change: 'added', kind: entry.collection, docId: entry.docId, ...shown, authorId: entry.authorId, at: atOf(entry) })
  })
  items.push(
    ...groupMedia(
      shownPhotos.map(({ entry, photo }) => ({ caveId: photo.caveId, authorId: entry.authorId, at: atOf(entry), media: [{ id: photo.id || entry.docId, thumbnailRevision: photo.thumbnailRevision || null, viewThumbnailRevision: photo.viewThumbnailRevision || null }] })),
      'photos',
      caves,
    ),
    ...groupMedia(
      // Only the videos the cave still has.
      videoEntries.map((entry) => ({ caveId: entry.docId, authorId: entry.authorId, at: atOf(entry), media: entry.added.filter((url) => (caves.get(entry.docId)?.videos || []).includes(url)) })).filter((a) => a.media.length),
      'videos',
      caves,
    ),
  )

  // Modified: only the records still there and shown.
  const modified = []
  updateGroups.forEach((group, index) => {
    const shown = updated[index].exists ? summary(group.collection, updated[index].data()) : null
    if (shown) modified.push({ change: 'modified', kind: group.collection, docId: group.docId, ...shown, fields: [...group.fields].sort(), authorId: group.authorId, at: group.at })
  })
  items.push(...modified.slice(0, MAX_MODIFIED))

  // Removed: named from the values it had (the entry's, or the trash's copy);
  // no thumbnail (its files may be gone).
  const removed = []
  removals.forEach((entry, index) => {
    const now = removedNow[index].exists ? removedNow[index].data() : null
    if (now && !isHidden(entry.collection, now)) return
    const last = entry.before && actionOf(entry) !== 'update' ? entry.before : now || {}
    // A system that wasn't public stays unnamed to the public: not listed.
    if (entry.collection === 'sistemas' && last.public === false) return
    removed.push({ change: 'removed', kind: entry.collection, docId: entry.docId, ...describe(entry.collection, last), thumbnailUrl: null, authorId: entry.authorId, at: atOf(entry) })
  })
  removed.sort((a, b) => (b.at?.getTime() || 0) - (a.at?.getTime() || 0))
  items.push(...removed.slice(0, MAX_REMOVED))

  items.sort((a, b) => (b.at?.getTime() || 0) - (a.at?.getTime() || 0))
  const shown = items.slice(0, MAX_ITEMS)
  const names = await displayNames(shown.map((item) => item.authorId))
  const answer = { items: shown.map(({ authorId, at: date, ...item }) => ({ ...item, at: date ? date.toISOString() : null, authorName: names.get(authorId) || null })) }
  cached = { time: Date.now(), answer }
  logger.debug('[whatsNew] built', { items: answer.items.length })
  return answer
})

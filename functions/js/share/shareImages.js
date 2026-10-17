// The share images (og:image) of the caves' and the systems' pages: the
// picture a link to them shows on Facebook, WhatsApp, X... Made by the
// server, stored once in Storage, named in the record's `shareImage` field,
// which the pages' <head> reads (seo/shared.js, the app's
// src/utils/shareImage.js):
// - a cave with a cover photo: that photo, cropped to 1200 x 630;
// - a cave without one but with a location: a map card (render.js) - the
//   app's map around it, its pin in its system's colour, its name;
// - a system: a map card of its caves (and the caves of the systems that
//   joined it), in its colour - or of its own location, without caves;
// - nothing to show (no location anywhere): no shareImage, the site's
//   generic image.
// shareImage = { kind: 'photo'|'map', url, width, height, key }. The key is
// a hash of everything the picture shows (inputs below, SHARE_RENDER_VERSION): a
// record whose key is still the one its data gives - and whose file is
// there - is left alone, so the triggers (onShareImageChanges.js) and the
// backfill script (scripts/share-images.js) only draw what changed, and the
// triggers' own write of shareImage ends there. The file is
// share/<caves|sistemas>/<id>/<key>.jpg: a new picture is a new address (no
// network keeps showing an old card), cached for a year; the older ones are
// deleted. Firestore and Storage are given (db, bucket), so the script, with
// its own firebase-admin, uses this too.
import { createHash } from 'node:crypto'
import { CAVES_ASSETS_COLL_NAME, CAVES_COLL_NAME, CONNECTIONS_COLL_NAME, MAP_STYLE, SISTEMAS_COLL_NAME, THUMBNAILS_FOLDER } from '../constants.js'
import { SHARE_HEIGHT, SHARE_WIDTH, fitView, renderMapCard, renderPhotoCard } from './render.js'

export const SHARE_FOLDER = 'share'

// Raised when the pictures change look (render.js): every key changes, and
// the backfill script draws them all again.
export const SHARE_RENDER_VERSION = 1

// A cave's map card: close enough to see the roads and the jungle around it
// (about 3 km across).
const SHARE_CAVE_ZOOM = 13.5
// A system's: no closer than this (one cave), and no farther.
const SHARE_SISTEMA_MAX_ZOOM = 14
const SHARE_SISTEMA_MIN_ZOOM = 8
// The photo copies tried, largest useful first (resize-images/config.js'
// sizes, WebP): 1536 px wide, else 1024; else the original.
const SHARE_PHOTO_SIZES = ['1536', '1024']

// A name that already says it's a system (as seo/indexPages.js and
// src/utils/sistemaTitle.js).
const SAYS_SYSTEM = /(^|[^\p{L}])(sistema|system|réseau|reseau)([^\p{L}]|$)/iu
const sistemaTitle = (name) => (SAYS_SYSTEM.test(name) ? name : `${name} system`)

const located = (point) => typeof point?.latitude === 'number' && typeof point?.longitude === 'number'
const round = (n) => Math.round(n * 1e5) / 1e5

/**
 * The public address of a file in the bucket: Storage's own (the files are
 * public), or the Storage emulator's.
 *
 * @param {string} bucketName
 * @param {string} path
 * @returns {string}
 */
export function storageUrl(bucketName, path) {
  const emulator = process.env.FIREBASE_STORAGE_EMULATOR_HOST || process.env.STORAGE_EMULATOR_HOST
  if (emulator) return `${emulator.startsWith('http') ? emulator : `http://${emulator}`}/v0/b/${bucketName}/o/${encodeURIComponent(path)}?alt=media`
  return `https://storage.googleapis.com/${bucketName}/${path}`
}

/**
 * The key of what a picture shows: a short hash of its inputs.
 *
 * @param {object} inputs
 * @returns {string}
 */
export function shareImageKey(inputs) {
  return createHash('sha256').update(JSON.stringify({ ...inputs, v: SHARE_RENDER_VERSION })).digest('hex').slice(0, 16)
}

// The systems a system joined, upward, itself first - from a function
// giving a system's parents.
async function walkUp(sistemaId, parentsOf) {
  const ids = [sistemaId]
  for (let id = sistemaId; ;) {
    const parent = (await parentsOf(id)).find((parentId) => parentId && !ids.includes(parentId))
    if (!parent) return ids
    ids.push(parent)
    id = parent
  }
}

// The systems that joined a system (every level), itself first - from a
// function giving a system's children.
async function walkDown(sistemaId, childrenOf) {
  const ids = [sistemaId]
  for (let i = 0; i < ids.length; i++) (await childrenOf(ids[i])).forEach((childId) => childId && !ids.includes(childId) && ids.push(childId))
  return ids
}

/**
 * What the share images read of the other records - a cave's systems, a
 * system's caves, a cave's cover - from Firestore, a query each: for the
 * triggers, which draw one record or a few.
 *
 * @param {FirebaseFirestore.Firestore} db
 * @returns {ShareLookup}
 */
export function firestoreLookup(db) {
  const linked = (field, id, other) => db.collection(CONNECTIONS_COLL_NAME).where(field, '==', id).get().then((snap) => snap.docs.map((doc) => doc.get(other)))
  return {
    ancestors: (sistemaId) => walkUp(sistemaId, (id) => linked('sistemaId', id, 'parentSistemaId')),
    descendants: (sistemaId) => walkDown(sistemaId, (id) => linked('parentSistemaId', id, 'sistemaId')),
    sistema: async (id) => (await db.collection(SISTEMAS_COLL_NAME).doc(id).get()).data() ?? null,
    async cavesOf(sistemaIds) {
      const caves = []
      // At most 30 values in an "in" query.
      for (let i = 0; i < sistemaIds.length; i += 30) {
        const snapshot = await db.collection(CAVES_COLL_NAME).where('sistemaId', 'in', sistemaIds.slice(i, i + 30)).get()
        caves.push(...snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })))
      }
      return caves
    },
    async cover(caveId) {
      const snapshot = await db.collection(CAVES_ASSETS_COLL_NAME).where('caveId', '==', caveId).where('isCover', '==', true).get()
      const doc = snapshot.docs.find((item) => item.get('type') === 'image' && !item.get('deletedAt'))
      return doc ? { id: doc.id, ...doc.data() } : null
    },
  }
}

/**
 * The same as {@link firestoreLookup}, from the collections read once
 * ({ id, ...fields } each): for the backfill script, which goes through
 * every record.
 *
 * @param {object} records
 * @param {Cave[]} records.caves
 * @param {Sistema[]} records.sistemas - With their id.
 * @param {{sistemaId?: string, parentSistemaId?: string}[]} records.connections
 * @param {object[]} records.covers - The cover photos (cavesAssets with isCover), the trashed ones too.
 * @returns {ShareLookup}
 */
export function memoryLookup({ caves, sistemas, connections, covers }) {
  const group = (items, keyOf, valueOf) => items.reduce((map, item) => {
    const key = keyOf(item)
    if (key) map.set(key, [...(map.get(key) || []), valueOf(item)])
    return map
  }, new Map())
  const parents = group(connections, (link) => link.sistemaId, (link) => link.parentSistemaId)
  const children = group(connections, (link) => link.parentSistemaId, (link) => link.sistemaId)
  const cavesBySistema = group(caves, (cave) => cave.sistemaId, (cave) => cave)
  const sistemasById = new Map(sistemas.map((sistema) => [sistema.id, sistema]))
  const coverByCave = new Map(covers.filter((asset) => asset.type === 'image' && !asset.deletedAt).map((asset) => [asset.caveId, asset]))
  return {
    ancestors: (sistemaId) => walkUp(sistemaId, async (id) => parents.get(id) || []),
    descendants: (sistemaId) => walkDown(sistemaId, async (id) => children.get(id) || []),
    sistema: async (id) => sistemasById.get(id) ?? null,
    cavesOf: async (sistemaIds) => sistemaIds.flatMap((id) => cavesBySistema.get(id) || []),
    cover: async (caveId) => coverByCave.get(caveId) ?? null,
  }
}

/**
 * What a cave's share image shows: its cover photo, else its map card, else
 * null (no location).
 *
 * @param {ShareLookup} lookup - {@link firestoreLookup} or {@link memoryLookup}.
 * @param {string} caveId
 * @param {Cave} cave
 * @param {{photo?: boolean}} [options] - photo: false, the map card even with a cover (its photo can't be read).
 * @returns {Promise<object|null>}
 */
export async function caveCardInputs(lookup, caveId, cave, { photo = true } = {}) {
  const cover = photo ? await lookup.cover(caveId) : null
  if (cover) return { kind: 'photo', caveId, assetId: cover.id, revision: cover.thumbnailRevision || 0, fullPath: cover.fullPath || null }
  if (!located(cave.location)) return null
  // Its pin's colour: its topmost system's, as the map draws it (the app's
  // CaveMarker: cave.sistemas.at(-1).color).
  let color = null
  let sistemaName = null
  if (cave.sistemaId) {
    const ancestors = await lookup.ancestors(cave.sistemaId)
    const [own, top] = await Promise.all([ancestors[0], ancestors.at(-1)].map((id) => lookup.sistema(id)))
    sistemaName = own?.name || null
    color = top?.color || null
  }
  const name = cave.name?.value?.trim() || ''
  return {
    kind: 'map',
    style: MAP_STYLE,
    view: { latitude: round(cave.location.latitude), longitude: round(cave.location.longitude), zoom: SHARE_CAVE_ZOOM },
    pins: [{ latitude: round(cave.location.latitude), longitude: round(cave.location.longitude), color, unknown: cave.location.validity !== 'valid', highlight: true }],
    pinHeight: 96,
    // As its page's title: its name, or a placeholder in parentheses.
    title: name || '(Unnamed cave)',
    subtitle: [sistemaName && sistemaTitle(sistemaName), cave.area].filter(Boolean).join(' · ') || null,
  }
}

/**
 * What a system's share image shows: its caves (and those of the systems
 * that joined it) on the map in its colour - or its own location - else null.
 *
 * @param {ShareLookup} lookup - {@link firestoreLookup} or {@link memoryLookup}.
 * @param {string} sistemaId
 * @param {Sistema} sistema
 * @returns {Promise<object|null>}
 */
export async function sistemaCardInputs(lookup, sistemaId, sistema) {
  const caves = await lookup.cavesOf(await lookup.descendants(sistemaId))
  const points = caves.filter((cave) => located(cave.location))
    .map((cave) => ({ latitude: round(cave.location.latitude), longitude: round(cave.location.longitude), unknown: cave.location.validity !== 'valid' }))
    // North first: the pins further south are drawn over them, as on the map.
    .sort((a, b) => b.latitude - a.latitude || a.longitude - b.longitude)
  if (points.length === 0 && !located(sistema.location)) return null
  const color = sistema.color || null
  const pins = points.map((point) => ({ ...point, color }))
  const view = points.length > 0
    ? fitView(points, { maxZoom: SHARE_SISTEMA_MAX_ZOOM, minZoom: SHARE_SISTEMA_MIN_ZOOM })
    : { latitude: round(sistema.location.latitude), longitude: round(sistema.location.longitude), zoom: 12 }
  const count = caves.length
  const name = sistema.name || sistemaId
  return {
    kind: 'map',
    style: MAP_STYLE,
    view,
    pins,
    // Smaller as they're more.
    pinHeight: pins.length <= 3 ? 84 : pins.length <= 15 ? 64 : 48,
    title: sistemaTitle(name),
    subtitle: [count > 0 && `${count} ${count === 1 ? 'cave' : 'caves'}`, sistema.area].filter(Boolean).join(' · ') || null,
  }
}

// The cover's picture: its largest useful copy, else its original; null
// when none can be read.
async function photoSource(bucket, inputs) {
  const suffix = inputs.revision > 1 ? `-r${inputs.revision}` : ''
  const paths = [...SHARE_PHOTO_SIZES.map((size) => `caves/${inputs.caveId}/${THUMBNAILS_FOLDER}/${inputs.assetId}_${size}${suffix}.webp`), inputs.fullPath].filter(Boolean)
  for (const path of paths) {
    const file = bucket.file(path)
    const [exists] = await file.exists()
    if (exists) return (await file.download())[0]
  }
  return null
}

/**
 * Makes, keeps or removes a cave's or a system's share image, as its data
 * now says: draws it only when its key changed or its file is missing
 * (force: always), and writes the record's shareImage (Admin SDK: not in the
 * audit log, and not a user's change).
 *
 * @param {object} context
 * @param {FirebaseFirestore.Firestore} context.db
 * @param {import('@google-cloud/storage').Bucket} context.bucket
 * @param {string} [context.token] - A Mapbox token for the map cards; none: a map card can't be drawn (throws).
 * @param {*} context.deleteField - The Firestore SDK's FieldValue.delete() (the caller's SDK).
 * @param {ShareLookup} [context.lookup] - Where the other records are read; {@link firestoreLookup} by default.
 * @param {Set<string>} [context.files] - Every file under share/, listed once (the script): no Storage call
 *   to check that a picture is there.
 * @param {'caves'|'sistemas'} collection
 * @param {string} id
 * @param {object} [options]
 * @param {object|null} [options.data] - The record's data (a trigger's); not given: read.
 * @param {boolean} [options.force=false] - Draw it again even if it's up to date.
 * @param {boolean} [options.dryRun=false] - Only say what would be done.
 * @returns {Promise<{action: 'unchanged'|'made'|'removed'|'none'|'would make'|'would remove', kind?: string, url?: string, path?: string}>} What
 *   was done; kind: the picture's ('map' for a cover that couldn't be read); path: the file made.
 * @throws {Error} When the picture can't be drawn or stored.
 */
export async function refreshShareImage({ db, bucket, token, deleteField, lookup = firestoreLookup(db), files }, collection, id, { data, force = false, dryRun = false } = {}) {
  const ref = db.collection(collection).doc(id)
  const record = data === undefined ? ((await ref.get()).data() ?? null) : data
  const prefix = `${SHARE_FOLDER}/${collection}/${id}/`
  // Its older pictures (all of them, if it has none now).
  const removeOthers = async (keep) => {
    // The listed files (the script) tell whether there are any: no call for none.
    if (files && ![...files].some((name) => name.startsWith(prefix) && name !== keep)) return
    const [stored] = await bucket.getFiles({ prefix })
    await Promise.all(stored.filter((file) => file.name !== keep).map((file) => file.delete({ ignoreNotFound: true })))
  }
  // A failed update on a record deleted meanwhile is no error.
  const update = (fields) => ref.update(fields).catch((error) => {
    if (error.code !== 5) throw error
  })

  if (!record) {
    if (!dryRun) await removeOthers(null)
    return { action: dryRun ? 'would remove' : 'removed' }
  }
  const inputs = collection === CAVES_COLL_NAME ? await caveCardInputs(lookup, id, record) : await sistemaCardInputs(lookup, id, record)
  if (!inputs) {
    if (dryRun) return { action: record.shareImage ? 'would remove' : 'none' }
    if (record.shareImage) await update({ shareImage: deleteField })
    await removeOthers(null)
    return { action: record.shareImage ? 'removed' : 'none' }
  }

  const key = shareImageKey(inputs)
  const path = `${prefix}${key}.jpg`
  const url = storageUrl(bucket.name, path)
  const current = record.shareImage
  if (!force && current?.key === key && current.url === url && (files ? files.has(path) : (await bucket.file(path).exists())[0])) return { action: 'unchanged', kind: inputs.kind, url }
  if (dryRun) return { action: 'would make', kind: inputs.kind }

  let kind = inputs.kind
  let picture = null
  if (inputs.kind === 'photo') {
    const photo = await photoSource(bucket, inputs)
    if (photo) picture = await renderPhotoCard(photo)
  }
  if (!picture) {
    // A cover whose picture can't be read: its map card, under the photo's
    // key all the same - a key its data gives, so this ends here instead of
    // being drawn again at each run.
    const mapInputs = inputs.kind === 'map' ? inputs : await caveCardInputs(lookup, id, record, { photo: false })
    if (!mapInputs) {
      if (record.shareImage) await update({ shareImage: deleteField })
      await removeOthers(null)
      return { action: record.shareImage ? 'removed' : 'none' }
    }
    if (!token) throw new Error("No Mapbox token: the map card can't be drawn")
    picture = await renderMapCard({ ...mapInputs, token })
    kind = 'map'
  }

  const file = bucket.file(path)
  await file.save(picture, { resumable: false, contentType: 'image/jpeg', metadata: { cacheControl: 'public, max-age=31536000, immutable' } })
  // Public, as the photos' copies (resize-images): read at its plain
  // address. (The Storage emulator's files are readable as they are.)
  await file.makePublic().catch((error) => {
    if (!process.env.FIREBASE_STORAGE_EMULATOR_HOST && !process.env.STORAGE_EMULATOR_HOST) throw error
  })
  await update({ shareImage: { kind, url, width: SHARE_WIDTH, height: SHARE_HEIGHT, key } })
  await removeOthers(path)
  return { action: 'made', kind, url, path }
}

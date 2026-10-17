import { onDocumentWritten } from 'firebase-functions/v2/firestore'
import { defineSecret } from 'firebase-functions/params'
import { logger } from 'firebase-functions/v2'
import { getStorage } from 'firebase-admin/storage'
import { FieldValue } from 'firebase-admin/firestore'
import { db } from '../init.js'
import { BUCKET_NAME, CAVES_ASSETS_COLL_NAME, CAVES_COLL_NAME, CONNECTIONS_COLL_NAME, REGION, SISTEMAS_COLL_NAME } from '../constants.js'
import { firestoreLookup, refreshShareImage } from './shareImages.js'

// The other records, read from Firestore (a query each).
const lookup = firestoreLookup(db)

// Keeps the caves' and the systems' share images (shareImages.js) in step
// with their data: each trigger redraws what a change can alter, and
// refreshShareImage draws only the pictures whose key changed. Its own write
// of shareImage comes back here as a change of that field: checked (the key
// still the data's, the file there) and left alone - no loop.

// A Mapbox token allowed to call the Static Images API from a server (a
// public token without a URL restriction, made for it): Google Secret
// Manager, `firebase functions:secrets:set MAPBOX_STATIC_TOKEN`; the emulators
// read functions/js/.secret.local. See docs/maintenance.md, "Share images".
export const MAPBOX_STATIC_TOKEN = defineSecret('MAPBOX_STATIC_TOKEN')

// A system's many caves can each need a new picture (a colour changed):
// about a second each.
const OPTIONS = { region: REGION, secrets: [MAPBOX_STATIC_TOKEN], memory: '512MiB', timeoutSeconds: 540 }

const context = () => ({ db, bucket: getStorage().bucket(BUCKET_NAME), token: MAPBOX_STATIC_TOKEN.value(), deleteField: FieldValue.delete(), lookup })

// Whether any of these fields differ between the two versions.
const changed = (before, after, fields) => fields.some((field) => JSON.stringify(before?.[field] ?? null) !== JSON.stringify(after?.[field] ?? null))

// One record's picture: an error logged, not thrown (the others go on).
async function refresh(collection, id, options) {
  try {
    const result = await refreshShareImage(context(), collection, id, options)
    if (result.action !== 'unchanged' && result.action !== 'none') logger.info(`[shareImage] ${collection}/${id}: ${result.action}`, result)
  } catch (error) {
    logger.error(`[shareImage] ${collection}/${id} could not be drawn`, { error: error.message })
  }
}

// These systems' pictures, one after the other (each its own Mapbox call).
async function refreshSistemas(ids) {
  for (const id of new Set(ids)) await refresh(SISTEMAS_COLL_NAME, id)
}

// The caves of these systems (their pins' colour, their system's name).
async function refreshCavesOf(sistemaIds) {
  for (const cave of await lookup.cavesOf([...new Set(sistemaIds)])) await refresh(CAVES_COLL_NAME, cave.id, { data: cave })
}

// A cave's fields its picture shows (shareImage: its own, checked).
const CAVE_FIELDS = ['location', 'name', 'sistemaId', 'area', 'shareImage']

/**
 * A cave written: its picture (made, kept, removed with it); its location or
 * system changed - or it came or went -, the pictures of its systems (and
 * those they joined), which show its pin.
 */
export const onCaveShareImage = onDocumentWritten({ document: `${CAVES_COLL_NAME}/{caveId}`, ...OPTIONS }, async (event) => {
  const before = event.data?.before?.exists ? event.data.before.data() : null
  const after = event.data?.after?.exists ? event.data.after.data() : null
  if (before && after && !changed(before, after, CAVE_FIELDS)) return
  await refresh(CAVES_COLL_NAME, event.params.caveId, { data: after })
  if (!before || !after || changed(before, after, ['location', 'sistemaId'])) {
    const sistemaIds = [before?.sistemaId, after?.sistemaId].filter(Boolean)
    const ancestors = (await Promise.all(sistemaIds.map((id) => lookup.ancestors(id)))).flat()
    await refreshSistemas(ancestors)
  }
})

// A system's fields its picture shows, or its caves' (name, colour).
const SISTEMA_FIELDS = ['name', 'color', 'location', 'area', 'shareImage']

/**
 * A system written: its picture; its name or colour changed, its caves'
 * pictures and those of the systems that joined it (a pin takes its topmost
 * system's colour).
 */
export const onSistemaShareImage = onDocumentWritten({ document: `${SISTEMAS_COLL_NAME}/{sistemaId}`, ...OPTIONS }, async (event) => {
  const before = event.data?.before?.exists ? event.data.before.data() : null
  const after = event.data?.after?.exists ? event.data.after.data() : null
  if (before && after && !changed(before, after, SISTEMA_FIELDS)) return
  const { sistemaId } = event.params
  await refresh(SISTEMAS_COLL_NAME, sistemaId, { data: after })
  if (before && changed(before, after, ['name', 'color'])) await refreshCavesOf(await lookup.descendants(sistemaId))
})

/**
 * A connection written (a system joined another, or no longer): the pictures
 * of the systems above, whose caves changed, and the caves of the one that
 * joined, whose topmost system (their pins' colour) changed.
 */
export const onConnectionShareImage = onDocumentWritten({ document: `${CONNECTIONS_COLL_NAME}/{connectionId}`, ...OPTIONS }, async (event) => {
  const before = event.data?.before?.exists ? event.data.before.data() : null
  const after = event.data?.after?.exists ? event.data.after.data() : null
  if (before && after && !changed(before, after, ['sistemaId', 'parentSistemaId'])) return
  const links = [before, after].filter((link) => link?.sistemaId && link?.parentSistemaId)
  const parents = (await Promise.all(links.map((link) => lookup.ancestors(link.parentSistemaId)))).flat()
  await refreshSistemas(parents)
  const children = (await Promise.all(links.map((link) => lookup.descendants(link.sistemaId)))).flat()
  await refreshCavesOf(children)
})

// A photo's fields that make or unmake a cave's cover picture.
const ASSET_FIELDS = ['isCover', 'deletedAt', 'thumbnailRevision', 'type', 'caveId']

/**
 * A photo written: when it is (or was) a cover, its cave's picture - a new
 * cover, one moved to the trash or deleted, its copies redone.
 */
export const onCaveAssetShareImage = onDocumentWritten({ document: `${CAVES_ASSETS_COLL_NAME}/{assetId}`, ...OPTIONS }, async (event) => {
  const before = event.data?.before?.exists ? event.data.before.data() : null
  const after = event.data?.after?.exists ? event.data.after.data() : null
  if (!before?.isCover && !after?.isCover) return
  if (before && after && !changed(before, after, ASSET_FIELDS)) return
  const caveIds = new Set([before?.caveId, after?.caveId].filter(Boolean))
  for (const caveId of caveIds) await refresh(CAVES_COLL_NAME, caveId)
})

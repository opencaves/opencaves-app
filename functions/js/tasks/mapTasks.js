import { FieldValue, Timestamp } from 'firebase-admin/firestore'
import { onDocumentUpdated, onDocumentWrittenWithAuthContext } from 'firebase-functions/v2/firestore'
import { onSchedule } from 'firebase-functions/v2/scheduler'
import { logger } from 'firebase-functions/v2'
import { auth, db } from '../init.js'
import { REGION, TASKS_COLL_NAME, USERS_COLL_NAME } from '../constants.js'
import { writer } from '../audit/onDataWritten.js'
import { RESEND_API_KEY, sendEmail } from '../email/sendEmail.js'
import { hammingDistance, VISUAL_HASH_MAX_DISTANCE } from '../maps/visualHash.js'
import { mapTaskEmail } from './emailContent.js'
import { isLaterDate, loadLayerMaps } from './layerMaps.js'

// The map tasks: each survey map added in the app (a "maps" document given its
// file's link, `url`, without importKey - the bulk import's maps are another
// work list) gets a task in _tasks, map-<mapId>, for the admins' Tasks page
// (/tasks), which says what OpenCaves already has of it:
// - exactDuplicate: an older map (not in the trash) has the same contentHash
//   (the file's SHA-256, sent by the app): uploaded although identical - the
//   app asks first, and the uploader chose Upload anyway (or uploaded offline);
// - possibleDuplicate: an older map's visualHash (its thumbnail's, made by
//   onUploaded.js) is VISUAL_HASH_MAX_DISTANCE bits or fewer from its own;
// - otherwise its place in the cave layer (layerMaps.js): newerSurvey, one of
//   its systems has a traced map, of an earlier date; alreadyTraced, of the same
//   date or later (or no date to compare); newToLayer, none.
// `layerStatus` keeps the last three apart from the duplicates. The task
// follows its map (onMapTaskWritten, onSistemaMapsChanged): its systems, its
// duplicates and the scenario are worked out again on each change, and it
// closes itself (status done, closedBy 'system', closedReason) once the map
// goes to the trash (trashed), is marked not for the layer (skipped), is named
// by a layer config (inLayer, checked by sweepMapTasks) or is deleted
// (deleted) - and opens again if the trash or the mark is undone. Admins close
// them (done, dismissed) or open them again on the page: _tasks isn't in the
// audit log (a to-do list, not cave data: each task keeps who closed it, and
// when), like _feedback.

// "Older": a map whose id sorts before this one's - push ids start with
// their creation time, so of two identical maps only the later one is the
// duplicate.

/** The kinds of map tasks, the first the most urgent (the Tasks page lists them so). */
export const MAP_TASK_SCENARIOS = ['exactDuplicate', 'possibleDuplicate', 'newerSurvey', 'alreadyTraced', 'newToLayer']
// The admins' email waits this long after a task is made, so the map's
// thumbnail (its visualHash) and its system (added to the system's list once
// uploaded) are there to tell.
const NOTIFY_AFTER_MS = 2 * 60 * 1000
// How often sweepMapTasks runs.
const SWEEP_SCHEDULE = 'every 10 minutes'

const tasks = () => db.collection(TASKS_COLL_NAME)

/**
 * A map's task's id.
 *
 * @param {string} mapId
 * @returns {string}
 */
export const mapTaskId = (mapId) => `map-${mapId}`

// The systems listing each map ({ id, name }), from every system.
async function sistemasByMap() {
  const byMap = new Map()
  const snapshot = await db.collection('sistemas').select('name', 'maps').get()
  snapshot.docs.forEach((sistema) => (sistema.get('maps') || []).forEach((mapId) => byMap.set(mapId, [...(byMap.get(mapId) || []), { id: sistema.id, name: String(sistema.get('name') || sistema.id) }])))
  return byMap
}

/**
 * What a map's task says, worked out from the data now: its systems, its older
 * identical maps (exactDuplicates) and look-alikes (duplicates: both, the
 * identical first, then those of the same systems), the layer's traced maps of
 * its systems, the layer status and the scenario.
 *
 * @param {string} mapId
 * @param {CaveMap} map
 * @param {{traced: LayerMap[], configured: Set<string>}|null} layer
 * @returns {Promise<{sistemaIds: string[], duplicates: string[], exactDuplicates: string[], tracedMaps: {title: string, date?: string}[], layerStatus: string, scenario: string}>}
 */
export async function mapTaskFindings(mapId, map, layer) {
  const [byMap, maps] = await Promise.all([sistemasByMap(), db.collection('maps').select('contentHash', 'visualHash', 'deletedAt', 'importKey').get()])
  const sistemaIds = (byMap.get(mapId) || []).map((sistema) => sistema.id)
  const older = maps.docs.filter((doc) => doc.id < mapId && !doc.get('deletedAt'))
  const exactDuplicates = map.contentHash ? older.filter((doc) => doc.get('contentHash') === map.contentHash).map((doc) => doc.id) : []
  const sharesSystem = (id) => (byMap.get(id) || []).some((sistema) => sistemaIds.includes(sistema.id))
  const lookAlikes = map.visualHash
    ? older
        .filter((doc) => !exactDuplicates.includes(doc.id) && typeof doc.get('visualHash') === 'string')
        .map((doc) => ({ id: doc.id, distance: hammingDistance(map.visualHash, doc.get('visualHash')) }))
        .filter(({ distance }) => distance <= VISUAL_HASH_MAX_DISTANCE)
        // The same systems first, then the closest.
        .sort((a, b) => Number(sharesSystem(b.id)) - Number(sharesSystem(a.id)) || a.distance - b.distance)
        .map(({ id }) => id)
    : []

  // The layer's traced maps of the same systems (by mapId, or by importKey
  // for the bulk import's), the latest survey first.
  const importKeys = new Map(maps.docs.filter((doc) => doc.get('importKey')).map((doc) => [doc.get('importKey'), doc.id]))
  const traced = (layer?.traced || []).filter((entry) => {
    const id = entry.mapId || importKeys.get(entry.mapImportKey)
    return id !== mapId && ((entry.sistemaId && sistemaIds.includes(entry.sistemaId)) || (id && sistemaIds.length && sharesSystem(id)))
  })
  const latest = traced.reduce((best, entry) => (!best || isLaterDate(entry.date, best.date) ? entry : best), null)
  const layerStatus = !latest ? 'newToLayer' : isLaterDate(map.date, latest.date) ? 'newerSurvey' : 'alreadyTraced'
  const scenario = exactDuplicates.length ? 'exactDuplicate' : lookAlikes.length ? 'possibleDuplicate' : layerStatus
  return {
    sistemaIds,
    duplicates: [...exactDuplicates, ...lookAlikes],
    exactDuplicates,
    tracedMaps: traced.map((entry) => ({ title: entry.title, ...(entry.date && { date: entry.date }) })),
    layerStatus,
    scenario,
  }
}

// Why the task of this map is closed by itself, if it is: in the trash,
// marked not for the layer, named by a layer config.
function closeReasonOf(mapId, map, layer) {
  if (!map) return 'deleted'
  if (map.deletedAt) return 'trashed'
  if (map.layerSkipReason) return 'skipped'
  if (layer?.configured.has(mapId)) return 'inLayer'
  return null
}

/**
 * Brings a map's task (if it has one) up to date with its map: closed by the
 * server when the map is in the trash, marked not for the layer, in the layer
 * or deleted; opened again when the server closed it and that's no longer so;
 * else, while open, its findings ({@link mapTaskFindings}) written when they
 * changed.
 *
 * @param {string} mapId
 * @param {object} [options]
 * @param {CaveMap|null} [options.map] - The map as it is now (read when not given; null: deleted).
 * @param {{traced: LayerMap[], configured: Set<string>}|null} [options.layer] - The cave layer's maps (read when not given).
 * @returns {Promise<'closed'|'reopened'|'updated'|'unchanged'|'none'>}
 */
export async function refreshMapTask(mapId, { map, layer } = {}) {
  const ref = tasks().doc(mapTaskId(mapId))
  const snapshot = await ref.get()
  if (!snapshot.exists) return 'none'
  const task = /** @type {MapTask} */ (snapshot.data())
  if (map === undefined) {
    const mapSnapshot = await db.collection('maps').doc(mapId).get()
    map = mapSnapshot.exists ? /** @type {CaveMap} */ (mapSnapshot.data()) : null
  }
  if (layer === undefined) layer = await loadLayerMaps()
  const closeReason = closeReasonOf(mapId, map, layer)

  if (task.status === 'open' && closeReason) {
    await ref.update({ status: 'done', closedAt: FieldValue.serverTimestamp(), closedBy: 'system', closedReason: closeReason })
    return 'closed'
  }
  const reopen = task.status === 'done' && task.closedBy === 'system' && !closeReason
  if (task.status !== 'open' && !reopen) return 'unchanged'

  const findings = await mapTaskFindings(mapId, map, layer)
  const changed = Object.entries(findings).some(([key, value]) => JSON.stringify(task[key] ?? null) !== JSON.stringify(value))
  if (!changed && !reopen) return 'unchanged'
  await ref.update({ ...findings, updatedAt: FieldValue.serverTimestamp(), ...(reopen && { status: 'open', closedAt: FieldValue.delete(), closedBy: FieldValue.delete(), closedReason: FieldValue.delete() }) })
  return reopen ? 'reopened' : 'updated'
}

/**
 * Makes a new map's task (once: its id is the map's), with its findings - or
 * none for a map the bulk import added (importKey) or one already in the trash.
 *
 * @param {string} mapId
 * @param {CaveMap} map
 * @param {string|null} addedBy - Who added the map (an account's id; null: a script).
 * @returns {Promise<boolean>} Whether it was made.
 */
export async function createMapTask(mapId, map, addedBy) {
  if (map.importKey || map.deletedAt) return false
  const layer = await loadLayerMaps()
  const findings = await mapTaskFindings(mapId, map, layer)
  try {
    await tasks()
      .doc(mapTaskId(mapId))
      .create({ kind: 'map', status: 'open', mapId, ...findings, addedBy, createdAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp() })
  } catch (error) {
    // Already made (a retried event).
    if (error.code === 6) return false
    throw error
  }
  logger.info('[tasks] a map task was made', { mapId, scenario: findings.scenario })
  // Marked or in the layer already (a config made before its first save).
  await refreshMapTask(mapId, { map, layer })
  return true
}

/**
 * A survey map written: one given its file (`url`) in the app gets its task
 * ({@link createMapTask}: the writer is who added it); any other change
 * brings its task up to date ({@link refreshMapTask}: its fingerprints, the
 * trash, the layer mark).
 */
export const onMapTaskWritten = onDocumentWrittenWithAuthContext({ document: 'maps/{mapId}', region: REGION }, async (event) => {
  const { mapId } = event.params
  const before = event.data?.before?.exists ? event.data.before.data() : null
  const after = event.data?.after?.exists ? /** @type {CaveMap} */ (event.data.after.data()) : null
  try {
    // The app writes the map's record with its link once its file is up
    // (src/components/MapsPicker/MapUpload.jsx); the server's thumbnail may
    // have made the document first.
    if (after?.url && !before?.url && (await createMapTask(mapId, after, writer(event)?.authorId ?? null))) return
    await refreshMapTask(mapId, { map: after })
  } catch (error) {
    logger.error('[tasks] the map task could not be kept', { mapId, error: error.message })
  }
})

/**
 * A system's maps changed: the tasks of the maps it added or dropped are
 * brought up to date (their systems, so their layer status).
 */
export const onSistemaMapsChanged = onDocumentUpdated({ document: 'sistemas/{sistemaId}', region: REGION }, async (event) => {
  const before = event.data.before.get('maps') || []
  const after = event.data.after.get('maps') || []
  const changed = [...after.filter((id) => !before.includes(id)), ...before.filter((id) => !after.includes(id))]
  for (const mapId of changed) {
    try {
      await refreshMapTask(mapId)
    } catch (error) {
      logger.error('[tasks] the map task could not be kept', { mapId, error: error.message })
    }
  }
})

// The admins: { uid, email, language } of each account with the admin role.
async function adminRecipients() {
  const admins = []
  let pageToken
  do {
    const page = await auth.listUsers(1000, pageToken)
    for (const user of page.users) if (user.email && !user.disabled && Array.isArray(user.customClaims?.roles) && user.customClaims.roles.includes('admin')) admins.push({ uid: user.uid, email: user.email })
    pageToken = page.pageToken
  } while (pageToken)
  const settings = admins.length ? await db.getAll(...admins.map((admin) => db.collection(USERS_COLL_NAME).doc(admin.uid))) : []
  return admins.map((admin, index) => ({ ...admin, language: String(settings[index].get('language') || 'en').slice(0, 2) }))
}

/**
 * Emails a map task to every admin, each in their account's language
 * ({@link mapTaskEmail}).
 *
 * @param {string} taskId
 * @param {MapTask} task
 * @returns {Promise<number>} How many emails went (the emulators send none, and count them).
 */
export async function emailMapTask(taskId, task) {
  const admins = await adminRecipients()
  if (!admins.length) {
    logger.warn('[tasks] no admin to email', { taskId })
    return 0
  }
  const ids = [task.mapId, ...(task.duplicates || [])]
  const [mapSnapshots, byMap, author] = await Promise.all([
    db.getAll(...ids.map((id) => db.collection('maps').doc(id))),
    sistemasByMap(),
    task.addedBy ? auth.getUser(task.addedBy).catch(() => null) : null,
  ])
  const maps = new Map(mapSnapshots.map((snapshot) => [snapshot.id, snapshot.data() || {}]))
  const map = maps.get(task.mapId)
  const systems = (byMap.get(task.mapId) || []).map((sistema) => sistema.name)
  const mapName = (id) => [maps.get(id)?.name || id, ...(byMap.get(id) || []).map((sistema) => sistema.name).slice(0, 1)].join(' - ')
  const addedBy = author?.displayName || author?.email || task.addedBy || ''
  let sent = 0
  for (const admin of admins) {
    try {
      await sendEmail({ to: admin.email, ...mapTaskEmail({ language: admin.language, task, map, systems, mapName, addedBy }) })
      sent++
    } catch (error) {
      logger.error('[tasks] an admin could not be emailed', { taskId, error: error.message })
    }
  }
  return sent
}

/**
 * The open map tasks' round: each brought up to date with the cave layer as
 * deployed now (one named by a layer config is closed: inLayer), then those
 * not yet emailed to the admins and at least {@link NOTIFY_AFTER_MS} old are
 * ({@link emailMapTask}; notifiedAt records it).
 *
 * @param {object} [options]
 * @param {number} [options.notifyAfterMs=NOTIFY_AFTER_MS] - How old a task must be to be emailed.
 * @returns {Promise<{open: number, closed: number, emailed: number}>}
 */
export async function sweepMapTasks({ notifyAfterMs = NOTIFY_AFTER_MS } = {}) {
  const layer = await loadLayerMaps({ fresh: true })
  const open = await tasks().where('kind', '==', 'map').where('status', '==', 'open').get()
  let closed = 0
  let emailed = 0
  for (const doc of open.docs) {
    const task = /** @type {MapTask} */ (doc.data())
    try {
      if ((await refreshMapTask(task.mapId, { layer })) === 'closed') {
        closed++
        continue
      }
      const created = task.createdAt?.toMillis?.() ?? Date.now()
      if (task.notifiedAt || Date.now() - created < notifyAfterMs) continue
      // Claimed first, so an overlapping run doesn't email it twice.
      const claimed = await db.runTransaction(async (transaction) => {
        const fresh = await transaction.get(doc.ref)
        if (fresh.get('notifiedAt') || fresh.get('status') !== 'open') return null
        transaction.update(doc.ref, { notifiedAt: Timestamp.now() })
        return /** @type {MapTask} */ (fresh.data())
      })
      if (claimed && (await emailMapTask(doc.id, claimed)) > 0) emailed++
    } catch (error) {
      logger.error('[tasks] the map task round failed for a task', { taskId: doc.id, error: error.message })
    }
  }
  return { open: open.size, closed, emailed }
}

/**
 * Every {@link SWEEP_SCHEDULE}: {@link sweepMapTasks} - the layer check (a
 * deploy of new tiles) and the admins' emails.
 */
export const mapTasksSweep = onSchedule({ schedule: SWEEP_SCHEDULE, region: REGION, secrets: [RESEND_API_KEY] }, async () => {
  const result = await sweepMapTasks()
  logger.debug('[tasks] map tasks swept', result)
})

import { onSchedule } from 'firebase-functions/v2/scheduler'
import { onDocumentWritten } from 'firebase-functions/v2/firestore'
import { logger } from 'firebase-functions/v2'
import { getStorage } from 'firebase-admin/storage'
import { FieldValue } from 'firebase-admin/firestore'
import { db } from '../init.js'
import { BUCKET_NAME, CAVES_COLL_NAME, REGION } from '../constants.js'
import { RESEND_API_KEY, sendEmail } from '../email/sendEmail.js'
import { adminRecipients } from '../users/adminRecipients.js'
import { ROADS_FILE, loadRoads, roadDistanceChange, roadIndex } from './roadDistances.js'
import { refreshRoadDistances as refreshAll, roadsMetaRef } from './refresh.js'
import { roadsFailedEmail } from './emailContent.js'

// The caves' road distances (roadDistances.js) kept up to date by the server:
// - monthly, the roads downloaded again from OpenStreetMap (Overpass) and
//   every cave measured again (refreshRoadDistances): on the 1st at 02:00,
//   Cancún time; a failed download keeps the previous roads, and is tried
//   again on the 2nd and the 3rd (the same schedule, which does nothing once
//   the month's roads are in); after the third failure the admins are
//   emailed, once. The state is _roads/meta's `refresh`: { month, failures,
//   lastError, lastAttemptAt, emailedAt }.
// - at once, a cave created or moved (its location's coordinates or
//   validity): that cave measured on the stored roads (onCaveRoadDistance).
//   Its own roadDistance write comes back as a change of that field only:
//   left alone, no loop.

// Days 1 to 3 of each month, 02:00 (unix-cron, as Cloud Scheduler reads it):
// the first attempt and its two retries.
const SCHEDULE = '0 2 1-3 * *'
const TIME_ZONE = 'America/Cancun'
// Failed attempts in a month before the admins are emailed.
const MAX_ATTEMPTS = 3

const bucket = () => getStorage().bucket(BUCKET_NAME)

// The month a run belongs to ('YYYY-MM'), in the schedule's time zone.
const monthIn = (date) => new Intl.DateTimeFormat('en-CA', { timeZone: TIME_ZONE, year: 'numeric', month: '2-digit' }).format(date).slice(0, 7)

/**
 * Emails the admins that the roads download failed this month ({@link roadsFailedEmail}).
 *
 * @param {number} attempts
 * @param {string} lastError
 * @param {string|null} roadsOf - The day of the roads still in use.
 * @returns {Promise<number>} How many emails went.
 */
async function emailAdmins(attempts, lastError, roadsOf) {
  const admins = await adminRecipients()
  let sent = 0
  for (const admin of admins) {
    try {
      await sendEmail({ to: admin.email, ...roadsFailedEmail({ language: admin.language, attempts, lastError, roadsOf }) })
      sent++
    } catch (error) {
      logger.error('[roads] an admin could not be emailed', { error: error.message })
    }
  }
  return sent
}

/**
 * Monthly ({@link SCHEDULE}, {@link TIME_ZONE}): the roads downloaded again
 * and every cave measured again, unless this month's roads are already in;
 * a failure counted in _roads/meta's refresh, the admins emailed at the
 * {@link MAX_ATTEMPTS}th.
 */
export const refreshRoadDistances = onSchedule({ schedule: SCHEDULE, timeZone: TIME_ZONE, region: REGION, memory: '2GiB', timeoutSeconds: 1800, secrets: [RESEND_API_KEY] }, async () => {
  const month = monthIn(new Date())
  const metaRef = roadsMetaRef(db)
  const meta = (await metaRef.get()).data() || {}
  if (meta.downloadedAt && monthIn(new Date(meta.downloadedAt)) === month) {
    logger.debug('[roads] this month\'s roads are already in', { downloadedAt: meta.downloadedAt })
    return
  }
  try {
    const result = await refreshAll({ db, bucket: bucket(), deleteField: FieldValue.delete(), download: true })
    await metaRef.set({ refresh: { month, failures: 0, lastError: null, lastAttemptAt: new Date(), emailedAt: null } }, { merge: true })
    logger.info('[roads] roads downloaded, caves measured', { ways: result.ways, ...result.counts })
  } catch (error) {
    const previous = meta.refresh?.month === month ? meta.refresh : null
    const failures = (previous?.failures || 0) + 1
    const lastError = String(error.message || error).slice(0, 500)
    logger.error('[roads] the roads could not be refreshed', { month, failures, error: lastError })
    const refresh = { month, failures, lastError, lastAttemptAt: new Date(), emailedAt: previous?.emailedAt || null }
    if (failures >= MAX_ATTEMPTS && !refresh.emailedAt) {
      const sent = await emailAdmins(failures, lastError, meta.downloadedAt ? String(meta.downloadedAt).slice(0, 10) : null)
      if (sent > 0 || process.env.FUNCTIONS_EMULATOR === 'true') refresh.emailedAt = new Date()
    }
    await metaRef.set({ refresh }, { merge: true })
  }
})

// The stored roads' index, kept between calls while the file is the same
// (its generation).
let cached = null

async function storedIndex() {
  const file = bucket().file(ROADS_FILE)
  const [exists] = await file.exists()
  if (!exists) return null
  const [metadata] = await file.getMetadata()
  if (cached?.generation === String(metadata.generation)) return cached.index
  const stored = await loadRoads(bucket())
  if (!stored) return null
  cached = { generation: stored.generation, index: roadIndex(stored.roads) }
  return cached.index
}

// A location's fields the distances depend on.
const locationKey = (cave) => JSON.stringify([cave?.location?.latitude ?? null, cave?.location?.longitude ?? null, cave?.location?.validity ?? null])

/**
 * A cave created, or its location moved or its validity changed: its road
 * distances measured on the stored roads (or removed: its position
 * confirmed, its location gone). Other changes - its own roadDistance
 * written - are left alone.
 */
export const onCaveRoadDistance = onDocumentWritten({ document: `${CAVES_COLL_NAME}/{caveId}`, region: REGION, memory: '1GiB' }, async (event) => {
  const before = event.data?.before?.exists ? event.data.before.data() : null
  const after = event.data?.after?.exists ? event.data.after.data() : null
  if (!after || (before && locationKey(before) === locationKey(after))) return
  const { caveId } = event.params
  try {
    const index = await storedIndex()
    const { action, value } = roadDistanceChange(index, /** @type {Cave} */ ({ id: caveId, ...after }))
    if (action === 'unchanged') return
    await db.collection(CAVES_COLL_NAME).doc(caveId).update({ roadDistance: action === 'set' ? value : FieldValue.delete() })
    logger.info(`[roads] ${caveId}: ${action}`, value ? { path: value.path?.m ?? null, road: value.road?.m ?? null } : {})
  } catch (error) {
    logger.error(`[roads] ${caveId}: its road distances could not be measured`, { error: error.message })
  }
})

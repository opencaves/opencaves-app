import { CAVES_COLL_NAME, ROADS_COLL_NAME, ROADS_META_DOC_ID } from '../constants.js'
import { downloadRoads, loadRoads, plausibleRoads, roadBoxes, roadDistanceChange, roadIndex, saveRoads } from './roadDistances.js'

// The caves' road distances worked out again (roadDistances.js), for every
// cave or one: by the monthly refresh (refreshRoadDistances.js) and
// scripts/road-distances.js. The database and the bucket are given (the
// functions' or the script's), nothing imported from Firebase here.

// Writes per batch (Firestore's limit is 500).
const BATCH_SIZE = 400

/**
 * The roads' public summary, _roads/meta (the caves' list's credit line):
 * { source, licence, asOf ('YYYY-MM'), downloadedAt, bbox, ways, updatedAt },
 * and the monthly refresh's state (refresh: refreshRoadDistances.js).
 *
 * @param {FirebaseFirestore.Firestore} db
 * @returns {FirebaseFirestore.DocumentReference}
 */
export const roadsMetaRef = (db) => db.collection(ROADS_COLL_NAME).doc(ROADS_META_DOC_ID)

/**
 * Works out the caves' road distances again and writes those that changed.
 * download: the roads downloaded anew from Overpass first (around every
 * located cave), stored if they look complete ({@link plausibleRoads}) -
 * else the stored file is used. Only the caves still to confirm get
 * distances; one that has some and shouldn't loses them.
 *
 * @param {object} context
 * @param {FirebaseFirestore.Firestore} context.db
 * @param {import('@google-cloud/storage').Bucket} context.bucket
 * @param {FirebaseFirestore.FieldValue} context.deleteField - FieldValue.delete().
 * @param {boolean} [context.download=false]
 * @param {boolean} [context.dryRun=false] - Nothing stored or written: only the changes listed.
 * @param {string} [context.caveId] - This cave only.
 * @param {typeof fetch} [context.fetchImpl]
 * @returns {Promise<{counts: Record<string, number>, changes: {id: string, action: string, value: RoadDistance|null}[], ways: number, downloadedAt: string, bbox: number[]|null}>}
 * @throws {Error} When the download fails or looks partial, or there's no roads file to use.
 */
export async function refreshRoadDistances({ db, bucket, deleteField, download = false, dryRun = false, caveId, fetchImpl }) {
  const snapshot = await db.collection(CAVES_COLL_NAME).get()
  const caves = snapshot.docs.map((doc) => /** @type {Cave} */ ({ id: doc.id, ...doc.data() }))
  const stored = await loadRoads(bucket)
  let roads = stored?.roads || null
  let bbox = null
  if (download) {
    const area = roadBoxes(caves)
    bbox = area.bbox
    const fresh = await downloadRoads(area.boxes, { fetchImpl })
    if (!plausibleRoads(fresh, roads)) throw new Error(`The download looks partial: ${fresh.ways.length} ways, the stored file has ${roads.ways.length}`)
    roads = fresh
    if (!dryRun) await saveRoads(bucket, roads)
  }
  if (!roads) throw new Error('No roads file yet: download the roads first')
  const index = roadIndex(roads)

  const targets = caveId ? caves.filter(({ id }) => id === caveId) : caves
  if (caveId && !targets.length) throw new Error(`No cave ${caveId}`)
  const counts = { set: 0, removed: 0, unchanged: 0 }
  const changes = []
  for (const cave of targets) {
    const { action, value } = roadDistanceChange(index, cave)
    counts[action]++
    if (action !== 'unchanged') changes.push({ id: cave.id, action, value })
  }
  if (!dryRun) {
    for (let start = 0; start < changes.length; start += BATCH_SIZE) {
      const batch = db.batch()
      for (const { id, action, value } of changes.slice(start, start + BATCH_SIZE)) {
        batch.update(db.collection(CAVES_COLL_NAME).doc(id), { roadDistance: action === 'set' ? value : deleteField })
      }
      await batch.commit()
    }
    if (download) {
      await roadsMetaRef(db).set({
        source: 'OpenStreetMap',
        licence: 'ODbL',
        asOf: roads.downloadedAt.slice(0, 7),
        downloadedAt: roads.downloadedAt,
        bbox: bbox || null,
        ways: roads.ways.length,
        updatedAt: new Date(),
      }, { merge: true })
    }
  }
  return { counts, changes, ways: roads.ways.length, downloadedAt: roads.downloadedAt, bbox }
}

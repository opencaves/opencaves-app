import { onSchedule } from 'firebase-functions/v2/scheduler'
import { logger } from 'firebase-functions/v2'
import { defineString } from 'firebase-functions/params'
import { GoogleAuth } from 'google-auth-library'
import { db } from '../init.js'
import { CAVE_POPULARITY_COLL_NAME, CAVE_POPULARITY_DOC_ID, CAVES_COLL_NAME, REGION, SAVED_CAVES_COLL_NAME } from '../constants.js'

// How popular each cave is, for the caves' list ranked by usefulness (/caves
// with a Needs help filter, src/utils/caveRank.js): its pages' views in
// Google Analytics (GA4: /caves/<id> and /map/<id>, the last 90 days) and how
// many accounts saved it - one public document, _cavePopularity/latest,
// rebuilt nightly by refreshCavePopularity.

/**
 * The GA4 property the views are read from (its number, e.g. "123456789"):
 * set in functions/js/.env (GA_PROPERTY_ID=...). Empty: no views read, the
 * saves only (see docs/maintenance.md, "Cave popularity").
 */
export const GA_PROPERTY_ID = defineString('GA_PROPERTY_ID', { default: '', description: 'The GA4 property id whose page views rank the caves (empty: none read)' })

// Nightly, in the region's own time (after the day's visits).
const SCHEDULE = 'every day 04:00'
const TIME_ZONE = 'America/Cancun'
// The period the views are counted over (GA's relative dates).
const START_DATE = '90daysAgo'
const END_DATE = 'today'
// The pages counted: a cave's page and its place on the map.
const PATH_PREFIXES = ['/caves/', '/map/']
// Rows per request (the API's most); more are read page by page.
const PAGE_SIZE = 100000
const DATA_API = 'https://analyticsdata.googleapis.com/v1beta'
const SCOPE = 'https://www.googleapis.com/auth/analytics.readonly'

let auth = null
let warnedNoProperty = false

/**
 * The cave a page's path is about, or null: the id after /caves/ or /map/,
 * its query string, hash, trailing slash and sub-paths (/edit, /photos/...,
 * /maps/...) aside; /caves/edit (the editors' list) is no cave.
 *
 * @param {string} path - A GA pagePath ("/caves/-KPZ.../photos/abc?x=1").
 * @returns {string|null}
 */
export function caveIdOfPath(path) {
  if (typeof path !== 'string') return null
  const bare = path.split(/[?#]/)[0]
  const prefix = PATH_PREFIXES.find((start) => bare.startsWith(start))
  if (!prefix) return null
  const segment = bare.slice(prefix.length).split('/')[0]
  if (!segment || (prefix === '/caves/' && segment === 'edit')) return null
  try {
    return decodeURIComponent(segment)
  } catch {
    return null
  }
}

/**
 * The views by cave id from runReport's rows (pagePath, screenPageViews):
 * each cave's pages added up, only the ids of caveIds; keys in order.
 *
 * @param {{dimensionValues: {value: string}[], metricValues: {value: string}[]}[]} rows
 * @param {Set<string>} caveIds - The caves that exist.
 * @returns {Record<string, number>}
 */
export function viewsByCave(rows, caveIds) {
  const views = {}
  for (const row of rows || []) {
    const id = caveIdOfPath(row.dimensionValues?.[0]?.value)
    const count = Number(row.metricValues?.[0]?.value)
    if (!id || !caveIds.has(id) || !(count > 0)) continue
    views[id] = (views[id] || 0) + count
  }
  return sortedKeys(views)
}

// An object with its keys in order: the same counts, the same JSON.
const sortedKeys = (counts) => Object.fromEntries(Object.entries(counts).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)))

// The pages' views from the GA4 Data API (runReport), as rows; the
// function's own service account (Application Default Credentials), which
// needs Viewer access on the property.
async function readPageViews(propertyId) {
  auth ||= new GoogleAuth({ scopes: [SCOPE] })
  const client = await auth.getClient()
  const rows = []
  for (let offset = 0; ; offset += PAGE_SIZE) {
    const { data } = await client.request({
      url: `${DATA_API}/properties/${encodeURIComponent(propertyId)}:runReport`,
      method: 'POST',
      data: {
        dateRanges: [{ startDate: START_DATE, endDate: END_DATE }],
        dimensions: [{ name: 'pagePath' }],
        metrics: [{ name: 'screenPageViews' }],
        dimensionFilter: { orGroup: { expressions: PATH_PREFIXES.map((value) => ({ filter: { fieldName: 'pagePath', stringFilter: { matchType: 'BEGINS_WITH', value } } })) } },
        limit: PAGE_SIZE,
        offset,
      },
    })
    rows.push(...(data.rows || []))
    if (!data.rows?.length || rows.length >= (data.rowCount || 0)) return rows
  }
}

// How many accounts saved each cave (_users/{uid}/savedCaves/{caveId}),
// only the caves that exist.
async function savesByCave(caveIds) {
  const snapshot = await db.collectionGroup(SAVED_CAVES_COLL_NAME).select().get()
  const saves = {}
  snapshot.docs.forEach(({ id }) => caveIds.has(id) && (saves[id] = (saves[id] || 0) + 1))
  return sortedKeys(saves)
}

/**
 * Rebuilds _cavePopularity/latest ({ views, saves, updatedAt }) nightly:
 * the views from GA4 ({@link GA_PROPERTY_ID}'s property), the saves from
 * the accounts. Written only when they changed. GA failing: logged, the
 * document kept as it is; no property set: logged once, the saves written
 * with the document's views kept (none at first).
 */
export const refreshCavePopularity = onSchedule({ schedule: SCHEDULE, timeZone: TIME_ZONE, region: REGION }, async () => {
  const caveIds = new Set((await db.collection(CAVES_COLL_NAME).select().get()).docs.map(({ id }) => id))
  const ref = db.collection(CAVE_POPULARITY_COLL_NAME).doc(CAVE_POPULARITY_DOC_ID)
  const current = await ref.get()
  const propertyId = GA_PROPERTY_ID.value().trim()
  let views
  if (propertyId) {
    try {
      views = viewsByCave(await readPageViews(propertyId), caveIds)
    } catch (error) {
      logger.error('[popularity] Google Analytics not read: the document kept', { propertyId, message: error?.message, status: error?.response?.status })
      return
    }
  } else {
    if (!warnedNoProperty) logger.warn('[popularity] GA_PROPERTY_ID not set: no page views read, the saves only')
    warnedNoProperty = true
    views = sortedKeys(current.get('views') || {})
  }
  const saves = await savesByCave(caveIds)
  const same = (a, b) => JSON.stringify(sortedKeys(a || {})) === JSON.stringify(b)
  if (current.exists && same(current.get('views'), views) && same(current.get('saves'), saves)) {
    logger.debug('[popularity] unchanged')
    return
  }
  await ref.set({ views, saves, updatedAt: new Date() })
  logger.debug('[popularity] refreshed', { viewed: Object.keys(views).length, saved: Object.keys(saves).length })
})

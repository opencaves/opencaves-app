import { onSchedule } from 'firebase-functions/v2/scheduler'
import { logger } from 'firebase-functions/v2'
import { defineString } from 'firebase-functions/params'
import { GoogleAuth } from 'google-auth-library'
import { db } from '../init.js'
import { CAVES_COLL_NAME, POPULARITY_COLL_NAME, REGION, SAVED_CAVES_COLL_NAME } from '../constants.js'

// How popular the caves and the cave systems are, one public document per
// kind, rebuilt nightly by refreshPopularity:
//   _popularity/caves: { views, saves, updatedAt } - each cave's pages' views
//     in Google Analytics (GA4: /caves/<id> and /map/<id>, the last 90 days)
//     and how many accounts saved it;
//   _popularity/sistemas: { views, updatedAt } - each system's page views
//     (/sistemas/<id>).
// For the search fields' suggestions (the app bar's, the landing page's and
// the map's: the most visited first) - to come, src/hooks/usePopularity.js.

/**
 * The GA4 property the views are read from (its number, e.g. "123456789"):
 * set in functions/js/.env (GA_PROPERTY_ID=...). Empty: no views read, the
 * caves' saves only (see docs/maintenance.md, "Popularity").
 */
export const GA_PROPERTY_ID = defineString('GA_PROPERTY_ID', { default: '', description: 'The GA4 property id whose page views make the popularity of caves and systems (empty: none read)' })

// Nightly, in the region's own time (after the day's visits).
const SCHEDULE = 'every day 04:00'
const TIME_ZONE = 'America/Cancun'
// The period the views are counted over (GA's relative dates).
const START_DATE = '90daysAgo'
const END_DATE = 'today'
// The pages counted, and the kind of record each is about: a cave's page
// and its place on the map, a system's page.
const PATH_KINDS = { '/caves/': 'caves', '/map/': 'caves', '/sistemas/': 'sistemas' }
// The sections whose /edit is their editors' list, no record.
const LIST_EDIT = ['/caves/', '/sistemas/']
// The real site's visits only: the reports before 2026-10-11 hold the dev
// server's (localhost) and automated tests' too (docs/maintenance.md,
// "Analytics: whose visits count").
const HOST_NAMES = ['opencaves.org', 'www.opencaves.org']
// Rows per request (the API's most); more are read page by page.
const PAGE_SIZE = 100000
const DATA_API = 'https://analyticsdata.googleapis.com/v1beta'
const SCOPE = 'https://www.googleapis.com/auth/analytics.readonly'

let auth = null
let warnedNoProperty = false

/**
 * The record a page's path is about, or null: the id after /caves/, /map/
 * or /sistemas/, its query string, hash, trailing slash and sub-paths
 * (/edit, /photos/..., /maps/...) aside; /caves/edit and /sistemas/edit
 * (the editors' lists) are none.
 *
 * @param {string} path - A GA pagePath ("/caves/-KPZ.../photos/abc?x=1").
 * @returns {{kind: 'caves'|'sistemas', id: string}|null}
 */
export function recordOfPath(path) {
  if (typeof path !== 'string') return null
  const bare = path.split(/[?#]/)[0]
  const prefix = Object.keys(PATH_KINDS).find((start) => bare.startsWith(start))
  if (!prefix) return null
  const segment = bare.slice(prefix.length).split('/')[0]
  if (!segment || (LIST_EDIT.includes(prefix) && segment === 'edit')) return null
  try {
    return { kind: PATH_KINDS[prefix], id: decodeURIComponent(segment) }
  } catch {
    return null
  }
}

// An object with its keys in order: the same counts, the same JSON.
const sortedKeys = (counts) => Object.fromEntries(Object.entries(counts || {}).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)))

/**
 * The views by kind and id from runReport's rows (pagePath,
 * screenPageViews): each record's pages added up, only the ids of the
 * records that exist; keys in order.
 *
 * @param {{dimensionValues: {value: string}[], metricValues: {value: string}[]}[]} rows
 * @param {{caves: Set<string>, sistemas: Set<string>}} ids - The records that exist, by kind.
 * @returns {{caves: Record<string, number>, sistemas: Record<string, number>}}
 */
export function viewsByRecord(rows, ids) {
  const views = { caves: {}, sistemas: {} }
  for (const row of rows || []) {
    const record = recordOfPath(row.dimensionValues?.[0]?.value)
    const count = Number(row.metricValues?.[0]?.value)
    if (!record || !ids[record.kind].has(record.id) || !(count > 0)) continue
    views[record.kind][record.id] = (views[record.kind][record.id] || 0) + count
  }
  return { caves: sortedKeys(views.caves), sistemas: sortedKeys(views.sistemas) }
}

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
        dimensionFilter: {
          andGroup: {
            expressions: [
              { orGroup: { expressions: Object.keys(PATH_KINDS).map((value) => ({ filter: { fieldName: 'pagePath', stringFilter: { matchType: 'BEGINS_WITH', value } } })) } },
              { filter: { fieldName: 'hostName', inListFilter: { values: HOST_NAMES } } },
            ],
          },
        },
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

// Writes a kind's document (counts: its views, and saves) unless it already
// has these counts: no write, so the open pages aren't sent the same again.
async function saveCounts(kind, counts, current) {
  const same = Object.entries(counts).every(([field, value]) => JSON.stringify(sortedKeys(current.get(field))) === JSON.stringify(value))
  if (current.exists && same) return false
  await db.collection(POPULARITY_COLL_NAME).doc(kind).set({ ...counts, updatedAt: new Date() })
  return true
}

/**
 * Rebuilds the popularity documents nightly (_popularity/caves: views,
 * saves; _popularity/sistemas: views; see the top of this file): the views
 * from one GA4 report ({@link GA_PROPERTY_ID}'s property), the saves from
 * the accounts. Each written only when it changed. GA failing: logged, both
 * kept as they are; no property set: logged once, the caves' saves written
 * with the documents' views kept (none at first).
 */
export const refreshPopularity = onSchedule({ schedule: SCHEDULE, timeZone: TIME_ZONE, region: REGION }, async () => {
  const [caveIds, sistemaIds] = await Promise.all([CAVES_COLL_NAME, 'sistemas'].map(async (name) => new Set((await db.collection(name).select().get()).docs.map(({ id }) => id))))
  const [currentCaves, currentSistemas] = await Promise.all(['caves', 'sistemas'].map((kind) => db.collection(POPULARITY_COLL_NAME).doc(kind).get()))
  const propertyId = GA_PROPERTY_ID.value().trim()
  let views
  if (propertyId) {
    try {
      views = viewsByRecord(await readPageViews(propertyId), { caves: caveIds, sistemas: sistemaIds })
    } catch (error) {
      logger.error('[popularity] Google Analytics not read: the documents kept', { propertyId, message: error?.message, status: error?.response?.status })
      return
    }
  } else {
    if (!warnedNoProperty) logger.warn("[popularity] GA_PROPERTY_ID not set: no page views read, the caves' saves only")
    warnedNoProperty = true
    views = { caves: sortedKeys(currentCaves.get('views')), sistemas: sortedKeys(currentSistemas.get('views')) }
  }
  const saves = await savesByCave(caveIds)
  const written = {
    caves: await saveCounts('caves', { views: views.caves, saves }, currentCaves),
    // Not written while there are no views to keep (no property set yet).
    sistemas: propertyId || currentSistemas.exists ? await saveCounts('sistemas', { views: views.sistemas }, currentSistemas) : false,
  }
  logger.debug('[popularity] refreshed', { caves: Object.keys(views.caves).length, saved: Object.keys(saves).length, sistemas: Object.keys(views.sistemas).length, written })
})

import { onSchedule } from 'firebase-functions/v2/scheduler'
import { logger } from 'firebase-functions/v2'
import { REGION, SITE_URL } from '../constants.js'

// The page functions (indexPages, cavePage) kept warm: an instance that has
// to start first took 2 to 6.6 s to answer (Lighthouse, 2026-10-12), every
// cold page's visitor and search engine waiting for it. keepPagesWarm asks
// each for a ping every few minutes, through the site (the Hosting rewrites,
// as a visitor): `?warm=<time>` on a page's address, answered 204 before
// anything is read or rendered (isWarmPing) - no Firestore read, no rendering.
//
// The CDN never answers in their place: the query string is part of its
// cache key, and each ping's is new (firebase.json's headers give these
// addresses an hour's s-maxage, whatever the function says); the request
// also says no-cache, and the 204 no-store. Cost: one Cloud Scheduler job (3 are free per
// billing account: this is the third, after refreshWhatsNew and
// refreshPopularity) and ~2 x 288 short invocations a day (docs/maintenance.md).

// How often: Cloud Run keeps an idle instance some minutes (not promised).
const SCHEDULE = 'every 5 minutes'
// One address per function (firebase.json's rewrites): / (indexPages) and a
// cave's place on the map (cavePage; no such cave needed, the ping answers first).
const PING_PATHS = ['/', '/map/warm']

/**
 * Whether the request is keepPagesWarm's ping (`?warm=...`, a GET).
 *
 * @param {import('express').Request} req
 * @returns {boolean}
 */
export function isWarmPing(req) {
  return req.method === 'GET' && req.query?.warm !== undefined
}

/**
 * Answers keepPagesWarm's ping: 204, never cached.
 *
 * @param {import('express').Response} res
 */
export function answerWarmPing(res) {
  res.set('Cache-Control', 'no-store')
  res.status(204).end()
}

/**
 * Every 5 minutes, pings the page functions through the site ({@link PING_PATHS},
 * with a new `?warm=` each time), so an instance of each stays started.
 */
export const keepPagesWarm = onSchedule({ schedule: SCHEDULE, region: REGION, retryCount: 0 }, async () => {
  const warm = Date.now().toString(36)
  await Promise.all(PING_PATHS.map(async (path) => {
    const started = Date.now()
    try {
      const response = await fetch(`${SITE_URL}${path}?warm=${warm}`, { cache: 'no-store', headers: { 'Cache-Control': 'no-cache', Pragma: 'no-cache' } })
      if (response.status !== 204) logger.warn('[keepPagesWarm] unexpected answer', { path, status: response.status })
      else logger.debug('[keepPagesWarm] pinged', { path, ms: Date.now() - started })
    } catch (error) {
      logger.warn('[keepPagesWarm] ping failed', { path, error: error.message })
    }
  }))
})

import { onRequest } from 'firebase-functions/v2/https'
import { defineSecret } from 'firebase-functions/params'
import { logger } from 'firebase-functions/v2'
import { db } from '../init.js'
import { CAVES_COLL_NAME, REGION } from '../constants.js'

// The Google Geocoding key stays on the server (a Functions secret): the
// Geocoding API can't be restricted to the site's URLs, so a key shipped in
// the app could be used by anyone.
export const GOOGLE_GEOCODING_API_KEY = defineSecret('GOOGLE_GEOCODING_API_KEY')

// The kinds of address shown, best first.
const RESULT_TYPES = ['street_address', 'route', 'postal_code', 'natural_feature', 'park', 'point_of_interest']
const CAVE_ID_PATTERN = /^[-_A-Za-z0-9]{1,64}$/
const LANGUAGE_PATTERN = /^[a-z]{2,3}(-[A-Za-z]{2,4})?$/
// An address doesn't change: a day in browsers, a month at the CDN, so each
// cave costs one Google request per language and month at most. Hosting
// sets the same for /api/address/ (firebase.json): its rule for paths
// without an extension would otherwise make them no-cache.
const CACHE_FOUND = 'public, max-age=86400, s-maxage=2592000'
const CACHE_NONE = 'public, max-age=3600, s-maxage=86400'

// GET /api/address/<caveId>?lang=<language> -> { address } (null when there
// is none). It takes a cave's id, not coordinates, so it can only ever look
// up the caves' own positions - nobody can run their geocoding through it.
export const caveAddress = onRequest({ region: REGION, secrets: [GOOGLE_GEOCODING_API_KEY], maxInstances: 5 }, async (req, res) => {
  const caveId = decodeURIComponent(req.path.split('/').filter(Boolean).pop() || '')
  const language = String(req.query.lang || 'en')
  if (req.method !== 'GET' || !CAVE_ID_PATTERN.test(caveId) || !LANGUAGE_PATTERN.test(language)) {
    res.status(400).set('Cache-Control', 'no-store').json({ error: 'bad request' })
    return
  }

  const cave = await db.collection(CAVES_COLL_NAME).doc(caveId).get()
  const { latitude, longitude } = cave.get('location') || {}
  if (typeof latitude !== 'number' || typeof longitude !== 'number') {
    res.status(cave.exists ? 200 : 404).set('Cache-Control', CACHE_NONE).json({ address: null })
    return
  }

  const url = new URL('https://maps.googleapis.com/maps/api/geocode/json')
  url.search = new URLSearchParams({ latlng: `${latitude},${longitude}`, language, result_type: RESULT_TYPES.join('|'), key: GOOGLE_GEOCODING_API_KEY.value() })
  const data = await (await fetch(url)).json()

  if (data.status !== 'OK' && data.status !== 'ZERO_RESULTS') {
    logger.error('[caveAddress] Google Geocoding failed', { caveId, status: data.status, message: data.error_message })
    res.status(502).set('Cache-Control', 'no-store').json({ error: data.status })
    return
  }

  const results = data.results || []
  const best = RESULT_TYPES.map((type) => results.find((result) => result.types.includes(type))).find(Boolean)
  res.set('Cache-Control', best ? CACHE_FOUND : CACHE_NONE).json({ address: best?.formatted_address || null })
})

import { onRequest } from 'firebase-functions/v2/https'
import { REGION, CAVES_COLL_NAME } from '../constants.js'
import { db } from '../init.js'

const SITE_URL = 'https://opencaves.org'

function escapeXml(value) {
  return value.replace(/[<>&'"]/g, (char) => ({
    '<': '&lt;',
    '>': '&gt;',
    '&': '&amp;',
    "'": '&apos;',
    '"': '&quot;',
  })[char])
}

function buildSitemap(urls) {
  const urlEntries = urls
    .map((loc) => `  <url>\n    <loc>${escapeXml(loc)}</loc>\n  </url>`)
    .join('\n')

  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urlEntries}\n</urlset>\n`
}

export const sitemap = onRequest({ region: REGION }, async (req, res) => {
  const caveRefs = await db.collection(CAVES_COLL_NAME).listDocuments()
  const caveIds = caveRefs.map((ref) => ref.id)

  const urls = [
    `${SITE_URL}/`,
    `${SITE_URL}/map`,
    ...caveIds.map((id) => `${SITE_URL}/map/${id}`),
  ]

  res.set('Content-Type', 'application/xml')
  // Search-engine crawlers, not people, hit this - cache briefly so a burst
  // of crawler requests doesn't hit Firestore on every one, without leaving
  // a stale CDN-edge copy around for too long after cave data changes.
  res.set('Cache-Control', 'public, max-age=600')
  res.send(buildSitemap(urls))
})

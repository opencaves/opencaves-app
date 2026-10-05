import { onRequest } from 'firebase-functions/v2/https'
import { REGION, CAVES_COLL_NAME } from '../constants.js'
import { db } from '../init.js'
import { loadIndexData } from '../seo/indexData.js'

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

// urls: [{ loc, lastmod? }], lastmod as a W3C date (YYYY-MM-DD).
function buildSitemap(urls) {
  const urlEntries = urls
    .map(({ loc, lastmod }) => `  <url>\n    <loc>${escapeXml(loc)}</loc>${lastmod ? `\n    <lastmod>${lastmod}</lastmod>` : ''}\n  </url>`)
    .join('\n')

  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urlEntries}\n</urlset>\n`
}

export const sitemap = onRequest({ region: REGION }, async (req, res) => {
  // select() with no fields returns only document metadata - cheap, and it
  // includes each cave's last write time, for lastmod.
  const [caves, { areas, sistemas }] = await Promise.all([db.collection(CAVES_COLL_NAME).select().get(), loadIndexData()])
  const day = (timestamp) => timestamp.toDate().toISOString().slice(0, 10)

  // Canonical URLs only: / is the landing page.
  const urls = [
    { loc: `${SITE_URL}/` },
    { loc: `${SITE_URL}/map` },
    ...caves.docs.map((doc) => ({ loc: `${SITE_URL}/map/${doc.id}`, lastmod: day(doc.updateTime) })),
    // Each cave's own page too (/caves/<id>, indexPages.js).
    ...caves.docs.map((doc) => ({ loc: `${SITE_URL}/caves/${doc.id}`, lastmod: day(doc.updateTime) })),
    // The index pages (seo/indexPages.js): areas with nothing in them aren't listed.
    { loc: `${SITE_URL}/caves` },
    { loc: `${SITE_URL}/sistemas` },
    ...areas.filter((area) => area.caves.length || area.sistemas.length).map((area) => ({ loc: `${SITE_URL}/areas/${area.slug}` })),
    ...sistemas.map((sistema) => ({ loc: `${SITE_URL}/sistemas/${sistema.slug}`, lastmod: day(sistema.updateTime) })),
    { loc: `${SITE_URL}/about` },
    { loc: `${SITE_URL}/privacy` },
    { loc: `${SITE_URL}/terms` },
  ]

  res.set('Content-Type', 'application/xml')
  // Search-engine crawlers, not people, hit this - cache briefly so a burst
  // of crawler requests doesn't hit Firestore on every one, without leaving
  // a stale CDN-edge copy around for too long after cave data changes.
  res.set('Cache-Control', 'public, max-age=600')
  res.send(buildSitemap(urls))
})

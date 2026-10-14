import { onRequest } from 'firebase-functions/v2/https'
import { REGION, CAVES_ASSETS_COLL_NAME, CAVES_COLL_NAME, SITE_URL } from '../constants.js'
import { db } from '../init.js'
import { loadIndexData } from '../seo/indexData.js'

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

const hasText = (value) => typeof value === 'string' && value.trim() !== ''

/**
 * Whether a cave's page is listed in the sitemap: documented - a photo, a
 * description or directions. The others (a name and coordinates at most)
 * stay reachable by links (the lists, the home page, Nearby caves) and
 * indexable, but search engines' first reads go to the pages that can rank;
 * a cave enters the sitemap as soon as one of these is added.
 *
 * @param {{description?: string, direction?: string}} cave
 * @param {boolean} hasPhoto - It has a photo outside the trash.
 * @returns {boolean}
 */
export function listedCave(cave, hasPhoto) {
  return hasPhoto || hasText(cave.description) || hasText(cave.direction)
}

/**
 * Whether a system's page is listed in the sitemap: a description, survey
 * maps, an exploration history, its length or depth, or several caves.
 *
 * @param {object} sistema
 * @param {number} caveCount - Its caves.
 * @returns {boolean}
 */
export function listedSistema(sistema, caveCount) {
  return hasText(sistema.description) || (Array.isArray(sistema.maps) && sistema.maps.length > 0) || (Array.isArray(sistema.explorations) && sistema.explorations.length > 0) || Number(sistema.exploredLength) > 0 || Number(sistema.maxDepth) > 0 || caveCount > 1
}

export const sitemap = onRequest({ region: REGION }, async (req, res) => {
  // The caves' texts and their last write time (lastmod); which have a
  // photo (any image outside the trash); the systems and their caves.
  const [caves, photos, { sistemas, caves: indexCaves }] = await Promise.all([
    db.collection(CAVES_COLL_NAME).select('description', 'direction').get(),
    db.collection(CAVES_ASSETS_COLL_NAME).where('type', '==', 'image').select('caveId', 'deletedAt').get(),
    loadIndexData(),
  ])
  const day = (timestamp) => timestamp.toDate().toISOString().slice(0, 10)
  const withPhoto = new Set(photos.docs.filter((doc) => !doc.get('deletedAt')).map((doc) => doc.get('caveId')))
  const cavesIn = new Map()
  indexCaves.forEach(({ sistemaId }) => sistemaId && cavesIn.set(sistemaId, (cavesIn.get(sistemaId) || 0) + 1))

  // Canonical URLs only: / is the landing page.
  const urls = [
    { loc: `${SITE_URL}/` },
    { loc: `${SITE_URL}/map` },
    // Each cave by its own page (/caves/<id>, indexPages.js) - its place on
    // the map (/map/<id>) names that page as its canonical.
    // Documented ones only (listedCave).
    ...caves.docs.filter((doc) => listedCave(doc.data(), withPhoto.has(doc.id))).map((doc) => ({ loc: `${SITE_URL}/caves/${doc.id}`, lastmod: day(doc.updateTime) })),
    // The index pages (seo/indexPages.js); an area has no page of its own.
    { loc: `${SITE_URL}/caves` },
    { loc: `${SITE_URL}/sistemas` },
    ...sistemas.filter((sistema) => listedSistema(sistema, cavesIn.get(sistema.id) || 0)).map((sistema) => ({ loc: `${SITE_URL}/sistemas/${sistema.slug}`, lastmod: day(sistema.updateTime) })),
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

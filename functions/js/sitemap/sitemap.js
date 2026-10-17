import { onRequest } from 'firebase-functions/v2/https'
import { REGION, BUCKET_NAME, CAVES_ASSETS_COLL_NAME, CAVES_COLL_NAME, SITE_URL, THUMBNAILS_FOLDER } from '../constants.js'
import { db } from '../init.js'
import { loadIndexData } from '../seo/indexData.js'
import { orderPhotos } from '../assets/photoOrder.js'
import { storageUrl } from '../share/shareImages.js'

// A cave page's photos in the sitemap (Google's image extension): those its
// photo strip shows, in its order (src/components/IndexPage/CavePhotosSection.jsx's
// MAX_PHOTOS; Google takes up to 1,000 a page), each by its 1536 px copy -
// the gallery's (resize-images/config.js: made for every photo, public, no
// token), as the share images use.
const SITEMAP_PHOTOS_MAX = 12
const SITEMAP_PHOTO_SIZE = '1536'

function escapeXml(value) {
  return value.replace(/[<>&'"]/g, (char) => ({
    '<': '&lt;',
    '>': '&gt;',
    '&': '&amp;',
    "'": '&apos;',
    '"': '&quot;',
  })[char])
}

// urls: [{ loc, lastmod?, images? }], lastmod as a W3C date (YYYY-MM-DD),
// images the page's photos' URLs (image:loc only: Google dropped the
// extension's caption, title and the rest in 2022).
function buildSitemap(urls) {
  const urlEntries = urls
    .map(({ loc, lastmod, images = [] }) => [
      `  <url>\n    <loc>${escapeXml(loc)}</loc>`,
      lastmod ? `\n    <lastmod>${lastmod}</lastmod>` : '',
      ...images.map((image) => `\n    <image:image>\n      <image:loc>${escapeXml(image)}</image:loc>\n    </image:image>`),
      '\n  </url>',
    ].join(''))
    .join('\n')

  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">\n${urlEntries}\n</urlset>\n`
}

/**
 * A cave page's photos for the sitemap: the URLs of those its photo strip
 * shows ({@link SITEMAP_PHOTOS_MAX}), its cover first, then the others in
 * the page's order ({@link orderPhotos}) - each its 1536 px copy (its
 * revision's, when redone).
 *
 * @param {import('firebase-admin/firestore').QueryDocumentSnapshot[]} docs - The cave's photos outside the trash.
 * @param {string[]} [order] - The cave's `photoOrder`.
 * @returns {string[]}
 */
export function sitemapPhotos(docs, order) {
  const cover = docs.find((doc) => doc.get('isCover'))
  const photos = [...(cover ? [cover] : []), ...orderPhotos(docs.filter((doc) => doc !== cover), order)]
  return photos.slice(0, SITEMAP_PHOTOS_MAX).map((doc) => {
    const revision = doc.get('thumbnailRevision') > 1 ? `-r${doc.get('thumbnailRevision')}` : ''
    return storageUrl(BUCKET_NAME, `caves/${doc.get('caveId')}/${THUMBNAILS_FOLDER}/${doc.id}_${SITEMAP_PHOTO_SIZE}${revision}.webp`)
  })
}

const hasText = (value) => typeof value === 'string' && value.trim() !== ''
const hasItems = (value) => Array.isArray(value) && value.length > 0

/**
 * Whether a cave's page is listed in the sitemap: documented - a photo, a
 * description, directions or Further reading. The others (a name and coordinates at most)
 * stay reachable by links (the lists, the home page, Nearby caves) and
 * indexable, but search engines' first reads go to the pages that can rank;
 * a cave enters the sitemap as soon as one of these is added.
 *
 * @param {{description?: string, direction?: string, documents?: string[]}} cave
 * @param {boolean} hasPhoto - It has a photo outside the trash.
 * @returns {boolean}
 */
export function listedCave(cave, hasPhoto) {
  return hasPhoto || hasText(cave.description) || hasText(cave.direction) || hasItems(cave.documents)
}

/**
 * Whether a system's page is listed in the sitemap: a description, survey
 * maps, Further reading, an exploration history, its length or depth, or
 * several caves.
 *
 * @param {object} sistema
 * @param {number} caveCount - Its caves.
 * @returns {boolean}
 */
export function listedSistema(sistema, caveCount) {
  return hasText(sistema.description) || hasItems(sistema.maps) || hasItems(sistema.documents) || (Array.isArray(sistema.explorations) && sistema.explorations.length > 0) || Number(sistema.exploredLength) > 0 || Number(sistema.maxDepth) > 0 || caveCount > 1
}

export const sitemap = onRequest({ region: REGION }, async (req, res) => {
  // The caves' texts, their photos' order and their last write time
  // (lastmod); their photos (images outside the trash); the systems and
  // their caves.
  const [caves, photos, { sistemas, caves: indexCaves }] = await Promise.all([
    db.collection(CAVES_COLL_NAME).select('description', 'direction', 'documents', 'photoOrder').get(),
    db.collection(CAVES_ASSETS_COLL_NAME).where('type', '==', 'image').select('caveId', 'deletedAt', 'isCover', 'date', 'thumbnailRevision').get(),
    loadIndexData(),
  ])
  const day = (timestamp) => timestamp.toDate().toISOString().slice(0, 10)
  const photosOf = new Map()
  photos.docs.filter((doc) => !doc.get('deletedAt')).forEach((doc) => {
    const caveId = doc.get('caveId')
    if (!photosOf.has(caveId)) photosOf.set(caveId, [])
    photosOf.get(caveId).push(doc)
  })
  const cavesIn = new Map()
  indexCaves.forEach(({ sistemaId }) => sistemaId && cavesIn.set(sistemaId, (cavesIn.get(sistemaId) || 0) + 1))

  // Canonical URLs only: / is the landing page.
  const urls = [
    { loc: `${SITE_URL}/` },
    { loc: `${SITE_URL}/map` },
    // Each cave by its own page (/caves/<id>, indexPages.js) - its place on
    // the map (/map/<id>) names that page as its canonical.
    // Documented ones only (listedCave), with their photos.
    ...caves.docs.filter((doc) => listedCave(doc.data(), photosOf.has(doc.id))).map((doc) => ({ loc: `${SITE_URL}/caves/${doc.id}`, lastmod: day(doc.updateTime), images: sitemapPhotos(photosOf.get(doc.id) || [], doc.get('photoOrder')) })),
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

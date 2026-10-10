import { onRequest } from 'firebase-functions/v2/https'
import { logger } from 'firebase-functions/v2'
import { REGION, CAVES_COLL_NAME } from '../constants.js'
import { db } from '../init.js'
import { APP_TITLE, SITE_URL } from '../constants.js'
import { escapeHtml, jsonLdScript, plainParagraphs, renderPage, sendHtml, shellFor, truncate } from './shared.js'
import { loadSistemaSlugs } from './indexData.js'
import { slugify } from './slug.js'

// A cave's page (/map/<caveId>) served with its content already in the HTML,
// for search engines and link previews: Google's renderer didn't run the app
// (it indexed an empty loading screen), so it gets the cave's title,
// description, canonical link and structured data in <head>, and its text in
// #root - which the app replaces when it starts, reusing the same <head> tags
// (headTags.js): visitors see the same page as before. The page is the site's
// own index.html (shared.js's shellFor). It links to the cave's area and
// system pages and to /caves, so crawlers reach those too.

/**
 * sistema: the cave's system ({ name, slug }), if any; path: the page's
 * address - /map/<id> (here), or /caves/<id>, its own page (indexPages.js).
 * Both are known to search engines by its own page: one URL per cave, not two
 * near-identical pages (Google skipped them as duplicates).
 * {@link cavePageMeta}: the page's <head> data and its text (body); cavePageHtml: the
 * page itself. structuredData: in the text (body), and in <head> when the
 * app renders the page (ssr.js).
 *
 * @param {string} shell
 * @param {object} cave
 * @param {string} id
 * @param {{name: string, slug: string}} [sistema]
 * @param {string} [path]
 * @returns {string}
 */
export function cavePageHtml(shell, cave, id, sistema, path = `/map/${id}`) {
  return renderPage(shell, cavePageMeta(cave, id, sistema, path))
}

export function cavePageMeta(cave, id, sistema, path = `/map/${id}`) {
  const area = cave.area || null
  const name = cave.name?.value || ''
  // Its name alone, as the app's titles (no "Cenote" prefix: "Cenote Cenote
  // Theater", and not every cave is a cenote). No name: in parentheses - a
  // placeholder, not a name (as the app's page); the description's sentence
  // doesn't.
  const label = name || '(Unnamed cave)'
  const paragraphs = plainParagraphs(cave.description)
  const summary = paragraphs.join(' ')
  const subject = name ? label : 'An unnamed cave'
  // As the app's (seo.caveDescriptionPrefix / caveDescriptionFallback).
  const description = truncate(summary ? `${subject} (Yucatán, Mexico): ${summary}` : `${subject}, a cave in the Yucatán, Mexico: location, access, pictures and maps on OpenCaves.`)
  const title = `${label} / ${APP_TITLE}`
  const canonical = `/caves/${id}`
  const url = `${SITE_URL}${canonical}`
  const aka = Array.isArray(cave.aka) ? cave.aka.filter(Boolean) : []
  const location = cave.location?.latitude != null ? cave.location : null
  const structuredData = {
    '@context': 'https://schema.org',
    '@type': 'TouristAttraction',
    name: name || label,
    description,
    url,
    address: { '@type': 'PostalAddress', addressCountry: 'MX' },
    ...(aka.length && { alternateName: aka }),
    ...(location && { geo: { '@type': 'GeoCoordinates', latitude: location.latitude, longitude: location.longitude } }),
  }

  const body = [
    `<main class="oc-ssr-cave">`,
    `<h1>${escapeHtml(label)}</h1>`,
    aka.length ? `<p>Also known as ${escapeHtml(aka.join(', '))}</p>` : '',
    location ? `<p>Location: ${Number(location.latitude).toFixed(5)}, ${Number(location.longitude).toFixed(5)} (Yucatán, Mexico)</p>` : '',
    ...paragraphs.map((p) => `<p>${escapeHtml(p)}</p>`),
    // How to get there, as the cave page shows it.
    ...(cave.direction ? [`<h2>Getting there</h2>`, ...plainParagraphs(cave.direction).map((p) => `<p>${escapeHtml(p)}</p>`)] : []),
    area ? `<p>Area: <a href="/caves#${escapeHtml(slugify(area))}">${escapeHtml(area)}</a></p>` : '',
    sistema ? `<p>Cave system: <a href="/sistemas/${escapeHtml(sistema.slug)}">${escapeHtml(sistema.name)}</a></p>` : '',
    path === `/map/${id}` ? `<p><a href="/caves/${escapeHtml(id)}">${escapeHtml(label)}'s page</a></p>` : `<p><a href="/map/${escapeHtml(id)}">${escapeHtml(label)} on the map</a></p>`,
    `<p><a href="/map">The OpenCaves map of the cenotes of the Yucatán</a> · <a href="/caves">All the caves by area</a></p>`,
    jsonLdScript(structuredData),
    `</main>`,
  ].filter(Boolean).join('\n')

  // Its breadcrumbs: its page under the caves and its area; its place on the map under the map.
  const trail = path.startsWith('/caves/')
    ? [{ name: 'Home', path: '/' }, { name: 'Caves', path: '/caves' }, ...(area ? [{ name: area, path: `/caves#${slugify(area)}` }] : []), { name: name || label, path }]
    : [{ name: 'Home', path: '/' }, { name: 'Map', path: '/map' }, { name: name || label, path }]
  return { title, description, path, canonical, body, ogType: 'place', trail, structuredData }
}

// A cave id as the app makes them (push ids): anything else is no cave - and
// can't carry markup into the page.
const CAVE_ID_PATTERN = /^[-_A-Za-z0-9]{1,64}$/

/**
 * /map/<caveId>, server-rendered for search engines ({@link cavePageHtml}).
 */
export const cavePage = onRequest({ region: REGION }, async (req, res) => {
  let id = ''
  try {
    id = decodeURIComponent((req.path.match(/^\/map\/([^/]+)\/?$/) || [])[1] || '')
  } catch {
    id = ''
  }
  if (!CAVE_ID_PATTERN.test(id)) id = ''
  let shell
  try {
    shell = await shellFor(req)
  } catch (error) {
    logger.error('[cavePage] the app shell could not be fetched', { error: error.message })
    res.redirect(302, '/map')
    return
  }

  const snapshot = id ? await db.collection(CAVES_COLL_NAME).doc(id).get() : null
  res.set('Content-Type', 'text/html; charset=utf-8')
  if (!snapshot?.exists) {
    // The app shows its own "not found"; search engines get the status.
    res.set('Cache-Control', 'public, max-age=60')
    sendHtml(req, res, shell, 404)
    return
  }
  // Short in browsers (the app is the page they use), longer at the CDN edge:
  // a cave's edit shows up within the hour.
  res.set('Cache-Control', 'public, max-age=300, s-maxage=3600')
  const cave = snapshot.data()
  let sistema = null
  if (cave.sistemaId) {
    const { slugs, names } = await loadSistemaSlugs()
    if (names.has(cave.sistemaId)) sistema = { name: names.get(cave.sistemaId), slug: slugs.get(cave.sistemaId) }
  }
  sendHtml(req, res, cavePageHtml(shell, cave, id, sistema))
})

import { onRequest } from 'firebase-functions/v2/https'
import { logger } from 'firebase-functions/v2'
import { REGION, CAVES_COLL_NAME } from '../constants.js'
import { db } from '../init.js'
import { APP_TITLE, SITE_URL, escapeHtml, jsonLdScript, plainParagraphs, renderPage, shellFor, truncate } from './shared.js'
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

// sistema: the cave's system ({ name, slug }), if any.
function cavePageHtml(shell, cave, id, sistema) {
  const area = cave.area || null
  const name = cave.name?.value || ''
  // As in the index pages (indexPages.js): an unnamed cave isn't "Cenote Cenote".
  const label = name ? `Cenote ${name}` : 'Unnamed cenote'
  const paragraphs = plainParagraphs(cave.description)
  const summary = paragraphs.join(' ')
  const description = truncate(summary ? `${label} (Yucatán, Mexico): ${summary}` : `${label} in the Yucatán, Mexico: location, access, pictures and maps on OpenCaves.`)
  const title = `${label} / ${APP_TITLE}`
  const url = `${SITE_URL}/map/${id}`
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
    area ? `<p>Area: <a href="/areas/${escapeHtml(slugify(area))}">${escapeHtml(area)}</a></p>` : '',
    sistema ? `<p>Cave system: <a href="/sistemas/${escapeHtml(sistema.slug)}">${escapeHtml(sistema.name)}</a></p>` : '',
    `<p><a href="/map">The OpenCaves map of the cenotes of the Yucatán</a> · <a href="/caves">All the caves by area</a></p>`,
    jsonLdScript(structuredData),
    `</main>`,
  ].filter(Boolean).join('\n')

  return renderPage(shell, { title, description, path: `/map/${id}`, body, ogType: 'place' })
}

// A cave id as the app makes them (push ids): anything else is no cave - and
// can't carry markup into the page.
const CAVE_ID_PATTERN = /^[-_A-Za-z0-9]{1,64}$/

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
    res.status(404).send(shell)
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
  res.send(cavePageHtml(shell, cave, id, sistema))
})

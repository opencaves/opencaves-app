import { onRequest } from 'firebase-functions/v2/https'
import { logger } from 'firebase-functions/v2'
import { REGION, CAVES_COLL_NAME } from '../constants.js'
import { db } from '../init.js'

// A cave's page (/map/<caveId>) served with its content already in the HTML,
// for search engines and link previews: Google's renderer didn't run the app
// (it indexed an empty loading screen), so it gets the cave's title,
// description, canonical link and structured data in <head>, and its text in
// #root - which the app replaces when it starts, reusing the same <head> tags
// (headTags.js): visitors see the same page as before. The page is the site's
// own index.html, fetched from the host serving the request (a preview channel
// has its own build), cached briefly.
const SITE_URL = 'https://opencaves.org'
const APP_TITLE = 'Open Caves'
const SHELL_TTL_MS = 5 * 60 * 1000

const shells = new Map()

async function shellFor(origin) {
  const cached = shells.get(origin)
  if (cached && Date.now() - cached.at < SHELL_TTL_MS) return cached.html
  const response = await fetch(`${origin}/index.html`)
  if (!response.ok) throw new Error(`index.html: ${response.status}`)
  const html = await response.text()
  shells.set(origin, { html, at: Date.now() })
  return html
}

const escapeHtml = (value) => String(value).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c])

// The app's Markdown as plain text (as src/utils/seo.js's markdownToPlainText),
// paragraph breaks kept.
function plainParagraphs(markdown = '') {
  return String(markdown)
    .replace(/:length\[([^\]]*)]/g, '$1')
    .replace(/!\[[^\]]*]\([^)]*\)/g, '')
    .replace(/\[([^\]]*)]\([^)]*\)/g, '$1')
    .replace(/^\s{0,3}(#{1,6}|>|[-*+]|\d+\.)\s+/gm, '')
    .replace(/[*_~`]+/g, '')
    .split(/\n\s*\n/)
    .map((p) => p.replace(/\s+/g, ' ').trim())
    .filter(Boolean)
}

// Cuts at a word boundary, for search-result snippets (as seo.js's truncate).
function truncate(text, max = 158) {
  if (text.length <= max) return text
  const cut = text.slice(0, max - 1)
  return `${cut.slice(0, cut.lastIndexOf(' ') > max * 0.6 ? cut.lastIndexOf(' ') : cut.length).replace(/[\s,.;:–-]+$/, '')}…`
}

function cavePageHtml(shell, cave, id) {
  const name = cave.name?.value || 'Cenote'
  const paragraphs = plainParagraphs(cave.description)
  const summary = paragraphs.join(' ')
  const description = truncate(summary ? `Cenote ${name} (Yucatán, Mexico): ${summary}` : `Cenote ${name} in the Yucatán, Mexico: location, access, pictures and maps on OpenCaves.`)
  const title = `Cenote ${name} / ${APP_TITLE}`
  const url = `${SITE_URL}/map/${id}`
  const aka = Array.isArray(cave.aka) ? cave.aka.filter(Boolean) : []
  const location = cave.location?.latitude != null ? cave.location : null
  const structuredData = {
    '@context': 'https://schema.org',
    '@type': 'TouristAttraction',
    name,
    description,
    url,
    address: { '@type': 'PostalAddress', addressCountry: 'MX' },
    ...(aka.length && { alternateName: aka }),
    ...(location && { geo: { '@type': 'GeoCoordinates', latitude: location.latitude, longitude: location.longitude } }),
  }

  const head = [
    `<title>${escapeHtml(title)}</title>`,
    `<meta name="description" content="${escapeHtml(description)}" />`,
    `<link rel="canonical" href="${escapeHtml(url)}" />`,
    `<meta property="og:type" content="place" />`,
    `<meta property="og:site_name" content="${APP_TITLE}" />`,
    `<meta property="og:title" content="${escapeHtml(title)}" />`,
    `<meta property="og:description" content="${escapeHtml(description)}" />`,
    `<meta property="og:url" content="${escapeHtml(url)}" />`,
  ].join('\n  ')

  const body = [
    `<main class="oc-ssr-cave">`,
    `<h1>Cenote ${escapeHtml(name)}</h1>`,
    aka.length ? `<p>Also known as ${escapeHtml(aka.join(', '))}</p>` : '',
    location ? `<p>Location: ${Number(location.latitude).toFixed(5)}, ${Number(location.longitude).toFixed(5)} (Yucatán, Mexico)</p>` : '',
    ...paragraphs.map((p) => `<p>${escapeHtml(p)}</p>`),
    `<p><a href="/map">The OpenCaves map of the cenotes of the Yucatán</a></p>`,
    `<script type="application/ld+json">${JSON.stringify(structuredData).replace(/</g, '\\u003c')}</script>`,
    `</main>`,
  ].filter(Boolean).join('\n')

  return shell
    // The shell's own title and description give way to the cave's.
    .replace(/<title>[^<]*<\/title>\s*/i, '')
    .replace(/<meta name="description"[^>]*>\s*/i, '')
    .replace(/<head>/i, `<head>\n  ${head}`)
    .replace('<div id="root"></div>', `<div id="root">${body}</div>`)
}

// A cave id as the app makes them (push ids): anything else is no cave - and
// can't carry markup into the page.
const CAVE_ID_PATTERN = /^[-_A-Za-z0-9]{1,64}$/
// The hosts whose index.html may serve as the page: the site and this
// project's Hosting domains (preview channels: opencaves--<channel>-<hash>).
const ALLOWED_HOST_PATTERN = /^(opencaves\.org|www\.opencaves\.org|opencaves(--[-a-z0-9]+)?\.(web\.app|firebaseapp\.com))$/

export const cavePage = onRequest({ region: REGION }, async (req, res) => {
  let id = ''
  try {
    id = decodeURIComponent((req.path.match(/^\/map\/([^/]+)\/?$/) || [])[1] || '')
  } catch {
    id = ''
  }
  if (!CAVE_ID_PATTERN.test(id)) id = ''
  // The served site's own index.html (a preview channel has its own build);
  // the production one when called directly (the emulator) or from any other
  // host (a forged X-Forwarded-Host must not choose where the page comes from).
  const host = (req.get('x-forwarded-host') || req.hostname || '').toLowerCase()
  const origin = ALLOWED_HOST_PATTERN.test(host) ? `https://${host}` : SITE_URL
  let shell
  try {
    shell = await shellFor(origin)
  } catch (error) {
    logger.error('[cavePage] index.html could not be fetched', { origin, error: error.message })
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
  res.send(cavePageHtml(shell, snapshot.data(), id))
})

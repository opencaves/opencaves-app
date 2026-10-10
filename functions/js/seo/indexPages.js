import { onRequest } from 'firebase-functions/v2/https'
import { logger } from 'firebase-functions/v2'
import { REGION, APP_TITLE, GITHUB_URL, SITE_URL } from '../constants.js'
import { cavePageMeta } from './cavePage.js'
import { loadPageIndex, loadSsr, renderWithApp } from './ssr.js'
import { decodeSegment, plainParagraphs, renderPage, sendHtml, shellFor, truncate } from './shared.js'

// The public pages rendered on the server for search engines and a fast
// first paint: / (the landing page), /caves (every cave by area, each area's
// section its anchor: #<slug>), /caves/<id>, /sistemas (every cave system by
// area) and /sistemas/<id> - an area has no page of its own (/areas/<slug> is
// redirected to /caves#<slug>, firebase.json). The app draws them (ssr.js);
// this gives each its <head> data - title, description, canonical address,
// structured data, breadcrumbs - and its status. The app's editor pages under
// these addresses (/caves/edit, /sistemas/edit, .../<id>/edit) are not
// rewritten here (firebase.json).
const CAVE_ID_PATTERN = /^[-_A-Za-z0-9]{1,64}$/

// A cave's name for structured data: as its own page's (cavePage.js).
const caveName = (cave) => cave.name || '(Unnamed cave)'

// An index page's structured data (schema.org): the page as a collection,
// its items listed in the page's order - all of them: /caves' ~860 caves
// add ~98 KB to its HTML, but ~10 KB sent (Brotli, which sendHtml uses for
// nearly every client; ~20 KB gzipped) on a page of ~64 KB sent.
function collectionJsonLd({ name, description, path }, items) {
  return {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name,
    description,
    url: `${SITE_URL}${path}`,
    isPartOf: { '@id': `${SITE_URL}/#website` },
    mainEntity: {
      '@type': 'ItemList',
      numberOfItems: items.length,
      itemListElement: items.map(({ name: itemName, path: itemPath }, i) => ({ '@type': 'ListItem', position: i + 1, url: `${SITE_URL}${itemPath}`, name: itemName })),
    },
  }
}

function cavesPage(data) {
  const page = {
    title: `Caves of the Yucatán by area / ${APP_TITLE}`,
    // The app's (src/locales/en.json indexPages.caves.description), word for word.
    description: 'Every cenote of the Yucatán, Mexico, listed on OpenCaves by area, each with its location, access, pictures and maps.',
    path: '/caves',
    trail: [{ name: 'Home', path: '/' }, { name: 'Caves', path: '/caves' }],
  }
  return { ...page, jsonLd: collectionJsonLd({ name: 'Caves of the Yucatán by area', ...page }, data.caves.map((cave) => ({ name: caveName(cave), path: `/caves/${cave.id}` }))) }
}

function sistemasPage(data) {
  const page = {
    title: `Cave systems of the Yucatán / ${APP_TITLE}`,
    description: 'The underwater cave systems of the Yucatán, Mexico, by area: their length, depth, connections, exploration history and cenotes, on OpenCaves.',
    path: '/sistemas',
    trail: [{ name: 'Home', path: '/' }, { name: 'Cave systems', path: '/sistemas' }],
  }
  return { ...page, jsonLd: collectionJsonLd({ name: 'Cave systems of the Yucatán', ...page }, data.sistemas.map((sistema) => ({ name: sistema.name, path: `/sistemas/${sistema.slug}` }))) }
}

// A system's caves as its page lists them (src/routes/sistemas/SistemaPage.jsx):
// its own, and those of every system that joined it.
function sistemaCaves(sistema, data) {
  const memberIds = new Set([sistema.id])
  const queue = [sistema.id]
  while (queue.length > 0) {
    const parentId = queue.shift()
    data.connections.forEach(({ sistemaId, parentSistemaId }) => {
      if (parentSistemaId === parentId && !memberIds.has(sistemaId)) {
        memberIds.add(sistemaId)
        queue.push(sistemaId)
      }
    })
  }
  return data.caves.filter((cave) => memberIds.has(cave.sistemaId))
}

function sistemaPage(sistema, data) {
  const summary = plainParagraphs(sistema.description).join(' ')
  const description = truncate(summary
    ? `${sistema.name} cave system (Yucatán, Mexico): ${summary}`
    : `${sistema.name} cave system in the Yucatán, Mexico: length, depth, connections, exploration history and cenotes on OpenCaves.`)
  const path = `/sistemas/${sistema.slug}`
  const aka = Array.isArray(sistema.aka) ? sistema.aka.filter(Boolean) : []
  return {
    title: `${sistema.name} system / ${APP_TITLE}`,
    description,
    path,
    trail: [{ name: 'Home', path: '/' }, { name: 'Cave systems', path: '/sistemas' }, { name: sistema.name, path }],
    // The system as a place, its caves in it (each as its own page's: cavePage.js).
    jsonLd: {
      '@context': 'https://schema.org',
      '@type': 'Place',
      name: sistema.name,
      description,
      url: `${SITE_URL}${path}`,
      address: { '@type': 'PostalAddress', addressCountry: 'MX' },
      ...(aka.length && { alternateName: aka }),
      containsPlace: sistemaCaves(sistema, data).map((cave) => ({ '@type': 'TouristAttraction', name: caveName(cave), url: `${SITE_URL}/caves/${cave.id}` })),
    },
  }
}

// The landing page (/), its texts as in the English locale
// (src/locales/en.json, "home") - keep the two in step.
function homePage() {
  return {
    title: `Open data for cave diving / ${APP_TITLE}`,
    description: 'OpenCaves: caves and cave systems for cave divers around the world - locations, access, survey maps, connections and exploration history, open and built by divers.',
    path: '/',
    // The site's name, address and publisher, for search results (schema.org).
    jsonLd: {
      '@context': 'https://schema.org',
      '@graph': [
        { '@type': 'WebSite', '@id': `${SITE_URL}/#website`, name: 'OpenCaves', alternateName: 'Open Caves', url: `${SITE_URL}/`, inLanguage: 'en', description: 'Open data for cave diving: caves, cave systems and survey maps, built by divers.', publisher: { '@id': `${SITE_URL}/#organization` } },
        { '@type': 'Organization', '@id': `${SITE_URL}/#organization`, name: 'OpenCaves', url: `${SITE_URL}/`, logo: `${SITE_URL}/pwa/icons/android-chrome-512x512.png`, sameAs: [GITHUB_URL] },
      ],
    },
  }
}

// The page for a path, { redirect } for an old address, or null (404).
function pageFor(path, data) {
  if (path === '/' || path === '') return homePage()
  const [, section, rawSegment, extra] = path.replace(/\/+$/, '').split('/')
  if (extra !== undefined) return null
  const segment = decodeSegment(rawSegment)
  if (section === 'caves') {
    if (rawSegment === undefined) return cavesPage(data)
    // A cave's own page (cavePage.js's <head>, at this address), looked up
    // in the handler: { cave: <id> }. (/caves/edit is the app's editor page, never
    // rewritten here.)
    return CAVE_ID_PATTERN.test(segment) && segment !== 'edit' ? { cave: segment } : null
  }
  if (section === 'sistemas') {
    if (rawSegment === undefined) return sistemasPage(data)
    const sistema = CAVE_ID_PATTERN.test(segment) && data.sistemasBySlug.get(segment)
    return sistema ? sistemaPage(sistema, data) : null
  }
  return null
}

// The page as the app renders it (ssr.js), or - no server build, or the
// rendering failing - the app's shell with the page's <head> (and, for a
// cave, its text: cavePage.js's), which the app renders in the browser.
async function pageHtml(req, meta) {
  try {
    const html = await renderWithApp(req, meta)
    if (html) return html
  } catch (error) {
    logger.error('[indexPages] the app could not render the page', { path: req.path, error: error.stack || error.message })
  }
  return renderPage(await shellFor(req), meta)
}

// The app's shell for a "not found": the server build's (ssr.js), else the site's.
async function notFoundShell(req) {
  try {
    const ssr = await loadSsr()
    if (ssr) return ssr.shell
  } catch {
    // The site's, then.
  }
  return shellFor(req)
}

// 512 MiB: the app's server build, the cave data and the pages it keeps
// (ssr.js) - more than the default 256.
export const indexPages = onRequest({ region: REGION, memory: '512MiB' }, async (req, res) => {
  try {
    const data = await loadPageIndex()
    const page = pageFor(req.path, data)
    let meta = page
    if (page?.cave) {
      const cave = data.cavesById.get(page.cave)
      const sistema = cave?.sistemaId && data.sistemasById.get(cave.sistemaId)
      meta = cave ? cavePageMeta(cave, page.cave, sistema ? { name: sistema.name, slug: sistema.slug } : null, `/caves/${page.cave}`) : null
    }
    if (page?.redirect) {
      res.set('Cache-Control', 'public, max-age=3600')
      res.redirect(301, page.redirect)
      return
    }
    res.set('Content-Type', 'text/html; charset=utf-8')
    if (!meta) {
      // The app shows its own "not found"; search engines get the status.
      res.set('Cache-Control', 'public, max-age=60')
      sendHtml(req, res, await notFoundShell(req), 404)
      return
    }
    const html = await pageHtml(req, meta)
    // As the cave page: short in browsers, an hour at the CDN edge.
    res.set('Cache-Control', 'public, max-age=300, s-maxage=3600')
    sendHtml(req, res, html)
  } catch (error) {
    logger.error('[indexPages] the page could not be served', { path: req.path, error: error.message })
    res.redirect(302, '/map')
  }
})

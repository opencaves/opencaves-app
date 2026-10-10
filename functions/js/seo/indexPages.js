import { onRequest } from 'firebase-functions/v2/https'
import { logger } from 'firebase-functions/v2'
import { REGION, CAVES_COLL_NAME } from '../constants.js'
import { db } from '../init.js'
import { cavePageMeta } from './cavePage.js'
import { loadSsr, renderWithApp } from './ssr.js'
import { APP_TITLE, GITHUB_URL, SITE_URL } from '../constants.js'
import { decodeSegment, escapeHtml, plainParagraphs, renderPage, sendHtml, shellFor, truncate } from './shared.js'
import { loadIndexData, loadSistemaSlugs } from './indexData.js'
import { slugify } from './slug.js'

// The public index pages, served with their content already in the HTML for
// search engines (as cavePage.js does for /map/<caveId>): / (the landing
// page), /caves (every cave by area, each area's section its anchor: #<slug>),
// /sistemas (every cave system by area) and /sistemas/<id> - an area has no
// page of its own (/areas/<slug> is redirected to /caves#<slug>,
// firebase.json). Plain links, so crawlers reach every cave and system from
// them. The app's editor pages under these addresses (/caves/edit,
// /sistemas/edit, .../<slug>/edit) are not rewritten here (firebase.json).
const UNKNOWN_AREA = 'Unknown area'
const CAVE_ID_PATTERN = /^[-_A-Za-z0-9]{1,64}$/

const count = (n, singular, plural = `${singular}s`) => `${n.toLocaleString('en-US')} ${n === 1 ? singular : plural}`
const metres = (value, decimals) => `${Number(value).toLocaleString('en-US', { maximumFractionDigits: decimals })} m`

// No name: a placeholder in parentheses, as the app's lists.
const caveLabel = (cave) => cave.name || '(Unnamed cave)'
const caveLink = (cave) => `<li><a href="/caves/${escapeHtml(cave.id)}">${escapeHtml(caveLabel(cave))}</a></li>`
const sistemaLink = (sistema) => `<li><a href="/sistemas/${escapeHtml(sistema.slug)}">${escapeHtml(sistema.name)}</a></li>`
const list = (items, toItem) => (items.length ? `<ul>\n${items.map(toItem).join('\n')}\n</ul>` : '')

// Records grouped under their area's heading: areas alphabetically, those
// with no (known) area last.
function byAreaSections(items, areasBySlug, toItem) {
  const groups = new Map()
  const unknown = []
  items.forEach((item) => {
    const area = item.area && areasBySlug.get(slugify(item.area))
    if (!area) return unknown.push(item)
    if (!groups.has(area)) groups.set(area, [])
    groups.get(area).push(item)
  })
  const sections = [...groups.entries()]
    .sort(([a], [b]) => a.name.localeCompare(b.name, 'en', { sensitivity: 'base' }))
    .map(([area, areaItems]) => `<section id="${escapeHtml(area.slug)}">\n<h2>${escapeHtml(area.name)}</h2>\n${list(areaItems, toItem)}\n</section>`)
  if (unknown.length) sections.push(`<section>\n<h2>${UNKNOWN_AREA}</h2>\n${list(unknown, toItem)}\n</section>`)
  return { sections }
}

function cavesPage(data) {
  const { sections } = byAreaSections(data.caves, data.areasBySlug, caveLink)
  return {
    title: `Caves of the Yucatán by area / ${APP_TITLE}`,
    // The app's (src/locales/en.json indexPages.caves.description), word for word.
    description: 'Every cenote of the Yucatán, Mexico, listed on OpenCaves by area, each with its location, access, pictures and maps.',
    path: '/caves',
    trail: [{ name: 'Home', path: '/' }, { name: 'Caves', path: '/caves' }],
    body: [
      `<main class="oc-ssr-caves">`,
      `<h1>Caves of the Yucatán by area</h1>`,
      `<p>${escapeHtml(count(data.caves.length, 'cave'))} on OpenCaves. See also <a href="/sistemas">the cave systems</a> and <a href="/map">the map</a>.</p>`,
      ...sections,
      `</main>`,
    ].join('\n'),
  }
}

function sistemasPage(data) {
  const { sections } = byAreaSections(data.sistemas, data.areasBySlug, sistemaLink)
  return {
    title: `Cave systems of the Yucatán / ${APP_TITLE}`,
    description: 'The underwater cave systems of the Yucatán, Mexico, by area: their length, depth, connections, exploration history and cenotes, on OpenCaves.',
    path: '/sistemas',
    trail: [{ name: 'Home', path: '/' }, { name: 'Cave systems', path: '/sistemas' }],
    body: [
      `<main class="oc-ssr-sistemas">`,
      `<h1>Cave systems of the Yucatán</h1>`,
      `<p>${escapeHtml(count(data.sistemas.length, 'cave system'))} on OpenCaves. See also <a href="/caves">the caves</a> and <a href="/map">the map</a>.</p>`,
      ...sections,
      `</main>`,
    ].join('\n'),
  }
}

function sistemaPage(sistema, data) {
  const paragraphs = plainParagraphs(sistema.description)
  const summary = paragraphs.join(' ')
  const aka = Array.isArray(sistema.aka) ? sistema.aka.filter(Boolean) : []
  const area = sistema.area && data.areasBySlug.get(slugify(sistema.area))
  const caves = data.caves.filter(({ sistemaId }) => sistemaId === sistema.id)
  const related = (ids) => [...new Set(ids)].map((id) => data.sistemasById.get(id)).filter(Boolean).sort((a, b) => a.name.localeCompare(b.name, 'en', { sensitivity: 'base' }))
  const parents = related(data.connections.filter(({ sistemaId }) => sistemaId === sistema.id).map(({ parentSistemaId }) => parentSistemaId))
  const children = related(data.connections.filter(({ parentSistemaId }) => parentSistemaId === sistema.id).map(({ sistemaId }) => sistemaId))
  // A team is a list of names (older records: one string) - as src/utils/explorationTeam.js.
  const teamOf = (team) => (Array.isArray(team) ? team : String(team || '').split(/\s*[,;]\s*/)).map((name) => String(name || '').trim()).filter(Boolean).join(', ')
  const explorations = (Array.isArray(sistema.explorations) ? sistema.explorations : []).map((e) => ({ ...e, team: teamOf(e.team) })).filter((e) => e.date || e.team || e.description)
  // Without the entries' sources (their notes), as the app's page.
  const exploration = ({ date, team, description }) => {
    const text = plainParagraphs(description).join(' ')
    const heading = [date, team].filter(Boolean).map(escapeHtml).join(' - ')
    return `<li>${[heading && `<p>${heading}</p>`, text && `<p>${escapeHtml(text)}</p>`].filter(Boolean).join('')}</li>`
  }
  const facts = [
    aka.length && `<p>Also known as ${escapeHtml(aka.join(', '))}</p>`,
    area && `<p>Area: <a href="/sistemas#${escapeHtml(area.slug)}">${escapeHtml(area.name)}</a></p>`,
    Number(sistema.length) > 0 && `<p>Length: ${metres(sistema.length, 0)}</p>`,
    Number(sistema.maxDepth) > 0 && `<p>Maximum depth: ${metres(sistema.maxDepth, 0)}</p>`,
  ]
  return {
    title: `${sistema.name} system / ${APP_TITLE}`,
    description: truncate(summary
      ? `${sistema.name} cave system (Yucatán, Mexico): ${summary}`
      : `${sistema.name} cave system in the Yucatán, Mexico: length, depth, connections, exploration history and cenotes on OpenCaves.`),
    path: `/sistemas/${sistema.slug}`,
    trail: [{ name: 'Home', path: '/' }, { name: 'Cave systems', path: '/sistemas' }, { name: sistema.name, path: `/sistemas/${sistema.slug}` }],
    body: [
      `<main class="oc-ssr-sistema">`,
      `<h1>${escapeHtml(sistema.name)} system</h1>`,
      ...facts,
      ...paragraphs.map((p) => `<p>${escapeHtml(p)}</p>`),
      explorations.length ? `<h2>Exploration</h2>\n${list(explorations, exploration)}` : '',
      caves.length ? `<h2>Caves</h2>\n${list(caves, caveLink)}` : '',
      parents.length ? `<h2>Part of</h2>\n${list(parents, sistemaLink)}` : '',
      children.length ? `<h2>Connected systems</h2>\n${list(children, sistemaLink)}` : '',
      `<p><a href="/sistemas">All the cave systems of the Yucatán</a></p>`,
      `</main>`,
    ].filter(Boolean).join('\n'),
  }
}

// The landing page (/): the app's Home in plain HTML, its texts as in the
// English locale (src/locales/en.json, "home") - keep the two in step.
function homePage(data) {
  const areas = [...data.areasBySlug.values()].filter((area) => area.caves.length || area.sistemas.length).sort((a, b) => a.name.localeCompare(b.name, 'en', { sensitivity: 'base' }))
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
    body: [
      `<main class="oc-ssr-home">`,
      `<h1>Open data for cave diving</h1>`,
      `<p>OpenCaves gathers what cave divers want to know about caves and cave systems around the world: where they are, how to get in, how they connect, what the surveys show. Open, and built by divers. It starts with the cenotes of the Yucatán.</p>`,
      `<p><a href="/map">Open the map</a> - <a href="/caves">Browse the caves</a> - <a href="/sistemas">Browse the systems</a></p>`,
      `<p>${escapeHtml(count(data.caves.length, 'cave'))} and ${escapeHtml(count(data.sistemas.length, 'cave system'))} on OpenCaves.</p>`,
      `<h2>Cave diving can kill</h2>`,
      `<p>Diving beyond the daylight zone of a cave or cenote takes cave training and certification, the right equipment and experience. In a cenote, the cavern - the part where daylight still shows the way out - can be dived with cavern training and a guide; beyond it is the cave, for trained cave divers only.</p>`,
      `<h2>Not for dive planning</h2>`,
      `<p>The information on OpenCaves is shared by its community. It can be incomplete, inaccurate or out of date, and it is not suitable for planning or conducting a dive. See the <a href="/terms">terms of use</a>.</p>`,
      `<h2>What you'll find</h2>`,
      `<ul>
<li>Caves: where each cave is and how to reach it - entrances, access, fees and facilities, with photos, videos and descriptions.</li>
<li>Cave systems: how caves connect into systems, their length and depth, and the history of their exploration.</li>
<li>Survey maps: cave passages traced from published survey maps, drawn on the map with their lines and markers.</li>
<li>Offline: save caves on your phone before you head out, to have them where there's no signal.</li>
</ul>`,
      areas.length ? `<h2>Areas of the Yucatán Peninsula, Mexico</h2>
${list(areas, (area) => `<li><a href="/caves#${escapeHtml(area.slug)}">${escapeHtml(area.name)}</a></li>`)}` : '',
      `<h2>Built by divers</h2>`,
      `<p>OpenCaves is open data: anyone can read it, and divers keep it up to date. Sign up to add caves, photos, videos and ratings. The app itself is open source.</p>`,
      `</main>`,
    ].filter(Boolean).join('\n'),
  }
}

// The page for a path, { redirect } for an old address, or null (404).
function pageFor(path, data) {
  if (path === '/' || path === '') return homePage(data)
  const [, section, rawSegment, extra] = path.replace(/\/+$/, '').split('/')
  if (extra !== undefined) return null
  const segment = decodeSegment(rawSegment)
  if (section === 'caves') {
    if (rawSegment === undefined) return cavesPage(data)
    // A cave's own page (cavePage.js's, at this address), read in the
    // handler: { cave: <id> }. (/caves/edit is the app's editor page, never
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
// rendering failing - as text in the app's shell (renderPage), as before.
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
    const page = pageFor(req.path, await loadIndexData())
    let meta = page
    if (page?.cave) {
      const snapshot = await db.collection(CAVES_COLL_NAME).doc(page.cave).get()
      if (snapshot.exists) {
        const cave = snapshot.data()
        let sistema = null
        if (cave.sistemaId) {
          const { slugs, names } = await loadSistemaSlugs()
          if (names.has(cave.sistemaId)) sistema = { name: names.get(cave.sistemaId), slug: slugs.get(cave.sistemaId) }
        }
        meta = cavePageMeta(cave, page.cave, sistema, `/caves/${page.cave}`)
      } else {
        meta = null
      }
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

import { onRequest } from 'firebase-functions/v2/https'
import { logger } from 'firebase-functions/v2'
import { REGION } from '../constants.js'
import { APP_TITLE, decodeSegment, escapeHtml, plainParagraphs, renderPage, shellFor, truncate } from './shared.js'
import { loadIndexData } from './indexData.js'
import { slugify } from './slug.js'

// The public index pages, served with their content already in the HTML for
// search engines (as cavePage.js does for /map/<caveId>): /caves (every
// cenote by area), /areas/<slug>, /sistemas (every cave system by area) and
// /sistemas/<id>. Plain links, so crawlers reach every cave and system from
// them. The app's editor pages under these addresses (/caves/edit,
// /sistemas/edit, .../<slug>/edit) are not rewritten here (firebase.json).
const UNKNOWN_AREA = 'Unknown area'
const CAVE_ID_PATTERN = /^[-_A-Za-z0-9]{1,64}$/
const SLUG_PATTERN = /^[a-z0-9][-a-z0-9_]{0,200}$/

const count = (n, singular, plural = `${singular}s`) => `${n.toLocaleString('en-US')} ${n === 1 ? singular : plural}`
const metres = (value, decimals) => `${Number(value).toLocaleString('en-US', { maximumFractionDigits: decimals })} m`

const caveLabel = (cave) => cave.name || 'Unnamed cave'
const caveLink = (cave) => `<li><a href="/map/${escapeHtml(cave.id)}">${escapeHtml(caveLabel(cave))}</a></li>`
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
    .map(([area, areaItems]) => `<section>\n<h2><a href="/areas/${escapeHtml(area.slug)}">${escapeHtml(area.name)}</a></h2>\n${list(areaItems, toItem)}\n</section>`)
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
    body: [
      `<main class="oc-ssr-sistemas">`,
      `<h1>Cave systems of the Yucatán</h1>`,
      `<p>${escapeHtml(count(data.sistemas.length, 'cave system'))} on OpenCaves. See also <a href="/caves">the caves</a> and <a href="/map">the map</a>.</p>`,
      ...sections,
      `</main>`,
    ].join('\n'),
  }
}

function areaPage(area) {
  return {
    title: `Caves in ${area.name} / ${APP_TITLE}`,
    description: truncate(`The cenotes and cave systems of ${area.name}, in the Yucatán, Mexico: locations, access, pictures and maps on OpenCaves.`),
    path: `/areas/${area.slug}`,
    body: [
      `<main class="oc-ssr-area">`,
      `<h1>Caves in ${escapeHtml(area.name)}</h1>`,
      `<p>${escapeHtml(count(area.caves.length, 'cave'))} and ${escapeHtml(count(area.sistemas.length, 'cave system'))} in ${escapeHtml(area.name)} (Yucatán, Mexico).</p>`,
      area.caves.length ? `<h2>Caves</h2>\n${list(area.caves, caveLink)}` : '',
      area.sistemas.length ? `<h2>Cave systems</h2>\n${list(area.sistemas, sistemaLink)}` : '',
      `<p><a href="/caves">All the caves of the Yucatán by area</a></p>`,
      `</main>`,
    ].filter(Boolean).join('\n'),
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
  const explorations = Array.isArray(sistema.explorations) ? sistema.explorations : []
  const exploration = ({ date, team, description, notes }) => {
    const text = [...plainParagraphs(description), ...plainParagraphs(notes)].join(' ')
    const heading = [date, team].filter(Boolean).map(escapeHtml).join(' - ')
    return `<li>${[heading && `<p>${heading}</p>`, text && `<p>${escapeHtml(text)}</p>`].filter(Boolean).join('')}</li>`
  }
  const facts = [
    aka.length && `<p>Also known as ${escapeHtml(aka.join(', '))}</p>`,
    area && `<p>Area: <a href="/areas/${escapeHtml(area.slug)}">${escapeHtml(area.name)}</a></p>`,
    Number(sistema.length) > 0 && `<p>Length: ${metres(sistema.length, 0)}</p>`,
    Number(sistema.maxDepth) > 0 && `<p>Maximum depth: ${metres(sistema.maxDepth, 1)}</p>`,
  ]
  return {
    title: `${sistema.name} cave system / ${APP_TITLE}`,
    description: truncate(summary
      ? `${sistema.name} cave system (Yucatán, Mexico): ${summary}`
      : `${sistema.name} cave system in the Yucatán, Mexico: length, depth, connections, exploration history and cenotes on OpenCaves.`),
    path: `/sistemas/${sistema.slug}`,
    body: [
      `<main class="oc-ssr-sistema">`,
      `<h1>${escapeHtml(sistema.name)} cave system</h1>`,
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

// The page for a path, { redirect } for an old address, or null (404).
function pageFor(path, data) {
  const [, section, rawSegment, extra] = path.replace(/\/+$/, '').split('/')
  if (extra !== undefined) return null
  const segment = decodeSegment(rawSegment)
  if (section === 'caves') {
    if (rawSegment === undefined) return cavesPage(data)
    // A cave's old address: its page is /map/<caveId>.
    // (/caves/edit is the app's editor page, never rewritten here.)
    return CAVE_ID_PATTERN.test(segment) && segment !== 'edit' ? { redirect: `/map/${segment}` } : null
  }
  if (section === 'sistemas') {
    if (rawSegment === undefined) return sistemasPage(data)
    const sistema = CAVE_ID_PATTERN.test(segment) && data.sistemasBySlug.get(segment)
    return sistema ? sistemaPage(sistema, data) : null
  }
  if (section === 'areas' && rawSegment !== undefined) {
    const area = SLUG_PATTERN.test(segment) && data.areasBySlug.get(segment)
    return area ? areaPage(area) : null
  }
  return null
}

export const indexPages = onRequest({ region: REGION }, async (req, res) => {
  let shell
  try {
    shell = await shellFor(req)
  } catch (error) {
    logger.error('[indexPages] index.html could not be fetched', { error: error.message })
    res.redirect(302, '/map')
    return
  }

  const page = pageFor(req.path, await loadIndexData())
  if (page?.redirect) {
    res.set('Cache-Control', 'public, max-age=3600')
    res.redirect(301, page.redirect)
    return
  }
  res.set('Content-Type', 'text/html; charset=utf-8')
  if (!page) {
    // The app shows its own "not found"; search engines get the status.
    res.set('Cache-Control', 'public, max-age=60')
    res.status(404).send(shell)
    return
  }
  // As the cave page: short in browsers, an hour at the CDN edge.
  res.set('Cache-Control', 'public, max-age=300, s-maxage=3600')
  res.send(renderPage(shell, page))
})

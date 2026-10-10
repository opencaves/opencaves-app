import { postProcessCaveData } from '@/services/data-service/postProcessCaveData.js'
import { buildIndexData, homeFigures } from '@/utils/indexData.js'
import { getSistemaMapRefs } from '@/utils/sistemaMaps.js'
import { isTrashed } from '@/utils/trash.js'

// Server only (entry-server.jsx): the cave data and the query results
// (ssrContext.js) a public page is rendered with - which the page carries to
// the browser for its first render (window.__OC_SSR__), so they're cut to
// what that page shows (the app's store holds ~500 KB of it). The browser's
// own data replaces it soon after (redux-persist's, then Firestore's), and
// no other page uses it (useCaveData). entry-server.jsx checks that the page
// is drawn the same with every record (falling back to them all if not).
//   /: its figures only (Home: the counts and the areas);
//   /caves: every cave's name, area, system and whether it's located, their
//     systems' names;
//   /sistemas: every public system's name, area and colour;
//   /caves/<id>: the cave, its system and the systems that one joined, in
//     full, their connections, the small reference collections;
//   /sistemas/<id>: the same for the system, and the systems that joined it
//     and their caves (their names, for its connections and its caves).
// Every page gets the areas, with those named by caves or systems only under
// the spelling the whole data gives them (utils/indexData.js picks the first
// one met, which a part of the caves might not have).

// The collections the store has (dataSlice.jsx), empty unless a page needs them.
const EMPTY = { accesses: [], accessibilities: [], areas: [], caves: [], colors: [], connections: [], sistemas: [], sources: [], languages: [] }

const pick = (record, fields) => Object.fromEntries(fields.filter((field) => record[field] !== undefined).map((field) => [field, record[field]]))

// A cave as a list shows it: its name, area, system, whether it's on the map
// (useIndexData's located), its other names (the lists' search).
function listCave(cave) {
  const item = { id: cave.id, located: cave.location?.latitude != null && cave.location?.longitude != null }
  if (cave.name?.value) item.name = { value: cave.name.value }
  if (Array.isArray(cave.aka) && cave.aka.length > 0) item.aka = cave.aka
  if (cave.area) item.area = cave.area
  if (cave.sistemaId) item.sistemaId = cave.sistemaId
  return item
}

// The systems sistemaId joined (connections up, itself first) and those that
// joined it (down, every level): what a cave's or a system's page shows of
// them (its history, maps, connections and caves).
function relatedSistemas(sistemaId, connections) {
  const links = connections.filter(({ sistemaId: child, parentSistemaId: parent }) => child && parent)
  const walk = (from, to) => {
    const ids = new Set([sistemaId])
    const queue = [sistemaId]
    while (queue.length > 0) {
      const id = queue.shift()
      links.forEach((link) => link[from] === id && !ids.has(link[to]) && (ids.add(link[to]), queue.push(link[to])))
    }
    return ids
  }
  return { ancestors: walk('sistemaId', 'parentSistemaId'), descendants: walk('parentSistemaId', 'sistemaId') }
}

/**
 * The page's address: { kind: 'home' | 'caves' | 'cave' | 'sistemas' | 'sistema', id }.
 *
 * @param {string} pathname
 * @returns {{kind: string, id?: string}|null}
 */
export function pageOf(pathname) {
  const path = pathname.replace(/\/+$/, '') || '/'
  if (path === '/') return { kind: 'home' }
  const [, section, id, extra] = path.split('/')
  if (extra !== undefined || !['caves', 'sistemas'].includes(section)) return null
  if (id === undefined) return { kind: section }
  if (id === 'edit') return null
  return { kind: section === 'caves' ? 'cave' : 'sistema', id: decodeURIComponent(id) }
}

// postProcessCaveData's result by raw data, and its index (buildIndexData):
// the server keeps the same data a few minutes (functions/js/seo/ssr.js),
// processed once.
const processed = new WeakMap()

function processedData(raw) {
  if (!processed.has(raw)) {
    const data = postProcessCaveData(raw)
    const index = buildIndexData(data)
    // The areas records, then those named by caves or systems only, as the
    // index spells them.
    const areas = [...data.areas, ...index.areas.filter(({ recordId }) => !recordId).map(({ name }) => ({ name }))]
    processed.set(raw, { data, index, areas })
  }
  return processed.get(raw)
}

/**
 * The page's cave data in full (state.data's shape): entry-server.jsx's check,
 * and its fallback.
 *
 * @param {CaveData} raw
 * @returns {object}
 */
export function fullPageData(raw) {
  const { data } = processedData(raw)
  return { dataLoadingState: { state: 'loaded' }, expires: null, maxAge: 24 * 60 * 60, ...EMPTY, ...pick(data, Object.keys(EMPTY)) }
}

/**
 * @param {{kind: string, id?: string}} page - {@link pageOf}'s.
 * @param {object} sources
 * @param {CaveData} sources.raw - The 9 cave-data collections as the app reads them ({ id, ...data },
 *   readCaveDataFromFirestore).
 * @param {{id: string, data: CaveMap}[]} [sources.maps=[]] - The maps collection ([{ id, data }]).
 * @param {{id: string, data: object}[]} [sources.assets=[]] - The page's
 *   cave's photos ([{ id, data }]), if a cave's page.
 * @returns {{data: object, queries: object, found: boolean}} { data (the page's
 *   cave data: useCaveData), queries, found }.
 */
export function buildPageState(page, { raw, maps = [], assets = [] }) {
  const { data: all, index, areas } = processedData(raw)
  const cave = page.kind === 'cave' ? all.caves.find(({ id }) => id === page.id) : null
  // The page's system (or its cave's), and the systems it joined, and those
  // that joined it (on a system's page).
  const focusSistemaId = page.kind === 'sistema' ? page.id : cave?.sistemaId
  const { ancestors, descendants } = focusSistemaId ? relatedSistemas(focusSistemaId, all.connections) : { ancestors: new Set(), descendants: new Set() }
  if (page.kind !== 'sistema') descendants.clear()
  const publicSistemas = all.sistemas.filter((sistema) => sistema.public !== false)

  const data = { ...fullPageData(raw), ...EMPTY, partial: true, areas }
  if (page.kind === 'home') {
    data.figures = homeFigures(index)
  } else if (page.kind === 'caves') {
    data.caves = all.caves.map(listCave)
    const used = new Set(all.caves.map(({ sistemaId }) => sistemaId))
    data.sistemas = publicSistemas.filter(({ id }) => used.has(id)).map((sistema) => pick(sistema, ['id', 'name']))
  } else if (page.kind === 'sistemas') {
    data.sistemas = publicSistemas.map((sistema) => pick(sistema, ['id', 'name', 'aka', 'area', 'color']))
  } else {
    Object.assign(data, pick(all, ['accesses', 'accessibilities', 'colors', 'sources', 'languages']))
    data.sistemas = all.sistemas.filter(({ id }) => ancestors.has(id) || descendants.has(id)).map((sistema) => (ancestors.has(sistema.id) ? sistema : pick(sistema, ['id', 'name', 'public', 'color'])))
    data.connections = all.connections.filter(({ sistemaId, parentSistemaId }) => (ancestors.has(sistemaId) && ancestors.has(parentSistemaId)) || descendants.has(sistemaId))
    data.caves = page.kind === 'cave' ? [cave] : all.caves.filter(({ sistemaId }) => descendants.has(sistemaId)).map((item) => pick(listCave(item), ['id', 'name', 'sistemaId', 'located']))
  }

  // The maps the page shows (MapsSection: its system's and those it joined),
  // not all of them; the cave's photos (useCaveAssetsList), its cover
  // (useCoverImage).
  const queries = {}
  if (focusSistemaId) {
    const ids = new Set(getSistemaMapRefs(focusSistemaId, all.sistemas, all.connections).map(({ id }) => id))
    queries.maps = maps.filter(({ id, data: map }) => ids.has(id) && !isTrashed(map))
  } else if (page.kind === 'cave' || page.kind === 'sistema') {
    queries.maps = []
  }
  if (cave) {
    const images = assets.filter(({ data: asset }) => asset.caveId === cave.id && asset.type === 'image')
    queries[`photos:${cave.id}`] = images
    queries[`cover:${cave.id}`] = images.filter(({ data: asset }) => asset.isCover === true)
  }
  return { data, queries, found: page.kind === 'cave' ? Boolean(cave) : page.kind === 'sistema' ? publicSistemas.some(({ id }) => id === page.id) : true }
}

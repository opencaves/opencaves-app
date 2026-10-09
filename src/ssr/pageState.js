import { postProcessCaveData, buildSistemaAncestryComputer } from '@/services/data-service/postProcessCaveData.js'
import { getSistemaMapRefs } from '@/utils/sistemaMaps.js'
import { isTrashed } from '@/utils/trash.js'

// Server only (entry-server.jsx): the store's cave data and the query
// results (ssrContext.js) a public page is rendered with - and which the
// page carries to the browser for its first render (window.__OC_SSR__). The
// app keeps every cave and system in its store (App subscribes to them), ~500
// KB: a page carries what it shows - every cave's and system's name, area,
// system and location (the lists, the search, the counts), and the full
// records of the page's own cave or system and the systems it joined. The
// browser's own data replaces it soon after (redux-persist's, then
// Firestore's).

// What every cave and system keeps (useIndexData, the lists, the search).
const CAVE_FIELDS = ['id', 'name', 'aka', 'area', 'sistemaId', 'location']
const SISTEMA_FIELDS = ['id', 'name', 'aka', 'area', 'public', 'color', 'maps', 'length', 'maxDepth']

const pick = (record, fields) => Object.fromEntries(fields.filter((field) => record[field] !== undefined).map((field) => [field, record[field]]))

// The page's address: { kind: 'home' | 'caves' | 'cave' | 'sistemas' | 'sistema', id }.
export function pageOf(pathname) {
  const path = pathname.replace(/\/+$/, '') || '/'
  if (path === '/') return { kind: 'home' }
  const [, section, id, extra] = path.split('/')
  if (extra !== undefined || !['caves', 'sistemas'].includes(section)) return null
  if (id === undefined) return { kind: section }
  if (id === 'edit') return null
  return { kind: section === 'caves' ? 'cave' : 'sistema', id: decodeURIComponent(id) }
}

// postProcessCaveData's result by raw data: the server keeps the same data a
// few minutes (functions/js/seo/ssr.js), processed once.
const processed = new WeakMap()

// raw: the 9 cave-data collections as the app reads them ({ id, ...data },
// readCaveDataFromFirestore); maps: the maps collection; assets: the page's
// cave's photos ([{ id, data }]), if a cave's page.
export function buildPageState(page, { raw, maps = [], assets = [] }) {
  if (!processed.has(raw)) processed.set(raw, postProcessCaveData(raw))
  const data = processed.get(raw)
  const ancestry = buildSistemaAncestryComputer(data.sistemas, data.connections)
  const cave = page.kind === 'cave' ? data.caves.find(({ id }) => id === page.id) : null
  // The systems shown in full: the page's (or its cave's) and those it joined.
  const focusSistemaId = page.kind === 'sistema' ? page.id : cave?.sistemaId
  const fullSistemas = new Set(focusSistemaId ? [focusSistemaId, ...(ancestry({ sistemaId: focusSistemaId }) || []).map(({ id }) => id)] : [])

  const state = {
    data: {
      dataLoadingState: { state: 'loaded' },
      expires: null,
      maxAge: 24 * 60 * 60,
      accesses: data.accesses,
      accessibilities: data.accessibilities,
      areas: data.areas,
      caves: data.caves.map((item) => (item === cave ? item : pick(item, CAVE_FIELDS))),
      colors: data.colors,
      connections: data.connections,
      sistemas: data.sistemas.map((item) => (fullSistemas.has(item.id) ? item : pick(item, SISTEMA_FIELDS))),
      sources: data.sources,
      languages: data.languages,
    },
  }

  // The maps the page shows (MapsSection: its system's and those it joined),
  // not all of them; the cave's photos (useCaveAssetsList), its cover
  // (useCoverImage).
  const queries = {}
  if (focusSistemaId) {
    const ids = new Set(getSistemaMapRefs(focusSistemaId, data.sistemas, data.connections).map(({ id }) => id))
    queries.maps = maps.filter(({ id, data: map }) => ids.has(id) && !isTrashed(map))
  } else if (page.kind === 'cave' || page.kind === 'sistema') {
    queries.maps = []
  }
  if (cave) {
    const images = assets.filter(({ data: asset }) => asset.caveId === cave.id && asset.type === 'image')
    queries[`photos:${cave.id}`] = images
    queries[`cover:${cave.id}`] = images.filter(({ data: asset }) => asset.isCover === true)
  }
  return { state, queries, found: page.kind === 'cave' ? Boolean(cave) : page.kind === 'sistema' ? data.sistemas.some(({ id, public: isPublic }) => id === page.id && isPublic !== false) : true }
}

import { CAVES_COLL_NAME } from '../constants.js'
import { db } from '../init.js'
import { slugify } from './slug.js'

// The data the index pages (/caves, /sistemas,
// /sistemas/<id>) and the sitemap list, read once and kept a few minutes
// per instance: a crawler going through the pages doesn't read every
// collection on each one (the CDN keeps each page an hour anyway). The app
// groups the same data for its own pages (src/utils/indexData.js): keep the
// two grouping things the same way.
const DATA_TTL_MS = 5 * 60 * 1000

let cached = null

const byName = (a, b) => a.name.localeCompare(b.name, 'en', { sensitivity: 'base' })

async function readIndexData() {
  const [cavesSnap, sistemasSnap, areasSnap, connectionsSnap] = await Promise.all([
    db.collection(CAVES_COLL_NAME).select('name', 'area', 'sistemaId').get(),
    db.collection('sistemas').get(),
    db.collection('areas').get(),
    db.collection('connections').get(),
  ])
  return groupIndexData({
    caves: cavesSnap.docs.map((doc) => ({ id: doc.id, ...doc.data() })),
    sistemas: sistemasSnap.docs.map((doc) => ({ id: doc.id, updateTime: doc.updateTime, ...doc.data() })),
    areas: areasSnap.docs.map((doc) => ({ id: doc.id, ...doc.data() })),
    connections: connectionsSnap.docs.map((doc) => doc.data()),
  })
}

/**
 * The index data from the records themselves ({ id, ...fields }): from
 * Firestore here, or from the data the app renders the pages with (ssr.js),
 * so the page functions don't read the collections twice.
 *
 * @param {object} records
 * @returns {object}
 */
export function groupIndexData(records) {
  const caves = records.caves
    .map(({ id, name, area, sistemaId }) => ({ id, name: name?.value?.trim() || null, area: area || null, sistemaId: sistemaId || null }))
    // Unnamed caves (there are some) after the named ones.
    .sort((a, b) => (!a.name || !b.name ? !a.name - !b.name : byName(a, b)))

  // All sistemas are public today; one marked otherwise has no page. Slugs
  // over the public ones, as the app makes them (src/utils/indexData.js).
  const sistemaDocs = records.sistemas.filter((sistema) => sistema.public !== false)
  // A system's address segment is its id (/sistemas/<id>, like /caves/<id>).
  const sistemas = sistemaDocs
    .map((sistema) => ({ ...sistema, name: sistema.name || sistema.id, slug: sistema.id }))
    .sort(byName)
  const sistemasById = new Map(sistemas.map((sistema) => [sistema.id, sistema]))
  const sistemasBySlug = new Map(sistemas.map((sistema) => [sistema.slug, sistema]))

  // Caves and sistemas name their area; some names have no record in
  // `areas`, and are areas all the same. Grouped by slug, so two spellings
  // of a name are one area (the `areas` record's spelling wins).
  const areasBySlug = new Map()
  const addArea = (name, fromRecord = false) => {
    const slug = slugify(name)
    if (!slug) return null
    let area = areasBySlug.get(slug)
    if (!area) {
      area = { name, slug, caves: [], sistemas: [] }
      areasBySlug.set(slug, area)
    } else if (fromRecord) {
      area.name = name
    }
    return area
  }
  records.areas.forEach((area) => addArea(area.name || area.id, true))
  caves.forEach((cave) => cave.area && addArea(cave.area).caves.push(cave))
  sistemas.forEach((sistema) => sistema.area && addArea(sistema.area).sistemas.push(sistema))
  // An area's systems also include those of its cenotes (most systems have
  // no area of their own).
  areasBySlug.forEach((area) => {
    const ids = new Set(area.sistemas.map(({ id }) => id))
    area.caves.forEach(({ sistemaId }) => {
      const sistema = sistemasById.get(sistemaId)
      if (sistema && !ids.has(sistema.id)) {
        ids.add(sistema.id)
        area.sistemas.push(sistema)
      }
    })
    area.sistemas.sort(byName)
  })
  const areas = [...areasBySlug.values()].sort(byName)

  const connections = records.connections
    .filter(({ sistemaId, parentSistemaId }) => sistemaId && parentSistemaId)

  return { caves, sistemas, sistemasById, sistemasBySlug, areas, areasBySlug, connections }
}

export async function loadIndexData() {
  if (cached && Date.now() - cached.at < DATA_TTL_MS) return cached.data
  const data = await readIndexData()
  cached = { data, at: Date.now() }
  return data
}

let sistemaSlugsCache = null

/**
 * Every public sistema's slug and name by id, for the cave page's link to
 * its system: only the names are read.
 *
 * @returns {Promise<object>}
 */
export async function loadSistemaSlugs() {
  if (sistemaSlugsCache && Date.now() - sistemaSlugsCache.at < DATA_TTL_MS) return sistemaSlugsCache.data
  const snapshot = await db.collection('sistemas').select('name', 'public').get()
  const docs = snapshot.docs.filter((doc) => doc.data().public !== false)
  // A system's address segment is its id.
  const slugs = new Map(docs.map((doc) => [doc.id, doc.id]))
  const names = new Map(docs.map((doc) => [doc.id, doc.data().name || doc.id]))
  const data = { slugs, names }
  sistemaSlugsCache = { data, at: Date.now() }
  return data
}

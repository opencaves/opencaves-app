import { slugify } from './slug.js'

// What the public index pages (/caves, /sistemas, /areas/<slug>,
// /sistemas/<id>) show, from the store's cave data. Mirrors the server's
// functions/js/seo/indexData.js (the same pages rendered for search engines):
// keep the two grouping things the same way.

const byName = (a, b) => a.name.localeCompare(b.name, 'en', { sensitivity: 'base' })

// Every public sistema's address segment by id - its id, as a cave's
// (/sistemas/<id>, like /caves/<id>). All are public today; one marked
// otherwise has no page.
export function sistemaSlugs(sistemas) {
  return new Map(sistemas.filter((sistema) => sistema.public !== false).map(({ id }) => [id, id]))
}

export function buildIndexData({ caves = [], sistemas = [], areas = [], connections = [] }) {
  // name: null for an unnamed cave (the pages say "Unnamed cenote"), listed
  // after the named ones.
  const caveItems = caves
    .map((cave) => ({ id: cave.id, name: cave.name?.value?.trim() || null, aka: Array.isArray(cave.aka) ? cave.aka : [], area: cave.area || null, sistemaId: cave.sistemaId || null, located: cave.location?.latitude != null && cave.location?.longitude != null }))
    .sort((a, b) => (!a.name || !b.name ? !a.name - !b.name : byName(a, b)))

  const slugs = sistemaSlugs(sistemas)
  const sistemaItems = sistemas
    .filter((sistema) => sistema.public !== false)
    .map((sistema) => ({ ...sistema, name: sistema.name || sistema.id, slug: slugs.get(sistema.id) }))
    .sort(byName)
  const sistemasById = new Map(sistemaItems.map((sistema) => [sistema.id, sistema]))
  const sistemasBySlug = new Map(sistemaItems.map((sistema) => [sistema.slug, sistema]))

  // Caves and sistemas name their area; some names have no record in
  // `areas`, and are areas all the same. Grouped by slug, so two spellings
  // of a name are one area (the `areas` record's spelling wins). recordId:
  // the `areas` record, for its Edit button.
  const areasBySlug = new Map()
  const addArea = (name, recordId = null) => {
    const slug = slugify(name)
    if (!slug) return null
    let area = areasBySlug.get(slug)
    if (!area) {
      area = { name, slug, recordId, caves: [], sistemas: [] }
      areasBySlug.set(slug, area)
    } else if (recordId) {
      area.name = name
      area.recordId = recordId
    }
    return area
  }
  areas.forEach((record) => addArea(record.name || record.id, record.id))
  caveItems.forEach((cave) => cave.area && addArea(cave.area)?.caves.push(cave))
  sistemaItems.forEach((sistema) => sistema.area && addArea(sistema.area)?.sistemas.push(sistema))
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
  const areaItems = [...areasBySlug.values()].sort(byName)

  const links = connections.filter(({ sistemaId, parentSistemaId }) => sistemaId && parentSistemaId)

  return { caves: caveItems, sistemas: sistemaItems, sistemasById, sistemasBySlug, areas: areaItems, areasBySlug, connections: links }
}

// Items grouped by their area, areas in alphabetical order, those without
// one (or with one that has no slug) last, under a null area.
export function groupByArea(items, areasBySlug, areaOf = (item) => item.area) {
  const groups = new Map()
  items.forEach((item) => {
    const area = areasBySlug.get(slugify(areaOf(item))) || null
    const key = area?.slug ?? null
    if (!groups.has(key)) groups.set(key, { area, items: [] })
    groups.get(key).items.push(item)
  })
  return [...groups.values()].sort((a, b) => (!a.area ? 1 : !b.area ? -1 : byName(a.area, b.area)))
}

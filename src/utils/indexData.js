import { slugify } from './slug.js'
import { caveFacts } from './caveFilters.js'

// What the public index pages (/caves, /sistemas,
// /sistemas/<id>) show, from the store's cave data. Mirrors the server's
// functions/js/seo/indexData.js (the same pages rendered for search engines):
// keep the two grouping things the same way.

// Names in alphabetical order, case and accents aside. One collator for
// every comparison: localeCompare with options builds a new one each call
// (thousands per sort of the caves).
const nameCollator = new Intl.Collator('en', { sensitivity: 'base' })

/**
 * Two records by their name, alphabetically, case and accents aside (for
 * sort).
 *
 * @param {{name: string}} a
 * @param {{name: string}} b
 * @returns {number}
 */
export const byName = (a, b) => nameCollator.compare(a.name, b.name)

/**
 * Every public sistema's address segment by id - its id, as a cave's
 * (/sistemas/<id>, like /caves/<id>). All are public today; one marked
 * otherwise has no page.
 *
 * @param {Sistema[]} sistemas
 * @returns {Map<string, string>}
 */
export function sistemaSlugs(sistemas) {
  return new Map(sistemas.filter((sistema) => sistema.public !== false).map(({ id }) => [id, id]))
}

export function buildIndexData({ caves = [], sistemas = [], areas = [], connections = [] }) {
  // name: null for an unnamed cave (the pages say "(Unnamed cave)"), listed
  // after the named ones.
  // located: whether it has coordinates - given as such by the data a
  // server-rendered page carries (src/ssr/pageState.js), without them.
  // cenoteEntrance: an entrance into its system (a system page's list marks it).
  // With the other facts the caves' search criteria test (caveFacts).
  const caveItems = caves
    .map((cave) => ({ ...caveFacts(cave), aka: Array.isArray(cave.aka) ? cave.aka : [], sistemaId: cave.sistemaId || null }))
    .sort((a, b) => (!a.name || !b.name ? Number(!a.name) - Number(!b.name) : byName(a, b)))

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

/**
 * Items grouped by their area, areas in alphabetical order, those without
 * one (or with one that has no slug) last, under a null area.
 *
 * @param {object[]} items
 * @param {Map<string, object>} areasBySlug
 * @param {(item: object) => string} [areaOf] - The item's area name (its `area` by default).
 * @returns {{area: object|null, items: object[]}[]}
 */
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

/**
 * The landing page's figures (Home): how many caves and public systems, and
 * the areas that have caves, with their count.
 *
 * @returns {{caves: number, sistemas: number, regions: {name: string, slug: string, count: number}[]}}
 */
export function homeFigures(data) {
  return {
    caves: data.caves.length,
    sistemas: data.sistemas.length,
    regions: data.areas.filter((area) => area.caves.length > 0).map(({ name, slug, caves }) => ({ name, slug, count: caves.length })),
  }
}

// The landing page's featured lists: Discover's cards, the popular caves
// after them, the longest systems.
const HOME_DISCOVER = 6
const HOME_POPULAR = 10
const HOME_LONGEST = 6

/**
 * The landing page's featured caves and systems (Home), the same on the
 * server (src/ssr/pageState.js, which sends them) and in the browser: links
 * search engines follow from the page they know best.
 * - discover: the most visited caves with a cover photo ({@link HOME_DISCOVER});
 * - popular: the next most visited caves, none of Discover's ({@link HOME_POPULAR});
 * - longest: the longest public systems ({@link HOME_LONGEST}) that stand on their own - one
 *   that joined another (Dos Ojos, now part of Sac Actun) is counted in that one.
 * Without visit counts (never read, offline): Discover's caves by name, no popular list.
 *
 * @param {{caves: object[], sistemas: object[], sistemasById: Map<string, object>, connections: object[]}} data - {@link buildIndexData}'s.
 * @param {{id: string, caveId: string}[]} covers - The cover photos outside the trash.
 * @param {Record<string, number>|null} views - Each cave's page views (_popularity/caves), null when unknown.
 * @returns {{discover: {caveId: string, assetId: string, name: string, sistema: string|null}[], popular: {id: string, name: string, sistema: string|null}[], longest: {id: string, name: string, length: number}[]}}
 */
export function homeFeatured(data, covers, views) {
  const count = (id) => Number(views?.[id]) || 0
  const rank = (a, b) => count(b.id) - count(a.id) || byName(a, b)
  const coverOf = new Map(covers.map((cover) => [cover.caveId, cover.id]))
  const sistemaName = (cave) => data.sistemasById.get(cave.sistemaId)?.name || null
  const named = data.caves.filter((cave) => cave.name)
  const discover = named.filter((cave) => coverOf.has(cave.id)).sort(rank).slice(0, HOME_DISCOVER)
  const shown = new Set(discover.map(({ id }) => id))
  const popular = views ? named.filter((cave) => !shown.has(cave.id) && count(cave.id) > 0).sort(rank).slice(0, HOME_POPULAR) : []
  const joined = new Set(data.connections.map(({ sistemaId }) => sistemaId))
  const longest = data.sistemas.filter((sistema) => Number(sistema.exploredLength) > 0 && !joined.has(sistema.id)).sort((a, b) => b.exploredLength - a.exploredLength || byName(a, b)).slice(0, HOME_LONGEST)
  return {
    discover: discover.map((cave) => ({ caveId: cave.id, assetId: coverOf.get(cave.id), name: cave.name, sistema: sistemaName(cave) })),
    popular: popular.map((cave) => ({ id: cave.id, name: cave.name, sistema: sistemaName(cave) })),
    longest: longest.map((sistema) => ({ id: sistema.id, name: sistema.name, length: Number(sistema.exploredLength) })),
  }
}

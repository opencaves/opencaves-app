/**
 * Maps are stored on sistemas, but a cave shows its own sistema's maps plus
 * those of every ancestor sistema it's connected into (walking
 * `connections`, like postProcessCaveData.js's ancestry).
 *
 * @param {string} sistemaId
 * @param {Sistema[]} sistemas
 * @param {Connection[]} connections
 * @returns {{id: string, sistemaId: string}[]} `[{ id, sistemaId }]`, own sistema first, each map id once, tagged with the
 *   sistema that actually holds it so edits/removals target that sistema.
 */
export function getSistemaMapRefs(sistemaId, sistemas, connections) {
  const sistemasById = new Map(sistemas.map((sistema) => [sistema.id, sistema]))
  const parentById = new Map()
  connections.forEach((connection) => {
    if (connection.sistemaId && connection.parentSistemaId) {
      parentById.set(connection.sistemaId, connection.parentSistemaId)
    }
  })

  const refs = []
  const seenMaps = new Set()
  // Guards against a connection cycle looping forever.
  const visited = new Set()
  let currentId = sistemaId

  while (currentId && !visited.has(currentId)) {
    visited.add(currentId)
    const maps = sistemasById.get(currentId)?.maps
    ;(Array.isArray(maps) ? maps : []).forEach((value) => {
      const id = value?.trim()
      if (id && !seenMaps.has(id)) {
        seenMaps.add(id)
        refs.push({ id, sistemaId: currentId })
      }
    })
    currentId = parentById.get(currentId)
  }

  return refs
}

/**
 * Maps in the order their lists show them: newest first by their date
 * ("2000", "2012-10", "1988-02-01" - ISO, so compared as text), the undated
 * ones last; equal ones keep their order (sort is stable).
 */
export function compareMapsByDate(a, b) {
  const dateA = a?.date || ''
  const dateB = b?.date || ''
  if (!dateA || !dateB) return (dateA ? 0 : 1) - (dateB ? 0 : 1)
  return dateB.localeCompare(dateA)
}

/**
 * One system's maps in the order its lists show them: the maps its
 * `mapOrder` doesn't name (new ones, or a system never reordered) first,
 * by date ({@link compareMapsByDate}), then those it names, in its order (the
 * ids no longer among the maps ignored).
 *
 * @template T
 * @param {T[]} items - The maps, or items carrying one.
 * @param {string[]} [mapOrder] - The system's `mapOrder`.
 * @param {object} [options]
 * @param {(item: T) => string} [options.idOf] - An item's map id (default: its `id`).
 * @param {(item: T) => CaveMap | undefined} [options.mapOf] - An item's map, for its date (default: the item).
 * @returns {T[]} A new array.
 */
export function orderMaps(items, mapOrder, { idOf = (item) => /** @type {any} */ (item).id, mapOf = (item) => /** @type {any} */ (item) } = {}) {
  const rank = new Map((Array.isArray(mapOrder) ? mapOrder : []).map((id, index) => [id, index]))
  const unordered = items.filter((item) => !rank.has(idOf(item))).sort((a, b) => compareMapsByDate(mapOf(a), mapOf(b)))
  const ordered = items.filter((item) => rank.has(idOf(item))).sort((a, b) => rank.get(idOf(a)) - rank.get(idOf(b)))
  return [...unordered, ...ordered]
}

/**
 * Maps of several systems (a cave's: its system's and those it joined,
 * {@link getSistemaMapRefs}) in the order their lists show them: each
 * system's together, in the order the systems first appear (the cave's own
 * first), each group in its system's order ({@link orderMaps}).
 *
 * @template T
 * @param {T[]} items - The maps, or items carrying one.
 * @param {Sistema[]} sistemas - Their systems (their `mapOrder`).
 * @param {object} [options]
 * @param {(item: T) => string} [options.sistemaOf] - The system holding an item's map (default: its `sistemaId`).
 * @param {(item: T) => string} [options.idOf] - {@link orderMaps}'s.
 * @param {(item: T) => CaveMap | undefined} [options.mapOf] - {@link orderMaps}'s.
 * @returns {T[]} A new array.
 */
export function orderSistemaMaps(items, sistemas, { sistemaOf = (item) => /** @type {any} */ (item).sistemaId, ...options } = {}) {
  const groups = new Map()
  items.forEach((item) => {
    const id = sistemaOf(item)
    if (!groups.has(id)) groups.set(id, [])
    groups.get(id).push(item)
  })
  return [...groups].flatMap(([id, group]) => orderMaps(group, sistemas.find((sistema) => sistema.id === id)?.mapOrder, options))
}

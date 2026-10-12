import SistemaModel from '@/models/SistemaModel.js'
import { useReorder } from '@/hooks/useReorder.js'

/**
 * Maps of one or more systems as editors reorder them ({@link useReorder}):
 * each map only among its own system's (`groupOf`), the system whose maps
 * moved saved with its new `mapOrder` (every map of it in the list).
 *
 * @param {Array<{id: string, sistemaId: string}>} maps - In their order (utils/sistemaMaps.js's orderSistemaMaps),
 *   each with the system holding it.
 * @param {Sistema[]} sistemas - Their systems (a name for the offline messages).
 * @returns {[string[], (ids: string[]) => Promise<void>, (id: string) => string]} The maps' ids in the order to show,
 *   the drop's handler, and a map's system (its group).
 */
export function useMapReorder(maps, sistemas) {
  const ids = maps.map((map) => map.id)
  const sistemaOf = new Map(maps.map((map) => [map.id, map.sistemaId]))
  const groupOf = (id) => sistemaOf.get(id)
  // The systems whose maps changed places (one, a drop moving a map within its own).
  const changed = (next) => [...new Set(maps.map((map) => map.sistemaId))].filter((sistemaId) => next.filter((id) => groupOf(id) === sistemaId).join(' ') !== ids.filter((id) => groupOf(id) === sistemaId).join(' '))
  const [order, reorder] = useReorder(
    ids,
    (next) => Promise.all(changed(next).map((sistemaId) => SistemaModel.save(sistemaId, { mapOrder: next.filter((id) => groupOf(id) === sistemaId) }))),
    // The offline messages name the list's first system (the page's own).
    { name: sistemas.find((sistema) => sistema.id === maps[0]?.sistemaId)?.name || '' },
  )
  return [order, reorder, groupOf]
}

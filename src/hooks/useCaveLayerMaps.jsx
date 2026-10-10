import { useEffect, useState } from 'react'
import { CAVE_LAYER } from '@/config/map.js'
import { subscribeHiddenMaps } from '@/services/caveLayerSettings.js'

// The maps in the cave layer's tiles (maps.json: name -> { title, date, sistemaId }),
// loaded once.
let mapIndex = null
const mapIndexLoading = fetch(CAVE_LAYER.MAPS)
  .then((response) => (response.ok ? response.json() : {}))
  .then((maps) => (mapIndex = maps))
  .catch(() => (mapIndex = {}))

/**
 * The layer's maps and the ones whose drawing is hidden for everyone
 * (caveLayerSettings), kept up to date.
 *
 * @returns {{maps: object, hiddenMaps: Array}}
 */
export function useCaveLayerMaps() {
  const [maps, setMaps] = useState(mapIndex || {})
  const [hiddenMaps, setHiddenMaps] = useState([])

  useEffect(() => {
    if (!mapIndex) mapIndexLoading.then(setMaps)
    return subscribeHiddenMaps(setHiddenMaps)
  }, [])

  return { maps, hiddenMaps }
}

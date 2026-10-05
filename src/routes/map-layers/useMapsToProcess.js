import { useEffect, useMemo, useState } from 'react'
import { useSelector } from 'react-redux'
import { collection } from 'firebase/firestore'
import { useCollection } from 'react-firebase-hooks/firestore'
import { db } from '@/config/firebase.js'
import { CAVE_LAYER } from '@/config/map.js'
import { isTrashed } from '@/utils/trash.js'

// The maps added in the app (no importKey: the bulk import's maps are
// another work list) that no map-layer config names yet (configs.json, from
// the tiles build: "mapId"), so still to be turned into the cave layer:
// toProcess; and those an admin marked not for the layer (layerSkipReason):
// skipped. Each { id, name, url, contentType, thumbnail, sistemas,
// layerSkipReason, layerSkippedBy, layerSkippedAt }. Computed, not stored: a
// map leaves the list as soon as the tiles are built with its config.
export function useMapsToProcess() {
  const [snapshot, loading] = useCollection(collection(db, 'maps'))
  const sistemas = useSelector((state) => state.data.sistemas)
  const [configured, setConfigured] = useState(null)

  useEffect(() => {
    fetch(CAVE_LAYER.CONFIGS)
      .then((response) => (response.ok ? response.json() : []))
      .then((configs) => setConfigured(new Set(configs.map((config) => config.mapId).filter(Boolean))))
      .catch(() => setConfigured(new Set()))
  }, [])

  return useMemo(() => {
    if (!snapshot || !configured) return { toProcess: [], skipped: [], loading: true }
    // Each map's systems (a sistema lists its maps).
    const sistemasOf = new Map()
    ;(sistemas || []).forEach((sistema) => (sistema.maps || []).forEach((mapId) => sistemasOf.set(mapId, [...(sistemasOf.get(mapId) || []), sistema.name?.value || sistema.name])))
    const added = snapshot.docs
      .filter((doc) => !isTrashed(doc) && !doc.get('importKey') && !configured.has(doc.id))
      .map((doc) => {
        const map = doc.data()
        return { ...map, id: doc.id, thumbnail: map.thumbnailUrl || map.previewUrl || (map.contentType?.startsWith('image/') ? map.url : null), sistemas: sistemasOf.get(doc.id) || [] }
      })
    return { toProcess: added.filter((map) => !map.layerSkipReason), skipped: added.filter((map) => map.layerSkipReason), loading }
  }, [snapshot, configured, sistemas, loading])
}

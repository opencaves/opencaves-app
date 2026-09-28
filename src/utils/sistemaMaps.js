// Maps are stored on sistemas, but a cave shows its own sistema's maps plus
// those of every ancestor sistema it's connected into (walking
// `connections`, like postProcessCaveData.js's ancestry). Returns
// `[{ id, sistemaId }]`, own sistema first, each map id once, tagged with the
// sistema that actually holds it so edits/removals target that sistema.
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

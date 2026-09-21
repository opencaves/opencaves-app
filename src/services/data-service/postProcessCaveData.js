import { findPhoneNumbersInText } from 'libphonenumber-js'
import { normalizeLengths } from '@/utils/lengths.jsx'
import { SISTEMA_DEFAULT_COLOR } from '@/config/map'

// Builds a markdown transformer that phone-number-links and cave-name-links
// (`[cenote X](oc:id)`) raw text, given the full cave list (needed upfront to
// know every cave name).
function buildMarkdown(caves) {
  const cenoteIdFromNameMap = new Map()

  for (const cave of caves) {
    if (cave.name?.value) {
      cenoteIdFromNameMap.set(cave.name.value.toLowerCase().trim(), cave.id)
    }
  }

  const cenoteNames = [...cenoteIdFromNameMap.keys()].sort().reverse()
  const cenoteNamesRegEx = cenoteNames.length
    ? new RegExp(`(^|[^\\[])(cenote\\s+)(${cenoteNames.join('|')})`, 'igu')
    : null

  function makeOCLinksFromCenoteNames(str) {
    if (!cenoteNamesRegEx) {
      return str
    }
    return str.replaceAll(cenoteNamesRegEx, function replacer(match, prefix, cenote, cenoteName) {
      return `${prefix}[${cenote}${cenoteName}](oc:${cenoteIdFromNameMap.get(cenoteName.toLowerCase())})`
    })
  }

  return function markdown(str) {
    if (!str) {
      return str
    }

    const country = 'MX'
    const slices = []
    let position = 0
    const matches = findPhoneNumbersInText(str, country)

    for (const match of matches) {
      const original = str.slice(match.startsAt, match.endsAt)
      const formattedNumber = `[${original}](${match.number.getURI()})`
      slices.push(str.slice(position, match.startsAt))
      slices.push(formattedNumber)
      position = match.endsAt
    }

    if (slices.length > 0) {
      slices.push(str.slice(position))
      str = slices.join('')
    }

    str = makeOCLinksFromCenoteNames(str)
    str = normalizeLengths(str)

    return str
  }
}

// Builds a per-cave sistema ancestry walker from the sistemas/connections
// collections. Mirrors the app's previous sheet-import-time
// getSistemaAncestry() computation, applied at read time instead, since
// Firestore stores each cave's direct sistemaId rather than a precomputed
// ancestry chain (which would otherwise go stale as sistemas/connections
// are edited independently of the caves that reference them).
function buildSistemaAncestryComputer(sistemas, connections) {
  const sistemaNamesFromId = new Map()
  const sistemasById = new Map()

  sistemas.forEach(sistema => {
    sistemaNamesFromId.set(sistema.id, sistema.name)
    sistemasById.set(sistema.id, sistema)
  })

  function getSistemaColor(sistemaId) {
    return sistemasById.get(sistemaId)?.color?.toLowerCase() || SISTEMA_DEFAULT_COLOR
  }

  // child sistemaId -> { id: parentSistemaId, date: connectionDate }
  const parentById = new Map()
  connections.forEach(connection => {
    if (connection.sistemaId && connection.parentSistemaId) {
      parentById.set(connection.sistemaId, { id: connection.parentSistemaId, date: connection.connectionDate })
    }
  })

  return function getSistemaAncestry(cave) {
    function pushParent(chain) {
      const currentSistemaId = chain[chain.length - 1].id
      const parent = parentById.get(currentSistemaId)

      if (parent) {
        chain.push({
          name: sistemaNamesFromId.get(parent.id) || 'n. d.',
          id: parent.id,
          date: parent.date,
          color: getSistemaColor(parent.id),
          u: false
        })
        pushParent(chain)
      }
    }

    if (!cave.sistemaId) {
      return null
    }

    const chain = [{
      name: sistemaNamesFromId.get(cave.sistemaId) || 'n. d.',
      id: cave.sistemaId,
      color: cave.sistemaColor
    }]
    pushParent(chain)

    return chain
  }
}

const CAVE_MARKDOWN_FIELDS = ['description', 'accessDetails', 'accessibilityDetails', 'direction']
const SISTEMA_MARKDOWN_FIELDS = ['description', 'direction']

// Turns the raw shape read from Firestore into the shape the app actually
// consumes: computes each cave's sistema ancestry and applies markdown
// linking, both left uncomputed in storage so they can't go stale as
// sistemas/connections/cave names are edited independently of each other.
export function postProcessCaveData(data) {
  const markdown = buildMarkdown(data.caves)
  const getSistemaAncestry = buildSistemaAncestryComputer(data.sistemas, data.connections)

  const caves = data.caves.map(cave => {
    const processed = { ...cave }

    CAVE_MARKDOWN_FIELDS.forEach(field => {
      if (processed[field]) {
        processed[field] = markdown(processed[field])
      }
    })

    const sistemas = getSistemaAncestry(cave)
    if (sistemas) {
      processed.sistemas = sistemas
    }

    return processed
  })

  const sistemas = data.sistemas.map(sistema => {
    const processed = { ...sistema }

    SISTEMA_MARKDOWN_FIELDS.forEach(field => {
      if (processed[field]) {
        processed[field] = markdown(processed[field])
      }
    })

    return processed
  })

  return {
    caves,
    sistemas,
    connections: data.connections,
    accesses: data.accesses,
    accessibilities: data.accessibilities,
    sources: data.sources,
    areas: data.areas,
    colors: [{ hex: '#ff0000', default: true }, ...data.colors],
    languages: data.languages
  }
}

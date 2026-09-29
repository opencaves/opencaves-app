import pushId from 'unique-push-id'
import { dashedId, str, bol, num, arrStr, loc } from './types.js'

const languagesMap = new Map()

const _objectIdMap = {}

function generateId() {
  return pushId()
}

function initIds(data) {

  data.caves.forEach(c => setId(c.id))

  data.sistemas.forEach(c => setId(c.id))

  data.connections.forEach(c => setId(c.id))

  data.access.forEach(c => setId(c.id))

  data.accessibility.forEach(c => setId(c.id))

  data.sources.forEach(c => setId(c.id))

  data.areas.forEach(c => {
    setId(c.Area)
  })
}

function initLangs(languageCodes) {
  languageCodes.forEach(l => languagesMap.set(l['English'], l['Code']))
}

function setId(oldId) {

  const newId = oldId

  if (str === 'Loading...') {
    oldId = generateId()
  }

  if (typeof _objectIdMap[oldId] === 'undefined') {
    _objectIdMap[oldId] = newId
  }

  return {
    $oid: newId
  }
}

function getId(oldId) {
  if (oldId === 'Loading...') {
    throw new Error('Found Loading... as oldId')
  }

  return _objectIdMap[oldId]
}

function getIdRef(oldId) {
  const newId = getId(oldId)
  return newId
}

function optional(o, props) {
  props.forEach(prop => {
    if (o[prop.old]) {
      let v = prop.fn(o[prop.old])
      if (v) {
        this[prop.new] = v
      }
    }
  })
}

function getCaveName(data) {
  if (!data['Cenote']) {
    return null
  }

  const name = {
    value: str(data['Cenote'])
  }

  if (data['Language Code (ISO-639-2)']) {
    name.languageCode = languagesMap.get(data['Language Code (ISO-639-2)'])
  }

  return name
}

function nameTrans(old) {
  const names = {}
  languagesMap.forEach((value, key) => {
    if (old[key]) {
      const newNameTrans = arrStr(old[key])
      if (newNameTrans) {
        names[value] = newNameTrans
      }
    }
  })
  if (Object.keys(names).length > 0) {
    return names
  }
  return
}

// The sheet's Team cells usually also hold the exploration's date after the
// team ("Devos, Riordan, 2008-02"; sometimes without the comma, "Bogaerts,
// Phillips 2004-09", or as a spaced range, "Wagner and Schmittner 1998 -
// 2001"): the whole trailing date - a year, month, day or year range - is
// split off.
const TRAILING_EXPLORATION_DATE = /^(.*?)[,\s]+(\d{4}\s*-\s*\d{4}|\d{4}(?:-\d{2}(?:-\d{2})?)?)$/

// { team, date } from a Team cell and its Date cell: whenever the team ends
// with a date, that whole date is the exploration's date and is removed from
// the team. `conflict` flags a Date cell that said something else (not the
// same date, nor a less precise one it falls within, like 1999 for
// 1999-07): the team's date still wins, the Date cell's is dropped - and
// reported (see teamDateConflicts).
export function splitExplorationTeam(team, date) {
  const match = TRAILING_EXPLORATION_DATE.exec(team || '')
  if (!match) return { team, date, conflict: false }
  const teamOnly = match[1].trim()
  const teamDate = match[2].replace(/\s+/g, '')
  const conflict = !!date && teamDate !== date && !teamDate.startsWith(`${date}-`)
  return { team: teamOnly, date: teamDate, conflict }
}

// Explorations whose Date cell disagreed with their team's date, for the
// migration script to report (the team's date was kept).
export const teamDateConflicts = []

// The Sistemas sheet records exploration history as numbered column groups
// ("Exploration 1 - Date"/"Exploration 1 - Team"/"Exploration 1 - Notes",
// "Exploration 2 - ...", currently up to 2) rather than a single flat set of
// columns, so each numbered group becomes one entry in the sistema's
// `explorations` array. The sheet has no per-exploration description column
// (that's markdown-only, entered directly in the admin UI), so it's left
// out of imported entries rather than forced to an empty string.
function getExplorations(old) {
  const explorations = []

  for (let i = 1; i <= 2; i++) {
    const rawDate = str(old[`Exploration ${i} - Date`])
    const rawTeam = str(old[`Exploration ${i} - Team`])
    const notes = str(old[`Exploration ${i} - Notes`])
    const { team, date, conflict } = splitExplorationTeam(rawTeam, rawDate)
    if (conflict) {
      teamDateConflicts.push({ sistema: str(old.Sistema) || str(old.id), team: rawTeam, date: rawDate })
    }

    if (date || team || notes) {
      const exploration = {}
      if (date) exploration.date = date
      if (team) exploration.team = team
      if (notes) exploration.notes = notes
      explorations.push(exploration)
    }
  }

  return explorations.length > 0 ? explorations : undefined
}

function canonicalizeVideoUrl(value) {
  const cleanValue = str(value)?.replace(/[\r\n\t]/g, '')
  if (!cleanValue) {
    return
  }

  try {
    const url = new URL(cleanValue)
    if (url.protocol !== 'https:' && url.protocol !== 'http:') {
      return cleanValue
    }

    if (url.hostname === 'youtu.be' || ['youtube.com', 'www.youtube.com', 'm.youtube.com'].includes(url.hostname)) {
      const videoId = url.hostname === 'youtu.be'
        ? url.pathname.split('/').filter(Boolean)[0]
        : url.searchParams.get('v') || url.pathname.match(/^\/(?:embed|shorts|live)\/([^/]+)/)?.[1]
      return videoId ? `https://www.youtube.com/watch?v=${encodeURIComponent(videoId)}` : cleanValue
    }

    if (['vimeo.com', 'www.vimeo.com', 'player.vimeo.com'].includes(url.hostname)) {
      const videoId = url.pathname.match(/^\/(?:video\/)?(\d+)/)?.[1]
      return videoId ? `https://vimeo.com/${videoId}` : cleanValue
    }

    if (['facebook.com', 'www.facebook.com', 'm.facebook.com'].includes(url.hostname)) {
      const videoUrl = url.pathname === '/plugins/video.php' ? url.searchParams.get('href') : url.href
      if (!videoUrl) {
        return cleanValue
      }

      const normalizedVideoUrl = new URL(videoUrl)
      normalizedVideoUrl.hash = ''
      return `https://www.facebook.com/plugins/video.php?href=${encodeURIComponent(normalizedVideoUrl.href)}&show_text=false`
    }
  } catch {
    return cleanValue
  }

  return cleanValue
}

function getVideoUrls(value) {
  return arrStr(value)?.map(canonicalizeVideoUrl).filter(Boolean)
}

/*
 * caves data
 */

function getCaves(data) {

  const caves = []

  data.caves.forEach((old) => {
    if (old.id !== '') {

      const newItem = {
        id: getId(old.id),
        name: getCaveName(old),
        keys: []
      }

      const caveLoc = loc(old, 'Longitude', 'Latitude', 'GPS valid')
      const keyLoc = loc(old, 'Key lng', 'Key lat')
      const entranceLoc = loc(old, 'Entrance lng', 'Entrance lat')
      const nameTranslations = nameTrans(old)

      optional.call(newItem, old, [
        {
          new: 'access',
          old: 'Access',
          fn: dashedId
        },
        {
          new: 'accessDetails',
          old: 'Access details',
          fn: str
        },
        {
          new: 'accessibility',
          old: 'Accessibility',
          fn: dashedId
        },
        {
          new: 'accessibilityDetails',
          old: 'Accessibility details',
          fn: str
        },
        {
          new: 'aka',
          old: 'AKA',
          fn: arrStr
        },
        {
          new: 'area',
          old: 'Area',
          fn: getIdRef
        },
        {
          new: 'description',
          old: 'Description',
          fn: str
        },
        {
          new: 'direction',
          old: 'Getting there',
          fn: str
        },
        {
          new: 'activities',
          old: 'Activities',
          fn: bol
        },
        {
          new: 'fees',
          old: 'Fees',
          fn: bol
        },
        {
          new: 'facilities',
          old: 'Facilities',
          fn: bol
        },
        {
          new: 'sistemaColor',
          old: 'Sistema color',
          fn: str
        },
        {
          new: 'source',
          old: 'Source ID',
          fn: getIdRef
        },
        {
          new: 'explorationDate',
          old: 'Exploration Date',
          fn: str
        },
        {
          new: 'rating',
          old: 'rating',
          fn: num
        },
        {
          new: 'reporter',
          old: 'Reported By',
          fn: str
        },
        {
          new: 'note',
          old: 'Note',
          fn: str
        },
        {
          new: 'coverImage',
          old: 'coverImage',
          fn: str
        },
        {
          new: 'videos',
          old: 'Videos',
          fn: getVideoUrls
        }
      ])

      if (nameTranslations) {
        newItem.nameTranslations = nameTranslations
      }

      if (caveLoc) {
        newItem.location = caveLoc
      }

      if (keyLoc) {
        newItem.keys.push(keyLoc)
      }

      if (entranceLoc) {
        newItem.entrance = entranceLoc
      }

      if (old['Original Sistema ID'] && old['Original Sistema ID'] !== '#N/A' && old['Original Sistema ID'] !== 'Loading...' && old['Original Sistema ID'] !== '#ERROR!') {
        newItem.sistemaId = getIdRef(old['Original Sistema ID'])
      }

      caves.push(newItem)

    }
  })

  return caves
}


/*
 * Sistemas data
 */

function getSistemas(data) {

  let sistemas = []

  data.sistemas.forEach((old) => {
    if (old.id !== '') {
      let sistemaLoc = loc(old, 'lng', 'lat', 'GPS valid'),
        nameTranslations = nameTrans(old),
        newItem = {
          id: getId(old.id),
          public: true
        }

      optional.call(newItem, old, [{
        new: 'aka',
        old: 'AKA',
        fn: arrStr
      },
      {
        new: 'area',
        old: 'Area',
        fn: getIdRef
      },
      {
        new: 'name',
        old: 'Sistema',
        fn: str
      },
      {
        new: 'color',
        old: 'Sistema color',
        fn: str
      },
      {
        new: 'description',
        old: 'Description',
        fn: str
      },
      {
        new: 'direction',
        old: 'Getting there',
        fn: str
      },
      {
        new: 'length',
        old: 'Total linear distance explored (m)',
        fn: num
      },
      {
        new: 'maxDepth',
        old: 'Depth (m)',
        fn: num
      },
      {
        new: 'source',
        old: 'Source ID',
        fn: getIdRef
      },
      {
        new: 'note',
        old: 'Note',
        fn: str
      },
      {
        new: 'coverImage',
        old: 'coverImage',
        fn: str
      }, {
        new: 'maps',
        old: 'maps',
        fn: arrStr
      }
      ])

      if (nameTranslations) {
        newItem.nameTranslations = nameTranslations
      }

      if (sistemaLoc) {
        newItem.location = sistemaLoc
      }

      const explorations = getExplorations(old)
      if (explorations) {
        newItem.explorations = explorations
      }

      sistemas.push(newItem)

    }
  })

  return sistemas
}

/*
 * Sistemas tree data
 */

function getConnections(data) {

  const connections = []
  const connectionsIdx = {}

  data.connections.forEach((old) => {
    if (old.id !== '' && old['Sistema ID'] !== '#N/A') {
      let newItem = {
        id: getId(old.id)
      }

      connectionsIdx[newItem.sistemaId] = true

      optional.call(newItem, old, [{
        new: 'sistemaId',
        old: 'Sistema ID',
        fn: getIdRef
      },
      {
        new: 'parentSistemaId',
        old: 'New name ID',
        fn: getIdRef
      },
      {
        new: 'source',
        old: 'Source ID',
        fn: getIdRef
      },
      {
        new: 'connectionDate',
        old: 'Date',
        fn: str
      },
      {
        new: 'reporter',
        old: 'Reported By',
        fn: str
      },
      {
        new: 'note',
        old: 'Note',
        fn: str
      }
      ])

      connections.push(newItem)
    }
  })

  const newConnections = []

  connections.forEach(connection => {
    if (connection.parentSistemaId && !(connection.parentSistemaId in connectionsIdx)) {
      connectionsIdx[connection.parentSistemaId] = true
      const newConnection = {
        id: generateId(),
        sistemaId: connection.parentSistemaId
      }
      connections.push(newConnection)
      newConnections.push(newConnection)
    }
  })

  return connections
}

/*
 * Access
 */

function getAccesses(data) {

  const accesses = []

  data.access.forEach((old) => {
    if (old.id !== '') {
      const description = str(old.Description)
      var newItem = {
        id: dashedId(old.Access),
        name: str(old.Access),
        descriptions: description ? [{ lang: 'eng', description }] : [],
        note: str(old.Note)
      }

      accesses.push(newItem)

    }
  })
  return accesses
}

/*
 * Accessibility
 */

function getAccessibilities(data) {

  const accessibilities = []

  data.accessibility.forEach((old) => {
    if (old.id !== '') {
      const description = str(old.Description)
      var newItem = {
        id: dashedId(old.Accessibility),
        name: str(old.Accessibility),
        descriptions: description ? [{ lang: 'eng', description }] : [],
        note: str(old.Note)
      }

      accessibilities.push(newItem)

    }
  })
  return accessibilities
}

/*
 * Sources
 */

function getSources(data) {

  let sources = []

  data.sources.forEach((old) => {
    if (old.id !== '') {
      var newItem = {
        id: getId(old.id),
        name: str(old.Source),
        description: str(old.Description),
        note: str(old.Note)
      }

      sources.push(newItem)

    }
  })
  return sources
}

/*
 * Areas
 */

function getAreas(data) {

  let areas = []

  data.areas.forEach((old) => {
    if (old.id !== '') {
      var newItem = {
        id: getId(old.Area),
        name: str(old.Area),
        note: str(old.Note)
      }

      areas.push(newItem)

    }
  })
  return areas
}

/*
 * Colors
 */

// The default red color ({hex:'#ff0000', default:true}) is a code constant
// injected at read time by postProcessCaveData.js, not stored data - keep it
// out of here so it isn't written to Firestore and duplicated on read.
function getColors(data) {

  return data.colors.map(color => ({ hex: color.Color }))
}

/* Languages
 *
 */

function getLanguages(data) {
  return data.languageCodes.map(l => ({
    code: l['Code'],
    eng: l['English'],
    fra: l['French']
  }))
}

// Produces the Firestore "storage" shape: raw (untransformed) markdown text
// and a plain sistemaId/sistemaColor foreign key on each cave, rather than
// the fully-linked markdown and precomputed sistema ancestry the app used to
// consume directly. Those two derived pieces are now computed client-side at
// read time, in postProcessCaveData.js, from whatever's actually in Firestore
// — see that file for why.
export function processDataForStorage(data) {

  initIds(data)
  initLangs(data.languageCodes)

  const result = {
    caves: getCaves(data),
    sistemas: getSistemas(data),
    connections: getConnections(data),
    accesses: getAccesses(data),
    accessibilities: getAccessibilities(data),
    sources: getSources(data),
    areas: getAreas(data),
    colors: getColors(data),
    languages: getLanguages(data)
  }

  return result
}

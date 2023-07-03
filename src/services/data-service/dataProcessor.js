import pushId from 'unique-push-id'
import { dashedId, str, Markdown, bol, num, arrStr, loc } from './types.js'
import { SISTEMA_DEFAULT_COLOR } from '../../config/map'

const languagesMap = new Map()

const _objectIdMap = {}

const sistemaNamesFromId = new Map()

let markdown

function generateId() {
  return pushId()
}

const sistemas = new Map()
const connectionsMap = new Map()

function setCaveIdx(cenotes) {
  const cenoteIdFromNameMap = new Map()

  for (const cenote of cenotes) {
    if (cenote['Cenote']) {
      cenoteIdFromNameMap.set(cenote['Cenote'].toLowerCase().trim(), cenote.id)
    }
  }
  const cenoteNames = [...cenoteIdFromNameMap.keys()].sort().reverse()
  const cenoteNamesRegEx = new RegExp(`(^|[^\\[])(cenote\\s+)(${cenoteNames.join('|')})`, 'igu')

  function makeOCLinksFromCenoteNames(str) {
    return str.replaceAll(cenoteNamesRegEx, function replacer(match, prefix, cenote, cenoteName) {
      return `${prefix}${cenote}[${cenoteName}](oc:${cenoteIdFromNameMap.get(cenoteName.toLowerCase())})`
    })
  }

  markdown = new Markdown({ makeOCLinksFromCenoteNames })
}

function setSistemaIdx(sis) {
  for (const sistema of sis) {
    sistemas.set(sistema.id, sistema)
  }
}

function initConnectionsMap(connections) {
  connections.forEach(connection => {
    const id = connection['New name ID']
    const date = connection['Date']
    const sistemaData = connectionsMap.get(id)

    const connectionMap = { id, date }
    if (sistemaData) {
      connectionMap.color = getSistemaColor(sistemaData.id)
    }

    connectionsMap.set(connection['Sistema ID'], connectionMap)
  })
}

function initIds(data) {

  data.caves.forEach(c => setId(c.id))

  data.sistemas.forEach(c => setId(c.id))

  data.connections.forEach(c => setId(c.id))

  data.access.forEach(c => setId(c.id))

  data.accessibility.forEach(c => setId(c.id))

  // data.accessibility.forEach(c => {
  //   if (accessMap.has(c.Accessibility)) {
  //     setId(c.id)
  //   }
  //   if (accessibilityMap.has(c.Accessibility)) {
  //     setId(c.id)
  //   }
  // })

  data.sources.forEach(c => setId(c.id))

  data.areas.forEach(c => {
    //console.log(`[initIds#areas] ${JSON.stringify(c.Area)}`);
    setId(c.Area)
  })
}

function initLangs(languageCodes) {
  languageCodes.forEach(l => languagesMap.set(l['English'], l['Code']))
}

function initLabels(data) {
  data.sistemas.forEach(s => {
    sistemaNamesFromId.set(getIdRef(s.id), s.Sistema)
  })
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
  //console.log(`[getId] oldId: '${oldId}'`);
  if (oldId === 'Loading...') {
    throw new Error('Found Loading... as oldId')
  }

  return _objectIdMap[oldId]
}

function getIdRef(oldId) {
  const newId = getId(oldId)
  //console.log(`[getIdRef] oldId: '${oldId}', newId: '${JSON.stringify(newId)}'`);

  //return newId.$oid;
  return newId
}

function getSistemaColor(sistemaId) {
  const sistema = sistemas.get(sistemaId)
  return sistema?.['Sistema color']?.toLowerCase() || SISTEMA_DEFAULT_COLOR
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

function getSistemaAncestry(cave) {

  function getSistemaParent(sistemas) {
    const currentSistemaId = sistemas[sistemas.length - 1].id

    if (connectionsMap.has(currentSistemaId)) {
      const parentSistema = connectionsMap.get(currentSistemaId)

      sistemas.push({ name: sistemaNamesFromId.get(parentSistema.id) || 'n. d.', id: parentSistema.id, date: parentSistema.date, color: getSistemaColor(parentSistema.id), u: false })
      getSistemaParent(sistemas)
    }
  }

  const sistemas = []

  if (cave['Original Sistema ID'] && cave['Original Sistema ID'] !== '#N/A' && cave['Original Sistema ID'] !== 'Loading...' && cave['Original Sistema ID'] !== '#ERROR!') {
    const id = getIdRef(cave['Original Sistema ID'])
    sistemas.push({ name: sistemaNamesFromId.get(id) || 'n. d.', id, color: cave['Sistema color'], t: true })

    getSistemaParent(sistemas)
  }

  return sistemas.length ? sistemas : null
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
      const sistemas = getSistemaAncestry(old)
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
          fn: markdown
        },
        {
          new: 'accessibility',
          old: 'Accessibility',
          fn: dashedId
        },
        {
          new: 'accessibilityDetails',
          old: 'Accessibility details',
          fn: markdown
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
          fn: markdown
        },
        {
          new: 'direction',
          old: 'Getting there',
          fn: markdown
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
        // {
        //   new: 'color',
        //   old: 'Sistema color',
        //   fn: str
        // },
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
          new: 'maps',
          old: 'maps',
          fn: arrStr
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

      // if (caveSistemas && Object.keys(caveSistemas).length) {
      //   Object.keys(caveSistemas).forEach(key => newItem[key] = caveSistemas[key])
      // }

      if (sistemas) {
        // newItem
        newItem.sistemas = sistemas
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
        fn: markdown
      },
      {
        new: 'direction',
        old: 'Getting there',
        fn: markdown
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
        new: 'explorationDate',
        old: 'Exploration Date',
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

  let i = 0
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
      i++
    }
  })

  console.log(`${i} connections added: %o`, newConnections)
  console.log('connections: %o', connections)

  return connections
}

/*
 * Access
 */

function getAccesses(data) {

  const accesses = []

  data.access.forEach((old) => {
    if (old.id !== '') {
      var newItem = {
        id: dashedId(old.Access),
        name: str(old.Access),
        description: str(old.Description),
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
      var newItem = {
        id: dashedId(old.Accessibility),
        name: str(old.Accessibility),
        description: str(old.Description),
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

function getColors(data) {

  return [{ hex: '#ff0000', default: true }, ...data.colors.map(color => ({ hex: color.Color }))]
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

/*
 * QRSS classification
 */
/*
function getClassification(data) {

    let connections = [];

    Object.keys(data['qrss-classification']).forEach((sistemaNodeId) => {
        if (id !== '') {
            var old = data['QRSS classification'][id],
                newItem = {
                    name: {
                        name: str(old.Name),
                        spanish: str(old.Spanish),
                        aka: arr(old.AKA)
                    },
                    definition: str(old.Definition),
                    note: str(old.Note)
                };

            newItem.type = "classification";

            var entry = QRSSClassification.child(id);
            entry.set(newItem).then(function() {
                console.log('%s added.', newItem.name);

            }, function(e) {
                console.error('ERROR %s', e);
            });

        };
    });
}
*/

export function processData(data) {

  initIds(data)
  initLangs(data.languageCodes)
  setCaveIdx(data.caves)
  setSistemaIdx(data.sistemas)
  initConnectionsMap(data.connections)

  initLabels(data)

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
  //console.log('ids in text: %s', idsInTxt)
  //console.log(linksInTxt)

  // const t = new Map()
  // let found = false

  // for (const cave of result.caves) {
  //   if (t.has(cave.id)) {
  //     console.log('We have double ids: %o / %o', t.get(cave.id), cave)
  //     found = true
  //   }
  // }

  // if (!found) {
  //   console.log('Did not find any double ids')
  // }

  return result
}
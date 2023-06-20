import ObjectID from 'bson-objectid'
import { colorMap, defaultColor } from './color-map'
import { findPhoneNumbersInText } from 'libphonenumber-js'


const languagesMap = new Map([
  ['Spanish', 'es'],
  ['English', 'en'],
  ['Mayan', 'myn']
])

const locationValidityValueMap = new Map([
  ['yes', 'valid'],
  ['no', 'invalid'],
  ['', 'unknown']
])

function generateId() {
  return ObjectID().toHexString()
}

// function generateId() {
//     return uuid();
// }

const sistemas = new Map()
const connectionsMap = new Map()
const sistemasColorMap = new Map()

function setSistemaIdx(sis) {
  for (const sistema of sis) {
    sistemas.set(sistema.id, sistema)
  }
}

const notes = []

function initConnectionsMap(connections) {
  connections.forEach(connection => {
    const id = connection['New name ID']
    const date = connection['Date']
    const sistemaData = connectionsMap.get(id)

    const connectionMap = { id, date }
    if (sistemaData) {
      connectionMap.color = getSistemaColor(sistemaData.id)
    }

    if (Reflect.has(connection, 'AKA')) {
      connectionMap.aka = connection['AKA'].split('|')
    }

    connectionsMap.set(connection['Sistema ID'], connectionMap)
    sistemasColorMap.set(connection['SistemaID'], connection['Sistema color'])
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

  idsRegEx = new RegExp(Object.keys(_objectIdMap).join('|'), 'g')

  //console.log(_objectIdMap)
}

function initLabels(data) {
  data.sistemas.forEach(s => {
    sistemaNamesFromId.set(getIdRef(s.id), s.Sistema)
  })
}

function setNote(data) {
  const note = {
    id: generateId(),
    note: data
  }
  notes.push(note)

}

const _objectIdMap = {}

const sistemaNamesFromId = new Map()

let idsRegEx

function setId(oldId) {

  const newId = oldId
  // const newId = generateId();

  if (str === 'Loading...') {
    oldId = generateId()
  }

  if (typeof _objectIdMap[oldId] === 'undefined') {
    _objectIdMap[oldId] = newId
  }

  //console.log(`[setId] oldId: ${oldId}, newId: ${newId}`);

  return {
    $oid: newId
  }
}

// function setId(str) {
//     const newId = ObjectID().toHexString();

//     let oldId = newId;

//     if (str) {
//         if (str === 'Loading...') {
//             //o[idProp] = newId;
//         } else {
//             oldId = str;
//         }
//     }

//     if (typeof _objectIdMap[oldId] === 'undefined') {
//         _objectIdMap[oldId] = newId;
//     }

//     //console.log(`[setId] oldId: ${oldId}, newId: ${newId}`);

//     return {
//         $oid: newId
//     };
// }

function getId(oldId) {
  //console.log(`[getId] oldId: '${oldId}'`);
  if (oldId === 'Loading...') {
    throw new Error('Found Loading... as oldId')
  }

  // return {
  //     $oid: _objectIdMap[oldId]
  // }

  return _objectIdMap[oldId]
}

function getIdRef(oldId) {
  const newId = getId(oldId)
  //console.log(`[getIdRef] oldId: '${oldId}', newId: '${JSON.stringify(newId)}'`);

  //return newId.$oid;
  return newId
}

function replaceIdsInHtmlForLink(string) {
  return string.replace(idsRegEx, function (k) {
    return `<a href="/${getIdRef(k)}">${k}</a>`
    // return `<router-link to="/${getIdRef(k)}">${k}</router-link>`
  })
}

function isEmpty(val) {
  if (typeof val === 'undefined') {
    return true
  }
  return typeof val === 'string' && val.trim() === ''
}

function getSistemaColor(color) {
  color = color.toLowerCase()
  const ret = typeof colorMap[color] === 'undefined' || colorMap[color] === '' ? defaultColor : colorMap[color]

  return ret
}

/*
 * Types functions
 */

function dashedId(str) {
  if (isEmpty(str)) {
    return
  }
  return str.trim().toLowerCase().replace(/\s+/g, '-')
}

function locationValidityValue(oldValue) {
  if (!locationValidityValueMap.has(oldValue)) {
    throw new Error(`'${oldValue}' is not a proper location.valid value`)
  }

  return locationValidityValueMap.get(oldValue)
}

function str(str) {
  if (isEmpty(str)) {
    return
  }
  return str.trim()
}

function arrMapUrls(str) {
  return (str || '').split('|')
}

function markdown(str) {
  const country = 'MX'
  const slices = []
  let position = 0
  const matches = findPhoneNumbersInText(str, country)

  for (const match of matches) {
    const original = str.slice(match.startsAt, match.endsAt)
    const formattedNumber = `[${original}](${match.number.getURI()})`
    // const formattedNumber = `${match.number.getURI()}`
    slices.push(str.slice(position, match.startsAt))
    slices.push(formattedNumber)
    position = match.endsAt
  }

  if (slices.length > 0) {
    slices.push(str.slice(position))
    str = slices.join('')
  }

  // var links = str.match(/\[[^\]]+\]/g)
  // if (links) {
  //   linksInTxt.push(...links)
  // }
  // str = replaceIdsInHtmlForLink(str)

  return str
}

function bol(str) {
  if (isEmpty(str)) {
    return
  }
  return (str === 'yes') ? true : (str === 'no') ? false : undefined
}

function num(num, digits) {
  //return isEmpty(num) ? undefined : new Number(('' + num).replace(/\s/, ''));
  const ret = Number(('' + num).replace(/\s/, ''))

  if (digits) {
    return parseFloat(ret.toFixed(digits))
  }

  return ret
}

function arr(str) {
  if (isEmpty(str)) {
    return
  }
  return str.split('|')

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
    name.ISO6392LanguageCode = languagesMap.get(data['Language Code (ISO-639-2)'])
  }

  return name
}

function loc(obj, lngProp, latProp, validProp = null) {
  if (typeof obj[lngProp] === 'undefined' || obj[lngProp] === '' || obj[latProp] === '') {
    return
  }

  const location = {
    longitude: num(obj[lngProp], 5),
    latitude: num(obj[latProp], 5)
  }

  if (validProp && Reflect.has(obj, validProp)) {
    location.validity = locationValidityValue(obj[validProp])
  }

  return location
}

function getCaveSistemas(cave) {

  function getSistemaAncestry(sistemas) {
    const currentSistemaId = sistemas[sistemas.length - 1].id

    if (connectionsMap.has(currentSistemaId)) {
      const parentSistema = connectionsMap.get(currentSistemaId)
      sistemas.push({ name: sistemaNamesFromId.get(parentSistema.id) || 'n. d.', id: parentSistema.id, date: parentSistema.date, color: parentSistema.color })
      getSistemaAncestry(sistemas)
    }
  }

  const sistemas = []

  if (cave['Original Sistema ID'] && cave['Original Sistema ID'] !== '#N/A' && cave['Original Sistema ID'] !== 'Loading...' && cave['Original Sistema ID'] !== '#ERROR!') {
    const originalSistemaId = getIdRef(cave['Original Sistema ID'])
    sistemas.push({ name: sistemaNamesFromId.get(originalSistemaId) || 'n. d.', id: originalSistemaId, color: cave['Sistema color'] })

    getSistemaAncestry(sistemas)
  }

  return sistemas
}

function nameTrans(old) {
  const names = {}
  languagesMap.forEach((value, key) => {
    if (old[key]) {
      names[value] = old[key]
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
      const sistemas = getCaveSistemas(old)
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
          fn: arr
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
        {
          new: 'color',
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
          new: 'maps',
          old: 'maps',
          fn: arrMapUrls
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
        fn: arr
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
        fn: arrMapUrls
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

  let connections = []
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
  connections.forEach(connection => {
    if (connection.parentSistemaId && !(connection.parentSistemaId in connectionsIdx)) {
      connectionsIdx[connection.parentSistemaId] = true
      connections.push({
        id: generateId(),
        sistemaId: connection.parentSistemaId
      })
      i++
    }
  })
  console.log(`${i} connections added.`)
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

// function getAccessibilities(data) {

//   let accessibilities = [],
//     done = {}

//   data['accessibility'].forEach(old => {
//     //console.log(old)
//     if ([...accessibilityMap.keys()].includes(old.Accessibility.toLowerCase()) && !Reflect.has(done, accessibilityMap.get(old.Accessibility))) {
//       done[accessibilityMap.get(old.Accessibility)] = true
//       let newItem = {
//         id: getId(old.id),
//         key: accessibilityMap.get(old.Accessibility),
//         description: accessDescs.get(accessibilityMap.get(old.Accessibility))
//       }

//       //newItem.type = "accessibility";

//       accessibilities.push(newItem)
//     }
//   })

//   return accessibilities
// }

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
    colors: getColors(data)
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
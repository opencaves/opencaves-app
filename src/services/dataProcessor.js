import ObjectID from 'bson-objectid'
import { colorMap } from './color-map'


function generateId() {
  return ObjectID().toHexString()
}

// function generateId() {
//     return uuid();
// }

const colorIdxMapping = {}

const defaultColorId = generateId()

function setColorIdx() {
  const newColorsMap = {}
  Object.keys(colorMap).forEach(k => {
    newColorsMap[colorMap[k]] = 1
  })

  Object.keys(newColorsMap).forEach((color) => {
    color = color.toLowerCase()
    const id = (color === '#ff0000') ? defaultColorId : generateId()
    colorIdxMapping[color] = id
  })
}

/*
  access[]
     . yes			open, 'open - key', 'open - sea'
     . no			closed, forbidden, private
     . private		'permission needed'
     . permissive
     . customers	'member only', restricted

  fee
     . no
     . yes

  accessibility[]
     . jungle
     . unsafe		'not safe'
     . key			'open - key'
     . sidemount	sidemount
     . variable
     .
*/

const accessMap = new Map([
  ['closed', 'no'],
  ['forbidden', 'no'],
  ['member only', 'customers'],
  ['open', 'yes'],
  ['open - key', 'yes'],
  ['permission needed', 'permission'],
  ['private', 'no'],
  ['restricted', 'customers'],
  ['open - sea', 'yes']
])


const accessibilityMap = new Map([
  ['jungle', 'jungle'],
  ['not safe', 'unsafe'],
  ['open - key', 'key'],
  ['sidemount only', 'sidemount'],
  ['open - sea', 'sea']
])

const accessDescs = new Map([
  ['yes', 'The site is accessible to anyone.'],
  ['no', 'No access for the general public.'],
  ['permission', 'Only with permission of the owner on an individual basis.'],
  ['customers', 'Only for customers.'],

  ['jungle', 'There is no path leading to the cave.'],
  ['unsafe', 'The site is considered not safe to dive for various reasons.'],
  ['key', 'A key must be obtained to access the site.'],
  ['sidemount', 'A sidemount certification card is required to access the site.'],
  ['sea', 'The access is made from sea.']
])

var linksInTxt = []

const notes = []

function setNote(data) {
  const note = {
    id: generateId(),
    note: data
  }
  notes.push(note)

}

const _objectIdMap = {}

const namesFromId = new Map()

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

function initIds(data) {

  data.caves.forEach(c => setId(c.id))

  data.sistemas.forEach(c => setId(c.id))

  data['old-sistemas'].forEach(c => setId(c.id))

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
    namesFromId.set(getIdRef(s.id), s.Sistema)
  })
}

// function replaceIdsInString(string) {
//   return string.replace(idsRegEx, function (k) {
//     idsInTxt++;
//     return getIdRef(k);
//   })
// }

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

function colorId(color) {
  color = color.toLowerCase()
  const ret = typeof colorMap[color] === 'undefined' || colorMap[color] === '' ? defaultColorId : colorMap[color]

  return ret
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

function html(str) {
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

function num(num) {
  //return isEmpty(num) ? undefined : new Number(('' + num).replace(/\s/, ''));
  return Number(('' + num).replace(/\s/, ''))
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

function loc(obj, lngProp, latProp, validProp = null) {
  if (typeof obj[lngProp] === 'undefined' || obj[lngProp] === '' || obj[latProp] === '') {
    return
  }

  const location = {
    longitude: num(obj[lngProp]),
    latitude: num(obj[latProp])
  }

  if (validProp && Reflect.has(obj, validProp) && obj[validProp] !== '') {
    location.valid = bol(obj[validProp])
  }

  return location
}

function caveSis(c) {
  const sis = {}
  if (c['Sistema ID'] && c['Sistema ID'] !== '#N/A' && c['Sistema ID'] !== 'Loading...' && c['Sistema ID'] !== '#ERROR!') {
    const newId = getIdRef(c['Sistema ID'])
    sis.sistemaId = newId
    if (namesFromId.has(newId)) {
      sis.sistemaName = namesFromId.get(newId)
    }
  }
  if (c['Original Sistema ID'] && c['Original Sistema ID'] !== '#N/A' && c['Original Sistema ID'] !== 'Loading...' && c['Original Sistema ID'] !== '#ERROR!') {
    const newId = getIdRef(c['Original Sistema ID'])
    sis.originalSistemaId = newId
    if (namesFromId.has(newId)) {
      sis.originalSistemaName = namesFromId.get(newId)
    }
  }

  return sis
}

function nameTrans(old) {
  let names = {},
    found = false;
  [
    ['Spanish', 'es'],
    ['English', 'en']
  ].forEach(n => {
    if (old[n[0]]) {
      found = true
      names[n[1]] = old[n[0]]
    }
  })
  if (found) {
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
        color: colorId(old['Sistema color']),
        keys: []
      }

      const caveLoc = loc(old, 'long-final', 'lat-final', 'GPS valid')
      const keyLoc = loc(old, 'Key lng', 'Key lat')
      const entranceLoc = loc(old, 'Entrance lng', 'Entrance lat')
      const caveSistemas = caveSis(old)
      const nameTranslations = nameTrans(old)

      optional.call(newItem, old, [
        {
          new: 'access',
          old: 'Access ID',
          fn: str
        },
        {
          new: 'accessDetails',
          old: 'Access details',
          fn: html
        },
        {
          new: 'accessibility',
          old: 'Accessibility ID',
          fn: str
        },
        {
          new: 'accessDetails',
          old: 'Accessibility details',
          fn: html
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
          fn: html
        },
        {
          new: 'direction',
          old: 'Getting there',
          fn: html
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
          new: 'name',
          old: 'Cenote',
          fn: str
        },
        {
          new: 'source',
          old: 'Source ID',
          fn: getIdRef
        },
        {
          new: 'created',
          old: 'Creation Date',
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

      if (caveSistemas && Object.keys(caveSistemas).length) {
        Object.keys(caveSistemas).forEach(key => newItem[key] = caveSistemas[key])
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
          public: true,
          color: colorId(old['Sistema color'])
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
      }, {
        new: 'name',
        old: 'Sistema',
        fn: str
      },
      {
        new: 'description',
        old: 'Description',
        fn: html
      },
      {
        new: 'direction',
        old: 'Getting there',
        fn: html
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
        new: 'created',
        old: 'Creation Date',
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

  data['old-sistemas'].forEach((old) => {
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
        id: getId(old.id),
        name: str(old.Access),
        description: str(old.Description),
        note: str(old.Note)
      }

      accesses.push(newItem)

    }
  })
  return accesses
}

// function getAccesses(data) {

//   let access = [],
//     done = {}

//   data['accessibility'].forEach((old) => {
//     //console.log(old)
//     if (old.Accessibility.toLowerCase() in accessMap && !Object.prototype.hasOwnProperty.call(done, accessMap[old.Accessibility])) {
//       done[accessMap.get(old.Accessibility)] = true
//       let newItem = {
//         id: getId(old.id),
//         key: accessMap.get(old.Accessibility),
//         description: accessDescs.get(accessMap.get(old.Accessibility))
//       }

//       access.push(newItem)
//     }
//   })

//   return access
// }

/*
 * Accessibility
 */

function getAccessibilities(data) {

  const accessibilities = []

  data.accessibility.forEach((old) => {
    if (old.id !== '') {
      var newItem = {
        id: getId(old.id),
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
  setColorIdx()

  initLabels(data)

  const colors = []

  for (var key in colorIdxMapping) {
    const color = {
      id: colorIdxMapping[key],
      hex: key
    }
    if (color.id === defaultColorId) {
      color.default = true
    }
    colors.push(color)
  }

  //console.info(colors);

  const result = {
    caves: getCaves(data),
    sistemas: getSistemas(data),
    connections: getConnections(data),
    accesses: getAccesses(data),
    accessibilities: getAccessibilities(data),
    sources: getSources(data),
    areas: getAreas(data),
    colors
  }
  //console.log('ids in text: %s', idsInTxt)
  //console.log(linksInTxt)

  return result
}

import { findPhoneNumbersInText } from 'libphonenumber-js'

const locationValidityValueMap = new Map([
  ['yes', 'valid'],
  ['no', 'invalid'],
  ['', 'unknown']
])

function getLocationValidityValue(oldValue) {
  if (!locationValidityValueMap.has(oldValue)) {
    throw new Error(`'${oldValue}' is not a proper location.valid value`)
  }

  return locationValidityValueMap.get(oldValue)
}

function isEmpty(val) {
  if (typeof val === 'undefined') {
    return true
  }
  return typeof val === 'string' && val.trim() === ''
}

export function dashedId(str) {
  if (isEmpty(str)) {
    return
  }
  return str.trim().toLowerCase().replace(/\s+/g, '-')
}

export function str(str) {
  if (isEmpty(str)) {
    return
  }
  return str.trim()
}

export function Markdown({ makeOCLinksFromCenoteNames }) {
  return function markdown(str) {
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

    str = makeOCLinksFromCenoteNames(str)

    // var links = str.match(/\[[^\]]+\]/g)
    // if (links) {
    //   linksInTxt.push(...links)
    // }
    // str = replaceIdsInHtmlForLink(str)

    return str
  }
}

export function markdown(str) {
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

export function bol(str) {
  if (isEmpty(str)) {
    return
  }
  return (str === 'yes') ? true : (str === 'no') ? false : undefined
}

export function num(num, digits) {
  //return isEmpty(num) ? undefined : new Number(('' + num).replace(/\s/, ''));
  const ret = Number(('' + num).replace(/\s/, ''))

  if (digits) {
    return parseFloat(ret.toFixed(digits))
  }

  return ret
}

export function arrStr(str) {
  if (isEmpty(str)) {
    return
  }
  return str.split('|')
}

export function loc(obj, lngProp, latProp, validProp = null) {
  if (typeof obj[lngProp] === 'undefined' || obj[lngProp] === '' || obj[latProp] === '') {
    return
  }

  const location = {
    longitude: num(obj[lngProp], 5),
    latitude: num(obj[latProp], 5)
  }

  if (validProp && Reflect.has(obj, validProp)) {
    location.validity = getLocationValidityValue(obj[validProp])
  }

  return location
}
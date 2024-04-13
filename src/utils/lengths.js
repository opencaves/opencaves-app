const defaultFormatProps = { maximumSignificantDigits: 2, style: 'unit' }

function re(...parts) {
  return parts.map(x => (x instanceof RegExp) ? x.source : x).join('')
}

const footFormatProps = { ...defaultFormatProps, unit: 'foot' }
const meterFormatProps = { ...defaultFormatProps, unit: 'meter' }

function round(number, precision) {
  const pow = Math.pow(10, precision)
  return Math.round((number + Number.EPSILON) * pow) / pow
}

function nbsp(str) {
  return `${str}`.replaceAll(/\s /g, '\xa0')
}

export function formatLength(length, { unit, locale } = { unit: 'meter', locale: 'en' }) {

  if (unit === 'meter') {
    const lengthInFeet = length / 0.3048
    let adjustedLengthInMeter
    let adjustedLengthInFeet

    switch (true) {
      case length < 10:
        adjustedLengthInMeter = round(length, 1)
        break

      default: adjustedLengthInMeter = round(length, 0)
    }

    switch (true) {
      case lengthInFeet < 10:
        adjustedLengthInFeet = round(lengthInFeet, 1)
        break

      default: adjustedLengthInFeet = round(lengthInFeet, 0)
    }

    return `${nbsp(adjustedLengthInMeter.toLocaleString(locale, meterFormatProps))} (${nbsp(adjustedLengthInFeet.toLocaleString(locale, footFormatProps))})`
  }

}

export function normalizeLengths(str, locale = 'en') {

  const lengthPart = re(
    /*
     * 1234
     * 12345.6
     */
    /(?:\d{4,}(?:\.\d+)?)/,

    /*
     * OR
     */
    '|',

    /*
     * 1 234
     * 1 234.5
     * 123 456 789.01
     */
    /(?:\d{1,3}(?:(?:\s\d{3})*)(?:\.\d+)?)/,

    /*
     * OR
     */
    '|',

    /*
     * 1,234
     * 1,234.5
     * 123,456,789.01
     */
    /(?:\d{1,3}(?:(?:,\d{3})*)(?:\.\d+)?)/,
  )
  const feetUnitPart = /(?:foot|feets?|fts?|')/.source
  const meterUnitPart = /(?:meters?|m)/.source
  const spacingZeroOrMorePart = /\s*/.source
  const spacingOneOrMorePart = /\s+/.source
  const allSpacingZeroOrMorePart = /[\s\xa0]*/.source
  const allSpacingOneOrMorePart = /[\s\xa0]+/.source

  const lengthInFeetPart = new RegExp(`(?<lengthInFeet>${lengthPart})${allSpacingZeroOrMorePart}${feetUnitPart}`).source
  const lengthInMeterPart = new RegExp(`(?:${lengthPart}${allSpacingZeroOrMorePart}${meterUnitPart})`).source
  const precedingLengthInMeterPart = new RegExp(`(?:${[
    '\\dm',
    '\\dmeter',
    '\\dmeters',
    `\\d${allSpacingOneOrMorePart}m`,
    `\\d${allSpacingOneOrMorePart}meter`,
    `\\d${allSpacingOneOrMorePart}meters`,
  ].join('\\()|(?:')
    }\\()`).source

  const lengthExpr = new RegExp(re([
    `(?<precedingLengthInMeter>${precedingLengthInMeterPart})?${spacingOneOrMorePart}${lengthInFeetPart}(?<succedingLengthInMeter>${spacingOneOrMorePart}(?:\\(${spacingZeroOrMorePart}${lengthInMeterPart}${spacingZeroOrMorePart}\\)))?`
  ]), 'gi')

  return str.replaceAll(lengthExpr, function (...args) {
    // console.group('[normalizeLengths] ////////////////////////')

    let { precedingLengthInMeter, lengthInFeet } = args.pop()
    const string = args.pop()
    const offset = args.pop()
    const match = args.shift()

    // console.info('%s\x1B[97;41;1m%s\x1B[m%s', string.substring(0, offset), string.substring(offset, offset + match.length), string.substring(offset + match.length))

    if (precedingLengthInMeter) {
      // console.log('\x1B[31;107;1mFound length in meter preceding a length in feet. Will not normalize the length.\x1B[m')
      console.groupEnd()

      return match
    }

    // Cases like `1 408m (4 620 ft)` will match `620 ft`,
    // so we need a workaround to exclude them for now
    if (string.substring(offset + match.length, offset + match.length + 1) === ')') {
      // console.log('\x1B[31;107;1mFound length in meter preceding a length in feet. Will not normalize the length.\x1B[m')
      console.groupEnd()

      return match
    }

    // console.log('match: %s', match)
    // console.log('lengthInFeet: %s', lengthInFeet)
    // console.log('precedingLengthInMeter: %s', precedingLengthInMeter)
    // console.log(lengthExpr.source)

    lengthInFeet = parseFloat(lengthInFeet.replaceAll(/[\s,]/g, ''))
    const lengthInMeter = parseFloat(lengthInFeet) * 0.3048

    const replacementString = ` ${formatLength(lengthInMeter)}`

    // console.info('\x1B[32;107;1m[normalizeLengths]\x1B[m String \x1B[97;42;1m%s\x1B[m replaced with \x1B[97;42;1m%s\x1B[m', match, replacementString)
    // console.groupEnd()

    return replacementString
  })
}
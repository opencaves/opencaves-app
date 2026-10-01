// Reads explorations.xlsx - the reviewed exploration history and map credits
// read off the maps (one row per exploration, or per map without one) - for
// import-explorations.js and upload-maps.js.

import ExcelJS from 'exceljs'

// The app's partial dates (src/components/PartialDateField.jsx): a year, a
// month or a day, or a range of years.
const PARTIAL_DATE = /^\d{4}(-(\d{2}(-\d{2})?|\d{4}))?$/
const DATE_TOKEN = /\d{4}(?:-\d{2}(?:-\d{2})?)?/g

const cellText = (value) => {
  if (value == null) return ''
  if (typeof value === 'object') return String(value.text ?? value.result ?? value.richText?.map((part) => part.text).join('') ?? '')
  return String(value)
}

export async function readWorkbook(file) {
  const workbook = new ExcelJS.Workbook()
  await workbook.xlsx.readFile(file)
  const sheet = workbook.worksheets[0]
  const header = sheet.getRow(1).values.slice(1).map(cellText)
  const rows = []
  sheet.eachRow((row, number) => {
    if (number === 1) return
    const values = row.values.slice(1)
    const record = Object.fromEntries(header.map((key, i) => [key, cellText(values[i]).trim()]))
    if (record.image) rows.push(record)
  })
  return rows
}

export const isExcluded = (row) => /^EXCLUDED\b/i.test(row.comment || '')
export const hasExploration = (row) => Boolean(row.explorationDate || row.explorationTeam || row.explorationDescription)

// A date the app accepts, from what was read off a map ("2013-08 - 2014-12",
// "2013-12-24; 2014-01-02", "< 2004"...), and whether it lost precision -
// then the text as read belongs in the description.
export function toPartialDate(text) {
  const raw = (text || '').trim()
  if (!raw || PARTIAL_DATE.test(raw)) return { date: raw, exact: true }
  const tokens = raw.match(DATE_TOKEN) || []
  if (tokens.length === 0) return { date: '', exact: false }
  if (tokens.length === 1) return { date: tokens[0], exact: false }
  const years = [...new Set(tokens.map((token) => token.slice(0, 4)))].sort()
  if (years.length > 1) return { date: `${years[0]}-${years.at(-1)}`, exact: false }
  const months = new Set(tokens.map((token) => token.slice(0, 7)))
  return { date: months.size === 1 && tokens[0].length >= 7 ? tokens[0].slice(0, 7) : years[0], exact: false }
}

// Per map (image): its title, authors and date - from any of its rows.
export function mapCredits(rows) {
  const credits = new Map()
  for (const row of rows) {
    const credit = credits.get(row.image) || { title: '', authors: [], date: '' }
    credit.title ||= row.mapTitle
    if (!credit.authors.length && row.mapAuthors) credit.authors = row.mapAuthors.split('|').map((a) => a.trim()).filter(Boolean)
    credit.date ||= row.mapDate
    credits.set(row.image, credit)
  }
  return credits
}

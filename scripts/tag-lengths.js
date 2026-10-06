#!/usr/bin/env node
// Turns the lengths and depths written as plain text in the Markdown fields
// ("40 ft", "12m", "2 km", "10-15 m") into the length tag (`:length[40 ft]`,
// src/components/Markdown/lengthDirective.js), shown in each reader's units:
//
// - the value is kept as written, the unit becomes its symbol (m, km, ft, yd, mi);
// - a range gets a tag at each end: "10-15 m" -> ":length[10 m]-:length[15 m]";
// - "and more" keeps its "+", after the tag (which holds only a value):
//   "61,000+ ft" -> ":length[61,000 ft]+";
// - a conversion written next to it is dropped, the tag showing it now:
//   "40 ft (12 m)" -> ":length[40 ft]", "12 m / 40 ft" -> ":length[12 m]";
// - tags already there, links' URLs and code are left alone.
//
// The fields: caves' description, direction, accessDetails and
// accessibilityDetails; sistemas' description, direction and their
// explorations' descriptions. A dry run (the default) lists the changes;
// --write saves them. Re-runnable: tagged lengths aren't matched again.
//
// scripts/migrate-sheet-to-firestore.js replaces the caves with the Google
// Sheet's: a Sheet sync brings the untagged text back.
import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'
import { initializeApp, applicationDefault } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import { LENGTH_UNITS } from '../src/components/Markdown/lengthDirective.js'

const PROJECT_ID = 'opencaves'
const CAVE_FIELDS = ['description', 'direction', 'accessDetails', 'accessibilityDetails']
const SISTEMA_FIELDS = ['description', 'direction']

const cli = yargs(hideBin(process.argv))
  .usage('$0 -l | -p [--write]\n\nTags the plain-text lengths and depths of the Markdown fields as :length[...] - a dry run unless --write.')
  .option('local', { alias: 'l', type: 'boolean', default: false, describe: 'The local Firestore emulator (127.0.0.1:8080, or FIRESTORE_EMULATOR_HOST)' })
  .option('production', { alias: 'p', type: 'boolean', default: false, describe: 'The real opencaves project (requires `gcloud auth application-default login`)' })
  .option('write', { type: 'boolean', default: false, describe: 'Save the changes (without it: only list them)' })
  .check((args) => {
    if (args.local === args.production) throw new Error('Use exactly one of -l (local) or -p (production).')
    return true
  })
  .help()
  .alias('help', 'h')
  .strict()

// No arguments: the help, not a run.
if (hideBin(process.argv).length === 0) {
  cli.showHelp()
  process.exit(0)
}
const argv = cli.parseSync()

// "1,234.5", "1 408", "12.5", "40" - not part of a longer number or word.
const NUMBER = String.raw`(?<![\w.,])(?:\d{1,3}(?:[, ]\d{3})+|\d+)(?:\.\d+)?`
// Free-text spellings (not "mi": a word in Spanish), longest first.
const SPELLINGS = Object.values(LENGTH_UNITS)
  .flatMap((u) => u.inText || u.spellings)
  .sort((a, b) => b.length - a.length)
  .join('|')
const UNIT = `(?:${SPELLINGS})(?![a-z])`
const symbolOf = (spelling) => Object.keys(LENGTH_UNITS).find((unit) => LENGTH_UNITS[unit].spellings.some((s) => new RegExp(`^${s}$`, 'i').test(spelling)))

// A length (maybe "and more": "61,000+ ft") or a range, then maybe its
// conversion: "(12 m)", "/ 12 m".
const LENGTH = new RegExp(
  String.raw`(?<from>${NUMBER})(?<plus>\+)?(?:(?<sep>\s*(?:-|–|to|a)\s*)(?<to>${NUMBER}))?\s*(?<unit>${UNIT})` +
    String.raw`(?<conversion>\s*\(\s*~?\s*${NUMBER}(?:\s*(?:-|–|to|a)\s*${NUMBER})?\s*${UNIT}\s*\)|\s*\/\s*${NUMBER}(?:\s*(?:-|–|to|a)\s*${NUMBER})?\s*${UNIT})?`,
  'gi',
)

// What is left alone: tags, links' URLs, autolinks, bare URLs, code.
const PROTECTED = /(:length\[[^\]]*\]|\]\([^)]*\)|<https?:[^>]*>|https?:\/\/\S+|`[^`]*`)/

function tagLengths(text) {
  const changes = []
  const out = text
    .split(PROTECTED)
    .map((part, i) => {
      if (i % 2) return part
      return part.replace(LENGTH, (match, ...args) => {
        const { from, plus, sep, to, unit, conversion } = args.at(-1)
        const symbol = symbolOf(unit)
        const tag = (n) => `:length[${n} ${symbol}]`
        // A conversion in the same system ("12 m (39 m)") isn't one: keep it.
        const conversionUnit = conversion && symbolOf(conversion.match(new RegExp(`(${SPELLINGS})\\s*\\)?\\s*$`, 'i'))?.[1] || '')
        const dropConversion = conversionUnit && LENGTH_UNITS[conversionUnit].system !== LENGTH_UNITS[symbol].system
        const replaced = (to ? `${tag(from)}${plus || ''}${sep}${tag(to)}` : `${tag(from)}${plus || ''}`) + (conversion && !dropConversion ? conversion : '')
        changes.push({ from: match, to: replaced })
        return replaced
      })
    })
    .join('')
  return { text: out, changes }
}

if (argv.local && !process.env.FIRESTORE_EMULATOR_HOST) process.env.FIRESTORE_EMULATOR_HOST = '127.0.0.1:8080'
initializeApp(argv.production ? { credential: applicationDefault(), projectId: PROJECT_ID } : { projectId: PROJECT_ID })
const db = getFirestore()

const nameOf = (data) => (typeof data.name === 'string' ? data.name : data.name?.value) || '(no name)'
let changedDocs = 0
let changeCount = 0

function report(collection, id, data, field, changes) {
  console.log(`\n${collection}/${id} - ${nameOf(data)} - ${field}`)
  for (const { from, to } of changes) console.log(`   ${JSON.stringify(from)}  ->  ${JSON.stringify(to)}`)
  changeCount += changes.length
}

for (const [collection, fields] of [
  ['caves', CAVE_FIELDS],
  ['sistemas', SISTEMA_FIELDS],
]) {
  const snapshot = await db.collection(collection).get()
  for (const doc of snapshot.docs) {
    const data = doc.data()
    const update = {}
    for (const field of fields) {
      if (typeof data[field] !== 'string') continue
      const { text, changes } = tagLengths(data[field])
      if (!changes.length) continue
      report(collection, doc.id, data, field, changes)
      update[field] = text
    }
    if (collection === 'sistemas' && Array.isArray(data.explorations)) {
      let changed = false
      const explorations = data.explorations.map((exploration, index) => {
        if (typeof exploration?.description !== 'string') return exploration
        const { text, changes } = tagLengths(exploration.description)
        if (!changes.length) return exploration
        report(collection, doc.id, data, `explorations[${index}].description`, changes)
        changed = true
        return { ...exploration, description: text }
      })
      if (changed) update.explorations = explorations
    }
    if (Object.keys(update).length) {
      changedDocs++
      if (argv.write) await doc.ref.update(update)
    }
  }
}

console.log(`\n${changeCount} length(s) in ${changedDocs} document(s) ${argv.write ? 'tagged' : 'to tag (dry run: nothing saved - add --write to save)'}.`)
process.exit(0)

#!/usr/bin/env node
// Fills in where the Markdown fields' words come from (textSources.<field>:
// { source, checkedAt }), from the estimate report
// _data/enrichment/text-sources.json (which compared each text with the
// Google Sheet it was imported from, the audit log, and the Evernote notes):
//
// - a text matching the Evernote notes (30 % or more): Open Caves (to
//   reread: some notes are dive centres' pages clipped);
// - a Sheet row whose source is Gerrard 2015: Gerrard 2015;
// - a row whose source named where its coordinates came from (Open Caves,
//   Google Maps, "map") or none: Gerrard 2015 - the guidebook's style (not
//   verifiable word for word, attributed all the same);
// - another source's row (QRSS, diveseven.com...): that source;
// - a text edited in the app, rewritten, or not in the Sheet: no entry.
//
// Only the fields without an entry yet: re-runnable, never overwrites one set
// since (in the app or by hand). A dry run (the default) lists the counts;
// --write saves them.
import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'
import { initializeApp, applicationDefault } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'

const PROJECT_ID = 'opencaves'
const ROOT = path.resolve(import.meta.dirname, '../..')
const REPORT = path.join(ROOT, '_data/enrichment/text-sources.json')
// The sources a row named for its coordinates, not its text.
const COORDINATE_SOURCES = ['Open Caves', 'Google Maps', 'map']
const EVERNOTE_SHARE = 30

const cli = yargs(hideBin(process.argv))
  .usage('$0 -l | -p [--write]\n\nFills in the Markdown fields\' sources (textSources) from _data/enrichment/text-sources.json - a dry run unless --write.')
  .option('local', { alias: 'l', type: 'boolean', default: false, describe: 'The local Firestore emulator (127.0.0.1:8080, or FIRESTORE_EMULATOR_HOST)' })
  .option('production', { alias: 'p', type: 'boolean', default: false, describe: 'The real opencaves project (requires `gcloud auth application-default login`)' })
  .option('write', { type: 'boolean', default: false, describe: 'Save the sources (without it: only count them)' })
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
if (!existsSync(REPORT)) {
  console.error(`No report at ${path.relative(ROOT, REPORT)}: run the estimate first.`)
  process.exit(1)
}

if (argv.local && !process.env.FIRESTORE_EMULATOR_HOST) process.env.FIRESTORE_EMULATOR_HOST = '127.0.0.1:8080'
initializeApp(argv.production ? { credential: applicationDefault(), projectId: PROJECT_ID } : { projectId: PROJECT_ID })
const db = getFirestore()

const report = JSON.parse(readFileSync(REPORT, 'utf8'))
const sourceIds = Object.fromEntries((await db.collection('sources').get()).docs.map((doc) => [doc.data().name, doc.id]))
const checkedAt = new Date().toISOString().slice(0, 7)

// The entry a report record gets, or null.
function entryFor(record) {
  if ((record.evernote?.share ?? 0) >= EVERNOTE_SHARE) return { source: sourceIds['Open Caves'] }
  if (!['sheet, unchanged', 'sheet, reworded'].includes(record.origin)) return null
  if (!record.source || record.source === 'Gerrard 2015' || COORDINATE_SOURCES.includes(record.source)) return { source: sourceIds['Gerrard 2015'] }
  return sourceIds[record.source] ? { source: sourceIds[record.source] } : null
}

const counts = {}
const writes = new Map() // "collection/id" -> { field: entry }
for (const record of report.records) {
  const entry = entryFor(record)
  const name = entry ? Object.keys(sourceIds).find((key) => sourceIds[key] === entry.source) : 'no entry'
  const key = `${record.collection}.${record.field}: ${name}`
  counts[key] = (counts[key] || 0) + 1
  if (!entry?.source) continue
  const doc = `${record.collection}/${record.id}`
  writes.set(doc, { ...writes.get(doc), [record.field]: { ...entry, checkedAt } })
}

// Only fields without an entry yet.
let fields = 0
const batch = []
for (const [docPath, entries] of writes) {
  const snapshot = await db.doc(docPath).get()
  if (!snapshot.exists) continue
  const current = snapshot.data().textSources || {}
  const missing = Object.fromEntries(Object.entries(entries).filter(([field]) => !current[field] && snapshot.data()[field]))
  if (!Object.keys(missing).length) continue
  fields += Object.keys(missing).length
  batch.push([docPath, missing])
}

for (const [key, n] of Object.entries(counts).sort()) console.log(`${String(n).padStart(4)}  ${key}`)
console.log(`\n${fields} fields to fill in, on ${batch.length} records (${argv.local ? 'local emulator' : 'production'})`)

if (!argv.write) {
  console.log('Dry run: nothing written (--write to save).')
  process.exit(0)
}
for (let i = 0; i < batch.length; i += 400) {
  const writeBatch = db.batch()
  for (const [docPath, missing] of batch.slice(i, i + 400)) writeBatch.set(db.doc(docPath), { textSources: missing }, { merge: true })
  await writeBatch.commit()
}
console.log(`Written: ${fields} fields.`)
process.exit(0)

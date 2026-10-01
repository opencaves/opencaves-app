// Imports the exploration history read off the maps (explorations.xlsx, see
// docs/maps-import.md) into the sistemas' `explorations`, and each imported
// map's authors and date into its `maps` document.
//
// - An entry the maps give replaces an existing entry about the same
//   exploration (a team name or, for an entry without a team, the year in
//   common); other existing entries are kept. Entries a previous import added
//   (marked `importedFrom: 'maps'`) are replaced, so a rerun doesn't pile up.
// - Dates the app can't hold ("2013-08 - 2014-12") become the closest partial
//   date ("2013-2014"); the text as read goes into the notes.
//
// Undoable: before writing, every sistema and map it changes is saved to a
// backup file (_data/maps-import/backups/). --undo puts those values back -
// skipping anything edited since the import, unless --force.
//
// A dry run by default: --apply to write.

import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'
import { initializeApp, applicationDefault } from 'firebase-admin/app'
import { getFirestore, FieldValue } from 'firebase-admin/firestore'
import { readWorkbook, isExcluded, hasExploration, toPartialDate, mapCredits } from './explorations-workbook.js'

const PROJECT_ID = 'opencaves'
const IMPORT_MARK = 'maps'
// Words that say nothing about who explored: never enough to call two entries the same.
const GENERIC_WORDS = new Set(['team', 'teams', 'society', 'speleological', 'czech', 'cave', 'diving', 'divers', 'survey', 'members', 'expedition', 'expédition', 'expéditions', 'unknown', 'explorer', 'quintana', 'speleo'])

const cli = yargs(hideBin(process.argv))
  .usage('Import the exploration history read off the maps into the sistemas (and map authors and dates).\n\nUsage: $0 [options]')
  .option('local', { alias: 'l', type: 'boolean', describe: 'The local emulators - the default, named to run with no other option' })
  .option('production', { alias: 'p', type: 'boolean', default: false, describe: 'The real opencaves project (needs `gcloud auth application-default login`)' })
  .check((args) => !(args.local && args.production) || 'Use --local or --production, not both')
  .option('workbook', { type: 'string', default: '_data/maps-import/explorations.xlsx', describe: 'The reviewed exploration workbook' })
  .option('csv', { type: 'string', default: '_data/maps-import/matched.csv', describe: 'The matched maps (which sistemas each map goes to)' })
  .option('apply', { type: 'boolean', default: false, describe: 'Actually write; without it, only print what would be done' })
  .option('only', { type: 'string', describe: 'Only sistemas whose name contains this text' })
  .option('undo', { type: 'string', describe: 'Restore the values saved by an import: a backup file, or "latest" for the newest one of this target' })
  .option('force', { type: 'boolean', default: false, describe: 'With --undo: also restore documents edited since the import' })
  .example('$0 -l', 'Dry run against the local emulators')
  .example('$0 -l --apply', 'Import locally')
  .example('$0 -p --apply', 'Import to production')
  .example('$0 -p --undo latest --apply', 'Undo the latest production import')
  .help()
  .alias('help', 'h')
  .strict()

// No arguments: the help, not a run.
if (hideBin(process.argv).length === 0) {
  cli.showHelp()
  process.exit(0)
}
const argv = cli.parseSync()

if (!argv.production) process.env.FIRESTORE_EMULATOR_HOST ??= '127.0.0.1:8080'
initializeApp({ projectId: PROJECT_ID, ...(argv.production && { credential: applicationDefault() }) })
const db = getFirestore()
const target = argv.production ? 'production' : 'local'
const mode = `${argv.production ? 'PRODUCTION' : 'local emulators'}${argv.apply ? '' : ' - dry run, nothing written (--apply to write)'}`
const BACKUP_DIR = path.join(path.dirname(argv.workbook), 'backups')

// Minimal CSV reader (quoted fields, "" escapes, CRLF, BOM) - the file comes from Python's csv module.
function readCsv(file) {
  const text = readFileSync(file, 'utf8').replace(/^﻿/, '')
  const records = []
  let record = [], field = '', quoted = false
  for (let i = 0; i < text.length; i++) {
    const c = text[i]
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') { field += '"'; i++ }
      else if (c === '"') quoted = false
      else field += c
    } else if (c === '"') quoted = true
    else if (c === ',') { record.push(field); field = '' }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++
      record.push(field); field = ''
      if (record.some((v) => v !== '')) records.push(record)
      record = []
    } else field += c
  }
  if (field || record.length) { record.push(field); records.push(record) }
  const [header, ...rows] = records
  return rows.map((values) => Object.fromEntries(header.map((key, i) => [key, values[i] ?? ''])))
}

const list = (value) => (value || '').split('|').map((v) => v.trim()).filter(Boolean)
const surnames = (text) => new Set((text || '').toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '').match(/[a-z']{4,}/g)?.filter((w) => !GENERIC_WORDS.has(w)) || [])
const years = (text) => new Set((text || '').match(/\b(19|20)\d\d\b/g) || [])
const overlaps = (a, b) => [...a].some((x) => b.has(x))

function explorationFrom(row, credit) {
  const { date, exact } = toPartialDate(row.explorationDate)
  const source = [credit.title && `“${credit.title}”`, credit.authors.join(', '), credit.date].filter(Boolean).join(', ')
  // The exploration itself goes in the description (markdown); the notes only say where it was read.
  const description = [
    row.explorationDescription,
    !exact && row.explorationDate && `Dates as given on the map: ${row.explorationDate}.`,
  ].filter(Boolean).join('\n\n')
  const notes = source && `Source: map ${source}.`
  const entry = { ...(date && { date }), ...(row.explorationTeam && { team: row.explorationTeam }), ...(description && { description }), ...(notes && { notes }), importedFrom: IMPORT_MARK }
  // The latest year this entry (or its map) speaks of - not written.
  const latest = Math.max(0, ...[...years(row.explorationDate), ...years(credit.date)].map(Number))
  Object.defineProperty(entry, 'latestYear', { value: latest || null })
  return entry
}

// Whether an existing entry is about an exploration the maps now describe:
// a team name in common, and not later than what the map covers (a later
// entry by the same people is a later exploration) - or, without a team,
// a year in common.
function superseded(existing, imported) {
  const team = surnames(existing.team)
  const when = [...years(existing.date)].map(Number)
  if (team.size) {
    return imported.some((entry) => overlaps(team, surnames(`${entry.team} ${entry.description}`))
      && (!when.length || !entry.latestYear || Math.min(...when) <= entry.latestYear + 1))
  }
  return when.length > 0 && imported.some((entry) => overlaps(new Set(when.map(String)), years(entry.date)))
}

const byDate = (a, b) => (a.date || '9999').localeCompare(b.date || '9999')

async function plan() {
  const rows = (await readWorkbook(argv.workbook)).filter((row) => !isExcluded(row))
  const matched = new Map(readCsv(argv.csv).filter((r) => r.image && (r.include ?? '').toLowerCase() !== 'no').map((r) => [r.image, r]))
  const credits = mapCredits(rows)

  // sistemaId -> imported entries
  const entries = new Map()
  const skipped = []
  for (const row of rows.filter(hasExploration)) {
    const map = matched.get(row.image)
    if (!map || !list(map.sistemaIds).length) { skipped.push(row.image); continue }
    const ids = list(map.sistemaIds), names = list(map.sistemaNames)
    // The row may narrow the map's sistemas (a sheet showing two systems).
    const wanted = list(row.sistemaNames)
    const targets = ids.filter((id, i) => !wanted.length || wanted.includes(names[i]))
    for (const id of targets.length ? targets : ids) {
      if (!entries.has(id)) entries.set(id, [])
      entries.get(id).push(explorationFrom(row, credits.get(row.image)))
    }
  }

  const sistemas = []
  for (const [id, imported] of entries) {
    const snap = await db.collection('sistemas').doc(id).get()
    if (!snap.exists) { console.log(`sistema ${id}: not found - skipped`); continue }
    const name = snap.get('name')
    if (argv.only && !name.toLowerCase().includes(argv.only.toLowerCase())) continue
    const current = snap.get('explorations') || []
    const previous = current.filter((e) => e.importedFrom !== IMPORT_MARK)
    const replaced = previous.filter((e) => superseded(e, imported))
    const kept = previous.filter((e) => !replaced.includes(e))
    sistemas.push({ id, name, ref: snap.ref, updateTime: snap.updateTime, current: snap.get('explorations') ?? null, next: [...kept, ...imported].sort(byDate), replaced, kept, imported })
  }

  // Map credits: the imported maps' authors and date.
  const maps = []
  for (const [image, credit] of credits) {
    const map = matched.get(image)
    if (!map?.sha1 || (!credit.authors.length && !credit.date)) continue
    const found = await db.collection('maps').where('importKey', '==', map.sha1).limit(1).get()
    if (found.empty) continue
    const doc = found.docs[0]
    const { date } = toPartialDate(credit.date)
    const update = { ...(credit.authors.length && { authors: credit.authors }), ...(date && { date }) }
    const unchanged = Object.entries(update).every(([k, v]) => JSON.stringify(doc.get(k)) === JSON.stringify(v))
    if (!unchanged) maps.push({ id: doc.id, image, ref: doc.ref, updateTime: doc.updateTime, current: { authors: doc.get('authors') ?? null, date: doc.get('date') ?? null }, update })
  }
  return { sistemas, maps, skipped }
}

const describe = (e) => [e.date, e.team].filter(Boolean).join(' - ') || '(no date or team)'

async function importExplorations() {
  const { sistemas, maps, skipped } = await plan()
  console.log(`${sistemas.length} sistemas, ${maps.length} maps to update (${mode})\n`)
  for (const s of sistemas) {
    console.log(`${s.name} (${s.id}): ${s.imported.length} from the maps, ${s.kept.length} kept, ${s.replaced.length} replaced`)
    for (const e of s.replaced) console.log(`    replaced: ${describe(e)}`)
    for (const e of s.kept) console.log(`    kept:     ${describe(e)}`)
    for (const e of s.imported) console.log(`    + ${describe(e).slice(0, 110)}`)
  }
  if (maps.length) console.log(`\nMap credits: ${maps.map((m) => m.image.replace('images/', '')).join(', ')}`)
  if (skipped.length) console.log(`\nRows of maps that aren't imported (no sistema): ${[...new Set(skipped)].join(', ')}`)
  if (!argv.apply || (!sistemas.length && !maps.length)) return

  // The backup first: what every document holds now.
  mkdirSync(BACKUP_DIR, { recursive: true })
  const file = path.join(BACKUP_DIR, `explorations-${target}-${new Date().toISOString().replace(/[:.]/g, '-')}.json`)
  const backup = {
    target, createdAt: new Date().toISOString(),
    sistemas: Object.fromEntries(sistemas.map((s) => [s.id, { name: s.name, explorations: s.current }])),
    maps: Object.fromEntries(maps.map((m) => [m.id, { image: m.image, ...m.current }])),
  }
  writeFileSync(file, JSON.stringify(backup, null, 2))

  for (const s of sistemas) {
    const result = await s.ref.update({ explorations: s.next })
    backup.sistemas[s.id].writtenAt = result.writeTime.toDate().toISOString()
  }
  for (const m of maps) {
    const result = await m.ref.update(m.update)
    backup.maps[m.id].writtenAt = result.writeTime.toDate().toISOString()
  }
  // The write times let --undo tell an edit made since the import.
  writeFileSync(file, JSON.stringify(backup, null, 2))
  console.log(`\nDone. Backup (for --undo): ${file}`)
}

async function undo() {
  let file = argv.undo
  if (file === 'latest') {
    const files = readdirSync(BACKUP_DIR).filter((f) => f.startsWith(`explorations-${target}-`)).sort()
    if (!files.length) throw new Error(`no ${target} backup in ${BACKUP_DIR}`)
    file = path.join(BACKUP_DIR, files.at(-1))
  }
  const backup = JSON.parse(readFileSync(file, 'utf8'))
  if (backup.target !== target) throw new Error(`${file} is a ${backup.target} backup, not ${target}`)
  console.log(`Restoring ${file} (${mode})`)

  const restore = async (collection, id, saved, fields) => {
    const ref = db.collection(collection).doc(id)
    const snap = await ref.get()
    if (!snap.exists) return console.log(`  ${collection}/${id}: gone - skipped`)
    const edited = saved.writtenAt && snap.updateTime.toDate().toISOString() !== saved.writtenAt
    if (edited && !argv.force) return console.log(`  ${saved.name || saved.image || id}: edited since the import - skipped (--force to restore anyway)`)
    console.log(`  ${saved.name || saved.image || id}: restored${edited ? ' (edited since the import)' : ''}`)
    if (argv.apply) await ref.update(Object.fromEntries(fields.map((f) => [f, saved[f] ?? FieldValue.delete()])))
  }
  for (const [id, saved] of Object.entries(backup.sistemas)) await restore('sistemas', id, saved, ['explorations'])
  for (const [id, saved] of Object.entries(backup.maps)) await restore('maps', id, saved, ['authors', 'date'])
}

await (argv.undo ? undo() : importExplorations())

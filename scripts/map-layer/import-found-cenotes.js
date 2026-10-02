#!/usr/bin/env node
// Imports scripts/map-layer/found-cenotes.json - the cenotes found on the
// processed cave maps (cenote_candidates.py), reviewed - into the database:
//
// - "create": a new cave (its id from the file), with its name, sistema (and
//   the sistema's colour), area, source, cenote-entrance flag and, when its
//   map was placed, its position - validity "unknown": to be confirmed on site.
//   A cave already there under that id is left alone.
// - "position": the map's position for a cave that has none, or whose position
//   is marked invalid (validity "unknown"). A position taken since is kept.
// - "fill": a name (and position) for an unnamed cave.
// - "cenote-entrance": the cave's cenoteEntrance flag set.
//
// Re-runnable: only what is missing is written. scripts/migrate-sheet-to-firestore.js
// replaces the caves collection with the Google Sheet's: run this again after
// a Sheet sync.
import { readFileSync } from 'node:fs'
import path from 'node:path'
import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'
import { initializeApp, applicationDefault } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'

const PROJECT_ID = 'opencaves'
const FOUND = path.join(import.meta.dirname, 'found-cenotes.json')

const cli = yargs(hideBin(process.argv))
  .usage('$0 -l | -p\n\nImports the cenotes found on the cave maps (found-cenotes.json) into the database.')
  .option('local', { alias: 'l', type: 'boolean', default: false, describe: 'The local Firestore emulator (127.0.0.1:8080, or FIRESTORE_EMULATOR_HOST)' })
  .option('production', {
    alias: 'p',
    type: 'boolean',
    default: false,
    describe: 'The real opencaves project (requires `gcloud auth application-default login`)',
  })
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

if (argv.local && !process.env.FIRESTORE_EMULATOR_HOST) process.env.FIRESTORE_EMULATOR_HOST = '127.0.0.1:8080'
initializeApp(argv.production ? { credential: applicationDefault(), projectId: PROJECT_ID } : { projectId: PROJECT_ID })
const db = getFirestore()

const { entries } = JSON.parse(readFileSync(FOUND, 'utf8'))
const location = (e) => (e.latitude != null ? { longitude: e.longitude, latitude: e.latitude, validity: 'unknown' } : null)
const colours = new Map()
const done = { created: 0, positioned: 0, named: 0, flagged: 0, skipped: 0 }

for (const entry of entries) {
  if (entry.action === 'create') {
    const ref = db.collection('caves').doc(entry.id)
    if ((await ref.get()).exists) {
      done.skipped++
      continue
    }
    const cave = { name: { value: entry.name, languageCode: entry.languageCode || 'spa' }, keys: [], cenoteEntrance: Boolean(entry.cenoteEntrance) }
    if (location(entry)) cave.location = location(entry)
    if (entry.sourceId) cave.source = entry.sourceId
    if (entry.area) cave.area = entry.area
    if (entry.sistemaId) {
      cave.sistemaId = entry.sistemaId
      if (!colours.has(entry.sistemaId)) colours.set(entry.sistemaId, (await db.collection('sistemas').doc(entry.sistemaId).get()).get('color'))
      if (colours.get(entry.sistemaId)) cave.sistemaColor = colours.get(entry.sistemaId)
    }
    await ref.create(cave)
    done.created++
    continue
  }
  const ref = db.collection('caves').doc(entry.caveId)
  const snapshot = await ref.get()
  if (!snapshot.exists) {
    done.skipped++
    continue
  }
  const cave = snapshot.data()
  const positionable = cave.location?.latitude == null || cave.location?.validity === 'invalid'
  if ((entry.action === 'position' || entry.action === 'fill') && location(entry) && positionable) {
    await ref.update({ location: location(entry), ...(entry.sourceId && { source: entry.sourceId }) })
    done.positioned++
  }
  if (entry.action === 'fill' && entry.name && !cave.name?.value) {
    await ref.update({ name: { value: entry.name, languageCode: entry.languageCode || 'spa' } })
    done.named++
  }
  if (entry.cenoteEntrance && !cave.cenoteEntrance) {
    await ref.update({ cenoteEntrance: true })
    done.flagged++
  }
}
console.log(`${argv.production ? 'PRODUCTION' : 'emulator'}: ${Object.entries(done).map(([k, n]) => `${n} ${k}`).join(', ')}`)

#!/usr/bin/env node
// Replaces production's cave data with the local emulator's: in each cave-data
// collection, production ends up with exactly the local documents - new ones
// created, differing ones overwritten whole, the ones only in production
// deleted. Users' data, photos (cavesAssets, Storage) and ratings aren't
// touched.
//
// Maps are the exception: the same map files were uploaded to each database
// under different ids (the local documents point to the Storage emulator), so
// production's map documents are kept, matched to the local ones by their
// importKey, and the sistemas' maps lists are written with production's ids.
//
// A dry run (--dry-run) lists what would change; --write first saves
// production's current documents of these collections to
// _data/backups/production-<date>/ (one JSON file per collection), then
// applies it. Run it with the local emulators up (127.0.0.1:8080, or
// FIRESTORE_EMULATOR_HOST), after `gcloud auth application-default login`.
import { mkdirSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'
import { initializeApp, applicationDefault } from 'firebase-admin/app'
import { getFirestore, Timestamp, GeoPoint, DocumentReference } from 'firebase-admin/firestore'

const PROJECT_ID = 'opencaves'
const COLLECTIONS = ['caves', 'sistemas', 'connections', 'accesses', 'accessibilities', 'sources', 'areas', 'colors', 'languages', 'settings']
const BACKUPS = path.resolve(import.meta.dirname, '../_data/backups')

const cli = yargs(hideBin(process.argv))
  .usage('$0 --dry-run | --write [--collection <name>...] [--report <file>]\n\nReplaces production\'s cave data with the local emulator\'s (users, photos and ratings untouched; maps matched, not copied).')
  .option('dry-run', { type: 'boolean', default: false, describe: 'List the changes, write nothing' })
  .option('write', { type: 'boolean', default: false, describe: 'Back production up, then write the changes to it' })
  .option('collection', { type: 'array', string: true, describe: `Only these collections (default: ${COLLECTIONS.join(', ')})` })
  .option('report', { type: 'string', describe: 'Also write the full list of changes (JSON) to this file' })
  .check((args) => {
    if (args.dryRun === args.write) throw new Error('Use exactly one of --dry-run or --write.')
    for (const c of args.collection || []) if (!COLLECTIONS.includes(c)) throw new Error(`Unknown collection: ${c}`)
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

// Two apps: FIRESTORE_EMULATOR_HOST would send both to the emulator, so the
// local one is pointed at it through its settings instead.
const emulatorHost = process.env.FIRESTORE_EMULATOR_HOST || '127.0.0.1:8080'
delete process.env.FIRESTORE_EMULATOR_HOST
const local = getFirestore(initializeApp({ projectId: PROJECT_ID }, 'local'))
local.settings({ host: emulatorHost, ssl: false })
const production = getFirestore(initializeApp({ credential: applicationDefault(), projectId: PROJECT_ID }, 'production'))

// Comparable (and JSON-able) form of a Firestore value.
function normalize(value) {
  if (value instanceof Timestamp) return { $timestamp: [value.seconds, value.nanoseconds] }
  if (value instanceof GeoPoint) return { $geo: [value.latitude, value.longitude] }
  if (value instanceof DocumentReference) return { $ref: value.path }
  if (Array.isArray(value)) return value.map(normalize)
  if (value && typeof value === 'object') return Object.fromEntries(Object.keys(value).sort().map((k) => [k, normalize(value[k])]))
  return value
}
const same = (a, b) => JSON.stringify(normalize(a)) === JSON.stringify(normalize(b))
const nameOf = (data) => (typeof data?.name === 'string' ? data.name : data?.name?.value) || data?.title || ''

// Local map id -> production map id, by importKey.
const [localMaps, prodMaps] = await Promise.all([local.collection('maps').get(), production.collection('maps').get()])
const prodMapByKey = new Map(prodMaps.docs.map((d) => [d.get('importKey'), d.id]))
const mapIds = new Map(localMaps.docs.map((d) => [d.id, prodMapByKey.get(d.get('importKey'))]))
const unmatchedMaps = [...mapIds].filter(([, prod]) => !prod).map(([id]) => id)
if (unmatchedMaps.length) {
  console.error(`Local maps with no production match (importKey): ${unmatchedMaps.join(', ')} - upload them first.`)
  process.exit(1)
}
console.log(`maps: ${mapIds.size} matched to production's (kept as they are)`)

// A local document as production must have it.
function forProduction(collection, data) {
  if (collection === 'sistemas' && Array.isArray(data.maps)) return { ...data, maps: data.maps.map((id) => mapIds.get(id) || id) }
  return data
}

const collections = argv.collection || COLLECTIONS
const plan = {}
for (const collection of collections) {
  const [localSnap, prodSnap] = await Promise.all([local.collection(collection).get(), production.collection(collection).get()])
  const prodDocs = new Map(prodSnap.docs.map((d) => [d.id, d.data()]))
  const localIds = new Set(localSnap.docs.map((d) => d.id))
  const creates = []
  const updates = []
  for (const doc of localSnap.docs) {
    const data = forProduction(collection, doc.data())
    const prod = prodDocs.get(doc.id)
    if (!prod) creates.push({ id: doc.id, data })
    else if (!same(data, prod)) updates.push({ id: doc.id, data, fields: [...new Set([...Object.keys(data), ...Object.keys(prod)])].filter((k) => !same(data[k], prod[k])) })
  }
  const deletes = prodSnap.docs.filter((d) => !localIds.has(d.id))
  plan[collection] = { creates, updates, deletes, prodSnap }

  const fieldCounts = {}
  for (const { fields } of updates) for (const f of fields) fieldCounts[f] = (fieldCounts[f] || 0) + 1
  console.log(`\n${collection}: ${creates.length} to create, ${updates.length} to overwrite, ${deletes.length} to delete (production ${prodSnap.size} -> ${localSnap.size})`)
  if (Object.keys(fieldCounts).length) console.log(`   changed fields: ${Object.entries(fieldCounts).sort((a, b) => b[1] - a[1]).map(([f, n]) => `${f} (${n})`).join(', ')}`)
}

if (argv.report) {
  const report = Object.fromEntries(Object.entries(plan).map(([c, { creates, updates, deletes }]) => [c, {
    creates: creates.map(({ id, data }) => ({ id, name: nameOf(data) })),
    updates: updates.map(({ id, data, fields }) => ({ id, name: nameOf(data), fields })),
    deletes: deletes.map((d) => ({ id: d.id, name: nameOf(d.data()) })),
  }]))
  writeFileSync(argv.report, JSON.stringify(report, null, 2))
}

if (argv.write) {
  // Production's documents as they were, first.
  const dir = path.join(BACKUPS, `production-${new Date().toISOString().replace(/[:.]/g, '-')}`)
  mkdirSync(dir, { recursive: true })
  for (const [collection, { prodSnap }] of Object.entries(plan)) {
    writeFileSync(path.join(dir, `${collection}.json`), JSON.stringify(Object.fromEntries(prodSnap.docs.map((d) => [d.id, normalize(d.data())])), null, 1))
  }
  writeFileSync(path.join(dir, 'maps.json'), JSON.stringify(Object.fromEntries(prodMaps.docs.map((d) => [d.id, normalize(d.data())])), null, 1))
  console.log(`\nproduction backed up to ${path.relative(process.cwd(), dir)}`)

  for (const [collection, { creates, updates, deletes }] of Object.entries(plan)) {
    const writes = [
      ...creates.map(({ id, data }) => (batch) => batch.set(production.collection(collection).doc(id), data)),
      ...updates.map(({ id, data }) => (batch) => batch.set(production.collection(collection).doc(id), data)),
      ...deletes.map((d) => (batch) => batch.delete(d.ref)),
    ]
    for (let i = 0; i < writes.length; i += 400) {
      const batch = production.batch()
      for (const write of writes.slice(i, i + 400)) write(batch)
      await batch.commit()
    }
    console.log(`${collection}: written`)
  }
}

const totals = Object.values(plan).reduce((t, { creates, updates, deletes }) => [t[0] + creates.length, t[1] + updates.length, t[2] + deletes.length], [0, 0, 0])
console.log(`\n${totals[0]} to create, ${totals[1]} to overwrite, ${totals[2]} to delete - ${argv.write ? 'done' : 'dry run: nothing written (--write to back up and apply)'}.`)
process.exit(0)

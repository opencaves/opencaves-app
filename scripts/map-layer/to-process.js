#!/usr/bin/env node
// The maps added in the app that are still to be turned into the cave layer -
// the Map layers page's "To process" tab: "maps" documents with no importKey
// (the bulk import's maps are another work list), not in the trash, not marked
// "not for the layer" (layerSkipReason), and named by no config in maps/
// ("mapId"). Lists them, and downloads each one's file into
// _data/map-layer/inbox/ (not in git), ready for the steps of
// docs/map-layer.md. --config also starts a config for each image map
// (maps/<name>.json: its mapId, image, title, date, credits and system),
// never overwriting one.
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'
import { initializeApp, applicationDefault } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import { getStorage } from 'firebase-admin/storage'
import { BUCKET_NAME } from '../../functions/js/constants.js'

const PROJECT_ID = 'opencaves'
const ROOT = path.resolve(import.meta.dirname, '../..')
const MAPS = path.join(import.meta.dirname, 'maps')
const INBOX = path.join(ROOT, '_data/map-layer/inbox')
const EXTENSIONS = { 'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp', 'image/svg+xml': '.svg', 'application/pdf': '.pdf' }

const cli = yargs(hideBin(process.argv))
  .usage('$0 -l | -p [--config]\n\nLists the maps added in the app that are still to be turned into the cave layer, and downloads their files into _data/map-layer/inbox/.')
  .option('local', { alias: 'l', type: 'boolean', default: false, describe: 'The local emulators (Firestore 127.0.0.1:8080, Storage 127.0.0.1:9199)' })
  .option('production', { alias: 'p', type: 'boolean', default: false, describe: 'The real opencaves project (requires `gcloud auth application-default login`)' })
  .option('config', { type: 'boolean', default: false, describe: 'Also start a config in scripts/map-layer/maps/ for each image map (never overwrites one)' })
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

if (argv.local) {
  process.env.FIRESTORE_EMULATOR_HOST ||= '127.0.0.1:8080'
  process.env.FIREBASE_STORAGE_EMULATOR_HOST ||= '127.0.0.1:9199'
}
initializeApp({ projectId: PROJECT_ID, storageBucket: BUCKET_NAME, ...(argv.production && { credential: applicationDefault() }) })
const db = getFirestore()
const bucket = getStorage().bucket(BUCKET_NAME)

// A name as a file name: lowercase, accents and anything but letters and digits dropped.
const slug = (name) => String(name || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/['’]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60) || 'map'

const configs = readdirSync(MAPS).filter((file) => file.endsWith('.json')).map((file) => JSON.parse(readFileSync(path.join(MAPS, file), 'utf8')))
const configured = new Set(configs.map((config) => config.mapId).filter(Boolean))
const [maps, sistemas] = await Promise.all([db.collection('maps').get(), db.collection('sistemas').get()])
const sistemasOf = new Map()
sistemas.docs.forEach((sistema) => (sistema.get('maps') || []).forEach((mapId) => sistemasOf.set(mapId, [...(sistemasOf.get(mapId) || []), { id: sistema.id, name: sistema.get('name') }])))
const waiting = maps.docs.filter((doc) => !doc.get('importKey') && !doc.get('deletedAt') && !doc.get('layerSkipReason') && !configured.has(doc.id))

console.log(`${waiting.length} map(s) to process (${argv.production ? 'production' : 'local emulators'})`)
mkdirSync(INBOX, { recursive: true })
for (const doc of waiting) {
  const map = doc.data()
  const name = `${slug(map.name)}-${doc.id.replace(/^-/, '').slice(-6).toLowerCase()}`
  const file = `${name}${EXTENSIONS[map.contentType] || ''}`
  const target = path.join(INBOX, file)
  if (!existsSync(target)) {
    const [bytes] = await bucket.file(`maps/${doc.id}`).download()
    writeFileSync(target, bytes)
  }
  const systems = sistemasOf.get(doc.id) || []
  console.log(`\n${map.name} (${doc.id})\n  system: ${systems.map((s) => s.name).join(', ') || '-'}\n  file: ${path.relative(ROOT, target)}`)
  if (!argv.config) continue
  const configPath = path.join(MAPS, `${name}.json`)
  if (!map.contentType?.startsWith('image/') || map.contentType === 'image/svg+xml') {
    console.log('  config: not started - a PDF or SVG map is prepared first (docs/map-layer.md)')
  } else if (existsSync(configPath)) {
    console.log(`  config: ${path.relative(ROOT, configPath)} exists, left as is`)
  } else {
    const config = {
      mapId: doc.id,
      image: path.relative(MAPS, target).split(path.sep).join('/'),
      title: map.name,
      ...(map.date && { date: map.date }),
      credits: [map.name, map.authors?.length ? `by ${map.authors.join(', ')}` : '', map.date || '', map.note || ''].filter(Boolean).join('; '),
      ...(systems.length && { sistemaId: systems[0].id }),
      utmEpsg: 32616,
    }
    writeFileSync(configPath, `${JSON.stringify(config, null, 2)}\n`)
    console.log(`  config: ${path.relative(ROOT, configPath)} started (placement, trace and symbols to add)`)
  }
}
process.exit(0)

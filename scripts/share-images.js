#!/usr/bin/env node
// Makes the share images (og:image) of the caves and the cave systems - the
// picture a link to their page shows on Facebook, WhatsApp, X... - for the
// records made before the server made them itself (functions/js/share/: a
// cave's cover photo, else its map card; a system's map card), or all again
// (--all) after their look changed. The same code as the server's triggers:
// a record whose picture is up to date (its key still the one its data gives,
// its file there) is skipped. Each map card is one Mapbox Static Images API
// call (free up to 50,000 a month): drawn one at a time, --pause apart.
//
// The Mapbox token (needed with --write): MAPBOX_STATIC_TOKEN if set (the
// environment, or the project's .env), else the functions' own secret,
// MAPBOX_STATIC_TOKEN in Secret Manager (read with gcloud, signed in with an
// account that can read the project's secrets) - never printed. See
// docs/maintenance.md, "Share images".
import { execSync } from 'node:child_process'
import { mkdirSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'
import { initializeApp, applicationDefault } from 'firebase-admin/app'
import { FieldValue, getFirestore } from 'firebase-admin/firestore'
import { getStorage } from 'firebase-admin/storage'
import { CAVES_ASSETS_COLL_NAME, CAVES_COLL_NAME, CONNECTIONS_COLL_NAME, SISTEMAS_COLL_NAME } from '../functions/js/constants.js'
import { SHARE_FOLDER, memoryLookup, refreshShareImage } from '../functions/js/share/shareImages.js'

const PROJECT_ID = 'opencaves'
const BUCKET = 'opencaves.appspot.com'
const ROOT = path.resolve(import.meta.dirname, '..')

const cli = yargs(hideBin(process.argv))
  .usage('Make the caves\' and the cave systems\' share images (og:image): a cave\'s cover photo, else its map card; a system\'s map card.\n\nUsage: $0 [-l | -p] --dry-run | --write [--cave=<id> | --sistema=<id> | --caves | --sistemas] [--all]')
  .option('dry-run', { type: 'boolean', default: false, describe: 'Only list the pictures that would be made or removed' })
  .option('write', { type: 'boolean', default: false, describe: 'Make them, store them and fill in the records\' shareImage' })
  .option('cave', { type: 'string', describe: 'This cave only (its id, with "=": ids start with "-")' })
  .option('sistema', { type: 'string', describe: 'This cave system only' })
  .option('caves', { type: 'boolean', default: false, describe: 'The caves only' })
  .option('sistemas', { type: 'boolean', default: false, describe: 'The cave systems only' })
  .option('all', { type: 'boolean', default: false, describe: 'Draw them all again, those up to date too' })
  .option('pause', { type: 'number', default: 400, describe: 'Milliseconds between two pictures drawn (Mapbox calls)' })
  .option('save', { type: 'string', describe: 'Also save a copy of each picture made in this folder' })
  .option('local', { alias: 'l', type: 'boolean', describe: 'The local emulators - the default' })
  .option('production', { alias: 'p', type: 'boolean', default: false, describe: 'The real opencaves project (needs `gcloud auth application-default login`)' })
  .check((args) => !(args.local && args.production) || 'Use --local or --production, not both')
  // No arguments: only the help is shown (below).
  .check((args) => hideBin(process.argv).length === 0 || args['dry-run'] !== args.write || 'Give --dry-run or --write')
  .check((args) => [args.cave, args.sistema, args.caves, args.sistemas].filter(Boolean).length <= 1 || 'Give one of --cave, --sistema, --caves, --sistemas')
  .example('$0 -l --dry-run', 'What would be made locally')
  .example('$0 -l --write --cave=-KPZkVEFFWL2YP1UQKRf', 'One cave\'s, locally')
  .example('$0 -p --write', 'Make the missing ones in production')
  .help()
  .alias('help', 'h')
  .strict()

// No arguments: the help, not a run.
if (hideBin(process.argv).length === 0) {
  cli.showHelp()
  process.exit(0)
}
const argv = cli.parseSync()

try {
  process.loadEnvFile(path.join(ROOT, '.env'))
} catch {
  // No .env: the token from the environment, if any.
}
// The Mapbox token: MAPBOX_STATIC_TOKEN if set, else the secret.
function mapboxToken() {
  if (process.env.MAPBOX_STATIC_TOKEN) return process.env.MAPBOX_STATIC_TOKEN.trim()
  try {
    return execSync(`gcloud secrets versions access latest --secret=MAPBOX_STATIC_TOKEN --project=${PROJECT_ID}`, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim()
  } catch (error) {
    console.error(`The Mapbox token couldn't be read from Secret Manager (gcloud signed in, the MAPBOX_STATIC_TOKEN secret readable?), and MAPBOX_STATIC_TOKEN isn't set: ${String(error.stderr || error.message).trim()}`)
    process.exit(1)
  }
}
// Only a run that draws needs it.
const token = argv.write ? mapboxToken() : null

if (!argv.production) {
  process.env.FIRESTORE_EMULATOR_HOST ??= '127.0.0.1:8080'
  process.env.FIREBASE_STORAGE_EMULATOR_HOST ??= '127.0.0.1:9199'
} else {
  // The emulators' addresses would send production's writes there, and give
  // the pictures emulator addresses.
  delete process.env.FIRESTORE_EMULATOR_HOST
  delete process.env.FIREBASE_STORAGE_EMULATOR_HOST
  delete process.env.STORAGE_EMULATOR_HOST
}
initializeApp({ projectId: PROJECT_ID, storageBucket: BUCKET, ...(argv.production && { credential: applicationDefault() }) })
const db = getFirestore()
const bucket = getStorage().bucket()
console.log(`${argv.production ? 'PRODUCTION' : 'local emulators'}${argv.write ? '' : ' - dry run, nothing written'}`)

// Everything read once - the caves, the systems, their connections, the
// cover photos and the pictures already stored -, the rest worked out in
// memory: a query per record made the run thousands of queries.
const started = Date.now()
const all = async (name) => (await db.collection(name).get()).docs.map((doc) => ({ id: doc.id, ...doc.data() }))
const [caves, sistemas, connections, covers, [stored]] = await Promise.all([
  all(CAVES_COLL_NAME),
  all(SISTEMAS_COLL_NAME),
  all(CONNECTIONS_COLL_NAME),
  db.collection(CAVES_ASSETS_COLL_NAME).where('isCover', '==', true).get().then((snap) => snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }))),
  bucket.getFiles({ prefix: `${SHARE_FOLDER}/` }),
])
const files = new Set(stored.map((file) => file.name))
console.log(`read ${caves.length} caves, ${sistemas.length} systems, ${connections.length} connections, ${covers.length} covers, ${files.size} pictures in ${Date.now() - started} ms`)
const context = { db, bucket, token, deleteField: FieldValue.delete(), lookup: memoryLookup({ caves, sistemas, connections, covers }), files }

// The records to go through: [collection, record].
const pick = (records, id) => {
  const record = records.find((item) => item.id === id)
  if (!record) {
    console.error(`No record ${id}.`)
    process.exit(1)
  }
  return record
}
const targets = []
if (argv.cave) targets.push([CAVES_COLL_NAME, pick(caves, argv.cave)])
else if (argv.sistema) targets.push([SISTEMAS_COLL_NAME, pick(sistemas, argv.sistema)])
else {
  if (!argv.sistemas) targets.push(...caves.map((cave) => [CAVES_COLL_NAME, cave]))
  if (!argv.caves) targets.push(...sistemas.map((sistema) => [SISTEMAS_COLL_NAME, sistema]))
}
if (argv.save) mkdirSync(argv.save, { recursive: true })

const counts = {}
let failed = 0
for (const [collection, { id, ...data }] of targets) {
  try {
    const result = await refreshShareImage(context, collection, id, { data, force: argv.all, dryRun: !argv.write })
    counts[result.action] = (counts[result.action] || 0) + 1
    if (result.action !== 'unchanged' && result.action !== 'none') console.log(`${collection}/${id}: ${result.action}${result.kind ? ` (${result.kind})` : ''}`)
    if (result.action === 'made') {
      if (argv.save) writeFileSync(path.join(argv.save, `${collection}-${id}.jpg`), (await bucket.file(result.path).download())[0])
      // Politely apart: the next one may call Mapbox.
      await new Promise((resolve) => setTimeout(resolve, argv.pause))
    }
  } catch (error) {
    console.error(`${collection}/${id}: FAILED - ${error.message}`)
    failed++
  }
}
console.log(`done in ${Math.round((Date.now() - started) / 1000)} s (${targets.length} record(s)): ${Object.entries(counts).map(([action, count]) => `${count} ${action}`).join(', ') || 'nothing'}${failed ? `, ${failed} failed` : ''}`)
if (failed) process.exitCode = 1
// Firestore's connection would keep the process up a while longer.
await db.terminate()

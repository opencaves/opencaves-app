#!/usr/bin/env node
// Picks the landing page's header photos: a short list of cave cover photos,
// written into the app (src/config/heroPhotos.json, in git), so the header
// shows one at random from its very first paint - on the server's page and
// in the app's own copy alike - and never swaps it for another (Home.jsx).
// The covers of the most visited caves (_popularity: views, saves) first,
// landscape photos only (wide enough for the header), panoramas left out.
// Run before a release, against production (-p): the build reads the file,
// never the database. Reads public data only; writes only the local file
// (--write), nothing to the database.
import path from 'node:path'
import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const OUT_FILE = path.join(ROOT, 'src', 'config', 'heroPhotos.json')
const PROJECT_ID = 'opencaves'
// How many photos the list holds.
const COUNT = 12
// Wide enough for the header (width / height, once the photo's EXIF
// orientation is applied).
const MIN_RATIO = 1.3

const cli = yargs(hideBin(process.argv))
  .usage('$0 (-l | -p) (--dry-run | --write)\n\nPicks the landing page\'s header photos (the most visited caves\' landscape cover photos) and writes them into src/config/heroPhotos.json.')
  .option('local', { alias: 'l', type: 'boolean', default: false, describe: 'The local emulators' })
  .option('production', { alias: 'p', type: 'boolean', default: false, describe: 'The real project (its public data, read only)' })
  .option('count', { type: 'number', default: COUNT, describe: 'How many photos' })
  .option('dry-run', { type: 'boolean', default: false, describe: 'List the photos, write nothing' })
  .option('write', { type: 'boolean', default: false, describe: 'Write src/config/heroPhotos.json' })
  .example('$0 -p --dry-run', 'The photos production would give')
  .example('$0 -p --write', 'Write them into the app (then commit the file)')
  .help()
  .alias('h', 'help')
  .strict()

const argv = cli.parseSync()
if (argv.local === argv.production || argv.dryRun === argv.write) {
  cli.showHelp()
  process.exit(argv.local || argv.production ? 1 : 0)
}

const FIRESTORE = argv.production
  ? `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents`
  : `http://127.0.0.1:8080/v1/projects/${PROJECT_ID}/databases/(default)/documents`
// The emulator's REST API reads as its owner (no rules).
const HEADERS = argv.local ? { Authorization: 'Bearer owner', 'Content-Type': 'application/json' } : { 'Content-Type': 'application/json' }

// A Firestore REST value as plain JSON.
const value = (field) => {
  if (!field) return undefined
  if ('stringValue' in field) return field.stringValue
  if ('integerValue' in field) return Number(field.integerValue)
  if ('doubleValue' in field) return field.doubleValue
  if ('booleanValue' in field) return field.booleanValue
  if ('timestampValue' in field) return field.timestampValue
  if ('nullValue' in field) return null
  return undefined
}

// The cover photos: { id, caveId, width, height, orientation, type, deletedAt, thumbnailRevision, viewThumbnailRevision }.
async function covers() {
  const response = await fetch(`${FIRESTORE}:runQuery`, {
    method: 'POST',
    headers: HEADERS,
    body: JSON.stringify({ structuredQuery: { from: [{ collectionId: 'cavesAssets' }], where: { fieldFilter: { field: { fieldPath: 'isCover' }, op: 'EQUAL', value: { booleanValue: true } } } } }),
  })
  if (!response.ok) throw new Error(`cavesAssets: ${response.status} ${(await response.text()).slice(0, 200)}`)
  return (await response.json())
    .filter((row) => row.document)
    .map(({ document }) => ({ id: document.name.split('/').pop(), ...Object.fromEntries(Object.entries(document.fields || {}).map(([key, field]) => [key, value(field)])) }))
}

// _popularity's caves numbers (views + saves), by cave id.
async function popularity() {
  const response = await fetch(`${FIRESTORE}/_popularity/caves`, { headers: HEADERS })
  if (!response.ok) return {}
  const { fields = {} } = await response.json()
  const score = {}
  for (const kind of ['views', 'saves']) {
    for (const [id, field] of Object.entries(fields[kind]?.mapValue?.fields || {})) score[id] = (score[id] || 0) + (value(field) || 0)
  }
  return score
}

// Width / height as shown: EXIF orientations 5-8 turn the photo a quarter.
const ratio = ({ width, height, orientation }) => {
  if (!width || !height) return 0
  return orientation >= 5 && orientation <= 8 ? height / width : width / height
}

const [all, score] = await Promise.all([covers(), popularity()])
const picked = all
  .filter((photo) => !photo.deletedAt && photo.type === 'image' && ratio(photo) >= MIN_RATIO)
  .sort((a, b) => (score[b.caveId] || 0) - (score[a.caveId] || 0) || a.id.localeCompare(b.id))
  .slice(0, argv.count)
  // What the app needs to build a photo's addresses (CaveAsset's getThumbnailUrl).
  .map(({ id, caveId, thumbnailRevision, viewThumbnailRevision }) => ({ id, caveId, ...(thumbnailRevision > 1 && { thumbnailRevision }), ...(viewThumbnailRevision > 0 && { viewThumbnailRevision }) }))

console.log(`${all.length} cover photos, ${picked.length} picked:`)
picked.forEach(({ id, caveId }, i) => console.log(`${String(i + 1).padStart(3)} ${caveId} ${id} (score ${score[caveId] || 0})`))
if (argv.dryRun) {
  console.log('\ndry run: nothing written (--write to write src/config/heroPhotos.json).')
  process.exit(0)
}
const text = `${JSON.stringify(picked, null, 2)}\n`
let before = ''
try {
  before = readFileSync(OUT_FILE, 'utf8')
} catch {
  // A first run.
}
if (before === text) {
  console.log('\nsrc/config/heroPhotos.json is up to date.')
} else {
  writeFileSync(OUT_FILE, text)
  console.log('\nwrote src/config/heroPhotos.json: commit it with the release.')
}

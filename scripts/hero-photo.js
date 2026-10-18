#!/usr/bin/env node
// Picks the landing page's header photo and downloads it into the app
// (src/images/hero/: hero-small.webp, 1024 px, for phones; hero.webp, 1536
// px, from MUI's md; hero.json, which photo it is), so it's part of the site
// itself: the same photo on every path, preloaded with the server's page and
// stored with the app by the service worker (vite.config.js' globPatterns) -
// shown from the first paint, never swapped (Home.jsx). One at random among
// the most visited caves' landscape cover photos (_popularity: views, saves;
// panoramas left out), or the one --id names. Run before a release's build,
// against production (-p): it reads public data only and writes only the
// local files (--write); commit them with the release.
import path from 'node:path'
import { mkdirSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const OUT_DIR = path.join(ROOT, 'src', 'images', 'hero')
const PROJECT_ID = 'opencaves'
const BUCKET = 'opencaves.appspot.com'
// Among how many of the most visited caves' covers the photo is picked.
const CANDIDATES = 12
// Wide enough for the header (width / height, once the photo's EXIF
// orientation is applied).
const MIN_RATIO = 1.3
// The photo's two sizes: its stored thumbnails, and the files they become.
const SIZES = [
  { size: '1024', file: 'hero-small.webp' },
  { size: '1536', file: 'hero.webp' },
]

const cli = yargs(hideBin(process.argv))
  .usage('$0 (-l | -p) (--dry-run | --write) [--id <photo id>]\n\nPicks the landing page\'s header photo (one of the most visited caves\' landscape cover photos, at random) and downloads it into src/images/hero/.')
  .option('local', { alias: 'l', type: 'boolean', default: false, describe: 'The local emulators\' data (the photo still comes from the real bucket)' })
  .option('production', { alias: 'p', type: 'boolean', default: false, describe: 'The real project (its public data, read only)' })
  .option('id', { type: 'string', describe: 'This cover photo (its id), not one at random' })
  .option('dry-run', { type: 'boolean', default: false, describe: 'Show the candidates and the pick, download nothing' })
  .option('write', { type: 'boolean', default: false, describe: 'Download it into src/images/hero/' })
  .example('$0 -p --dry-run', 'The candidates, and the one picked')
  .example('$0 -p --write', 'Download the pick (then commit src/images/hero/)')
  .example('$0 -p --write --id=-P2lm3hW9rly7vR4qBIl', 'This photo')
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
  return undefined
}

// The cover photos: { id, caveId, width, height, orientation, type, deletedAt, thumbnailRevision }.
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

// A stored thumbnail's address (CaveAsset's getThumbnailUrl: a redone copy
// carries its revision in its name).
const thumbnailUrl = ({ id, caveId, thumbnailRevision }, size) => {
  const revision = thumbnailRevision > 1 ? `-r${thumbnailRevision}` : ''
  return `https://storage.googleapis.com/${BUCKET}/caves/${caveId}/thumbnails/${id}_${size}${revision}.webp`
}

const [all, score] = await Promise.all([covers(), popularity()])
const candidates = all
  .filter((photo) => !photo.deletedAt && photo.type === 'image' && ratio(photo) >= MIN_RATIO)
  .sort((a, b) => (score[b.caveId] || 0) - (score[a.caveId] || 0) || a.id.localeCompare(b.id))
  .slice(0, CANDIDATES)
const photo = argv.id ? all.find(({ id }) => id === argv.id) : candidates[Math.floor(Math.random() * candidates.length)]
if (!photo) {
  console.error(argv.id ? `No cover photo ${argv.id}.` : 'No cover photo to pick.')
  process.exit(1)
}

console.log(`${all.length} cover photos; the ${candidates.length} candidates:`)
candidates.forEach(({ id, caveId }, i) => console.log(`${String(i + 1).padStart(3)} ${caveId} ${id} (score ${score[caveId] || 0})${id === photo.id ? '   <- picked' : ''}`))
if (argv.id) console.log(`picked by --id: ${photo.caveId} ${photo.id}`)
if (argv.dryRun) {
  console.log('\ndry run: nothing downloaded (--write to download it into src/images/hero/).')
  process.exit(0)
}

mkdirSync(OUT_DIR, { recursive: true })
for (const { size, file } of SIZES) {
  const url = thumbnailUrl(photo, size)
  const response = await fetch(url)
  if (!response.ok) throw new Error(`${url}: ${response.status}`)
  const bytes = Buffer.from(await response.arrayBuffer())
  writeFileSync(path.join(OUT_DIR, file), bytes)
  console.log(`${file}: ${Math.round(bytes.length / 1024)} KB, from ${url}`)
}
writeFileSync(path.join(OUT_DIR, 'hero.json'), `${JSON.stringify({ id: photo.id, caveId: photo.caveId, pickedAt: new Date().toISOString().slice(0, 10) }, null, 2)}\n`)
console.log('\nwrote src/images/hero/ - commit it with the release.')

// Fills in the survey maps' fingerprints that the map tasks compare
// (functions/js/tasks/mapTasks.js), for the maps made before they existed:
// - contentHash, the file's SHA-256 (hex) - what the app sends with a new map
//   (src/components/MapsPicker/MapUpload.jsx), hashed from the file as stored:
//   an image's or a PDF's original (maps/<id>, maps/original-pdf/<id>) is the
//   uploaded file itself, so a new upload of it is found identical. An SVG's
//   isn't: the server replaced it with its cleaned, minified copy (stored
//   gzip-compressed; the download unzips it), whose hash only matches a new
//   upload of that copy (its "Original file" download) - the visual hash still
//   finds the same map;
// - visualHash, its thumbnail's difference hash (maps/derived/<id>_thumb.webp),
//   the same function as the server's (functions/js/maps/visualHash.js). A map
//   without a thumbnail is left without one.
// Both are server fields (not in the audit log in production, nor in What's
// new). Re-runnable: a map with its fingerprints is skipped (--all hashes them
// all again).

import { createHash } from 'node:crypto'
import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'
import { initializeApp, applicationDefault } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import { getStorage } from 'firebase-admin/storage'
import { visualHash } from '../functions/js/maps/visualHash.js'

const PROJECT_ID = 'opencaves'
const BUCKET = 'opencaves.appspot.com'

const cli = yargs(hideBin(process.argv))
  .usage('Fill in the survey maps\' fingerprints (contentHash, visualHash) for the map tasks\' duplicate checks.\n\nUsage: $0 [-l | -p] --dry-run | --write [--content | --visual] [--all]')
  .option('dry-run', { type: 'boolean', default: false, describe: 'Only list the maps that would get a fingerprint' })
  .option('write', { type: 'boolean', default: false, describe: 'Hash them and save the fingerprints' })
  .option('content', { type: 'boolean', default: false, describe: 'Only contentHash (the file\'s SHA-256)' })
  .option('visual', { type: 'boolean', default: false, describe: 'Only visualHash (the thumbnail\'s difference hash)' })
  .option('all', { type: 'boolean', default: false, describe: 'Every map, those with fingerprints too (hashed again)' })
  .option('local', { alias: 'l', type: 'boolean', describe: 'The local emulators - the default' })
  .option('production', { alias: 'p', type: 'boolean', default: false, describe: 'The real opencaves project (needs `gcloud auth application-default login`)' })
  .check((args) => !(args.local && args.production) || 'Use --local or --production, not both')
  .check((args) => args['dry-run'] !== args.write || 'Give --dry-run or --write')
  .check((args) => !(args.content && args.visual) || 'Give --content or --visual, not both (neither: both)')
  .example('$0 -l --dry-run', 'The local maps without fingerprints')
  .example('$0 -p --write', 'Fill them in in production')
  .help()
  .alias('help', 'h')
  .strict()

// No arguments: the help, not a run.
if (hideBin(process.argv).length === 0) {
  cli.showHelp()
  process.exit(0)
}
const argv = cli.parseSync()

if (!argv.production) {
  process.env.FIRESTORE_EMULATOR_HOST ??= '127.0.0.1:8080'
  process.env.FIREBASE_STORAGE_EMULATOR_HOST ??= '127.0.0.1:9199'
}
initializeApp({ projectId: PROJECT_ID, storageBucket: BUCKET, ...(argv.production && { credential: applicationDefault() }) })
const db = getFirestore()
const bucket = getStorage().bucket()
console.log(`${argv.production ? 'PRODUCTION' : 'local emulators'}${argv.write ? '' : ' - dry run, nothing written'}`)

const wantContent = !argv.visual
const wantVisual = !argv.content
// A map's original file in Storage: a PDF's apart (its pages are SVGs at maps/<svgId>).
const originalPath = (doc) => (doc.get('contentType') === 'application/pdf' ? `maps/original-pdf/${doc.id}` : `maps/${doc.id}`)

const maps = (await db.collection('maps').get()).docs.filter((doc) => !doc.get('deletedAt'))
const todo = maps
  .map((doc) => ({ doc, content: wantContent && (argv.all || !doc.get('contentHash')), visual: wantVisual && (argv.all || !doc.get('visualHash')) }))
  .filter(({ content, visual }) => content || visual)
console.log(`${todo.length} of ${maps.length} map(s) to hash`)

let failed = 0
let skipped = 0
for (const { doc, content, visual } of todo) {
  const label = `${doc.id} ${String(doc.get('name') || '').slice(0, 60)}`
  if (!argv.write) {
    console.log(`${label}: ${[content && 'contentHash', visual && 'visualHash'].filter(Boolean).join(', ')}`)
    continue
  }
  const fields = {}
  const notes = []
  try {
    if (content) {
      const file = bucket.file(originalPath(doc))
      if ((await file.exists())[0]) {
        const [bytes] = await file.download()
        fields.contentHash = createHash('sha256').update(bytes).digest('hex')
      } else notes.push('no original file')
    }
    if (visual) {
      const thumbnail = bucket.file(`maps/derived/${doc.id}_thumb.webp`)
      if ((await thumbnail.exists())[0]) fields.visualHash = await visualHash((await thumbnail.download())[0])
      else notes.push('no thumbnail')
    }
    if (Object.keys(fields).length) await doc.ref.update(fields)
    else skipped++
    console.log(`${label}: ${Object.keys(fields).join(', ') || '-'}${notes.length ? ` (${notes.join(', ')})` : ''}`)
  } catch (error) {
    console.error(`${label}: FAILED - ${error.message}`)
    failed++
  }
}
if (argv.write) console.log(`done: ${todo.length - skipped - failed} hashed, ${skipped} with nothing to hash, ${failed} failed`)
if (failed) process.exitCode = 1

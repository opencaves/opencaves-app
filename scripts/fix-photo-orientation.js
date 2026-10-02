#!/usr/bin/env node
// Redoes the resized copies of the photos uploaded turned (a phone saves
// many photos sideways or upside down, with an EXIF orientation tag saying how
// to turn them, which the resize function didn't apply until 2026-10).
//
// For each photo (cavesAssets) whose orientation isn't 1 and whose copies
// weren't redone yet: its original is turned upright and resized like the
// resize function does (functions/js/resize-images), under new names
// (<id>_<size>-r2.webp: a new URL, so no browser or CDN cache keeps serving
// the old copies, cached for a year); its record gets thumbnailRevision: 2
// (the app builds the copies' URLs from it) and, for a quarter-turned photo,
// its width and height as shown. The old copies are then deleted.
//
// A dry run (--dry-run) lists the photos; --write does it.
import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'
import { initializeApp, applicationDefault } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import { getStorage } from 'firebase-admin/storage'
import config from '../functions/js/resize-images/config.js'
import { resize, convertType } from '../functions/js/resize-images/resize-image.js'
import { BUCKET_NAME, THUMBNAILS_FOLDER } from '../functions/js/constants.js'

const PROJECT_ID = 'opencaves'
const REVISION = 2

const cli = yargs(hideBin(process.argv))
  .usage('$0 -l | -p --dry-run | --write\n\nRedoes the resized copies of the photos uploaded turned (EXIF orientation), upright, under new names.')
  .option('local', { alias: 'l', type: 'boolean', default: false, describe: 'The local emulators (Firestore 127.0.0.1:8080, Storage 127.0.0.1:9199)' })
  .option('production', { alias: 'p', type: 'boolean', default: false, describe: 'The real opencaves project (requires `gcloud auth application-default login`)' })
  .option('dry-run', { type: 'boolean', default: false, describe: 'List the photos, change nothing' })
  .option('write', { type: 'boolean', default: false, describe: 'Redo their copies' })
  .check((args) => {
    if (args.local === args.production) throw new Error('Use exactly one of -l (local) or -p (production).')
    if (args.dryRun === args.write) throw new Error('Use exactly one of --dry-run or --write.')
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
initializeApp(argv.production ? { credential: applicationDefault(), projectId: PROJECT_ID, storageBucket: BUCKET_NAME } : { projectId: PROJECT_ID, storageBucket: BUCKET_NAME })
const db = getFirestore()
const bucket = getStorage().bucket(BUCKET_NAME)

const copyName = (caveId, id, size, type, revision) => `caves/${caveId}/${THUMBNAILS_FOLDER}/${id}_${size}${revision > 1 ? `-r${revision}` : ''}.${type}`

const snapshot = await db.collection('cavesAssets').get()
const turned = snapshot.docs.filter((doc) => (doc.get('orientation') || 1) !== 1 && !(doc.get('thumbnailRevision') > 1))
console.log(`${turned.length} photo(s) to redo, of ${snapshot.size}`)

for (const doc of turned) {
  const asset = doc.data()
  const id = asset.id || doc.id
  const original = asset.fullPath || `caves/${asset.caveId}/images/${id}`
  const quarterTurned = asset.orientation >= 5 && asset.orientation <= 8
  console.log(`\n${asset.caveId} ${original} (orientation ${asset.orientation}${quarterTurned ? `, ${asset.width}x${asset.height} -> ${asset.height}x${asset.width}` : ''})`)
  if (!argv.write) continue

  const [buffer] = await bucket.file(original).download()
  for (const [size, options] of Object.entries(config.imageSizes)) {
    for (const type of config.imageTypes) {
      // resize() applies the EXIF orientation (rotate()), as the function now does.
      const image = await convertType(await resize(buffer, options), type)
      const name = copyName(asset.caveId, id, size, type, REVISION)
      const file = bucket.file(name)
      await file.save(image, {
        resumable: false,
        metadata: {
          contentType: `image/${type}`,
          cacheControl: config.cacheControlHeader,
          contentDisposition: `inline; filename*=utf-8''${name.split('/').pop()}`,
          metadata: { resizedImage: 'true' },
        },
      })
      if (config.makePublic && argv.production) await file.makePublic()
      console.log(`   ${name} (${image.length} B)`)
    }
  }
  await doc.ref.update({ thumbnailRevision: REVISION, ...(quarterTurned && asset.width && asset.height && { width: asset.height, height: asset.width }) })
  // The old, turned copies.
  for (const size of Object.keys(config.imageSizes)) {
    for (const type of config.imageTypes) await bucket.file(copyName(asset.caveId, id, size, type, 1)).delete({ ignoreNotFound: true })
  }
  console.log('   record updated, old copies deleted')
}

console.log(`\n${argv.write ? 'Done.' : 'Dry run: nothing changed (--write to redo them).'}`)
process.exit(0)

#!/usr/bin/env node
// Redoes the resized copies of the cave photos (cover, thumbnails, 1024, 1536,
// 4k) from their originals, with the resize function's current settings
// (functions/js/resize-images/config.js) - after changing them, or to fix
// copies made wrong (photos uploaded turned: their EXIF orientation wasn't
// applied until 2026-10).
//
// Each photo's copies are written under new names (<id>_<size>-r<n>.webp,
// the next thumbnailRevision): a new URL, so no browser or CDN cache keeps
// serving the old copies, cached for a year. Its record then gets that
// thumbnailRevision (the app builds the copies' URLs from it) and its width
// and height as shown (a quarter-turned photo's are swapped); the old copies
// are deleted last.
//
// A dry run (--dry-run) lists the photos; --write redoes them. Run it on the
// local emulators (the original data), then mirror them to production
// (sync-to-production.js).
import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'
import { initializeApp, applicationDefault } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import { getStorage } from 'firebase-admin/storage'
import config from '../functions/js/resize-images/config.js'
import { resize, convertType, shownSize } from '../functions/js/resize-images/resize-image.js'
import { BUCKET_NAME, THUMBNAILS_FOLDER } from '../functions/js/constants.js'

const PROJECT_ID = 'opencaves'
const PARALLEL = 4

const cli = yargs(hideBin(process.argv))
  .usage('$0 -l | -p --dry-run | --write [--turned] [--cave=<caveId>]\n\nRedoes the resized copies of the cave photos with the resize function\'s current settings, under new names.')
  .option('local', { alias: 'l', type: 'boolean', default: false, describe: 'The local emulators (Firestore 127.0.0.1:8080, Storage 127.0.0.1:9199)' })
  .option('production', { alias: 'p', type: 'boolean', default: false, describe: 'The real opencaves project (requires `gcloud auth application-default login`)' })
  .option('dry-run', { type: 'boolean', default: false, describe: 'List the photos, change nothing' })
  .option('write', { type: 'boolean', default: false, describe: 'Redo their copies' })
  .option('turned', { type: 'boolean', default: false, describe: 'Only the photos uploaded turned (EXIF orientation) whose copies weren\'t redone yet' })
  .option('cave', { type: 'string', describe: 'Only this cave\'s photos (--cave=<id>: cave IDs start with "-")' })
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

const snapshot = await (argv.cave ? db.collection('cavesAssets').where('caveId', '==', argv.cave) : db.collection('cavesAssets')).get()
const photos = snapshot.docs.filter((doc) => doc.get('type') === 'image' && (!argv.turned || ((doc.get('orientation') || 1) !== 1 && !(doc.get('thumbnailRevision') > 1))))
console.log(`${photos.length} photo(s) to redo, of ${snapshot.size}`)

async function redo(doc) {
  const asset = doc.data()
  const id = asset.id || doc.id
  const original = asset.fullPath || `caves/${asset.caveId}/images/${id}`
  const revision = asset.thumbnailRevision || 1
  const next = revision + 1
  const lines = [`${asset.caveId} ${original}: r${revision} -> r${next}`]
  if (!argv.write) return lines

  const [buffer] = await bucket.file(original).download()
  let bytes = 0
  for (const [size, options] of Object.entries(config.imageSizes)) {
    for (const type of config.imageTypes) {
      // resize() applies the EXIF orientation (rotate()), as the function does.
      const image = await convertType(await resize(buffer, options), type)
      const name = copyName(asset.caveId, id, size, type, next)
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
      bytes += image.length
    }
  }
  const shown = await shownSize(buffer)
  const resized = shown.width !== asset.width || shown.height !== asset.height
  await doc.ref.update({ thumbnailRevision: next, ...(resized && shown) })
  for (const size of Object.keys(config.imageSizes)) {
    for (const type of config.imageTypes) await bucket.file(copyName(asset.caveId, id, size, type, revision)).delete({ ignoreNotFound: true })
  }
  lines.push(`   ${Object.keys(config.imageSizes).length * config.imageTypes.length} copies (${Math.round(bytes / 1024)} KiB)${resized ? `, size ${asset.width}x${asset.height} -> ${shown.width}x${shown.height}` : ''}, old copies deleted`)
  return lines
}

// A few at a time: each holds a full-size original in memory.
let next = 0
let failed = 0
await Promise.all(Array.from({ length: Math.min(PARALLEL, photos.length) }, async () => {
  while (next < photos.length) {
    const doc = photos[next++]
    try {
      console.log((await redo(doc)).join('\n'))
    } catch (error) {
      failed++
      console.error(`${doc.id}: FAILED - ${error.message}`)
    }
  }
}))

console.log(`\n${argv.write ? `Done${failed ? `, ${failed} failed` : ''}.` : 'Dry run: nothing changed (--write to redo them).'}`)
process.exit(failed ? 1 : 0)

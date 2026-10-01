#!/usr/bin/env node
// Checks that the cave photos (cavesAssets) and their files in Storage agree -
// for maintenance, after a bulk import or a function change. Read-only: it
// only reports. Checks:
// - every photo's original file is in Storage, with all its thumbnails
//   (the sizes the onAssetUploaded function makes, from its resize config);
// - no file in caves/*/images or caves/*/thumbnails without a photo;
// - every photo belongs to an existing cave;
// - every cave with photos has exactly one cover.
// Exits with code 1 when something is wrong.
import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'
import { initializeApp, applicationDefault } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import { getStorage } from 'firebase-admin/storage'
import resizeConfig from '../functions/js/resize-images/config.js'
import { BUCKET_NAME, CAVES_ASSETS_COLL_NAME, THUMBNAILS_FOLDER } from '../functions/js/constants.js'

const PROJECT_ID = 'opencaves'

const cli = yargs(hideBin(process.argv))
  .usage('Check that the cave photos and their files in Storage agree.\n\nUsage: $0 [options]')
  .option('production', { alias: 'p', type: 'boolean', default: false, describe: 'The real opencaves project instead of the local emulators (needs `gcloud auth application-default login`)' })
  .option('cave', { type: 'string', describe: 'Only this cave: --cave=<id> (with "=", since cave IDs start with "-")' })
  .option('local', { alias: 'l', type: 'boolean', describe: 'The local emulators - the default, named to run with no other option' })
  .check((args) => !(args.local && args.production) || 'Use --local or --production, not both')
  .example('$0 -l', 'Check the local emulators')
  .example('$0 -p', 'Check production')
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
initializeApp({ projectId: PROJECT_ID, storageBucket: BUCKET_NAME, ...(argv.production && { credential: applicationDefault() }) })
const db = getFirestore()
const bucket = getStorage().bucket()

const THUMBNAIL_SUFFIXES = Object.keys(resizeConfig.imageSizes).flatMap((size) => resizeConfig.imageTypes.map((type) => `_${size}.${type}`))

const problems = {
  missingOriginal: [],
  missingThumbnails: [],
  unknownCave: [],
  coverCount: [],
  bogusAsset: [],
  failedCopies: [],
  orphanOriginal: [],
  orphanThumbnails: [],
}
const TITLES = {
  missingOriginal: 'Photos whose original file is missing',
  missingThumbnails: 'Photos missing thumbnails (the function failed on them: re-upload them)',
  unknownCave: 'Photos of a cave that doesn\'t exist',
  coverCount: 'Caves with photos but not exactly one cover',
  bogusAsset: 'Photo documents made from a file that is not a photo (e.g. a failed-resize copy): delete them',
  failedCopies: 'Copies of originals the resize failed on (images/failed/): delete once the photo was re-uploaded',
  orphanOriginal: 'Files in caves/*/images with no photo document',
  orphanThumbnails: 'Thumbnails with no photo document',
}

async function main() {
  const prefix = argv.cave ? `caves/${argv.cave}/` : 'caves/'
  console.log(`Checking cave photos in ${argv.production ? 'PRODUCTION' : 'the local emulators'}${argv.cave ? ` (cave ${argv.cave})` : ''}...`)

  let assetsQuery = db.collection(CAVES_ASSETS_COLL_NAME).where('type', '==', 'image')
  if (argv.cave) assetsQuery = assetsQuery.where('caveId', '==', argv.cave)
  const [assetsSnap, caveRefs, [files]] = await Promise.all([
    assetsQuery.get(),
    db.collection('caves').listDocuments(),
    bucket.getFiles({ prefix }),
  ])
  const caveIds = new Set(caveRefs.map((ref) => ref.id))
  // Folder placeholders ("caves/x/images/", empty) aren't files.
  const fileNames = new Set(files.map((file) => file.name).filter((name) => !name.endsWith('/')))
  const assets = assetsSnap.docs.map((doc) => ({ id: doc.id, ...doc.data() }))
  const label = (asset) => `${asset.id} (cave ${asset.caveId}${asset.originalName ? `, ${asset.originalName}` : ''}${asset.importSource ? `, imported from ${asset.importSource}` : ''})`

  const coversByCave = new Map()
  const knownPaths = new Set()
  for (const asset of assets) {
    // Only caves/{caveId}/images/{assetId} is a photo's file.
    if (asset.fullPath && asset.fullPath.split('/').length !== 4) {
      problems.bogusAsset.push(`${label(asset)}: ${asset.fullPath}`)
      continue
    }
    const original = asset.fullPath || `caves/${asset.caveId}/images/${asset.id}`
    knownPaths.add(original)
    if (!fileNames.has(original)) problems.missingOriginal.push(label(asset))

    const thumbnails = THUMBNAIL_SUFFIXES.map((suffix) => `caves/${asset.caveId}/${THUMBNAILS_FOLDER}/${asset.id}${suffix}`)
    thumbnails.forEach((path) => knownPaths.add(path))
    const missing = thumbnails.filter((path) => !fileNames.has(path)).map((path) => path.slice(path.lastIndexOf('_') + 1))
    if (missing.length) problems.missingThumbnails.push(`${label(asset)}: ${missing.length === thumbnails.length ? 'all' : missing.join(', ')}`)

    if (!caveIds.has(asset.caveId)) problems.unknownCave.push(label(asset))

    if (!coversByCave.has(asset.caveId)) coversByCave.set(asset.caveId, [])
    if (asset.isCover) coversByCave.get(asset.caveId).push(asset.id)
  }
  for (const [caveId, covers] of coversByCave) {
    if (covers.length !== 1) problems.coverCount.push(`cave ${caveId}: ${covers.length} covers${covers.length ? ` (${covers.join(', ')})` : ''}`)
  }

  for (const name of fileNames) {
    if (knownPaths.has(name)) continue
    if (/^caves\/[^/]+\/images\/failed\//.test(name)) problems.failedCopies.push(name)
    else if (/^caves\/[^/]+\/images\//.test(name)) problems.orphanOriginal.push(name)
    else if (name.includes(`/${THUMBNAILS_FOLDER}/`)) problems.orphanThumbnails.push(name)
  }

  console.log(`${assets.length} photos in ${coversByCave.size} caves, ${fileNames.size} files\n`)
  let total = 0
  for (const [key, items] of Object.entries(problems)) {
    if (!items.length) continue
    total += items.length
    console.log(`${TITLES[key]} (${items.length}):`)
    items.forEach((item) => console.log(`  ${item}`))
    console.log()
  }
  console.log(total ? `${total} problem(s) found.` : 'All good.')
  process.exitCode = total ? 1 : 0
}

main().catch((error) => {
  console.error('Check failed:', error)
  process.exitCode = 2
})

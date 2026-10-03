#!/usr/bin/env node
// Moves each photo record's uploader (userId) and original file name
// (originalName) out of cavesAssets, which anyone can read, into
// cavesAssetsPrivate/{assetId}, which only admins can (firestore.rules). New
// uploads are stored this way by onAssetUploaded; this moves the older ones.
//
// A dry run (the default) counts the records to move; --write moves them.
// Re-runnable: moved records have nothing left to move.
import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'
import { initializeApp, applicationDefault } from 'firebase-admin/app'
import { getFirestore, FieldValue } from 'firebase-admin/firestore'

const PROJECT_ID = 'opencaves'
const PRIVATE_FIELDS = ['userId', 'originalName']

const cli = yargs(hideBin(process.argv))
  .usage('$0 -l | -p [--write]\n\nMoves the photo records\' uploader and original file name to the admin-only cavesAssetsPrivate - a dry run unless --write.')
  .option('local', { alias: 'l', type: 'boolean', default: false, describe: 'The local Firestore emulator (127.0.0.1:8080, or FIRESTORE_EMULATOR_HOST)' })
  .option('production', { alias: 'p', type: 'boolean', default: false, describe: 'The real opencaves project (requires `gcloud auth application-default login`)' })
  .option('write', { type: 'boolean', default: false, describe: 'Move the fields (without it: only count them)' })
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

const snapshot = await db.collection('cavesAssets').get()
const toMove = snapshot.docs.filter((doc) => PRIVATE_FIELDS.some((field) => doc.get(field) !== undefined))
console.log(`${toMove.length} of ${snapshot.size} photo records have an uploader or file name to move.`)

if (!argv.write) {
  if (toMove.length) console.log('Dry run: nothing changed. Add --write to move them.')
  process.exit(0)
}

// 200 records per batch: two writes each, under Firestore's 500.
for (let i = 0; i < toMove.length; i += 200) {
  const batch = db.batch()
  for (const doc of toMove.slice(i, i + 200)) {
    const privateData = Object.fromEntries(PRIVATE_FIELDS.filter((field) => doc.get(field) !== undefined).map((field) => [field, doc.get(field)]))
    batch.set(db.collection('cavesAssetsPrivate').doc(doc.id), privateData, { merge: true })
    batch.update(doc.ref, Object.fromEntries(PRIVATE_FIELDS.map((field) => [field, FieldValue.delete()])))
  }
  await batch.commit()
}
console.log(`Moved ${toMove.length} records.`)

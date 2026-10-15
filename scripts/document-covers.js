// Draws the covers (each one's first page) of the Further reading PDFs that
// have none: those checked before covers were made (onDocumentUploaded makes
// one for every new PDF). The same drawing as the server's
// (functions/js/documents/cover.js): saved at documents/<id>_cover.webp, its
// link in the record's coverUrl - a server field, not in the audit log.
// Re-runnable: a PDF with a cover is skipped (--all draws them all again).

import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'
import { initializeApp, applicationDefault } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import { getStorage } from 'firebase-admin/storage'
import { saveDocumentCover } from '../functions/js/documents/cover.js'
import { documentFilePath } from '../functions/js/documents/files.js'

const PROJECT_ID = 'opencaves'
const BUCKET = 'opencaves.appspot.com'

const cli = yargs(hideBin(process.argv))
  .usage('Draw the covers (first pages) of the Further reading PDFs that have none.\n\nUsage: $0 [-l | -p] --dry-run | --write [--all]')
  .option('dry-run', { type: 'boolean', default: false, describe: 'Only list the PDFs that would get a cover' })
  .option('write', { type: 'boolean', default: false, describe: 'Draw and save them' })
  .option('all', { type: 'boolean', default: false, describe: 'Every PDF, those with a cover too (drawn again)' })
  .option('local', { alias: 'l', type: 'boolean', describe: 'The local emulators - the default' })
  .option('production', { alias: 'p', type: 'boolean', default: false, describe: 'The real opencaves project (needs `gcloud auth application-default login`)' })
  .check((args) => !(args.local && args.production) || 'Use --local or --production, not both')
  .check((args) => args['dry-run'] !== args.write || 'Give --dry-run or --write')
  .example('$0 -l --dry-run', 'The local PDFs without a cover')
  .example('$0 -p --write', 'Draw them in production')
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

const pdfs = (await db.collection('documents').where('kind', '==', 'file').get()).docs
  .filter((doc) => doc.get('status') === 'ready' && !doc.get('deletedAt') && (argv.all || !doc.get('coverUrl')))
console.log(`${pdfs.length} PDF(s) to draw`)

let failed = 0
for (const doc of pdfs) {
  const label = `${doc.id} ${String(doc.get('title')).slice(0, 70)}`
  if (!argv.write) {
    console.log(label)
    continue
  }
  try {
    const [bytes] = await bucket.file(documentFilePath(doc.id)).download()
    const coverUrl = await saveDocumentCover(bucket, doc.id, bytes)
    await doc.ref.update({ coverUrl })
    console.log(`${label}: drawn`)
  } catch (error) {
    console.error(`${label}: FAILED - ${error.message}`)
    failed++
  }
}
if (failed) process.exitCode = 1

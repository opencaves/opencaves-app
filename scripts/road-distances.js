#!/usr/bin/env node
// Works out how far each cave still to confirm (located, its position not
// confirmed) is from the nearest path and road - OpenStreetMap's highways,
// downloaded from Overpass - and writes it on the cave (roadDistance), for the
// caves' list's "Easiest to reach first" (/caves?missing=position&sort=road).
// The same code as the server's (functions/js/roads/), which does it monthly
// and whenever a cave moves: this is for a first run, or after a big import.
// --refresh downloads the roads again (one Overpass query around every
// located cave) and stores them in Storage (roads/roads.json.gz); without it,
// the stored roads are used. See docs/maintenance.md, "Road distances".
import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'
import { initializeApp, applicationDefault } from 'firebase-admin/app'
import { FieldValue, getFirestore } from 'firebase-admin/firestore'
import { getStorage } from 'firebase-admin/storage'
import { refreshRoadDistances } from '../functions/js/roads/refresh.js'

const PROJECT_ID = 'opencaves'
const BUCKET = 'opencaves.appspot.com'

const cli = yargs(hideBin(process.argv))
  .usage('Measure how far each cave still to confirm is from the nearest path and road (OpenStreetMap).\n\nUsage: $0 [-l | -p] --dry-run | --write [--refresh] [--cave=<id>]')
  .option('dry-run', { type: 'boolean', default: false, describe: 'Only list the changes (with --refresh: the roads downloaded, not stored)' })
  .option('write', { type: 'boolean', default: false, describe: 'Write the caves\' roadDistance (with --refresh: store the roads and _roads/meta)' })
  .option('refresh', { type: 'boolean', default: false, describe: 'Download the roads again from Overpass, else use the stored ones' })
  .option('cave', { type: 'string', describe: 'This cave only (its id, with "=": ids start with "-")' })
  .option('verbose', { alias: 'v', type: 'boolean', default: false, describe: 'Print each change\'s distances' })
  .option('local', { alias: 'l', type: 'boolean', describe: 'The local emulators - the default' })
  .option('production', { alias: 'p', type: 'boolean', default: false, describe: 'The real opencaves project (needs `gcloud auth application-default login`)' })
  .check((args) => !(args.local && args.production) || 'Use --local or --production, not both')
  .check((args) => hideBin(process.argv).length === 0 || args['dry-run'] !== args.write || 'Give --dry-run or --write')
  .example('$0 -l --refresh --dry-run', 'Download the roads, list what would change locally')
  .example('$0 -l --refresh --write', 'Download the roads and write the distances locally')
  .example('$0 -p --write --cave=-KPZkVEFFWL2YP1UQKRf', 'One cave, on the stored roads, in production')
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
} else {
  // The emulators' addresses would send production's writes there.
  delete process.env.FIRESTORE_EMULATOR_HOST
  delete process.env.FIREBASE_STORAGE_EMULATOR_HOST
  delete process.env.STORAGE_EMULATOR_HOST
}
initializeApp({ projectId: PROJECT_ID, storageBucket: BUCKET, ...(argv.production && { credential: applicationDefault() }) })
const db = getFirestore()
const bucket = getStorage().bucket()
console.log(`${argv.production ? 'PRODUCTION' : 'local emulators'}${argv.write ? '' : ' - dry run, nothing written'}${argv.refresh ? ' - roads downloaded from Overpass' : ' - the stored roads'}`)

const started = Date.now()
try {
  const result = await refreshRoadDistances({ db, bucket, deleteField: FieldValue.delete(), download: argv.refresh, dryRun: !argv.write, caveId: argv.cave })
  const metres = (way) => (way ? `${way.m} m (${way.kind}${way.name ? ` "${way.name}"` : ''})` : 'none')
  for (const { id, action, value } of result.changes) {
    console.log(`${id}: ${action}${argv.verbose && value ? ` - path ${metres(value.path)}, road ${metres(value.road)}` : ''}`)
  }
  console.log(`roads of ${result.downloadedAt} (${result.ways} ways${result.bbox ? `, around ${result.bbox.join(', ')}` : ''})`)
  console.log(`${result.counts.set} set, ${result.counts.removed} removed, ${result.counts.unchanged} unchanged in ${((Date.now() - started) / 1000).toFixed(1)} s${argv.write ? '' : ' (dry run)'}`)
} catch (error) {
  console.error(error.message)
  process.exit(1)
}
// The Admin SDK keeps the process alive.
process.exit(0)

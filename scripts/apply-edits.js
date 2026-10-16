// Applies a reviewed list of field edits to records (a JSON file: an array of
// { collection, id, set: { field: value }, why }) - each an update of those
// fields alone, nothing else of the record written. For the small fixes read
// off sources (a depth, a cave's coordinates from a survey map) that no import
// covers. In production the changes are credited to an account (--as
// <email>) with their audit log entries (scripts/lib/audit.js), so What's new
// shows them and they can be undone. A field already at its new value is
// skipped.

import { readFileSync } from 'node:fs'
import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'
import { initializeApp, applicationDefault } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import { accountUid, auditWriter, updateEntry } from './lib/audit.js'

const PROJECT_ID = 'opencaves'

const cli = yargs(hideBin(process.argv))
  .usage('Apply a reviewed list of field edits to records (JSON: [{ collection, id, set: { field: value }, why }]).\n\nUsage: $0 [-l | -p] --file <edits.json> --dry-run | --write [--as <email>]')
  .option('file', { type: 'string', demandOption: true, describe: 'The edits (JSON)' })
  .option('dry-run', { type: 'boolean', default: false, describe: 'Only print the changes' })
  .option('write', { type: 'boolean', default: false, describe: 'Apply them' })
  .option('as', { type: 'string', describe: 'The account the changes are credited to in the audit log (its email); required to write to production' })
  .option('local', { alias: 'l', type: 'boolean', describe: 'The local emulators - the default' })
  .option('production', { alias: 'p', type: 'boolean', default: false, describe: 'The real opencaves project (needs `gcloud auth application-default login`)' })
  .check((args) => !(args.local && args.production) || 'Use --local or --production, not both')
  .check((args) => args['dry-run'] !== args.write || 'Give --dry-run or --write')
  .check((args) => !(args.production && args.write && !args.as) || 'Give --as <email> to write to production (the audit log credits that account)')
  .example('$0 -l --file edits.json --dry-run', 'What would change locally')
  .example('$0 -p --file edits.json --write --as me@example.org', 'Apply them in production')
  .help()
  .alias('help', 'h')
  .strict()

// No arguments: the help, not a run.
if (hideBin(process.argv).length === 0) {
  cli.showHelp()
  process.exit(0)
}
const argv = cli.parseSync()

if (!argv.production) process.env.FIRESTORE_EMULATOR_HOST ??= '127.0.0.1:8080'
initializeApp({ projectId: PROJECT_ID, ...(argv.production && { credential: applicationDefault() }) })
const db = getFirestore()
const audit = auditWriter(db, { production: argv.production, uid: argv.as ? await accountUid(argv.as) : null })
console.log(`${argv.production ? 'PRODUCTION' : 'local emulators'}${argv.write ? '' : ' - dry run, nothing written'}`)

const same = (a, b) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null)
let changed = 0
for (const { collection, id, set, why } of JSON.parse(readFileSync(argv.file, 'utf8'))) {
  const ref = db.collection(collection).doc(id)
  const snap = await ref.get()
  if (!snap.exists) {
    console.error(`${collection}/${id}: not found - skipped`)
    process.exitCode = 1
    continue
  }
  const name = snap.get('name')?.value ?? snap.get('name') ?? id
  const after = Object.fromEntries(Object.entries(set).filter(([field, value]) => !same(snap.get(field), value)))
  if (!Object.keys(after).length) {
    console.log(`${name}: already so - skipped`)
    continue
  }
  for (const [field, value] of Object.entries(after)) console.log(`${name} (${collection}/${id}): ${field} ${JSON.stringify(snap.get(field) ?? null)} -> ${JSON.stringify(value)}${why ? `  (${why})` : ''}`)
  if (argv.write) {
    await ref.update(after)
    await audit(updateEntry(collection, id, snap.data(), after))
  }
  changed++
}
console.log(`${argv.write ? 'changed' : 'to change'}: ${changed} record(s)`)

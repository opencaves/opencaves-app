// Applies a reviewed list of field edits to records (a JSON file: an array of
// { collection, id, set: { field: value }, why }) - each an update of those
// fields alone, nothing else of the record written - or creates a record
// ({ collection, id, create: { field: value }, why }: only when no record has
// that id yet, so a second run skips it), or deletes one ({ collection, id,
// delete: true, why }: its whole record kept in its audit entry, so it can be
// undone; a cave with photos or ratings is refused - those would
// be left behind). For the small fixes read
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
  .usage('Apply a reviewed list of field edits to records (JSON: [{ collection, id, set: { field: value }, why }], or create: { field: value } for a new record, or delete: true).\n\nUsage: $0 [-l | -p] --file <edits.json> --dry-run | --write [--as <email>]')
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
// What still points at a cave (a deleted cave would leave them behind).
async function caveLinks(id) {
  const [photos, ratings] = await Promise.all([
    db.collection('cavesAssets').where('caveId', '==', id).limit(1).get(),
    db.collection('caves').doc(id).collection('ratings').limit(1).get(),
  ])
  return [!photos.empty && 'photos', !ratings.empty && 'ratings'].filter(Boolean)
}

for (const { collection, id, set, create, delete: remove, why } of JSON.parse(readFileSync(argv.file, 'utf8'))) {
  const ref = db.collection(collection).doc(id)
  const snap = await ref.get()
  // A record deleted, its audit entry keeping it whole (undo puts it back).
  if (remove) {
    if (!snap.exists) {
      console.log(`${collection}/${id}: gone already - skipped`)
      continue
    }
    const name = snap.get('name')?.value ?? snap.get('name') ?? id
    const links = collection === 'caves' ? await caveLinks(id) : []
    if (links.length) {
      console.error(`${name} (${collection}/${id}): has ${links.join(', ')} - not deleted`)
      process.exitCode = 1
      continue
    }
    console.log(`${name} (${collection}/${id}): delete${why ? `  (${why})` : ''}`)
    if (argv.write) {
      await ref.delete()
      await audit({ action: 'delete', collection, docId: id, before: snap.data() })
    }
    changed++
    continue
  }
  // A new record: created as given, with its audit entry - unless it exists.
  if (create) {
    const name = create.name?.value ?? create.name ?? id
    if (snap.exists) {
      console.log(`${name} (${collection}/${id}): exists already - skipped`)
      continue
    }
    console.log(`${name} (${collection}/${id}): new ${JSON.stringify(create)}${why ? `  (${why})` : ''}`)
    if (argv.write) {
      await ref.set(create)
      await audit({ action: 'create', collection, docId: id, after: create })
    }
    changed++
    continue
  }
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

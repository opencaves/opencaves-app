#!/usr/bin/env node
// Renames a cave system's explored length from `length` to `exploredLength`
// (metres, unchanged): each sistema that still has `length` gets its value as
// exploredLength (unless it has one already, which wins) and loses `length`.
// A dry run (the default) lists them; --write saves them. Re-runnable: a
// migrated record has no `length` left.
//
// The app reads exploredLength, falling back to length, and its edit form
// saves exploredLength and removes length: the order of the deploy and this
// run doesn't matter. Written with the Admin SDK: the audit log doesn't record
// it (What's new doesn't list it).
import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'
import { initializeApp, applicationDefault } from 'firebase-admin/app'
import { FieldValue, getFirestore } from 'firebase-admin/firestore'

const PROJECT_ID = 'opencaves'

const cli = yargs(hideBin(process.argv))
  .usage('$0 -l | -p [--write]\n\nRenames the sistemas\' `length` (explored length, metres) to `exploredLength` - a dry run unless --write.')
  .option('local', { alias: 'l', type: 'boolean', default: false, describe: 'The local Firestore emulator (127.0.0.1:8080, or FIRESTORE_EMULATOR_HOST)' })
  .option('production', { alias: 'p', type: 'boolean', default: false, describe: 'The real opencaves project (requires `gcloud auth application-default login`)' })
  .option('write', { type: 'boolean', default: false, describe: 'Save the changes (without it: only list them)' })
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

const snapshot = await db.collection('sistemas').get()
const toMigrate = snapshot.docs.filter((doc) => doc.get('length') !== undefined)
let conflicts = 0
for (const doc of toMigrate) {
  const length = doc.get('length')
  const explored = doc.get('exploredLength')
  if (explored !== undefined && explored !== length) conflicts++
  console.log(`${doc.id}  ${doc.get('name') || ''}: length ${length}${explored !== undefined ? ` (exploredLength already ${explored}, kept)` : ''}`)
}
console.log(`\n${toMigrate.length} of ${snapshot.size} sistemas to migrate${conflicts ? `, ${conflicts} with a different exploredLength already (kept)` : ''}.`)

if (argv.write && toMigrate.length) {
  // 500 writes a batch at most.
  for (let i = 0; i < toMigrate.length; i += 400) {
    const batch = db.batch()
    for (const doc of toMigrate.slice(i, i + 400)) {
      batch.update(doc.ref, { ...(doc.get('exploredLength') === undefined && { exploredLength: doc.get('length') }), length: FieldValue.delete() })
    }
    await batch.commit()
  }
  console.log(`Migrated ${toMigrate.length}.`)
} else if (toMigrate.length) {
  console.log('Dry run: nothing saved (--write to save).')
}
process.exit(0)

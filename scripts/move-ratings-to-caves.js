#!/usr/bin/env node
// Moves the cave ratings from their author's data (users/{uid}/ratings/{caveId},
// which anyone could read) to their cave (caves/{caveId}/ratings/{uid}, private
// to their author), and writes each rated cave's public summary
// (caveRatings/{caveId} = { average, count }) - from then on kept by the
// onRatingWritten function.
//
// A dry run (the default) counts the ratings to move; --write moves them.
// Re-runnable: moved ratings are no longer in the users' data.
import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'
import { initializeApp, applicationDefault } from 'firebase-admin/app'
import { getFirestore, FieldValue } from 'firebase-admin/firestore'

const PROJECT_ID = 'opencaves'

const cli = yargs(hideBin(process.argv))
  .usage('$0 -l | -p [--write]\n\nMoves the cave ratings from users/{uid}/ratings to caves/{caveId}/ratings, private to their author, and writes each cave\'s public summary (caveRatings) - a dry run unless --write.')
  .option('local', { alias: 'l', type: 'boolean', default: false, describe: 'The local Firestore emulator (127.0.0.1:8080, or FIRESTORE_EMULATOR_HOST)' })
  .option('production', { alias: 'p', type: 'boolean', default: false, describe: 'The real opencaves project (requires `gcloud auth application-default login`)' })
  .option('write', { type: 'boolean', default: false, describe: 'Move the ratings (without it: only count them)' })
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

// The old ratings: users/{uid}/ratings/{caveId}. The new ones are under the
// caves, so only the users' are counted here.
const old = (await db.collectionGroup('ratings').get()).docs.filter((doc) => doc.ref.parent.parent?.parent.id === 'users')
const caveIds = new Set(old.map((doc) => doc.get('caveId') || doc.id))
console.log(`${old.length} ratings of ${caveIds.size} caves to move.`)

if (!argv.write) {
  if (old.length) console.log('Dry run: nothing changed. Add --write to move them.')
  process.exit(0)
}

// 200 ratings per batch: two writes each, under Firestore's 500.
for (let i = 0; i < old.length; i += 200) {
  const batch = db.batch()
  for (const doc of old.slice(i, i + 200)) {
    const uid = doc.ref.parent.parent.id
    const caveId = doc.get('caveId') || doc.id
    batch.set(db.collection('caves').doc(caveId).collection('ratings').doc(uid), {
      value: doc.get('value'),
      userId: uid,
      updatedAt: doc.get('updatedAt') || FieldValue.serverTimestamp(),
    })
    batch.delete(doc.ref)
  }
  await batch.commit()
}

// The summaries, recounted from the moved ratings (as onRatingWritten does).
for (const caveId of caveIds) {
  const ratings = (await db.collection('caves').doc(caveId).collection('ratings').get()).docs.map((doc) => doc.get('value')).filter((value) => typeof value === 'number')
  const ref = db.collection('caveRatings').doc(caveId)
  if (ratings.length) await ref.set({ average: ratings.reduce((sum, value) => sum + value, 0) / ratings.length, count: ratings.length, updatedAt: FieldValue.serverTimestamp() })
  else await ref.delete()
}
console.log(`Moved ${old.length} ratings; ${caveIds.size} cave summaries written.`)

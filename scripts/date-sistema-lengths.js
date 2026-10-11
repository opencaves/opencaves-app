#!/usr/bin/env node
// Dates the systems' explored lengths (exploredLengthDate, a partial date)
// from scripts/sistema-length-dates.json, worked out on 2026-10-11: QRSS's
// report date where the length is QRSS's figure (matched by name, the same
// length), else the date of an exploration whose text states that length.
// The guidebook's lengths stay undated: its editions don't date the figures
// it gives. A system gets its date only if
// it has none yet and its length is still the one dated; others are skipped
// and listed. A dry run (the default) lists the changes; --write saves them.
// Re-runnable.
import { readFileSync } from 'node:fs'
import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'
import { initializeApp, applicationDefault } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'

const PROJECT_ID = 'opencaves'
const DATA = new URL('./sistema-length-dates.json', import.meta.url)

const cli = yargs(hideBin(process.argv))
  .usage("$0 -l | -p [--write]\n\nDates the systems' explored lengths (exploredLengthDate) - a dry run unless --write.")
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

const { systems } = JSON.parse(readFileSync(DATA, 'utf8'))
const updates = []
const skipped = []
for (const { id, name, length, date, why } of systems) {
  const doc = await db.collection('sistemas').doc(id).get()
  const current = doc.exists ? (doc.get('exploredLength') ?? doc.get('length') ?? null) : undefined
  if (!doc.exists) skipped.push(`${name}: the system is gone`)
  else if (doc.get('exploredLengthDate') === date) skipped.push(`${name}: done already`)
  else if (doc.get('exploredLengthDate')) skipped.push(`${name}: dated already (${doc.get('exploredLengthDate')}) - left as is`)
  else if (current !== length) skipped.push(`${name}: its length changed since (${current ?? 'none'} m, not ${length} m) - left as is`)
  else {
    updates.push({ ref: doc.ref, date })
    console.log(`${name}  ${length} m  ${date}  (${why})`)
  }
}
const notDone = skipped.filter((line) => !line.endsWith('done already'))
if (notDone.length) console.log(`\nSkipped:\n  ${notDone.join('\n  ')}`)
console.log(`\n${updates.length} of ${systems.length} lengths to date.`)

if (argv.write && updates.length) {
  for (let i = 0; i < updates.length; i += 400) {
    const batch = db.batch()
    for (const { ref, date } of updates.slice(i, i + 400)) batch.update(ref, { exploredLengthDate: date })
    await batch.commit()
  }
  console.log(`Dated ${updates.length}.`)
} else if (updates.length) {
  console.log('Dry run: nothing saved (--write to save).')
}
process.exit(0)

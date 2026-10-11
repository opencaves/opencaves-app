#!/usr/bin/env node
// Updates cave systems' explored length to the Quintana Roo Speleological
// Survey's newer figures (scripts/qrss-lengths-2025-02.json: the systems its
// February 2025 report gives as longer than OpenCaves had, matched by name
// and checked on 2026-10-11). A system is updated only if its length is still
// the one the comparison saw ("from"): one changed since is skipped, and
// listed. Its length goes to exploredLength, any older `length` field removed
// (as scripts/rename-sistema-length.js does). A dry run (the default) lists
// the changes; --write saves them. Re-runnable: an updated system is skipped.
import { readFileSync } from 'node:fs'
import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'
import { initializeApp, applicationDefault } from 'firebase-admin/app'
import { FieldValue, getFirestore } from 'firebase-admin/firestore'

const PROJECT_ID = 'opencaves'
const DATA = new URL('./qrss-lengths-2025-02.json', import.meta.url)

const cli = yargs(hideBin(process.argv))
  .usage("$0 -l | -p [--write]\n\nUpdates the systems' explored length to QRSS's February 2025 figures - a dry run unless --write.")
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
for (const { id, name, from, to, reported } of systems) {
  const doc = await db.collection('sistemas').doc(id).get()
  const current = doc.exists ? (doc.get('exploredLength') ?? doc.get('length') ?? null) : undefined
  if (current === to) skipped.push(`${name}: already ${to} m`)
  else if (current !== from) skipped.push(`${name}: now ${current ?? 'none'} m, not ${from} m - left as is`)
  else {
    updates.push({ ref: doc.ref, hasOldField: doc.get('length') !== undefined, to })
    console.log(`${name}  ${from} -> ${to} m  (QRSS ${reported})`)
  }
}
if (skipped.length) console.log(`\nSkipped:\n  ${skipped.join('\n  ')}`)
console.log(`\n${updates.length} of ${systems.length} systems to update.`)

if (argv.write && updates.length) {
  const batch = db.batch()
  for (const { ref, hasOldField, to } of updates) batch.update(ref, { exploredLength: to, ...(hasOldField && { length: FieldValue.delete() }) })
  await batch.commit()
  console.log(`Updated ${updates.length}.`)
} else if (updates.length) {
  console.log('Dry run: nothing saved (--write to save).')
}
process.exit(0)

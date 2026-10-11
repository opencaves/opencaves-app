#!/usr/bin/env node
// Adds the cave systems the Quintana Roo Speleological Survey reports and
// OpenCaves didn't have (scripts/qrss-new-systems-2025-02.json: its February
// 2025 report's systems with no OpenCaves match, checked one by one on
// 2026-10-11 - mostly explored since 2016). Each gets what QRSS gives: its
// name (other names from its parentheses), explored length, maximum depth, an
// exploration entry with the reported date and team, its cenote count in a
// note when QRSS has one, QRSS as its source, and a colour from the list - no
// area, coordinates or caves (QRSS doesn't publish them). Fixed ids, so local
// and production get the same records. A system is skipped when its id exists
// already, or another system has its name (listed). A dry run (the default)
// lists them; --write saves them. Re-runnable.
import { readFileSync } from 'node:fs'
import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'
import { initializeApp, applicationDefault } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'

const PROJECT_ID = 'opencaves'
const DATA = new URL('./qrss-new-systems-2025-02.json', import.meta.url)

const cli = yargs(hideBin(process.argv))
  .usage('$0 -l | -p [--write]\n\nAdds the cave systems from QRSS\'s February 2025 report that OpenCaves didn\'t have - a dry run unless --write.')
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
const fold = (name) => name.normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase().trim()
const existing = await db.collection('sistemas').get()
const ids = new Set(existing.docs.map((doc) => doc.id))
const names = new Map(existing.docs.map((doc) => [fold(doc.get('name') || ''), doc.get('name')]))

const toAdd = []
const skipped = []
for (const { id, record } of systems) {
  if (ids.has(id)) skipped.push(`${record.name}: added already`)
  else if (names.has(fold(record.name))) skipped.push(`${record.name}: a system has that name already (${names.get(fold(record.name))})`)
  else {
    toAdd.push({ id, record })
    console.log(`${record.name}  ${record.exploredLength} m${record.maxDepth != null ? `, -${record.maxDepth} m` : ''}`)
  }
}
if (skipped.length) console.log(`\nSkipped:\n  ${skipped.join('\n  ')}`)
console.log(`\n${toAdd.length} of ${systems.length} systems to add.`)

if (argv.write && toAdd.length) {
  const batch = db.batch()
  for (const { id, record } of toAdd) batch.set(db.collection('sistemas').doc(id), record)
  await batch.commit()
  console.log(`Added ${toAdd.length}.`)
} else if (toAdd.length) {
  console.log('Dry run: nothing saved (--write to save).')
}
process.exit(0)

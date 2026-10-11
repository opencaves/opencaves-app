#!/usr/bin/env node
// Adds the connections between systems that QRSS's news page reports
// (https://qrss.caves.org/new.htm) and OpenCaves didn't have, from
// scripts/qrss-connections-2025-02.json (checked 2026-10-11): the smaller
// system joined to the one it became part of, dated with the month of QRSS's
// report, QRSS as the source. Fixed ids, so local and production get the same
// records. A connection is skipped (and listed) when either system is gone or
// the smaller system is connected to some system already. A dry run (the
// default) lists the changes; --write saves them. Re-runnable.
import { readFileSync } from 'node:fs'
import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'
import { initializeApp, applicationDefault } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'

const PROJECT_ID = 'opencaves'
const QRSS_SOURCE = '-KPZg4jsKUZe0Tf3lyro'
const DATA = new URL('./qrss-connections-2025-02.json', import.meta.url)

const cli = yargs(hideBin(process.argv))
  .usage("$0 -l | -p [--write]\n\nAdds the connections between systems reported by QRSS - a dry run unless --write.")
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

const { connections } = JSON.parse(readFileSync(DATA, 'utf8'))
const creates = []
const skipped = []
for (const { id, what, sistemaId, parentSistemaId, connectionDate } of connections) {
  const ref = db.collection('connections').doc(id)
  const [doc, small, big, existing] = await Promise.all([
    ref.get(),
    db.collection('sistemas').doc(sistemaId).get(),
    db.collection('sistemas').doc(parentSistemaId).get(),
    db.collection('connections').where('sistemaId', '==', sistemaId).get(),
  ])
  if (doc.exists) skipped.push(`${what}: done already`)
  else if (!small.exists || !big.exists) skipped.push(`${what}: a system is gone - left as is`)
  else if (!existing.empty) skipped.push(`${what}: connected already (${existing.docs.map((d) => d.get('parentSistemaId')).join(', ')}) - left as is`)
  else {
    creates.push({ ref, record: { sistemaId, parentSistemaId, connectionDate, source: QRSS_SOURCE } })
    console.log(`${small.get('name')} -> ${big.get('name')}  ${connectionDate}`)
  }
}
const notDone = skipped.filter((line) => !line.endsWith('done already'))
if (notDone.length) console.log(`\nSkipped:\n  ${notDone.join('\n  ')}`)
console.log(`\n${creates.length} of ${connections.length} connections to add.`)

if (argv.write && creates.length) {
  const batch = db.batch()
  for (const { ref, record } of creates) batch.set(ref, record)
  await batch.commit()
  console.log(`Added ${creates.length}.`)
} else if (creates.length) {
  console.log('Dry run: nothing saved (--write to save).')
}
process.exit(0)

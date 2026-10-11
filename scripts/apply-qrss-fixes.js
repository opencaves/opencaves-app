#!/usr/bin/env node
// Applies the corrections decided after comparing OpenCaves with QRSS's
// February 2025 report (scripts/qrss-fixes-2025-02.json, 2026-10-11):
// - names: QRSS's spelling (the old one kept in aka), names cut at 25
//   characters completed, the two "Cenote C" named C2 and C5;
// - systems QRSS reports longer or deeper under another name: its figures;
// - six caves that were in no system: a system each, from QRSS's data, the
//   cave attached to it (fixed ids: local and production get the same);
// - maximum depths: filled where OpenCaves had none, QRSS's where it's deeper
//   (the deeper survey is taken as the more complete one);
// - merges of duplicate systems ("merge": from into into - into's fields set,
//   from's caves and maps moved to into, the larger length and deeper depth
//   kept, connections naming from deleted, from deleted; from's record and
//   its connections are in the data file, to restore them);
// - a cave for each new system named after its cenote ("createCave": no
//   coordinates; fixed ids).
// Each update applies only if the record still has the values it was decided
// on ("expect"); one changed since is skipped and listed. Lengths are written
// as exploredLength (an older `length` field removed). A dry run (the
// default) lists the changes; --write saves them. Re-runnable.
import { readFileSync } from 'node:fs'
import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'
import { initializeApp, applicationDefault } from 'firebase-admin/app'
import { FieldValue, getFirestore } from 'firebase-admin/firestore'

const PROJECT_ID = 'opencaves'
const DATA = new URL('./qrss-fixes-2025-02.json', import.meta.url)

const cli = yargs(hideBin(process.argv))
  .usage('$0 -l | -p [--write]\n\nApplies the corrections decided from the QRSS comparison - a dry run unless --write.')
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

const { ops } = JSON.parse(readFileSync(DATA, 'utf8'))
// A field's current value; a system's length may still be under its old name.
const valueOf = (doc, field) => (field === 'exploredLength' ? (doc.get('exploredLength') ?? doc.get('length') ?? null) : (doc.get(field) ?? null))
// Equal values, arrays and maps included.
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b)
const writes = []
const skipped = []
for (const op of ops) {
  if (op.type === 'createCave') {
    const ref = db.collection('caves').doc(op.id)
    if ((await ref.get()).exists) skipped.push(`${op.what}: done already`)
    else if (!(await db.collection('sistemas').doc(op.sistemaId).get()).exists) skipped.push(`${op.what}: its system is gone - left as is`)
    else writes.push({ op, apply: (batch) => batch.set(ref, op.record) })
    continue
  }
  if (op.type === 'merge') {
    const from = await db.collection('sistemas').doc(op.from).get()
    const into = await db.collection('sistemas').doc(op.into).get()
    if (!from.exists) skipped.push(`${op.what}: done already`)
    else if (!into.exists || from.get('name') !== op.expect.fromName || into.get('name') !== op.expect.intoName) skipped.push(`${op.what}: changed since - left as is`)
    else {
      const { aka: akaToAdd = [], ...fields } = op.set
      const target = { ...fields }
      const aka = into.get('aka') || []
      const newAka = akaToAdd.filter((name) => !aka.includes(name))
      if (newAka.length) target.aka = [...aka, ...newAka]
      // The larger length, the deeper depth.
      const length = Math.max(valueOf(into, 'exploredLength') ?? 0, valueOf(from, 'exploredLength') ?? 0)
      if (length && length !== valueOf(into, 'exploredLength')) target.exploredLength = length
      const depth = Math.max(into.get('maxDepth') ?? 0, from.get('maxDepth') ?? 0)
      if (depth && depth !== into.get('maxDepth')) target.maxDepth = depth
      const maps = [...new Set([...(into.get('maps') || []), ...(from.get('maps') || [])])]
      if (maps.length !== (into.get('maps') || []).length) target.maps = maps
      const caves = await db.collection('caves').where('sistemaId', '==', op.from).get()
      writes.push({
        op,
        apply: (batch) => {
          batch.update(into.ref, target)
          caves.docs.forEach((cave) => batch.update(cave.ref, { sistemaId: op.into }))
          op.deleteConnections.forEach((id) => batch.delete(db.collection('connections').doc(id)))
          batch.delete(from.ref)
        },
      })
    }
    continue
  }
  if (op.type === 'create') {
    const ref = db.collection('sistemas').doc(op.id)
    const cave = await db.collection('caves').doc(op.attachCave).get()
    if ((await ref.get()).exists) skipped.push(`${op.what}: done already`)
    else if (!cave.exists || cave.get('sistemaId')) skipped.push(`${op.what}: the cave is now in a system, or gone - left as is`)
    else writes.push({ op, apply: (batch) => (batch.set(ref, op.record), batch.update(cave.ref, { sistemaId: op.id })) })
    continue
  }
  const doc = await db.collection('sistemas').doc(op.id).get()
  const target = { ...op.set }
  const aka = doc.get('aka') || []
  const newAka = (op.addAka || []).filter((name) => !aka.includes(name))
  const done = doc.exists && Object.entries(target).every(([field, value]) => same(valueOf(doc, field), value)) && !newAka.length
  if (!doc.exists) skipped.push(`${op.what}: the system is gone`)
  else if (done) skipped.push(`${op.what}: done already`)
  else if (!Object.entries(op.expect).every(([field, value]) => same(valueOf(doc, field), value))) skipped.push(`${op.what}: changed since - left as is`)
  else {
    if (newAka.length) target.aka = [...aka, ...newAka]
    if ('exploredLength' in target && doc.get('length') !== undefined) target.length = FieldValue.delete()
    writes.push({ op, apply: (batch) => batch.update(doc.ref, target) })
  }
}
for (const { op } of writes) console.log(op.what)
if (skipped.length) console.log(`\nSkipped:\n  ${skipped.join('\n  ')}`)
console.log(`\n${writes.length} of ${ops.length} changes to make.`)

if (argv.write && writes.length) {
  const batch = db.batch()
  for (const { apply } of writes) apply(batch)
  await batch.commit()
  console.log(`Made ${writes.length}.`)
} else if (writes.length) {
  console.log('Dry run: nothing saved (--write to save).')
}
process.exit(0)

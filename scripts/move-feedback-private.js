#!/usr/bin/env node
// One-time move, for the reports sent before every registered account could
// read them (/feedback, Ideas and fixes): what of a report only admins may
// read leaves it for its private doc, _feedbackPrivate/{id} (admins only):
//
// - browser: its author's user agent (the Send feedback form now writes it
//   there itself, with the report);
// - replyToken: its reply address' secret (functions/js/feedback/
//   replyAddress.js now keeps it there) - whoever knew it could write to the
//   report's thread by email, were the sender checks to fail.
//
// It also gives each report its author's name, authorName (onFeedbackCreated
// now does), from the account's display name in Auth - nothing taken from
// the email; none without one.
//
// A dry run (the default) lists the changes; --write saves them. Re-runnable:
// a report already moved and named is left alone.
import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'
import { initializeApp, applicationDefault } from 'firebase-admin/app'
import { getAuth } from 'firebase-admin/auth'
import { FieldValue, getFirestore } from 'firebase-admin/firestore'

const PROJECT_ID = 'opencaves'
const FEEDBACK = '_feedback'
const FEEDBACK_PRIVATE = '_feedbackPrivate'
// The report's fields only admins may read.
const PRIVATE_FIELDS = ['browser', 'replyToken']

const cli = yargs(hideBin(process.argv))
  .usage('$0 -l | -p [--write]\n\nMoves the feedback reports\' private fields (browser, replyToken) to _feedbackPrivate and fills in their authorName - a dry run unless --write.')
  .option('local', { alias: 'l', type: 'boolean', default: false, describe: 'The local emulators (Firestore 127.0.0.1:8080, Auth 127.0.0.1:9099, or FIRESTORE_EMULATOR_HOST / FIREBASE_AUTH_EMULATOR_HOST)' })
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

if (argv.local) {
  process.env.FIRESTORE_EMULATOR_HOST ||= '127.0.0.1:8080'
  process.env.FIREBASE_AUTH_EMULATOR_HOST ||= '127.0.0.1:9099'
}
initializeApp(argv.production ? { credential: applicationDefault(), projectId: PROJECT_ID } : { projectId: PROJECT_ID })
const db = getFirestore()
const auth = getAuth()

// The same name as onFeedbackCreated's (feedbackAuthorName).
const authorNameOf = (user) => user?.displayName?.trim().slice(0, 100) || null
const names = new Map()
async function authorName(uid) {
  if (!uid) return null
  if (!names.has(uid)) names.set(uid, authorNameOf(await auth.getUser(uid).catch(() => null)))
  return names.get(uid)
}

console.log(`${argv.production ? 'PRODUCTION' : 'emulator'}${argv.write ? '' : ' (dry run: --write to save)'}`)
const reports = await db.collection(FEEDBACK).get()
let changed = 0
for (const report of reports.docs) {
  const data = report.data()
  const privateRef = db.collection(FEEDBACK_PRIVATE).doc(report.id)
  const existing = (await privateRef.get()).data() || {}
  const moved = PRIVATE_FIELDS.filter((field) => field in data)
  // A value already in the private doc wins (the report's is then only removed).
  const toPrivate = Object.fromEntries(moved.filter((field) => !(field in existing)).map((field) => [field, data[field]]))
  const name = data.authorName ? null : await authorName(data.userId)
  if (!moved.length && !name) continue

  changed++
  const notes = [...moved.map((field) => `${field} -> ${FEEDBACK_PRIVATE}${field in toPrivate ? '' : ' (already there: removed from the report)'}`), ...(name ? [`authorName = ${JSON.stringify(name)}`] : [])]
  console.log(`${FEEDBACK}/${report.id}: ${notes.join('; ')}`)
  if (!argv.write) continue
  const batch = db.batch()
  if (Object.keys(toPrivate).length) batch.set(privateRef, toPrivate, { merge: true })
  batch.update(report.ref, { ...Object.fromEntries(moved.map((field) => [field, FieldValue.delete()])), ...(name && { authorName: name }) })
  await batch.commit()
}
console.log(`${reports.size} report(s), ${changed} ${argv.write ? 'changed' : 'to change'}.`)

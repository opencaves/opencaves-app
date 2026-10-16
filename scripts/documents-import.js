// Adds Further reading documents (links and PDFs) to caves and cave systems
// from a reviewed list (JSON), the way the app's own form does: a
// `documents` record (a PDF: `checking`, its file at documents/<id>.pdf with
// a download token - the onDocumentUploaded function then checks and cleans
// it), and its id added to each record's `documents` list. Only that list
// is changed on a cave or a system (an update of that one field, never the
// whole record), so nothing else in the database is overwritten.
//
// Every document is credited to an account (--as): its `userId`, and in
// production its audit log entries - written by this script, since the audit
// trigger doesn't log the Admin SDK's writes there (in the emulators it
// logs them itself, as "emulator").
//
// Re-runnable: a document whose DOI or link is already there (outside the
// trash) is skipped.
//
// The list: an array of { kind: 'link'|'file', title, authors[], year,
// language, url (a link), file (a PDF, relative to the list's folder),
// publishedIn (a PDF's), doi, summary, holders: [{ collection: 'caves'|'sistemas', id }] }.

import { randomUUID } from 'node:crypto'
import { readFileSync, statSync } from 'node:fs'
import path from 'node:path'
import pushId from 'unique-push-id'
import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'
import { initializeApp, applicationDefault } from 'firebase-admin/app'
import { getFirestore, FieldValue } from 'firebase-admin/firestore'
import { getStorage } from 'firebase-admin/storage'
import { inlineDisposition } from '../functions/js/documents/files.js'
import { accountUid, auditWriter } from './lib/audit.js'

const PROJECT_ID = 'opencaves'
const BUCKET = 'opencaves.appspot.com'
// storage.rules' and the server's limit.
const MAX_BYTES = 20 * 1024 * 1024

const cli = yargs(hideBin(process.argv))
  .usage('Add Further reading documents (links and PDFs) to caves and cave systems from a reviewed list.\n\nUsage: $0 [-l | -p] --dry-run | --write --as <email> [--file <list.json>]')
  .option('file', { type: 'string', default: '_data/papers/papers.json', describe: 'The documents to add (JSON); PDF paths are relative to its folder' })
  .option('as', { type: 'string', describe: 'The account the documents are credited to (its email)' })
  .option('dry-run', { type: 'boolean', default: false, describe: 'Only print what would be added' })
  .option('write', { type: 'boolean', default: false, describe: 'Add them' })
  .option('only', { type: 'string', describe: 'Only the documents whose title contains this text' })
  .option('local', { alias: 'l', type: 'boolean', describe: 'The local emulators - the default' })
  .option('production', { alias: 'p', type: 'boolean', default: false, describe: 'The real opencaves project (needs `gcloud auth application-default login`)' })
  .check((args) => !(args.local && args.production) || 'Use --local or --production, not both')
  .check((args) => args['dry-run'] !== args.write || 'Give --dry-run or --write')
  .check((args) => Boolean(args.as) || 'Give --as <email>: the account the documents are credited to')
  .example('$0 -l --dry-run --as me@example.org', 'What would be added locally')
  .example('$0 -l --write --as me@example.org', 'Add them locally')
  .example('$0 -p --write --as me@example.org', 'Add them in production')
  .help()
  .alias('help', 'h')
  .strict()

// No arguments: the help, not a run.
if (hideBin(process.argv).length === 0) {
  cli.showHelp()
  process.exit(0)
}
const argv = cli.parseSync()

if (!argv.production) {
  process.env.FIRESTORE_EMULATOR_HOST ??= '127.0.0.1:8080'
  process.env.FIREBASE_STORAGE_EMULATOR_HOST ??= '127.0.0.1:9199'
  process.env.FIREBASE_AUTH_EMULATOR_HOST ??= '127.0.0.1:9099'
}
initializeApp({ projectId: PROJECT_ID, storageBucket: BUCKET, ...(argv.production && { credential: applicationDefault() }) })
const db = getFirestore()
const bucket = getStorage().bucket()
console.log(`${argv.production ? 'PRODUCTION' : 'local emulators'}${argv.write ? '' : ' - dry run, nothing written'}`)

const uid = await accountUid(argv.as)
console.log(`credited to ${argv.as} (${uid})`)

// The same download URL shape getDownloadURL() gives the app.
function downloadUrl(storagePath, token) {
  const host = argv.production ? 'https://firebasestorage.googleapis.com' : `http://${process.env.FIREBASE_STORAGE_EMULATOR_HOST}`
  return `${host}/v0/b/${BUCKET}/o/${encodeURIComponent(storagePath)}?alt=media&token=${token}`
}

// Audit log entries (scripts/lib/audit.js): production only.
const audit = auditWriter(db, { production: argv.production, uid })

// Already there (outside the trash): by DOI, else by link.
async function existing(item) {
  const queries = [item.doi && db.collection('documents').where('doi', '==', item.doi), item.url && db.collection('documents').where('url', '==', item.url)].filter(Boolean)
  for (const query of queries) {
    const found = (await query.get()).docs.find((doc) => !doc.get('deletedAt'))
    if (found) return found
  }
  return null
}

// A document's id added to caves' or systems' `documents` lists: each list
// read as it is now, then the id added to it alone (arrayUnion: the list is
// never replaced), with its audit entry.
async function addTo(holders, id) {
  for (const holder of holders) {
    const holderRef = db.collection(holder.collection).doc(holder.id)
    const documents = (await holderRef.get()).get('documents')
    const before = Array.isArray(documents) ? documents : null
    await holderRef.update({ documents: FieldValue.arrayUnion(id) })
    await audit({
      action: 'update',
      collection: holder.collection,
      docId: holder.id,
      changedFields: ['documents'],
      before: before ? { documents: before } : {},
      after: { documents: [...(before || []), id] },
    })
  }
}

const listDir = path.dirname(argv.file)
let items = JSON.parse(readFileSync(argv.file, 'utf8'))
if (argv.only) items = items.filter((item) => item.title.toLowerCase().includes(argv.only.toLowerCase()))
console.log(`${items.length} documents in ${argv.file}`)

const counts = { added: 0, skipped: 0, failed: 0 }
for (const [index, item] of items.entries()) {
  const label = `[${index + 1}/${items.length}] ${item.title.slice(0, 80)}`
  try {
    const holders = await Promise.all(item.holders.map(async ({ collection, id }) => ({ collection, id, snap: await db.collection(collection).doc(id).get() })))
    const missing = holders.filter((holder) => !holder.snap.exists)
    if (missing.length) throw new Error(`no ${missing.map((holder) => `${holder.collection}/${holder.id}`).join(', ')}`)
    const found = await existing(item)
    if (found) {
      // Already there - added to the records a stopped run left it off.
      const unlisted = holders.filter((holder) => !(holder.snap.get('documents') || []).includes(found.id))
      console.log(`${label}: already there (${found.id})${unlisted.length ? `, added to ${unlisted.map((holder) => holder.id).join(', ')}` : ', skipped'}`)
      if (argv.write) await addTo(unlisted, found.id)
      counts.skipped++
      continue
    }
    const where = holders.map((holder) => holder.snap.get('name')?.value ?? holder.snap.get('name') ?? holder.id).join(', ')
    const filePath = item.kind === 'file' ? path.join(listDir, item.file) : null
    if (filePath && statSync(filePath).size > MAX_BYTES) throw new Error(`${item.file} is over 20 MB`)
    console.log(`${label}: ${item.kind === 'file' ? `PDF ${item.file}` : item.url} -> ${where}`)
    if (!argv.write) {
      counts.added++
      continue
    }

    const id = pushId()
    const ref = db.collection('documents').doc(id)
    const fields = {
      title: item.title,
      ...(item.authors?.length && { authors: item.authors }),
      ...(item.year && { year: String(item.year) }),
      ...(item.language && { language: item.language }),
      ...(item.doi && { doi: item.doi }),
      ...(item.summary && { summary: item.summary }),
      userId: uid,
    }
    let record
    if (item.kind === 'file') {
      // The record first (`checking`): onDocumentUploaded deletes a file without one.
      const fullPath = `documents/${id}.pdf`
      record = { kind: 'file', fullPath, contentType: 'application/pdf', status: 'checking', rightsConfirmed: true, ...(item.publishedIn && { publishedIn: item.publishedIn }), ...fields }
      await ref.set(record)
      const token = randomUUID()
      await bucket.file(fullPath).save(readFileSync(filePath), {
        resumable: false,
        metadata: { contentType: 'application/pdf', contentDisposition: inlineDisposition(item.title), metadata: { firebaseStorageDownloadTokens: token } },
      })
      record.url = downloadUrl(fullPath, token)
      await ref.update({ url: record.url })
    } else {
      record = { kind: 'link', url: item.url, ...fields }
      await ref.set(record)
    }
    await audit({ action: 'create', collection: 'documents', docId: id, after: record })
    await addTo(holders, id)
    counts.added++
  } catch (error) {
    console.error(`${label}: FAILED - ${error.message}`)
    counts.failed++
  }
}
console.log(`${argv.write ? 'added' : 'to add'}: ${counts.added}, already there: ${counts.skipped}, failed: ${counts.failed}`)
if (counts.failed) process.exitCode = 1

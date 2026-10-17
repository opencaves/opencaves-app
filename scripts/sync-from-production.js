#!/usr/bin/env node
// Mirrors production (the source of the data since the 1.0 release) to the
// local emulators, for development: the local documents and files end up
// production's - but for what's private or personal, which isn't copied and
// stays as it is locally: the accounts (Auth, _users/* - settings, saved
// caves), the frozen accounts (_frozenUsers), the testers' reports
// (_feedback, _feedbackPrivate), the error reports (_errorReports), the
// admins' tasks (_tasks: about production's maps and accounts), the
// photos' uploaders (_cavesAssetsPrivate) and the caves' ratings (their
// ratings subcollections, and so their summaries, _caveRatings).
//
// - Firestore: every other collection. New documents are created, differing
//   ones overwritten whole, the ones only local deleted - but for the audit
//   log (What's new, the Audits page), which gets production's entries and
//   keeps its own (the history of the local data work). A photo's _created
//   and _modified (each side's upload function stamps its own) aren't a
//   difference. File URLs are rewritten to the local Storage emulator's (same
//   paths and download tokens); accounts named in a record (deletedBy,
//   userId, layerSkippedBy, an audit entry's authorId) become the local
//   account with the same email (or paired in SYNC_ACCOUNTS, .env), else
//   keep production's id.
// - Storage: caves/ (photos, their resized copies), maps/ (scans, their
//   previews) and documents/ (Further reading's PDFs, checked already).
//   Files missing or different (MD5) locally are copied with their metadata
//   (download tokens included, gzip-encoded SVG maps as stored) and marked
//   ocSync=true, so the upload functions leave them alone. Files only local
//   are deleted.
//
// Production is only read. A dry run (--dry-run) lists what would change;
// --write first copies the whole emulator data folder (.emulator-data, the
// autosave's) to _data/backups/local-<date>/, pauses the emulators'
// background functions (so the copy isn't logged as edits, and deleting a
// photo's record doesn't delete its files), copies, then turns them back on,
// and records when it read production (_data/sync-from-production.json:
// push-to-production.js pushes the local edits made since).
// Run it with the emulators up (`npm run dev`), after
// `gcloud auth application-default login`.
import { cpSync, existsSync, mkdirSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'
import { initializeApp, applicationDefault } from 'firebase-admin/app'
import { getFirestore, Timestamp, GeoPoint, DocumentReference } from 'firebase-admin/firestore'
import { getStorage } from 'firebase-admin/storage'
import { getAuth } from 'firebase-admin/auth'

const PROJECT_ID = 'opencaves'
const BUCKET = 'opencaves.appspot.com'
// Private or personal: never copied, the local ones kept.
const SKIP = ['_users', '_frozenUsers', '_feedback', '_feedbackPrivate', '_errorReports', '_cavesAssetsPrivate', '_caveRatings', '_tasks']
// Added to, never trimmed: production's entries join the local ones.
const ADD_ONLY = ['_auditLog']
const STORAGE_PREFIXES = ['caves/', 'maps/', 'documents/']
const FIRESTORE_EMULATOR = process.env.FIRESTORE_EMULATOR_HOST || '127.0.0.1:8080'
const STORAGE_EMULATOR = process.env.FIREBASE_STORAGE_EMULATOR_HOST || '127.0.0.1:9199'
const AUTH_EMULATOR = process.env.FIREBASE_AUTH_EMULATOR_HOST || '127.0.0.1:9099'
const EMULATOR_HUB = process.env.FIREBASE_EMULATOR_HUB || '127.0.0.1:4400'
const ROOT = path.resolve(import.meta.dirname, '..')
const EMULATOR_DATA = path.join(ROOT, '.emulator-data')
const BACKUPS = path.join(ROOT, '_data/backups')
const SYNC_MARKER = path.join(ROOT, '_data/sync-from-production.json')

// SYNC_ACCOUNTS (.env): local accounts paired with production's by email,
// "local@example.org=production@example.org,..." (as sync-to-production.js
// reads it) - for local accounts whose email isn't their production one.
// Here by production's email.
try {
  process.loadEnvFile(path.join(ROOT, '.env'))
} catch {
  // No .env: the accounts pair by the same email only.
}
const PAIRED_EMAILS = new Map((process.env.SYNC_ACCOUNTS || '').split(',').map((pair) => pair.split('=').map((email) => email.trim().toLowerCase())).filter(([from, to]) => from && to).map(([from, to]) => [to, from]))

const cli = yargs(hideBin(process.argv))
  .usage('$0 --dry-run | --write [--no-files]\n\nMirrors production to the local emulators: every collection but the private ones (accounts, settings, feedback, error reports, uploaders, ratings) and the caves/, maps/ and documents/ files; the audit log gets production\'s entries and keeps its own. Production is only read.')
  .option('dry-run', { type: 'boolean', default: false, describe: 'List the changes, change nothing' })
  .option('write', { type: 'boolean', default: false, describe: 'Back the local emulator data up, then mirror' })
  .option('files', { type: 'boolean', default: true, describe: 'Mirror the Storage files too (--no-files: documents only)' })
  .option('report', { type: 'string', describe: 'Also write the full list of changes (JSON) to this file' })
  .check((args) => {
    if (args.dryRun === args.write) throw new Error('Use exactly one of --dry-run or --write.')
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

// Two apps in one process: the local one points at the emulator through its
// settings (FIRESTORE_EMULATOR_HOST would send both there); local Storage and
// Auth are reached through the emulators' REST APIs, for the same reason.
delete process.env.FIRESTORE_EMULATOR_HOST
delete process.env.FIREBASE_STORAGE_EMULATOR_HOST
delete process.env.FIREBASE_AUTH_EMULATOR_HOST
const local = getFirestore(initializeApp({ projectId: PROJECT_ID }, 'local'))
local.settings({ host: FIRESTORE_EMULATOR, ssl: false })
const productionApp = initializeApp({ credential: applicationDefault(), projectId: PROJECT_ID, storageBucket: BUCKET }, 'production')
const production = getFirestore(productionApp)
const bucket = getStorage(productionApp).bucket(BUCKET)
const LOCAL_STORAGE = `http://${STORAGE_EMULATOR}/v0/b/${BUCKET}/o`

// Production's accounts as local ones, by email: a record naming a production
// account (who moved it to the trash, who wrote an audit entry) gets the
// local account with the same email; one with none keeps production's id.
const ACCOUNT_FIELDS = ['deletedBy', 'userId', 'layerSkippedBy', 'authorId']
async function localAccountIds() {
  const response = await fetch(`http://${AUTH_EMULATOR}/identitytoolkit.googleapis.com/v1/projects/${PROJECT_ID}/accounts:batchGet?maxResults=1000`, { headers: { Authorization: 'Bearer owner' } })
  const localByEmail = new Map(((await response.json()).users || []).filter((user) => user.email).map((user) => [user.email.toLowerCase(), user.localId]))
  const ids = new Map()
  let pageToken
  do {
    const page = await getAuth(productionApp).listUsers(1000, pageToken)
    for (const user of page.users) {
      const email = user.email && (PAIRED_EMAILS.get(user.email.toLowerCase()) || user.email.toLowerCase())
      if (email && localByEmail.has(email)) ids.set(user.uid, localByEmail.get(email))
    }
    pageToken = page.pageToken
  } while (pageToken)
  return ids
}
const LOCAL_ACCOUNT = await localAccountIds()
console.log(`${LOCAL_ACCOUNT.size} production accounts matched to local ones by email`)

// Comparable (and JSON-able) form of a Firestore value.
function normalize(value) {
  if (value instanceof Timestamp) return { $timestamp: [value.seconds, value.nanoseconds] }
  if (value instanceof GeoPoint) return { $geo: [value.latitude, value.longitude] }
  if (value instanceof DocumentReference) return { $ref: value.path }
  if (Array.isArray(value)) return value.map(normalize)
  if (value && typeof value === 'object') return Object.fromEntries(Object.keys(value).sort().map((k) => [k, normalize(value[k])]))
  return value
}
const same = (a, b) => JSON.stringify(normalize(a)) === JSON.stringify(normalize(b))

// A production document as the emulators must have it: file URLs on the
// local Storage emulator, accounts local (at any depth: an audit entry's
// before/after carry a record's fields).
const PRODUCTION_STORAGE_URL = /^https:\/\/firebasestorage\.googleapis\.com\/v0\/b\//
function forLocal(value, key) {
  if (typeof value === 'string') {
    if (ACCOUNT_FIELDS.includes(key) && LOCAL_ACCOUNT.has(value)) return LOCAL_ACCOUNT.get(value)
    return value.replace(PRODUCTION_STORAGE_URL, `http://${STORAGE_EMULATOR}/v0/b/`)
  }
  if (Array.isArray(value)) return value.map((item) => forLocal(item))
  if (value && typeof value === 'object' && !(value instanceof Timestamp) && !(value instanceof GeoPoint) && !(value instanceof DocumentReference)) {
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, forLocal(v, k)]))
  }
  return value
}

async function writeInBatches(operations) {
  for (let i = 0; i < operations.length; i += 400) {
    const batch = local.batch()
    for (const op of operations.slice(i, i + 400)) op(batch)
    await batch.commit()
  }
}

async function inPool(items, size, task) {
  const results = new Array(items.length)
  let next = 0
  await Promise.all(Array.from({ length: Math.min(size, items.length) }, async () => {
    while (next < items.length) {
      const i = next++
      results[i] = await task(items[i])
    }
  }))
  return results
}

// Production as read from now on: the edits pushed later are those after it.
const startedAt = new Date()

// --- Firestore
const collections = (await production.listCollections()).map((c) => c.id).filter((id) => !SKIP.includes(id))
const localOnlyCollections = (await local.listCollections()).map((c) => c.id).filter((id) => !SKIP.includes(id) && !collections.includes(id))
const plan = {}
for (const collection of [...collections, ...localOnlyCollections]) {
  const [prodSnap, localSnap] = await Promise.all([production.collection(collection).get(), local.collection(collection).get()])
  const localDocs = new Map(localSnap.docs.map((d) => [d.id, d.data()]))
  const prodIds = new Set(prodSnap.docs.map((d) => d.id))
  const creates = []
  const updates = []
  for (const doc of prodSnap.docs) {
    const data = forLocal(doc.data())
    const mine = localDocs.get(doc.id)
    if (!mine) creates.push({ id: doc.id, data })
    // A photo's _created/_modified: each side's upload function stamps its own.
    else if (!same({ ...data, _created: 0, _modified: 0 }, { ...mine, _created: 0, _modified: 0 })) updates.push({ id: doc.id, data })
  }
  const deletes = ADD_ONLY.includes(collection) ? [] : localSnap.docs.filter((d) => !prodIds.has(d.id))
  plan[collection] = { creates, updates, deletes }
  console.log(`${collection}: ${creates.length} to create, ${updates.length} to overwrite, ${deletes.length} to delete (local ${localSnap.size} -> ${prodSnap.size})`)
}

// --- Storage
async function localFiles(prefix) {
  const items = []
  let pageToken = ''
  do {
    const page = await (await fetch(`${LOCAL_STORAGE}?prefix=${encodeURIComponent(prefix)}&maxResults=1000${pageToken ? `&pageToken=${pageToken}` : ''}`)).json()
    items.push(...(page.items || []))
    pageToken = page.nextPageToken || ''
  } while (pageToken)
  // The emulator's list has names only: each file's metadata (md5), 20 at a
  // time (a burst of a thousand requests knocks it over).
  return inPool(items, 20, async ({ name }) => (await fetch(`${LOCAL_STORAGE}/${encodeURIComponent(name)}`)).json())
}

const filePlan = { copies: [], deletes: [] }
if (argv.files) {
  for (const prefix of STORAGE_PREFIXES) {
    const [[prodList], localList] = await Promise.all([bucket.getFiles({ prefix }), localFiles(prefix)])
    const localByName = new Map(localList.map((f) => [f.name, f]))
    const prodNames = new Set(prodList.map((f) => f.name))
    const copies = prodList.filter((f) => localByName.get(f.name)?.md5Hash !== f.metadata.md5Hash)
    const deletes = localList.filter((f) => !prodNames.has(f.name))
    filePlan.copies.push(...copies)
    filePlan.deletes.push(...deletes)
    console.log(`files ${prefix}: ${copies.length} to copy, ${deletes.length} to delete (local ${localList.length} -> ${prodList.length})`)
  }
}

if (argv.report) {
  const report = {
    collections: Object.fromEntries(Object.entries(plan).map(([c, { creates, updates, deletes }]) => [c, { creates: creates.map((d) => d.id), updates: updates.map((d) => d.id), deletes: deletes.map((d) => d.id) }])),
    files: { copies: filePlan.copies.map((f) => f.name), deletes: filePlan.deletes.map((f) => f.name) },
  }
  writeFileSync(argv.report, JSON.stringify(report, null, 2))
}

// The Storage emulator's upload (the GCS JSON API's multipart upload): the
// file's bytes as stored, and its metadata - its download tokens, a gzip
// encoding kept as such.
async function uploadToEmulator(file, bytes) {
  const { contentType, contentEncoding, cacheControl, contentDisposition, metadata } = file.metadata
  const resource = { name: file.name, contentType, ...(contentEncoding && { contentEncoding }), ...(cacheControl && { cacheControl }), ...(contentDisposition && { contentDisposition }), metadata: { ...(metadata || {}), ocSync: 'true' } }
  const boundary = `oc-sync-${Date.now()}`
  const body = Buffer.concat([
    Buffer.from(`--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(resource)}\r\n--${boundary}\r\nContent-Type: ${contentType || 'application/octet-stream'}\r\n\r\n`),
    bytes,
    Buffer.from(`\r\n--${boundary}--`),
  ])
  const response = await fetch(`http://${STORAGE_EMULATOR}/upload/storage/v1/b/${BUCKET}/o?uploadType=multipart&name=${encodeURIComponent(file.name)}`, { method: 'POST', headers: { 'Content-Type': `multipart/related; boundary=${boundary}` }, body })
  if (!response.ok) throw new Error(`${file.name}: upload ${response.status} ${await response.text()}`)
  const stored = await response.json()
  if (stored.md5Hash && stored.md5Hash !== file.metadata.md5Hash) throw new Error(`${file.name}: copied, but its MD5 differs from production's`)
}

// The emulators' background functions (Firestore and Storage triggers),
// paused while the copy is written.
async function backgroundTriggers(on) {
  const response = await fetch(`http://${EMULATOR_HUB}/functions/${on ? 'enable' : 'disable'}BackgroundTriggers`, { method: 'PUT' })
  if (!response.ok) throw new Error(`The emulator hub refused to ${on ? 'resume' : 'pause'} the background functions (${response.status}).`)
}

if (argv.write) {
  // The local data as it was, first: the autosave's whole folder (accounts
  // included), at most a minute behind the emulators.
  if (!existsSync(EMULATOR_DATA)) throw new Error(`No ${EMULATOR_DATA}: is the emulators' autosave running (npm run dev)?`)
  const dir = path.join(BACKUPS, `local-${new Date().toISOString().replace(/[:.]/g, '-')}`)
  mkdirSync(dir, { recursive: true })
  cpSync(EMULATOR_DATA, path.join(dir, '.emulator-data'), { recursive: true })
  console.log(`\nthe local emulator data backed up to ${path.relative(process.cwd(), dir)}`)

  await backgroundTriggers(false)
  try {
    // Files before documents: a record never points at a missing file.
    let done = 0
    await inPool(filePlan.copies, 8, async (file) => {
      // As stored (decompress: false): a gzip-encoded SVG map stays zipped.
      const [bytes] = await file.download({ decompress: false })
      await uploadToEmulator(file, bytes)
      if (++done % 100 === 0) console.log(`   ${done}/${filePlan.copies.length} files copied`)
    })
    console.log(`files: ${filePlan.copies.length} copied`)

    for (const [collection, { creates, updates }] of Object.entries(plan)) {
      await writeInBatches([...creates, ...updates].map(({ id, data }) => (batch) => batch.set(local.collection(collection).doc(id), data)))
    }
    console.log('documents: created and overwritten')

    for (const { deletes } of Object.values(plan)) {
      await writeInBatches(deletes.map((d) => (batch) => batch.delete(d.ref)))
    }
    // As the emulator's owner: a plain request goes through storage.rules,
    // which refuse it (deletes are admins'), and the file stayed.
    for (const file of filePlan.deletes) {
      const response = await fetch(`${LOCAL_STORAGE}/${encodeURIComponent(file.name)}`, { method: 'DELETE', headers: { Authorization: 'Bearer owner' } })
      if (!response.ok && response.status !== 404) throw new Error(`Couldn't delete the local file ${file.name}: ${response.status} ${(await response.text()).slice(0, 200)}`)
    }
    console.log(`deleted: ${Object.values(plan).reduce((n, p) => n + p.deletes.length, 0)} documents, ${filePlan.deletes.length} files`)
    // When the local data was last production's: push-to-production.js
    // pushes the local edits made since.
    writeFileSync(SYNC_MARKER, JSON.stringify({ at: startedAt.toISOString() }, null, 2))
  } finally {
    await backgroundTriggers(true)
  }
}

const totals = Object.values(plan).reduce((t, p) => [t[0] + p.creates.length, t[1] + p.updates.length, t[2] + p.deletes.length], [0, 0, 0])
console.log(`\ndocuments: ${totals[0]} to create, ${totals[1]} to overwrite, ${totals[2]} to delete | files: ${filePlan.copies.length} to copy, ${filePlan.deletes.length} to delete - ${argv.write ? 'done' : 'dry run: nothing changed (--write to mirror)'}.`)
process.exit(0)

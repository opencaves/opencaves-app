#!/usr/bin/env node
// Mirrors the local emulators (the original data) to production: production
// ends up with exactly the local documents and files - everything but its
// users (accounts, _users/* - settings, saved caves), its frozen accounts
// (_frozenUsers), its audit log (_auditLog: only the additions it lacks -
// records, photos, videos - are copied, for the What's new page) and its ratings (the caves' ratings
// subcollections, _caveRatings), which stay untouched.
//
// - Firestore: every other collection. New documents are created, differing
//   ones overwritten whole, the ones only in production deleted. Map
//   documents' file URLs point to the local Storage emulator: they're
//   rewritten to production's (same paths and download tokens). Accounts
//   named in a record (deletedBy, userId) become the production account with
//   the same email. The trash comes along as it is (deletedAt, deletedBy).
// - Storage: caves/ (photos, their resized copies) and maps/ (scans, their
//   previews). Files missing or different (MD5) in production are uploaded
//   with their local metadata (download tokens included) and marked
//   ocSync=true, so the upload functions leave them alone; the resized photo
//   copies are made public (the app reads them at storage.googleapis.com).
//   Files only in production are deleted.
//
// A dry run (--dry-run) lists what would change; --write first saves
// production's current documents to _data/backups/production-<date>/, then
// uploads the files, writes the documents, and deletes what's only in
// production (deleting a photo's record also deletes its files, by the
// onAssetDeleted function). Run it with the local emulators up, after
// `gcloud auth application-default login`.
import { mkdirSync, writeFileSync } from 'node:fs'
import http from 'node:http'
import path from 'node:path'
import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'
import { initializeApp, applicationDefault } from 'firebase-admin/app'
import { getFirestore, Timestamp, GeoPoint, DocumentReference } from 'firebase-admin/firestore'
import { getStorage } from 'firebase-admin/storage'
import { getAuth } from 'firebase-admin/auth'

const PROJECT_ID = 'opencaves'
const BUCKET = 'opencaves.appspot.com'
// Production's own: its users, which accounts are frozen, its audit log, and
// its ratings' summaries (the ratings themselves, under the caves, aren't copied).
const KEEP = ['_users', '_frozenUsers', '_auditLog', '_caveRatings']
const STORAGE_PREFIXES = ['caves/', 'maps/']
const FIRESTORE_EMULATOR = process.env.FIRESTORE_EMULATOR_HOST || '127.0.0.1:8080'
const STORAGE_EMULATOR = process.env.FIREBASE_STORAGE_EMULATOR_HOST || '127.0.0.1:9199'
const AUTH_EMULATOR = process.env.FIREBASE_AUTH_EMULATOR_HOST || '127.0.0.1:9099'
const BACKUPS = path.resolve(import.meta.dirname, '../_data/backups')

// SYNC_ACCOUNTS (.env): local accounts paired with production's by email,
// "local@example.org=production@example.org,..." - for local accounts whose
// email isn't their production one (the others pair by the same email).
try {
  process.loadEnvFile(path.resolve(import.meta.dirname, '../.env'))
} catch {
  // No .env: the accounts pair by the same email only.
}
const PAIRED_EMAILS = new Map((process.env.SYNC_ACCOUNTS || '').split(',').map((pair) => pair.split('=').map((email) => email.trim().toLowerCase())).filter(([from, to]) => from && to))

const cli = yargs(hideBin(process.argv))
  .usage('$0 --dry-run | --write [--no-files]\n\nMirrors the local emulators to production: every collection and the caves/ and maps/ files; production\'s users are kept.')
  .option('dry-run', { type: 'boolean', default: false, describe: 'List the changes, change nothing' })
  .option('write', { type: 'boolean', default: false, describe: 'Back production\'s documents up, then mirror' })
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
// settings (FIRESTORE_EMULATOR_HOST would send both there); local Storage is
// read through the emulator's REST API, for the same reason.
delete process.env.FIRESTORE_EMULATOR_HOST
delete process.env.FIREBASE_STORAGE_EMULATOR_HOST
delete process.env.FIREBASE_AUTH_EMULATOR_HOST
const local = getFirestore(initializeApp({ projectId: PROJECT_ID }, 'local'))
local.settings({ host: FIRESTORE_EMULATOR, ssl: false })
const productionApp = initializeApp({ credential: applicationDefault(), projectId: PROJECT_ID, storageBucket: BUCKET }, 'production')
const production = getFirestore(productionApp)
const bucket = getStorage(productionApp).bucket(BUCKET)

// Local and production accounts have different ids, so a record naming a
// local account (who moved it to the trash, who uploaded a photo) gets the
// production account with the same email (or paired in SYNC_ACCOUNTS). One with no production
// counterpart keeps its id (shown as a deleted account).
const ACCOUNT_FIELDS = ['deletedBy', 'userId', 'layerSkippedBy']
async function productionAccountIds() {
  const local = await (await fetch(`http://${AUTH_EMULATOR}/identitytoolkit.googleapis.com/v1/projects/${PROJECT_ID}/accounts:batchGet?maxResults=1000`, { headers: { Authorization: 'Bearer owner' } })).json()
  const productionByEmail = new Map()
  let pageToken
  do {
    const page = await getAuth(productionApp).listUsers(1000, pageToken)
    for (const user of page.users) if (user.email) productionByEmail.set(user.email.toLowerCase(), user.uid)
    pageToken = page.pageToken
  } while (pageToken)
  const productionEmail = (user) => PAIRED_EMAILS.get(user.email.toLowerCase()) || user.email.toLowerCase()
  return new Map((local.users || []).filter((user) => user.email && productionByEmail.has(productionEmail(user))).map((user) => [user.localId, productionByEmail.get(productionEmail(user))]))
}
const PRODUCTION_ACCOUNT = await productionAccountIds()
console.log(`${PRODUCTION_ACCOUNT.size} local accounts matched to production's by email`)
const withProductionAccounts = (data) => Object.fromEntries(Object.entries(data).map(([key, value]) => [key, ACCOUNT_FIELDS.includes(key) && PRODUCTION_ACCOUNT.has(value) ? PRODUCTION_ACCOUNT.get(value) : value]))

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

// A local document as production must have it: file URLs on production's host
// (and its accounts production's: withProductionAccounts).
const LOCAL_STORAGE_URL = new RegExp(`^https?://(127\\.0\\.0\\.1|localhost):\\d+/v0/b/`)
function forProduction(value) {
  if (typeof value === 'string') return value.replace(LOCAL_STORAGE_URL, 'https://firebasestorage.googleapis.com/v0/b/')
  if (Array.isArray(value)) return value.map(forProduction)
  if (value && typeof value === 'object' && !(value instanceof Timestamp) && !(value instanceof GeoPoint) && !(value instanceof DocumentReference)) {
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, forProduction(v)]))
  }
  return value
}

async function writeInBatches(operations) {
  for (let i = 0; i < operations.length; i += 400) {
    const batch = production.batch()
    for (const op of operations.slice(i, i + 400)) op(batch)
    await batch.commit()
  }
}

// --- Firestore
const collections = (await local.listCollections()).map((c) => c.id).filter((id) => !KEEP.includes(id))
const productionOnlyCollections = (await production.listCollections()).map((c) => c.id).filter((id) => !KEEP.includes(id) && !collections.includes(id))
const plan = {}
for (const collection of [...collections, ...productionOnlyCollections]) {
  const [localSnap, prodSnap] = await Promise.all([local.collection(collection).get(), production.collection(collection).get()])
  const prodDocs = new Map(prodSnap.docs.map((d) => [d.id, d.data()]))
  const localIds = new Set(localSnap.docs.map((d) => d.id))
  const creates = []
  const updates = []
  for (const doc of localSnap.docs) {
    const data = withProductionAccounts(forProduction(doc.data()))
    const prod = prodDocs.get(doc.id)
    if (!prod) creates.push({ id: doc.id, data })
    // cavesAssets' _created/_modified are stamped by onAssetCreated: not a difference.
    else if (!same({ ...data, _created: 0, _modified: 0 }, { ...prod, _created: 0, _modified: 0 })) updates.push({ id: doc.id, data })
  }
  const deletes = prodSnap.docs.filter((d) => !localIds.has(d.id))
  plan[collection] = { creates, updates, deletes, prodSnap }
  console.log(`${collection}: ${creates.length} to create, ${updates.length} to overwrite, ${deletes.length} to delete (production ${prodSnap.size} -> ${localSnap.size})`)
}

// --- The audit log's additions (the What's new page, getWhatsNew): production
// keeps its own audit log, but gets the local entries it lacks for what was
// added - the "create" entries of caves, systems, connections, maps and photos
// (matched by record), and the caves' changes that added videos (matched by
// entry) - their date kept, their author production's account with the same
// email - so its What's new lists what was added locally too.
const WHATS_NEW_COLLECTIONS = ['caves', 'sistemas', 'connections', 'maps', 'cavesAssets']
const additionKey = (entry) => `${entry.collection}/${entry.docId}`
const [localCreates, prodCreates, localCaveChanges] = await Promise.all([
  local.collection('_auditLog').where('action', '==', 'create').get(),
  production.collection('_auditLog').where('action', '==', 'create').get(),
  local.collection('_auditLog').where('collection', '==', 'caves').where('action', '==', 'update').get(),
])
const prodAdditions = new Set(prodCreates.docs.map((d) => additionKey(d.data())))
const videoChanges = localCaveChanges.docs.filter((d) => d.data().changedFields?.includes('videos'))
const videoChangesInProduction = new Set(videoChanges.length ? (await production.getAll(...videoChanges.map((d) => production.collection('_auditLog').doc(d.id)))).filter((d) => d.exists).map((d) => d.id) : [])
const auditAdditions = [...localCreates.docs.filter((d) => WHATS_NEW_COLLECTIONS.includes(d.data().collection) && !prodAdditions.has(additionKey(d.data()))), ...videoChanges.filter((d) => !videoChangesInProduction.has(d.id))].map((d) => {
  const entry = d.data()
  return { id: d.id, data: { ...entry, ...(entry.after && { after: withProductionAccounts(forProduction(entry.after)) }), ...(entry.before && { before: withProductionAccounts(forProduction(entry.before)) }), authorId: PRODUCTION_ACCOUNT.get(entry.authorId) || entry.authorId } }
})
console.log(`_auditLog: ${auditAdditions.length} additions to copy (caves, systems, connections, maps, photos, videos)`)

// --- Storage
async function localFiles(prefix) {
  const items = []
  let pageToken = ''
  do {
    const response = await fetch(`http://${STORAGE_EMULATOR}/v0/b/${BUCKET}/o?prefix=${encodeURIComponent(prefix)}&maxResults=1000${pageToken ? `&pageToken=${pageToken}` : ''}`)
    const page = await response.json()
    items.push(...(page.items || []))
    pageToken = page.nextPageToken || ''
  } while (pageToken)
  // The emulator's list has names only: each file's metadata (md5, type,
  // tokens), 20 at a time (a burst of a thousand requests knocks it over).
  return inPool(items, 20, async ({ name }) => (await fetch(`http://${STORAGE_EMULATOR}/v0/b/${BUCKET}/o/${encodeURIComponent(name)}`)).json())
}

// A file's bytes as stored: fetch() would unzip a gzip-encoded one (the SVG
// maps), which would then be uploaded unzipped, its MD5 never matching.
function storedBytes(url) {
  return new Promise((resolve, reject) => {
    http.get(url, { headers: { 'Accept-Encoding': 'gzip' } }, (response) => {
      if (response.statusCode !== 200) {
        response.resume()
        reject(new Error(`${url}: ${response.statusCode}`))
        return
      }
      const chunks = []
      response.on('data', (chunk) => chunks.push(chunk))
      response.on('end', () => resolve(Buffer.concat(chunks)))
    }).on('error', reject)
  })
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

const filePlan = { uploads: [], deletes: [] }
if (argv.files) {
  for (const prefix of STORAGE_PREFIXES) {
    const [localList, [prodList]] = await Promise.all([localFiles(prefix), bucket.getFiles({ prefix })])
    const prodByName = new Map(prodList.map((f) => [f.name, f]))
    const localNames = new Set(localList.map((f) => f.name))
    const uploads = localList.filter((f) => prodByName.get(f.name)?.metadata.md5Hash !== f.md5Hash)
    const deletes = prodList.filter((f) => !localNames.has(f.name))
    filePlan.uploads.push(...uploads)
    filePlan.deletes.push(...deletes)
    console.log(`files ${prefix}: ${uploads.length} to upload, ${deletes.length} to delete (production ${prodList.length} -> ${localList.length})`)
  }
}

if (argv.report) {
  const report = {
    collections: Object.fromEntries(Object.entries(plan).map(([c, { creates, updates, deletes }]) => [c, { creates: creates.map((d) => d.id), updates: updates.map((d) => d.id), deletes: deletes.map((d) => d.id) }])),
    files: { uploads: filePlan.uploads.map((f) => f.name), deletes: filePlan.deletes.map((f) => f.name) },
  }
  writeFileSync(argv.report, JSON.stringify(report, null, 2))
}

if (argv.write) {
  // Production's documents as they were, first.
  const dir = path.join(BACKUPS, `production-${new Date().toISOString().replace(/[:.]/g, '-')}`)
  mkdirSync(dir, { recursive: true })
  for (const [collection, { prodSnap }] of Object.entries(plan)) {
    writeFileSync(path.join(dir, `${collection}.json`), JSON.stringify(Object.fromEntries(prodSnap.docs.map((d) => [d.id, normalize(d.data())])), null, 1))
  }
  console.log(`\nproduction's documents backed up to ${path.relative(process.cwd(), dir)}`)

  // Files before documents: a record never points at a missing file.
  let done = 0
  for (const file of filePlan.uploads) {
    const content = await storedBytes(`http://${STORAGE_EMULATOR}/v0/b/${BUCKET}/o/${encodeURIComponent(file.name)}?alt=media`)
    const target = bucket.file(file.name)
    await target.save(content, {
      resumable: false,
      // Already compressed if stored so (SVG maps): uploaded as they are.
      ...(file.contentEncoding && { gzip: false }),
      metadata: {
        contentType: file.contentType,
        ...(file.contentEncoding && { contentEncoding: file.contentEncoding }),
        ...(file.cacheControl && { cacheControl: file.cacheControl }),
        ...(file.contentDisposition && { contentDisposition: file.contentDisposition }),
        metadata: { ...(file.metadata || {}), ocSync: 'true' },
      },
    })
    if (/^caves\/[^/]+\/thumbnails\//.test(file.name)) await target.makePublic()
    if (++done % 100 === 0) console.log(`   ${done}/${filePlan.uploads.length} files uploaded`)
  }
  console.log(`files: ${filePlan.uploads.length} uploaded`)

  for (const [collection, { creates, updates }] of Object.entries(plan)) {
    await writeInBatches([...creates, ...updates].map(({ id, data }) => (batch) => batch.set(production.collection(collection).doc(id), data)))
  }
  console.log('documents: created and overwritten')

  await writeInBatches(auditAdditions.map(({ id, data }) => (batch) => batch.set(production.collection('_auditLog').doc(id), data)))
  console.log(`_auditLog: ${auditAdditions.length} additions copied`)

  for (const [collection, { deletes }] of Object.entries(plan)) {
    await writeInBatches(deletes.map((d) => (batch) => batch.delete(d.ref)))
  }
  for (const file of filePlan.deletes) await file.delete({ ignoreNotFound: true })
  console.log(`deleted: ${Object.values(plan).reduce((n, p) => n + p.deletes.length, 0)} documents, ${filePlan.deletes.length} files`)
}

const totals = Object.values(plan).reduce((t, p) => [t[0] + p.creates.length, t[1] + p.updates.length, t[2] + p.deletes.length], [0, 0, 0])
console.log(`\ndocuments: ${totals[0]} to create, ${totals[1]} to overwrite, ${totals[2]} to delete | files: ${filePlan.uploads.length} to upload, ${filePlan.deletes.length} to delete - ${argv.write ? 'done' : 'dry run: nothing changed (--write to mirror)'}.`)
process.exit(0)

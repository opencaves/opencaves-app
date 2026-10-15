#!/usr/bin/env node
// Pushes the local edits to production (the source of the data since 1.0):
// the records changed in the app on the emulators since the last sync from
// production, with their files and their audit log entries - so they show in
// What's new and can be undone there, as if made in production.
//
// - Which records: those named by the local audit log's entries written
//   since --since (by default the last `sync-from-production.js --write`,
//   recorded in _data/sync-from-production.json) in the audited collections,
//   leaving out the entries production has already (copied by the sync, or
//   pushed before). Each record goes as it is locally now: written whole, or
//   deleted if it's gone - only when its last entry is a delete (or the
//   trash emptied); one gone otherwise (a sync removed it) is left alone.
// - A conflict: production's audit log has an entry for the same record
//   since --since - someone changed it there meanwhile. That record isn't
//   pushed (nor its entries); the rest is.
// - Files: a photo's, a map's or a Further reading PDF's (their paths hold
//   the record's id: caves/<cave>/images/<id>, caves/<cave>/thumbnails/
//   <id>_..., maps/<id>, maps/derived/<id>_..., documents/<id>.pdf), uploaded when missing or different (MD5) in
//   production, as stored (gzip-encoded SVG maps too), marked ocSync=true so
//   the upload functions leave them alone; deleted in production with a
//   record that's gone.
// - Accounts: a record's or an entry's (deletedBy, userId, layerSkippedBy,
//   authorId, at any depth) become production's account with the same email
//   (or paired in SYNC_ACCOUNTS, .env). The emulators log app edits as
//   authorId "emulator": --as <email> credits them to that production account
//   (required when there are some).
// - File URLs are rewritten to production's Storage host.
//
// A dry run (--dry-run) lists what would be pushed; --write first saves
// production's current versions of those records to
// _data/backups/production-push-<date>/, then writes files, records and
// entries. Run it with the emulators up (`npm run dev`), after
// `gcloud auth application-default login`.
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
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
// The collections edited in the app, whose changes the audit log records
// (functions/js/audit/log.js' AUDITED_COLLECTIONS).
const AUDITED = ['caves', 'sistemas', 'connections', 'accesses', 'accessibilities', 'sources', 'areas', 'colors', 'languages', 'maps', 'documents', 'cavesAssets', '_settings']
// The records with files, under these Storage prefixes.
const FILE_PREFIXES = { cavesAssets: 'caves/', maps: 'maps/', documents: 'documents/' }
const ACCOUNT_FIELDS = ['deletedBy', 'userId', 'layerSkippedBy', 'authorId']
const FIRESTORE_EMULATOR = process.env.FIRESTORE_EMULATOR_HOST || '127.0.0.1:8080'
const STORAGE_EMULATOR = process.env.FIREBASE_STORAGE_EMULATOR_HOST || '127.0.0.1:9199'
const AUTH_EMULATOR = process.env.FIREBASE_AUTH_EMULATOR_HOST || '127.0.0.1:9099'
const ROOT = path.resolve(import.meta.dirname, '..')
const BACKUPS = path.join(ROOT, '_data/backups')
const SYNC_MARKER = path.join(ROOT, '_data/sync-from-production.json')

try {
  process.loadEnvFile(path.join(ROOT, '.env'))
} catch {
  // No .env: the accounts pair by the same email only.
}
const PAIRED_EMAILS = new Map((process.env.SYNC_ACCOUNTS || '').split(',').map((pair) => pair.split('=').map((email) => email.trim().toLowerCase())).filter(([from, to]) => from && to))

const cli = yargs(hideBin(process.argv))
  .usage('$0 --dry-run | --write [--since <date>] [--as <email>]\n\nPushes the records edited locally since the last sync from production - with their files and audit log entries - to production. A record changed in production meanwhile is left out.')
  .option('dry-run', { type: 'boolean', default: false, describe: 'List what would be pushed, change nothing' })
  .option('write', { type: 'boolean', default: false, describe: 'Back production\'s versions up, then push' })
  .option('since', { type: 'string', describe: 'The local edits since this date (ISO); by default the last sync from production' })
  .option('as', { type: 'string', describe: 'The production account (email) the emulators\' "emulator" entries are credited to' })
  .option('report', { type: 'string', describe: 'Also write the list of what\'s pushed (JSON) to this file' })
  .example('$0 --dry-run --as me@example.com', 'What would be pushed')
  .example('$0 --write --as me@example.com', 'Push it')
  .check((args) => {
    // No arguments: only the help is shown (below).
    if (hideBin(process.argv).length === 0) return true
    if (args.dryRun === args.write) throw new Error('Use exactly one of --dry-run or --write.')
    if (args.since && Number.isNaN(Date.parse(args.since))) throw new Error('--since: a date, e.g. 2026-10-15T10:00:00Z.')
    return true
  })
  .help()
  .alias('help', 'h')
  .strict()

// No arguments: the help, not a run.
if (hideBin(process.argv).length === 0) {
  cli.showHelp('log')
  process.exit(0)
}
const argv = cli.parseSync()

// Since when: --since, else the last sync from production (its marker, else
// its newest backup of the local data).
function lastSync() {
  if (existsSync(SYNC_MARKER)) return new Date(JSON.parse(readFileSync(SYNC_MARKER, 'utf8')).at)
  const pattern = /^local-(\d{4}-\d{2}-\d{2})T(\d{2})-(\d{2})-(\d{2})-(\d{3})Z$/
  const newest = (existsSync(BACKUPS) ? readdirSync(BACKUPS).filter((name) => pattern.test(name)).sort() : []).at(-1)?.match(pattern)
  return newest ? new Date(`${newest[1]}T${newest[2]}:${newest[3]}:${newest[4]}.${newest[5]}Z`) : null
}
const since = argv.since ? new Date(argv.since) : lastSync()
if (!since) throw new Error('No sync from production found: give --since <date>.')
console.log(`local edits since ${since.toISOString()}${argv.since ? '' : ' (the last sync from production)'}`)

// Two apps in one process: the local one points at the emulator through its
// settings (FIRESTORE_EMULATOR_HOST would send both there).
delete process.env.FIRESTORE_EMULATOR_HOST
delete process.env.FIREBASE_STORAGE_EMULATOR_HOST
delete process.env.FIREBASE_AUTH_EMULATOR_HOST
const local = getFirestore(initializeApp({ projectId: PROJECT_ID }, 'local'))
local.settings({ host: FIRESTORE_EMULATOR, ssl: false })
const productionApp = initializeApp({ credential: applicationDefault(), projectId: PROJECT_ID, storageBucket: BUCKET }, 'production')
const production = getFirestore(productionApp)
const bucket = getStorage(productionApp).bucket(BUCKET)

// Local accounts as production's, by email.
async function productionAccounts() {
  const localUsers = (await (await fetch(`http://${AUTH_EMULATOR}/identitytoolkit.googleapis.com/v1/projects/${PROJECT_ID}/accounts:batchGet?maxResults=1000`, { headers: { Authorization: 'Bearer owner' } })).json()).users || []
  const byEmail = new Map()
  let pageToken
  do {
    const page = await getAuth(productionApp).listUsers(1000, pageToken)
    for (const user of page.users) if (user.email) byEmail.set(user.email.toLowerCase(), user.uid)
    pageToken = page.pageToken
  } while (pageToken)
  const ids = new Map(localUsers.filter((user) => user.email).map((user) => [user.localId, byEmail.get(PAIRED_EMAILS.get(user.email.toLowerCase()) || user.email.toLowerCase())]).filter(([, uid]) => uid))
  if (argv.as) {
    const uid = byEmail.get(argv.as.toLowerCase())
    if (!uid) throw new Error(`--as: no production account with the email ${argv.as}.`)
    ids.set('emulator', uid)
  }
  return ids
}
const PRODUCTION_ACCOUNT = await productionAccounts()

// A local value as production must have it: file URLs on production's host,
// accounts production's (at any depth: an entry's before/after).
const LOCAL_STORAGE_URL = /^https?:\/\/(127\.0\.0\.1|localhost):\d+\/v0\/b\//
function forProduction(value, key) {
  if (typeof value === 'string') {
    if (ACCOUNT_FIELDS.includes(key) && PRODUCTION_ACCOUNT.has(value)) return PRODUCTION_ACCOUNT.get(value)
    return value.replace(LOCAL_STORAGE_URL, 'https://firebasestorage.googleapis.com/v0/b/')
  }
  if (Array.isArray(value)) return value.map((item) => forProduction(item))
  if (value && typeof value === 'object' && !(value instanceof Timestamp) && !(value instanceof GeoPoint) && !(value instanceof DocumentReference)) {
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, forProduction(v, k)]))
  }
  return value
}

// Comparable (and JSON-able) form of a Firestore value.
function normalize(value) {
  if (value instanceof Timestamp) return { $timestamp: [value.seconds, value.nanoseconds] }
  if (value instanceof GeoPoint) return { $geo: [value.latitude, value.longitude] }
  if (value instanceof DocumentReference) return { $ref: value.path }
  if (Array.isArray(value)) return value.map(normalize)
  if (value && typeof value === 'object') return Object.fromEntries(Object.keys(value).sort().map((k) => [k, normalize(value[k])]))
  return value
}

// --- The local edits: the entries since `since` production doesn't have.
const sinceTs = Timestamp.fromDate(since)
const localEntries = (await local.collection('_auditLog').where('at', '>=', sinceTs).get()).docs.filter((d) => AUDITED.includes(d.get('collection')) && typeof d.get('docId') === 'string')
const known = new Set()
for (let i = 0; i < localEntries.length; i += 100) {
  const refs = localEntries.slice(i, i + 100).map((d) => production.collection('_auditLog').doc(d.id))
  if (refs.length) for (const snap of await production.getAll(...refs)) if (snap.exists) known.add(snap.id)
}
const entries = localEntries.filter((d) => !known.has(d.id))
const emulatorAuthored = entries.filter((d) => d.get('authorId') === 'emulator')
if (emulatorAuthored.length && !argv.as) throw new Error(`${emulatorAuthored.length} local entries are credited to "emulator": give --as <your production email>.`)

// The records they name, each once, and whether production changed it since.
const records = new Map()
for (const entry of entries) {
  const key = `${entry.get('collection')}/${entry.get('docId')}`
  if (!records.has(key)) records.set(key, { collection: entry.get('collection'), id: entry.get('docId'), entries: [] })
  records.get(key).entries.push(entry)
}
const plan = []
const conflicts = []
// Gone locally without a delete of their own (a sync removed them): left alone.
const unexplained = []
for (const record of records.values()) {
  // By docId only (no composite index), the dates compared here.
  const changedThere = await production.collection('_auditLog').where('docId', '==', record.id).get()
  const theirs = changedThere.docs.filter((d) => d.get('collection') === record.collection && !known.has(d.id) && d.get('at')?.toMillis() >= since.getTime())
  if (theirs.length) {
    conflicts.push({ ...record, theirs })
    continue
  }
  const [mine, current] = await Promise.all([local.collection(record.collection).doc(record.id).get(), production.collection(record.collection).doc(record.id).get()])
  // Gone locally: deleted in production only when its last entry deletes it
  // (a delete, or the trash emptied) - not when a sync removed it.
  const lastAction = record.entries.map((e) => e.data()).sort((a, b) => a.at.toMillis() - b.at.toMillis()).at(-1).action
  if (!mine.exists && !['delete', 'purge'].includes(lastAction)) {
    unexplained.push(record)
    continue
  }
  if (!mine.exists && !current.exists) continue
  plan.push({ ...record, data: mine.exists ? forProduction(mine.data()) : null, current })
}

// --- Files of the photos, maps and documents pushed.
async function localFiles(prefix) {
  const items = []
  let pageToken = ''
  do {
    const page = await (await fetch(`http://${STORAGE_EMULATOR}/v0/b/${BUCKET}/o?prefix=${encodeURIComponent(prefix)}&maxResults=1000${pageToken ? `&pageToken=${pageToken}` : ''}`)).json()
    items.push(...(page.items || []))
    pageToken = page.nextPageToken || ''
  } while (pageToken)
  return items.map(({ name }) => name)
}
const fileOf = (name, id) => name.includes(`/${id}`) && (name.endsWith(`/${id}`) || name.includes(`/${id}_`) || name.includes(`/${id}.`))
const filePlan = { uploads: [], deletes: [] }
for (const [collection, prefix] of Object.entries(FILE_PREFIXES)) {
  const ids = plan.filter((r) => r.collection === collection).map((r) => ({ id: r.id, gone: !r.data }))
  if (!ids.length) continue
  const [localNames, [prodList]] = await Promise.all([localFiles(prefix), bucket.getFiles({ prefix })])
  for (const { id, gone } of ids) {
    const prodFiles = prodList.filter((f) => fileOf(f.name, id))
    if (gone) {
      filePlan.deletes.push(...prodFiles.filter((f) => !localNames.includes(f.name)))
      continue
    }
    for (const name of localNames.filter((n) => fileOf(n, id))) {
      const meta = await (await fetch(`http://${STORAGE_EMULATOR}/v0/b/${BUCKET}/o/${encodeURIComponent(name)}`)).json()
      if (prodFiles.find((f) => f.name === name)?.metadata.md5Hash !== meta.md5Hash) filePlan.uploads.push(meta)
    }
  }
}

// --- The plan.
const label = (r) => `${r.collection}/${r.id}${r.data?.name ? ` (${typeof r.data.name === 'string' ? r.data.name : r.data.name.value || ''})` : ''}`
console.log(`\n${entries.length} local entries to push, on ${plan.length} record(s)${conflicts.length ? `; ${conflicts.length} record(s) left out (changed in production)` : ''}`)
for (const r of plan) console.log(`  ${(r.data ? (r.current.exists ? 'update' : 'create') : 'delete').padEnd(6)}  ${label(r)}  [${r.entries.map((e) => e.get('action')).join(', ')}]`)
for (const r of conflicts) console.log(`  SKIP    ${r.collection}/${r.id}: changed in production since (${r.theirs.length} entr${r.theirs.length > 1 ? 'ies' : 'y'})`)
for (const r of unexplained) console.log(`  SKIP    ${r.collection}/${r.id}: gone locally, but its entries don't delete it`)
console.log(`files: ${filePlan.uploads.length} to upload, ${filePlan.deletes.length} to delete`)

if (argv.report) {
  writeFileSync(argv.report, JSON.stringify({ since, records: plan.map((r) => ({ collection: r.collection, id: r.id, action: r.data ? (r.current.exists ? 'update' : 'create') : 'delete', entries: r.entries.map((e) => e.id) })), conflicts: conflicts.map((r) => ({ collection: r.collection, id: r.id })), files: { uploads: filePlan.uploads.map((f) => f.name), deletes: filePlan.deletes.map((f) => f.name) } }, null, 2))
}

if (!argv.write) {
  console.log('\ndry run: nothing changed (--write to push).')
  process.exit(0)
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

// Production's versions of the records, first.
const dir = path.join(BACKUPS, `production-push-${new Date().toISOString().replace(/[:.]/g, '-')}`)
mkdirSync(dir, { recursive: true })
writeFileSync(path.join(dir, 'records.json'), JSON.stringify(plan.map((r) => ({ collection: r.collection, id: r.id, before: r.current.exists ? normalize(r.current.data()) : null })), null, 1))
console.log(`\nproduction's versions backed up to ${path.relative(process.cwd(), dir)}`)

// Files before records: a record never points at a missing file.
for (const file of filePlan.uploads) {
  const content = await storedBytes(`http://${STORAGE_EMULATOR}/v0/b/${BUCKET}/o/${encodeURIComponent(file.name)}?alt=media`)
  const target = bucket.file(file.name)
  await target.save(content, {
    resumable: false,
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
}
console.log(`files: ${filePlan.uploads.length} uploaded`)

// Each record with its entries, in one batch: both or neither.
for (const r of plan) {
  const batch = production.batch()
  const ref = production.collection(r.collection).doc(r.id)
  if (r.data) batch.set(ref, r.data)
  else batch.delete(ref)
  for (const entry of r.entries) batch.set(production.collection('_auditLog').doc(entry.id), forProduction(entry.data()))
  await batch.commit()
}
console.log(`records: ${plan.length} pushed, with ${entries.filter((e) => plan.some((r) => r.entries.includes(e))).length} audit entries`)

for (const file of filePlan.deletes) await file.delete({ ignoreNotFound: true })
console.log(`files: ${filePlan.deletes.length} deleted`)
console.log('\ndone. What\'s new picks the entries up within 10 minutes (refreshWhatsNew).')
process.exit(0)

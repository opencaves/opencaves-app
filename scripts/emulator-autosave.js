#!/usr/bin/env node
// Saves the running Firebase emulators' data to ./.emulator-data while they
// run, for `npm run dev`. The emulators' own --export-on-exit only runs on a
// clean stop, and concurrently force-kills its processes on Windows (Ctrl+C,
// closing the terminal): the data was never saved, and every start began
// with an empty database.
//
// Firestore, Auth and the Realtime Database are saved every minute (small);
// Storage (photos and maps: most of the size, ~1 GB) only when its files
// changed - the listing's names, versions and sizes no longer match the
// fingerprint recorded at its last save.
//
// Exports go to the system temp folder, then are copied over: the emulators
// build an export in that temp folder and move it to its target, which fails
// when the target is on another drive (the project on F:, temp on C:) - which
// is also why --export-on-exit never saved anything here. Each part replaces
// its previous copy only once fully copied, so a save cut short can't spoil
// the last good one.
import { spawn } from 'node:child_process'
import { createHash } from 'node:crypto'
import { cpSync, existsSync, readdirSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'

const ROOT = path.resolve(import.meta.dirname, '..')
const DATA_DIR = path.join(ROOT, '.emulator-data')
const TEMP_DIR = path.join(os.tmpdir(), 'opencaves-emulator-export')
const METADATA = 'firebase-export-metadata.json'
// The Storage files' fingerprint at its last save (ignored by git like the rest).
const STORAGE_FINGERPRINT = path.join(DATA_DIR, 'storage-fingerprint.txt')
// The emulator hub (Firebase's default port): up means the emulators are.
const HUB = 'http://127.0.0.1:4400/emulators'
const STORAGE_API = 'http://127.0.0.1:9199/storage/v1/b'
const DEFAULT_BUCKET = 'opencaves.appspot.com'
const INTERVAL_MINUTES = Number(process.env.EMULATOR_AUTOSAVE_MINUTES || 1)
const SMALL_PARTS = ['firestore', 'auth', 'database']

const log = (message) => console.log(`[autosave] ${new Date().toLocaleTimeString()} ${message}`)
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

async function emulatorsUp() {
  try {
    return (await fetch(HUB)).ok
  } catch {
    return false
  }
}

function exportParts(parts) {
  rmSync(TEMP_DIR, { recursive: true, force: true })
  return new Promise((resolve) => {
    // A command line through the shell: firebase is a .cmd on Windows.
    const child = spawn(`firebase emulators:export "${TEMP_DIR}" --force --only ${parts.join(',')}`, { cwd: ROOT, shell: true, stdio: ['ignore', 'pipe', 'pipe'] })
    let output = ''
    child.stdout.on('data', (chunk) => { output += chunk })
    child.stderr.on('data', (chunk) => { output += chunk })
    child.on('close', (code) => resolve(code === 0 && existsSync(path.join(TEMP_DIR, METADATA)) ? null : output.trim().split('\n').pop()))
  })
}

// Moves the exported parts into the data folder without renaming any folder
// (Windows often refuses to rename one just written: EPERM). Each part has two
// slots, <part>_export_a and _b: the new copy goes into the slot not in use,
// then the metadata - which tells the next start where each part is - is
// switched to it (a file rename, which works), then the old slot is deleted.
// Cut short anywhere, the metadata still points to a complete copy. Parts not
// exported keep their metadata entry, so the next start still imports them.
function install(parts) {
  const exported = JSON.parse(readFileSync(path.join(TEMP_DIR, METADATA), 'utf8'))
  const metadataPath = path.join(DATA_DIR, METADATA)
  const metadata = existsSync(metadataPath) ? JSON.parse(readFileSync(metadataPath, 'utf8')) : {}
  const replaced = []
  for (const part of parts) {
    if (!exported[part]) continue
    const folder = exported[part].path
    const current = metadata[part]?.path
    const slot = current === `${folder}_a` ? `${folder}_b` : `${folder}_a`
    rmSync(path.join(DATA_DIR, slot), { recursive: true, force: true })
    cpSync(path.join(TEMP_DIR, folder), path.join(DATA_DIR, slot), { recursive: true })
    metadata[part] = { ...exported[part], path: slot }
    if (exported[part].metadata_file) metadata[part].metadata_file = exported[part].metadata_file.replace(folder, slot)
    if (current && current !== slot) replaced.push(current)
  }
  metadata.version = exported.version
  writeFileSync(`${metadataPath}.new`, JSON.stringify(metadata, null, 2))
  renameSync(`${metadataPath}.new`, metadataPath)
  for (const old of replaced) {
    try {
      rmSync(path.join(DATA_DIR, old), { recursive: true, force: true })
    } catch {
      // Still locked: deleted at the next save of this part.
    }
  }
  rmSync(TEMP_DIR, { recursive: true, force: true })
}

// Names, versions and sizes of every Storage file: changes with any upload,
// deletion or metadata change.
async function storageFingerprint() {
  const storageFolder = existsSync(path.join(DATA_DIR, METADATA)) ? JSON.parse(readFileSync(path.join(DATA_DIR, METADATA), 'utf8')).storage?.path : null
  const bucketsFile = path.join(DATA_DIR, storageFolder || 'storage_export', 'buckets.json')
  const buckets = existsSync(bucketsFile) ? JSON.parse(readFileSync(bucketsFile, 'utf8')).buckets.map((b) => b.id) : [DEFAULT_BUCKET]
  const hash = createHash('sha1')
  for (const bucket of new Set([DEFAULT_BUCKET, ...buckets])) {
    let pageToken = ''
    do {
      const response = await fetch(`${STORAGE_API}/${bucket}/o?maxResults=1000${pageToken ? `&pageToken=${encodeURIComponent(pageToken)}` : ''}`)
      if (!response.ok) break
      const page = await response.json()
      for (const item of page.items || []) hash.update(`${bucket}/${item.name} ${item.generation} ${item.metageneration} ${item.size}\n`)
      pageToken = page.nextPageToken
    } while (pageToken)
  }
  return hash.digest('hex')
}

async function save() {
  const smallError = await exportParts(SMALL_PARTS)
  if (smallError) return log(`save failed: ${smallError}`)
  install(SMALL_PARTS)

  const fingerprint = await storageFingerprint()
  const saved = existsSync(STORAGE_FINGERPRINT) ? readFileSync(STORAGE_FINGERPRINT, 'utf8') : ''
  const storagePath = JSON.parse(readFileSync(path.join(DATA_DIR, METADATA), 'utf8')).storage?.path
  if (fingerprint === saved && storagePath && existsSync(path.join(DATA_DIR, storagePath))) {
    return log('saved Firestore, Auth, Database (Storage unchanged)')
  }
  const started = Date.now()
  const storageError = await exportParts(['storage'])
  if (storageError) return log(`saved Firestore, Auth, Database; Storage save failed: ${storageError}`)
  install(['storage'])
  writeFileSync(STORAGE_FINGERPRINT, fingerprint)
  log(`saved Firestore, Auth, Database and Storage (changed; ${Math.round((Date.now() - started) / 1000)} s)`)
}

// A failed export (the emulators hanging) leaves the Firebase CLI's empty
// working folder, firebase-export-<time><random>, in the project: removed
// after each save - only when empty, so no data is ever lost.
function removeLeftovers() {
  for (const entry of readdirSync(ROOT, { withFileTypes: true })) {
    if (!entry.isDirectory() || !/^firebase-export-\d+\w*$/.test(entry.name)) continue
    const folder = path.join(ROOT, entry.name)
    const isEmpty = (dir) => readdirSync(dir, { withFileTypes: true }).every((e) => e.isDirectory() && isEmpty(path.join(dir, e.name)))
    try {
      if (isEmpty(folder)) rmSync(folder, { recursive: true, force: true })
    } catch {
      // Still in use: removed after a later save.
    }
  }
}

log(`waiting for the emulators; then saving every ${INTERVAL_MINUTES} min`)
while (!(await emulatorsUp())) await sleep(3000)
// A first save once they're up: the data the emulators just imported is then
// safe even if this session is killed before the next one.
await sleep(15000)
for (;;) {
  if (await emulatorsUp()) {
    try {
      await save()
    } catch (error) {
      log(`save failed: ${error.message}`)
    }
    removeLeftovers()
  }
  await sleep(INTERVAL_MINUTES * 60 * 1000)
}

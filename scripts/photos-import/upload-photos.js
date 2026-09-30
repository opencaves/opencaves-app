// Uploads the photos prepared by extract_photos.py / match_photos.py
// (matched.csv by default, or a reviewed CSV with the same columns) to their
// caves - the same way the app's own upload does: the file in Storage at
// caves/<caveId>/images/<assetId>, where the onAssetUploaded function makes
// the thumbnails, reads the EXIF (date, GPS, 360° panorama) and creates the
// cavesAssets document. So the functions must be running (emulators
// included): without them no document appears and the photo counts as failed.
//
// Which photos: every row with exactly one caveId, except include=no and
// kind "map?" (unless include=yes). isCover=yes makes that photo its cave's
// cover; otherwise a cave without a cover gets its first uploaded photo.
//
// Re-runnable: every imported photo records its file's hash (importKey), on
// the document and on the Storage file. A photo already imported isn't
// uploaded again.
//
// A dry run by default: --apply to write. --undo removes everything an
// import added (documents, files, thumbnails).

import { readFileSync } from 'node:fs'
import path from 'node:path'
import pushId from 'unique-push-id'
import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'
import { initializeApp, applicationDefault } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import { getStorage } from 'firebase-admin/storage'

const PROJECT_ID = 'opencaves'
const BUCKET = 'opencaves.appspot.com'
const COLL = 'cavesAssets'
const CONTENT_TYPES = { '.webp': 'image/webp', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png' }
// Photos uploaded at once, after each cave's first (see importCave).
const CONCURRENCY = 4
// How long the function may take to create a photo's document.
const DOCUMENT_TIMEOUT_MS = 180_000
const POLL_MS = 1500

const argv = yargs(hideBin(process.argv))
  .usage('Upload the extracted photos to their caves.\n\nUsage: $0 [options]')
  .option('csv', { type: 'string', default: '_data/photos-import/matched.csv', describe: 'The photos to upload (matched.csv or a reviewed copy); image paths are relative to its folder' })
  .option('production', { alias: 'p', type: 'boolean', default: false, describe: 'The real opencaves project instead of the local emulators (needs `gcloud auth application-default login`)' })
  .option('apply', { type: 'boolean', default: false, describe: 'Actually write; without it, only print what would be done' })
  .option('limit', { type: 'number', describe: 'Only the first N photos (to try a few first)' })
  .option('only', { type: 'string', describe: 'Only photos whose cave, folder or file contains this text' })
  .option('undo', { type: 'boolean', default: false, describe: 'Remove every imported photo (documents, files, thumbnails) instead' })
  .example('$0', 'Dry run against the local emulators')
  .example('$0 --apply --limit 5', 'Upload the first 5 photos locally')
  .example('$0 -p --apply', 'Upload everything to production')
  .help()
  .alias('help', 'h')
  .strict()
  .parseSync()

if (!argv.production) {
  process.env.FIRESTORE_EMULATOR_HOST ??= '127.0.0.1:8080'
  process.env.FIREBASE_STORAGE_EMULATOR_HOST ??= '127.0.0.1:9199'
}
initializeApp({ projectId: PROJECT_ID, storageBucket: BUCKET, ...(argv.production && { credential: applicationDefault() }) })
const db = getFirestore()
const bucket = getStorage().bucket()
const mode = `${argv.production ? 'PRODUCTION' : 'local emulators'}${argv.apply ? '' : ' - dry run, nothing written (--apply to write)'}`

// Minimal CSV reader (quoted fields, "" escapes, CRLF, BOM) - the files
// come from Python's csv module.
function readCsv(file) {
  const text = readFileSync(file, 'utf8').replace(/^﻿/, '')
  const records = []
  let record = [], field = '', quoted = false
  for (let i = 0; i < text.length; i++) {
    const c = text[i]
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') { field += '"'; i++ }
      else if (c === '"') quoted = false
      else field += c
    } else if (c === '"') quoted = true
    else if (c === ',') { record.push(field); field = '' }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++
      record.push(field); field = ''
      if (record.some((v) => v !== '')) records.push(record)
      record = []
    } else field += c
  }
  if (field || record.length) { record.push(field); records.push(record) }
  const [header, ...rows] = records
  return rows.map((values) => Object.fromEntries(header.map((key, i) => [key, values[i] ?? ''])))
}

const list = (value) => (value || '').split('|').map((v) => v.trim()).filter(Boolean)
const yes = (value) => (value || '').trim().toLowerCase() === 'yes'
const no = (value) => (value || '').trim().toLowerCase() === 'no'
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

async function waitFor(ref, test) {
  const deadline = Date.now() + DOCUMENT_TIMEOUT_MS
  while (Date.now() < deadline) {
    const snap = await ref.get()
    if (snap.exists && test(snap.data())) return snap
    await sleep(POLL_MS)
  }
  return null
}

async function coverIds(caveId) {
  const snap = await db.collection(COLL).where('caveId', '==', caveId).where('isCover', '==', true).get()
  return snap.docs.map((d) => d.id)
}

async function setCover(caveId, assetId) {
  const current = await coverIds(caveId)
  await Promise.all(current.filter((id) => id !== assetId).map((id) => db.collection(COLL).doc(id).update({ isCover: false })))
  await db.collection(COLL).doc(assetId).update({ isCover: true })
}

// The photo's file and thumbnails (the onAssetDeleted function does this
// too, when the functions run).
async function removeFiles(caveId, assetId) {
  await bucket.file(`caves/${caveId}/images/${assetId}`).delete({ ignoreNotFound: true })
  await bucket.deleteFiles({ prefix: `caves/${caveId}/thumbnails/${assetId}_` })
}

// A photo uploaded by an earlier, interrupted run: its file is there, but
// its document never got the importKey.
async function findUploadedFile(caveId, importKey) {
  const [files] = await bucket.getFiles({ prefix: `caves/${caveId}/images/` })
  for (const file of files) {
    const [metadata] = await file.getMetadata()
    if (metadata.metadata?.importKey === importKey) return path.posix.basename(file.name)
  }
  return null
}

// Returns the photo's asset id, or null on a dry run.
async function importPhoto(row, csvDir, label) {
  const caveId = list(row.caveIds)[0]
  const importKey = row.sha1
  const existing = await db.collection(COLL).where('importKey', '==', importKey).limit(1).get()
  if (!existing.empty) {
    const asset = existing.docs[0]
    const where = asset.data().caveId === caveId ? '' : ` - but in another cave (${asset.data().caveId}): --undo and re-import to move it`
    console.log(`${label}: already imported as ${asset.id}${where}`)
    return { id: asset.id, status: 'existing' }
  }

  let assetId = await findUploadedFile(caveId, importKey)
  // Uploaded but the function made no document (it failed on this file):
  // uploaded again, to trigger it again.
  if (assetId && !(await db.collection(COLL).doc(assetId).get()).exists) {
    console.log(`${label}: file uploaded as ${assetId} earlier but never got a document - uploading it again`)
    if (argv.apply) await removeFiles(caveId, assetId)
    assetId = null
  }
  if (assetId) {
    console.log(`${label}: file already uploaded as ${assetId}, finishing its import`)
  } else {
    const file = path.join(csvDir, row.image)
    const contentType = CONTENT_TYPES[path.extname(file).toLowerCase()]
    if (!contentType) throw new Error(`unsupported file type ${path.extname(file)}`)
    assetId = pushId()
    console.log(`${label}: upload as ${assetId}${yes(row.isCover) ? ', as cover' : ''}`)
    if (!argv.apply) return { id: null, status: 'uploaded' }
    await bucket.file(`caves/${caveId}/images/${assetId}`).save(readFileSync(file), {
      metadata: { contentType, metadata: { originalName: path.basename(row.source), importKey } },
    })
  }
  if (!argv.apply) return { id: assetId, status: 'uploaded' }

  const ref = db.collection(COLL).doc(assetId)
  if (!await waitFor(ref, () => true)) {
    throw new Error(`no ${COLL} document after ${DOCUMENT_TIMEOUT_MS / 1000}s - are the functions running? A re-run finishes it`)
  }
  await ref.set({ importKey, importSource: row.source }, { merge: true })
  return { id: assetId, status: 'uploaded' }
}

// A cave's photos: the cover (or the first one) alone, so the setCoverImage
// function has made it the cover before the rest arrive - uploaded together,
// several could each see "no cover yet" and all become covers.
async function importCave(caveRows, csvDir, counts, labelOf) {
  const caveId = list(caveRows[0].caveIds)[0]
  const hadCover = argv.apply && (await coverIds(caveId)).length > 0
  const [first, ...rest] = caveRows

  const run = async (row) => {
    try {
      const result = await importPhoto(row, csvDir, labelOf(row))
      counts[result.status]++
      return result.id
    } catch (error) {
      console.error(`${labelOf(row)}: FAILED - ${error.message}`)
      counts.failed++
      return null
    }
  }

  const firstId = await run(first)
  if (argv.apply && firstId) {
    if (yes(first.isCover)) {
      await setCover(caveId, firstId)
    } else if (!hadCover && !await waitFor(db.collection(COLL).doc(firstId), (data) => data.isCover)) {
      await setCover(caveId, firstId)
    }
  }
  for (let i = 0; i < rest.length; i += CONCURRENCY) {
    await Promise.all(rest.slice(i, i + CONCURRENCY).map(run))
  }
}

async function upload() {
  const csvDir = path.dirname(argv.csv)
  const all = readCsv(argv.csv).filter((row) => row.image && row.kind !== 'error')
  const skipped = { 'include=no': 0, 'map?': 0, 'no cave': 0, 'several caves': 0 }
  let rows = all.filter((row) => {
    const reason = no(row.include) ? 'include=no'
      : row.kind === 'map?' && !yes(row.include) ? 'map?'
      : list(row.caveIds).length === 0 ? 'no cave'
      : list(row.caveIds).length > 1 ? 'several caves'
      : null
    if (reason) skipped[reason]++
    return !reason
  })
  if (argv.only) rows = rows.filter((row) => `${row.caveNames} ${row.folder} ${row.image}`.toLowerCase().includes(argv.only.toLowerCase()))
  if (argv.limit) rows = rows.slice(0, argv.limit)
  console.log(`${rows.length} photos to import (${mode}); left out: ${Object.entries(skipped).map(([k, n]) => `${n} ${k}`).join(', ')}`)

  const byCave = new Map()
  for (const row of rows) {
    const caveId = list(row.caveIds)[0]
    if (!byCave.has(caveId)) byCave.set(caveId, [])
    byCave.get(caveId).push(row)
  }
  const counts = { uploaded: 0, existing: 0, failed: 0 }
  let index = 0
  const numbers = new Map(rows.map((row) => [row, ++index]))
  const labelOf = (row) => `[${numbers.get(row)}/${rows.length}] ${row.caveNames}: ${row.source}`
  for (const caveRows of byCave.values()) {
    // The chosen cover first.
    caveRows.sort((a, b) => yes(b.isCover) - yes(a.isCover))
    await importCave(caveRows, csvDir, counts, labelOf)
  }
  console.log(`\n${argv.apply ? 'Done' : 'Would do'}: ${counts.uploaded} uploaded, ${counts.existing} already there, ${counts.failed} failed`)
}

async function undo() {
  const imported = await db.collection(COLL).where('importKey', '!=', null).get()
  console.log(`${imported.size} imported photos to remove (${mode})`)
  for (const doc of imported.docs) {
    const { caveId, importSource } = doc.data()
    console.log(`  ${importSource} (${doc.id}): document, file, thumbnails`)
    if (!argv.apply) continue
    await removeFiles(caveId, doc.id)
    await doc.ref.delete()
  }
}

await (argv.undo ? undo() : upload())

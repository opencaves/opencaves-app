// Uploads the maps prepared by extract_maps.py / match_maps.py (matched.csv
// by default, or a reviewed CSV with the same columns) and attaches each to
// its sistema(s) - the same way the app's own upload does: the file in
// Storage at maps/<id> with a download token (which the onMapImageUploaded
// function then gives a preview and thumbnail), a `maps` document, and the
// map's id added to each sistema's `maps` list.
//
// Re-runnable: every imported map records its file's hash (importKey). A
// file already imported isn't uploaded again - its details (name, date,
// authors, note) and sistema links are brought up to date instead.
// Maps with no sistema are skipped (nothing would show them).
//
// A dry run by default: --apply to write. --undo removes everything an
// import added (documents, files, sistema links).

import { randomUUID } from 'node:crypto'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import pushId from 'unique-push-id'
import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'
import { initializeApp, applicationDefault } from 'firebase-admin/app'
import { getFirestore, FieldValue } from 'firebase-admin/firestore'
import { getStorage } from 'firebase-admin/storage'

const PROJECT_ID = 'opencaves'
const BUCKET = 'opencaves.appspot.com'
const CONTENT_TYPES = { '.webp': 'image/webp', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.svg': 'image/svg+xml' }

const argv = yargs(hideBin(process.argv))
  .usage('Upload the extracted maps and attach them to their sistemas.\n\nUsage: $0 [options]')
  .option('csv', { type: 'string', default: '_data/maps-import/matched.csv', describe: 'The maps to upload (matched.csv or a reviewed copy); image paths are relative to its folder' })
  .option('production', { alias: 'p', type: 'boolean', default: false, describe: 'The real opencaves project instead of the local emulators (needs `gcloud auth application-default login`)' })
  .option('apply', { type: 'boolean', default: false, describe: 'Actually write; without it, only print what would be done' })
  .option('limit', { type: 'number', describe: 'Only the first N maps (to try a few first)' })
  .option('only', { type: 'string', describe: 'Only maps whose name or file contains this text' })
  .option('undo', { type: 'boolean', default: false, describe: 'Remove every imported map (documents, files, sistema links) instead' })
  .example('$0', 'Dry run against the local emulators')
  .example('$0 --apply --limit 5', 'Upload the first 5 maps locally')
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

// The same download URL shape getDownloadURL() gives the app.
function downloadUrl(storagePath, token) {
  const host = argv.production ? 'https://firebasestorage.googleapis.com' : `http://${process.env.FIREBASE_STORAGE_EMULATOR_HOST}`
  return `${host}/v0/b/${BUCKET}/o/${encodeURIComponent(storagePath)}?alt=media&token=${token}`
}

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

// What the map document holds, from a CSV row. A reviewed CSV may set name,
// date, authors (separated by "|") and note; otherwise: the map's name, its
// publication year and the publication.
function mapDetails(row) {
  const name = row.name || row.mapName
  const date = row.date ?? row.publicationYear
  const authors = list(row.authors)
  const note = row.note ?? row.publications
  return { name, ...(date && { date }), ...(authors.length && { authors }), ...(note && { note }) }
}

async function upload() {
  const csvDir = path.dirname(argv.csv)
  let rows = readCsv(argv.csv).filter((row) => row.image && list(row.sistemaIds).length && (row.include ?? 'yes').toLowerCase() !== 'no')
  if (argv.only) rows = rows.filter((row) => `${row.name || row.mapName} ${row.image} ${row.source}`.toLowerCase().includes(argv.only.toLowerCase()))
  if (argv.limit) rows = rows.slice(0, argv.limit)
  console.log(`${rows.length} maps to import (${mode})`)

  const counts = { uploaded: 0, updated: 0, failed: 0 }
  for (const [index, row] of rows.entries()) {
    const label = `[${index + 1}/${rows.length}] ${row.name || row.mapName} (${row.image})`
    try {
      const importKey = row.sha1
      const details = mapDetails(row)
      const sistemaIds = list(row.sistemaIds)
      const existing = await db.collection('maps').where('importKey', '==', importKey).limit(1).get()

      if (!existing.empty) {
        const mapId = existing.docs[0].id
        console.log(`${label}: already imported as ${mapId} - details and links updated`)
        if (argv.apply) {
          await existing.docs[0].ref.set({ ...details, authors: details.authors ?? FieldValue.delete() }, { merge: true })
          await Promise.all(sistemaIds.map((id) => db.collection('sistemas').doc(id).update({ maps: FieldValue.arrayUnion(mapId) })))
        }
        counts.updated++
        continue
      }

      const file = path.join(csvDir, row.image)
      const contentType = CONTENT_TYPES[path.extname(file).toLowerCase()]
      if (!contentType) throw new Error(`unsupported file type ${path.extname(file)}`)
      const mapId = pushId()
      const storagePath = `maps/${mapId}`
      console.log(`${label}: upload as ${mapId}, attach to ${sistemaIds.length} sistema(s): ${row.sistemaNames}`)
      if (argv.apply) {
        const token = randomUUID()
        await bucket.file(storagePath).save(readFileSync(file), { metadata: { contentType, metadata: { firebaseStorageDownloadTokens: token } } })
        await db.collection('maps').doc(mapId).set({ ...details, url: downloadUrl(storagePath, token), contentType, importKey, importSource: row.source })
        await Promise.all(sistemaIds.map((id) => db.collection('sistemas').doc(id).update({ maps: FieldValue.arrayUnion(mapId) })))
      }
      counts.uploaded++
    } catch (error) {
      console.error(`${label}: FAILED - ${error.message}`)
      counts.failed++
    }
  }
  console.log(`\n${argv.apply ? 'Done' : 'Would do'}: ${counts.uploaded} uploaded, ${counts.updated} already there (updated), ${counts.failed} failed`)
}

async function undo() {
  const imported = await db.collection('maps').where('importKey', '!=', null).get()
  console.log(`${imported.size} imported maps to remove (${mode})`)
  for (const doc of imported.docs) {
    const linked = await db.collection('sistemas').where('maps', 'array-contains', doc.id).get()
    console.log(`  ${doc.data().name} (${doc.id}): document, files, ${linked.size} sistema link(s)`)
    if (!argv.apply) continue
    await Promise.all(linked.docs.map((sistema) => sistema.ref.update({ maps: FieldValue.arrayRemove(doc.id) })))
    // The upload and the function's derived WebPs.
    await Promise.all([`maps/${doc.id}`, `maps/derived/${doc.id}_view.webp`, `maps/derived/${doc.id}_thumb.webp`].map((p) => bucket.file(p).delete({ ignoreNotFound: true })))
    await doc.ref.delete()
  }
}

await (argv.undo ? undo() : upload())

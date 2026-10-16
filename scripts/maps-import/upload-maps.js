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
// Maps with no sistema are skipped (nothing would show them). A map later
// found to be a copy of another (duplicates.csv) is retired: its sistema
// links move to the kept copy, then it's deleted.
//
// A dry run by default: --apply to write. --undo removes everything an
// import added (documents, files, sistema links).
//
// A row with a mapId and no image attaches that existing map to its
// sistema(s) instead of uploading one. New maps get their file's SHA-256
// (contentHash, the app's duplicate check). In production, the changes are
// credited to an account (--as <email>) with their audit log entries
// (scripts/lib/audit.js), so What's new shows them and they can be undone.

import { createHash, randomUUID } from 'node:crypto'
import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import pushId from 'unique-push-id'
import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'
import { initializeApp, applicationDefault } from 'firebase-admin/app'
import { getFirestore, FieldValue } from 'firebase-admin/firestore'
import { getStorage } from 'firebase-admin/storage'
import { readWorkbook, mapCredits, toPartialDate } from './explorations-workbook.js'
import { accountUid, auditWriter, updateEntry } from '../lib/audit.js'

const PROJECT_ID = 'opencaves'
const BUCKET = 'opencaves.appspot.com'
const CONTENT_TYPES = { '.webp': 'image/webp', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.svg': 'image/svg+xml' }

const cli = yargs(hideBin(process.argv))
  .usage('Upload the extracted maps and attach them to their sistemas.\n\nUsage: $0 [options]')
  .option('csv', { type: 'string', default: '_data/maps-import/matched.csv', describe: 'The maps to upload (matched.csv or a reviewed copy); image paths are relative to its folder' })
  .option('production', { alias: 'p', type: 'boolean', default: false, describe: 'The real opencaves project instead of the local emulators (needs `gcloud auth application-default login`)' })
  .option('apply', { type: 'boolean', default: false, describe: 'Actually write; without it, only print what would be done' })
  .option('limit', { type: 'number', describe: 'Only the first N maps (to try a few first)' })
  .option('only', { type: 'string', describe: 'Only maps whose name or file contains this text' })
  .option('undo', { type: 'boolean', default: false, describe: 'Remove every imported map (documents, files, sistema links) instead' })
  .option('local', { alias: 'l', type: 'boolean', describe: 'The local emulators - the default, named to run with no other option' })
  .option('as', { type: 'string', describe: 'The account the changes are credited to in the audit log (its email); required to write to production' })
  .check((args) => !(args.local && args.production) || 'Use --local or --production, not both')
  .check((args) => !(args.production && args.apply && !args.undo && !args.as) || 'Give --as <email> to write to production (the audit log credits that account)')
  .example('$0 -l', 'Dry run against the local emulators')
  .example('$0 --apply --limit 5', 'Upload the first 5 maps locally')
  .example('$0 -p --apply --as me@example.org', 'Upload everything to production, credited to that account')
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
}
initializeApp({ projectId: PROJECT_ID, storageBucket: BUCKET, ...(argv.production && { credential: applicationDefault() }) })
const db = getFirestore()
const bucket = getStorage().bucket()
const mode = `${argv.production ? 'PRODUCTION' : 'local emulators'}${argv.apply ? '' : ' - dry run, nothing written (--apply to write)'}`
const audit = auditWriter(db, { production: argv.production, uid: argv.as ? await accountUid(argv.as) : null })

// A map added to a sistema's list (arrayUnion: nothing else of it written),
// with its audit entry - when it isn't there already.
async function attach(sistemaId, mapId) {
  const ref = db.collection('sistemas').doc(sistemaId)
  const snap = await ref.get()
  if (!snap.exists) throw new Error(`no sistema ${sistemaId}`)
  const maps = snap.get('maps') || []
  if (maps.includes(mapId)) return false
  if (argv.apply) {
    await ref.update({ maps: FieldValue.arrayUnion(mapId) })
    await audit(updateEntry('sistemas', sistemaId, { maps: snap.get('maps') }, { maps: [...maps, mapId] }))
  }
  return true
}

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
// The credits read off the map (explorations.xlsx, next to the CSV) come
// before the publication's, so a rerun keeps what import-explorations.js set.
function mapDetails(row, credits) {
  const credit = credits.get(row.image)
  const name = row.name || row.mapName
  const date = row.date ?? (credit?.date && toPartialDate(credit.date).date) ?? row.publicationYear
  const authors = row.authors ? list(row.authors) : credit?.authors ?? []
  const note = row.note ?? row.publications
  return { name, ...(date && { date }), ...(authors.length && { authors }), ...(note && { note }) }
}

async function upload() {
  const csvDir = path.dirname(argv.csv)
  const workbook = path.join(csvDir, 'explorations.xlsx')
  const credits = existsSync(workbook) ? mapCredits(await readWorkbook(workbook)) : new Map()
  let rows = readCsv(argv.csv).filter((row) => (row.image || row.mapId) && list(row.sistemaIds).length && (row.include ?? 'yes').toLowerCase() !== 'no')
  if (argv.only) rows = rows.filter((row) => `${row.name || row.mapName} ${row.image} ${row.source}`.toLowerCase().includes(argv.only.toLowerCase()))
  if (argv.limit) rows = rows.slice(0, argv.limit)
  console.log(`${rows.length} maps to import (${mode})`)

  const counts = { uploaded: 0, updated: 0, failed: 0 }
  for (const [index, row] of rows.entries()) {
    const label = `[${index + 1}/${rows.length}] ${row.name || row.mapName} (${row.image})`
    try {
      // An existing map, attached to more sistemas.
      if (row.mapId && !row.image) {
        const map = await db.collection('maps').doc(row.mapId).get()
        if (!map.exists || map.get('deletedAt')) throw new Error(`no map ${row.mapId}`)
        const added = []
        for (const id of list(row.sistemaIds)) if (await attach(id, row.mapId)) added.push(id)
        console.log(`${label}: existing map ${row.mapId}${added.length ? ` attached to ${row.sistemaNames}` : ', already attached'}`)
        counts.updated++
        continue
      }
      const importKey = row.sha1
      const details = mapDetails(row, credits)
      const sistemaIds = list(row.sistemaIds)
      const existing = await db.collection('maps').where('importKey', '==', importKey).limit(1).get()

      if (!existing.empty) {
        const mapId = existing.docs[0].id
        // Sistemas linked to it that the CSV no longer lists (a corrected match).
        const stale = (await db.collection('sistemas').where('maps', 'array-contains', mapId).get()).docs.filter((doc) => !sistemaIds.includes(doc.id))
        console.log(`${label}: already imported as ${mapId} - details and links updated${stale.length ? `, unlinked from ${stale.map((doc) => doc.data().name).join(', ')}` : ''}`)
        if (argv.apply) {
          const before = existing.docs[0].data()
          await existing.docs[0].ref.set({ ...details, authors: details.authors ?? FieldValue.delete() }, { merge: true })
          const after = Object.fromEntries(Object.entries({ ...details, authors: details.authors ?? null }).filter(([k, v]) => JSON.stringify(before[k] ?? null) !== JSON.stringify(v ?? null)))
          if (Object.keys(after).length) await audit(updateEntry('maps', mapId, before, after))
          for (const id of sistemaIds) await attach(id, mapId)
          for (const doc of stale) {
            await doc.ref.update({ maps: FieldValue.arrayRemove(mapId) })
            await audit(updateEntry('sistemas', doc.id, { maps: doc.get('maps') }, { maps: (doc.get('maps') || []).filter((m) => m !== mapId) }))
          }
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
        const bytes = readFileSync(file)
        await bucket.file(storagePath).save(bytes, { metadata: { contentType, metadata: { firebaseStorageDownloadTokens: token } } })
        const record = { ...details, url: downloadUrl(storagePath, token), contentType, contentHash: createHash('sha256').update(bytes).digest('hex'), importKey, importSource: row.source }
        await db.collection('maps').doc(mapId).set(record)
        await audit({ action: 'create', collection: 'maps', docId: mapId, after: record })
        for (const id of sistemaIds) await attach(id, mapId)
      }
      counts.uploaded++
    } catch (error) {
      console.error(`${label}: FAILED - ${error.message}`)
      counts.failed++
    }
  }
  const retired = argv.only || argv.limit ? 0 : await retireDuplicates(csvDir)
  const excluded = argv.only || argv.limit ? 0 : await removeExcluded()
  console.log(`\n${argv.apply ? 'Done' : 'Would do'}: ${counts.uploaded} uploaded, ${counts.updated} already there (updated), ${retired} duplicate(s) retired, ${excluded} excluded map(s) removed, ${counts.failed} failed`)
}

// Maps imported earlier that the CSV now excludes (include=no, e.g. from
// map-overrides.csv): unlinked from their sistemas and deleted.
async function removeExcluded() {
  let removed = 0
  for (const row of readCsv(argv.csv).filter((r) => r.sha1 && (r.include ?? '').toLowerCase() === 'no')) {
    for (const doc of (await db.collection('maps').where('importKey', '==', row.sha1).get()).docs) {
      const linked = await db.collection('sistemas').where('maps', 'array-contains', doc.id).get()
      console.log(`${row.image} (${doc.id}): excluded - unlinked from ${linked.size} sistema(s) and deleted`)
      if (argv.apply) {
        await Promise.all(linked.docs.map((sistema) => sistema.ref.update({ maps: FieldValue.arrayRemove(doc.id) })))
        await removeMapFiles(doc.id)
        await doc.ref.delete()
      }
      removed++
    }
  }
  return removed
}

// Copies found to be duplicates after they were imported (duplicates.csv,
// from extract_maps.py, next to the CSV): each one's sistema links move to
// the copy that was kept, then it's deleted - document and files.
async function retireDuplicates(csvDir) {
  const file = path.join(csvDir, 'duplicates.csv')
  if (!existsSync(file)) return 0
  const keptKeys = new Map(readCsv(argv.csv).map((row) => [row.image, row.sha1]))
  let retired = 0
  for (const dup of readCsv(file).filter((row) => row.sha1)) {
    const imported = await db.collection('maps').where('importKey', '==', dup.sha1).get()
    if (imported.empty) continue
    const keeperKey = keptKeys.get(dup.keptImage)
    const keeper = keeperKey && await db.collection('maps').where('importKey', '==', keeperKey).limit(1).get()
    if (!keeper || keeper.empty) {
      console.log(`${dup.image}: a duplicate of ${dup.keptImage}, which isn't imported - left in place`)
      continue
    }
    const keeperId = keeper.docs[0].id
    for (const doc of imported.docs) {
      const linked = await db.collection('sistemas').where('maps', 'array-contains', doc.id).get()
      console.log(`${dup.image} (${doc.id}): a duplicate of ${dup.keptImage} (${keeperId}) - ${linked.size} sistema link(s) moved to it, then deleted`)
      if (argv.apply) {
        // Two writes: one update can't both arrayUnion and arrayRemove the same field.
        await Promise.all(linked.docs.map((sistema) => sistema.ref.update({ maps: FieldValue.arrayUnion(keeperId) })))
        await Promise.all(linked.docs.map((sistema) => sistema.ref.update({ maps: FieldValue.arrayRemove(doc.id) })))
        await removeMapFiles(doc.id)
        await doc.ref.delete()
      }
      retired++
    }
  }
  return retired
}

// The upload and the function's derived WebPs.
function removeMapFiles(mapId) {
  return Promise.all([`maps/${mapId}`, `maps/derived/${mapId}_view.webp`, `maps/derived/${mapId}_thumb.webp`].map((p) => bucket.file(p).delete({ ignoreNotFound: true })))
}

async function undo() {
  const imported = await db.collection('maps').where('importKey', '!=', null).get()
  console.log(`${imported.size} imported maps to remove (${mode})`)
  for (const doc of imported.docs) {
    const linked = await db.collection('sistemas').where('maps', 'array-contains', doc.id).get()
    console.log(`  ${doc.data().name} (${doc.id}): document, files, ${linked.size} sistema link(s)`)
    if (!argv.apply) continue
    await Promise.all(linked.docs.map((sistema) => sistema.ref.update({ maps: FieldValue.arrayRemove(doc.id) })))
    await removeMapFiles(doc.id)
    await doc.ref.delete()
  }
}

await (argv.undo ? undo() : upload())

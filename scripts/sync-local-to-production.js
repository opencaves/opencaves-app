#!/usr/bin/env node
// Makes production's cave data match the local emulator's: the collections
// the Google Sheet migration used to write (caves, sistemas, connections,
// accesses, accessibilities, sources, areas, colors, languages). Every local
// document is written to production as it is; production documents that no
// longer exist locally are deleted - production becomes a mirror of local.
// Photos, maps, users' data and Auth are not touched, nor the fields in
// KEEP_FROM_PRODUCTION (a sistema's list of maps).
//
// Documents are copied through the Firestore REST API in their typed form,
// so every value (timestamps, maps, arrays...) arrives exactly as it is
// locally. A dry run by default: --apply to write. Production access needs
// `gcloud auth application-default login`.
import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'
import { GoogleAuth } from 'google-auth-library'

const PROJECT_ID = 'opencaves'
const COLLECTIONS = ['caves', 'sistemas', 'connections', 'accesses', 'accessibilities', 'sources', 'areas', 'colors', 'languages']
const LOCAL = `http://${process.env.FIRESTORE_EMULATOR_HOST || '127.0.0.1:8080'}/v1/projects/${PROJECT_ID}/databases/(default)/documents`
const PRODUCTION = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents`
// Fields kept from production: they point to documents that exist
// separately in each database, with different ids (a sistema's maps were
// uploaded to each by its own run of upload-maps.js).
const KEEP_FROM_PRODUCTION = { sistemas: ['maps'] }
// Firestore accepts up to 500 writes per commit.
const BATCH = 400

const argv = yargs(hideBin(process.argv))
  .usage('Make production\'s cave data match the local emulator\'s.\n\nUsage: $0 [options]')
  .option('apply', { type: 'boolean', default: false, describe: 'Actually write to production; without it, only report what would change' })
  .option('only', { type: 'array', string: true, choices: COLLECTIONS, describe: 'Only these collections' })
  .example('$0', 'Dry run: what would change in production')
  .example('$0 --apply', 'Update production')
  .example('$0 --only caves sistemas --apply', 'Only the caves and sistemas')
  .help()
  .alias('help', 'h')
  .strict()
  .parseSync()

const auth = new GoogleAuth({ scopes: ['https://www.googleapis.com/auth/datastore'] })
let token

async function request(url, options = {}, production = true) {
  if (production && !token) token = await auth.getAccessToken()
  const response = await fetch(url, {
    ...options,
    headers: { 'Content-Type': 'application/json', Authorization: production ? `Bearer ${token}` : 'Bearer owner', ...options.headers },
  })
  if (!response.ok) throw new Error(`${options.method || 'GET'} ${url}: ${response.status} ${await response.text()}`)
  return response.json()
}

// Every document of a collection: { id: fields } (typed REST values).
async function readAll(base, collection, production) {
  const documents = new Map()
  let pageToken = ''
  do {
    const page = await request(`${base}/${collection}?pageSize=1000${pageToken ? `&pageToken=${encodeURIComponent(pageToken)}` : ''}`, {}, production)
    for (const doc of page.documents || []) documents.set(doc.name.split('/').pop(), doc.fields || {})
    pageToken = page.nextPageToken
  } while (pageToken)
  return documents
}

// Order-independent comparison of two documents' typed fields.
function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical)
  if (value && typeof value === 'object') return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonical(value[key])]))
  return value
}
const same = (a, b) => JSON.stringify(canonical(a)) === JSON.stringify(canonical(b))

async function commit(writes) {
  for (let i = 0; i < writes.length; i += BATCH) {
    await request(`${PRODUCTION}:commit`, { method: 'POST', body: JSON.stringify({ writes: writes.slice(i, i + BATCH) }) })
  }
}

async function main() {
  const collections = argv.only?.length ? argv.only : COLLECTIONS
  console.log(`Local emulator -> PRODUCTION${argv.apply ? '' : ' (dry run, nothing written - --apply to write)'}`)
  const totals = { added: 0, updated: 0, deleted: 0, unchanged: 0 }
  for (const collection of collections) {
    const [local, production] = await Promise.all([readAll(LOCAL, collection, false), readAll(PRODUCTION, collection, true)])
    if (local.size === 0) {
      // An empty local collection would wipe production's: almost certainly
      // an emulator that didn't load its data.
      console.log(`  ${collection}: empty locally - skipped (is the emulator running with its data?)`)
      continue
    }
    const writes = []
    const counts = { added: 0, updated: 0, deleted: 0, unchanged: 0 }
    const keep = KEEP_FROM_PRODUCTION[collection] || []
    for (const [id, localFields] of local) {
      const fields = { ...localFields }
      for (const key of keep) {
        delete fields[key]
        if (production.get(id)?.[key] !== undefined) fields[key] = production.get(id)[key]
      }
      if (!production.has(id)) counts.added++
      else if (same(fields, production.get(id))) { counts.unchanged++; continue }
      else counts.updated++
      writes.push({ update: { name: `projects/${PROJECT_ID}/databases/(default)/documents/${collection}/${id}`, fields } })
    }
    for (const id of production.keys()) {
      if (!local.has(id)) {
        counts.deleted++
        writes.push({ delete: `projects/${PROJECT_ID}/databases/(default)/documents/${collection}/${id}` })
      }
    }
    console.log(`  ${collection}: ${counts.added} to add, ${counts.updated} to update, ${counts.deleted} to delete, ${counts.unchanged} unchanged`)
    if (argv.apply && writes.length) await commit(writes)
    for (const key of Object.keys(totals)) totals[key] += counts[key]
  }
  console.log(`${argv.apply ? 'Done' : 'Would do'}: ${totals.added} added, ${totals.updated} updated, ${totals.deleted} deleted, ${totals.unchanged} unchanged`)
}

main().catch((error) => {
  console.error('Sync failed:', error.message)
  process.exitCode = 1
})

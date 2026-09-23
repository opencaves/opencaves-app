// One-time (re-runnable) migration: fetches the live Google Sheet data and
// writes it into Firestore, using the existing sheet-derived IDs as literal
// Firestore document IDs.

import pushId from 'unique-push-id'
import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'
import { initializeApp, applicationDefault } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import { getCaveData } from '../src/services/data-service/dataImporter.js'
import { processDataForStorage } from '../src/services/data-service/dataProcessor.js'

const PROJECT_ID = 'opencaves'
const WRITE_BATCH_SIZE = 500

const argv = yargs(hideBin(process.argv))
  .usage('Fetch the live Google Sheet data and write it into Firestore.\n\nUsage: $0 [options]')
  .option('production', {
    alias: 'p',
    type: 'boolean',
    default: false,
    describe: 'Write to the real opencaves Firestore project instead of the local emulator (requires Application Default Credentials for a service account with Firestore access)'
  })
  .example('$0', 'Run against the local emulator (FIRESTORE_EMULATOR_HOST must be set)')
  .example('$0 --production', 'Run against the real opencaves Firestore project')
  .help()
  .alias('help', 'h')
  .strict()
  .parseSync()

const isProd = argv.production

if (!isProd && !process.env.FIRESTORE_EMULATOR_HOST) {
  console.error(
    'Refusing to run: no FIRESTORE_EMULATOR_HOST set and --production was not passed.\n' +
    'Either start the emulator (`npm run dev` or `firebase emulators:start`) and set\n' +
    'FIRESTORE_EMULATOR_HOST=127.0.0.1:8080, or pass --production/-p to write to the real\n' +
    'project (requires Application Default Credentials for a service account with\n' +
    'Firestore access).'
  )
  process.exit(1)
}

if (isProd) {
  initializeApp({ credential: applicationDefault(), projectId: PROJECT_ID })
} else {
  initializeApp({ projectId: PROJECT_ID })
}

const db = getFirestore()
// getAccesses()/getAccessibilities()/getSources()/getAreas() always include a
// `note` key, undefined when the sheet's Note column is empty for that row -
// same "absent optional field" convention as everywhere else in this data,
// just not filtered out by an `optional()`-style call. Treat it the same way
// here instead of pre-filtering every record by hand.
db.settings({ ignoreUndefinedProperties: true })

// [collectionName, getIdForDoc, getRecords]
function collectionsToWrite(data) {
  return [
    ['caves', (cave) => cave.id, () => data.caves],
    ['sistemas', (sistema) => sistema.id, () => data.sistemas],
    ['connections', (connection) => connection.id, () => data.connections],
    ['accesses', (access) => access.id, () => data.accesses],
    ['accessibilities', (accessibility) => accessibility.id, () => data.accessibilities],
    ['sources', (source) => source.id, () => data.sources],
    ['areas', (area) => area.id, () => data.areas],
    ['colors', () => pushId(), () => data.colors],
    ['languages', (language) => language.code, () => data.languages],
  ]
}

async function writeCollection(collectionName, getId, records) {
  let written = 0

  for (let i = 0; i < records.length; i += WRITE_BATCH_SIZE) {
    const batch = db.batch()
    const chunk = records.slice(i, i + WRITE_BATCH_SIZE)

    chunk.forEach((record) => {
      const { id, ...fields } = record
      batch.set(db.collection(collectionName).doc(getId(record)), fields)
    })

    await batch.commit()
    written += chunk.length
  }

  console.log(`  ${collectionName}: wrote ${written} document(s)`)
}

async function main() {
  console.log(`Fetching data from the Google Sheet...`)
  const rawData = await getCaveData()

  console.log('Processing into storage shape...')
  const data = processDataForStorage(rawData)

  console.log(`Writing to Firestore project '${PROJECT_ID}' (${isProd ? 'PRODUCTION' : 'emulator'})...`)

  for (const [collectionName, getId, getRecords] of collectionsToWrite(data)) {
    await writeCollection(collectionName, getId, getRecords())
  }

  console.log('Done.')
}

main().catch((error) => {
  console.error('Migration failed:', error)
  process.exitCode = 1
})

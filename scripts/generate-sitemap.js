import { writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { initializeApp, applicationDefault } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'

const SITE_URL = 'https://opencaves.org'
const PROJECT_ID = 'opencaves'

const isProd = process.argv.includes('--prod')

if (!isProd && !process.env.FIRESTORE_EMULATOR_HOST) {
  console.error(
    'Refusing to run: no FIRESTORE_EMULATOR_HOST set and --prod was not passed.\n' +
    'Either start the emulator and set FIRESTORE_EMULATOR_HOST=127.0.0.1:8080, or pass\n' +
    '--prod to read from the real project (requires Application Default Credentials).'
  )
  process.exit(1)
}

initializeApp(isProd ? { credential: applicationDefault(), projectId: PROJECT_ID } : { projectId: PROJECT_ID })
const db = getFirestore()

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const outputPath = path.resolve(__dirname, '../public/sitemap.xml')

function escapeXml(value) {
  return value.replace(/[<>&'"]/g, (char) => ({
    '<': '&lt;',
    '>': '&gt;',
    '&': '&amp;',
    "'": '&apos;',
    '"': '&quot;',
  })[char])
}

function buildSitemap(urls) {
  const urlEntries = urls
    .map((loc) => `  <url>\n    <loc>${escapeXml(loc)}</loc>\n  </url>`)
    .join('\n')

  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urlEntries}\n</urlset>\n`
}

async function main() {
  const caveRefs = await db.collection('caves').listDocuments()
  const caveIds = caveRefs.map((ref) => ref.id)

  const urls = [
    `${SITE_URL}/`,
    `${SITE_URL}/map`,
    ...caveIds.map((id) => `${SITE_URL}/map/${id}`),
  ]

  const xml = buildSitemap(urls)

  await writeFile(outputPath, xml, 'utf8')

  console.log(`Sitemap generated with ${urls.length} routes (${caveIds.length} cenotes) at ${outputPath}`)
}

main().catch((error) => {
  console.error('Failed to generate sitemap:', error)
  process.exitCode = 1
})

import { writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { getCaveData } from '../src/services/data-service/dataImporter.js'

const SITE_URL = 'https://opencaves.org'

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
  const data = await getCaveData()

  const caveIds = data.caves
    .map((cave) => cave.id?.trim())
    .filter(Boolean)

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

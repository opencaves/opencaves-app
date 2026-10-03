#!/usr/bin/env node
// Builds the cave layer's vector tiles from the traced maps, for the app
// (served by Firebase Hosting from public/tiles/caves/{z}/{x}/{y}.pbf).
//
// Every placed map (maps/*.json without "unverified") contributes its traced
// output from _data/map-layer/scans/: walls, survey lines, water and drawn
// details (<map>-walls.geojson, or <map>.geojson for a vector map) to the
// "passages" tile layer, and its typed symbols (<map>-symbols.geojson:
// depths, restrictions, flow, entrances...) to the "symbols" layer. Each
// feature keeps its map's id ("map": the config's "id", assign-ids.js), its sistema ("sistemaId": the app
// filters and colours by it, colours from the database) and its kind or type.
// maps.json lists the maps in the tiles by id, with their config file's name,
// title, date, sistema, scan (mapImportKey: the "maps" document's importKey)
// and extent (center, bounds)
// (the layer's edit mode names the map under the pointer), and the image it
// was traced from as laid on the ground ("scan": its four corners; the image
// is scans/<id>.webp, from georef_scans.py - the admin's original-vs-drawing
// viewer).
//
// Runs tippecanoe in Docker (image opencaves-tippecanoe, built from
// tippecanoe.Dockerfile when missing). The tiles are build output: not in git,
// rebuilt when a map changes (npm run build:tiles), copied into build/ by
// `npm run build`.
import { execFileSync } from 'node:child_process'
import { cpSync, createWriteStream, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'

const ROOT = path.resolve(import.meta.dirname, '../..')
const MAPS = path.join(import.meta.dirname, 'maps')
const SCANS = path.join(ROOT, '_data/map-layer/scans')
// The maps' images laid on the ground (georef_scans.py), kept between builds.
const GEOREF = path.join(ROOT, '_data/map-layer/georef')
const OUT = path.join(ROOT, 'public/tiles/caves')
const IMAGE = 'opencaves-tippecanoe'
// Zooms: the whole region's walls from MIN_ZOOM; drawn details and symbols
// only once passages are wide enough on screen to hold them.
const MIN_ZOOM = 10
const MAX_ZOOM = 18
const DETAIL_ZOOM = 15
const SYMBOL_ZOOM = 16

const cli = yargs(hideBin(process.argv))
  .usage('$0 --build | --check\n\nBuilds the cave layer\'s vector tiles (public/tiles/caves) from the traced maps.')
  .option('build', { alias: 'b', type: 'boolean', default: false, describe: 'Build the tiles (needs Docker running)' })
  .option('check', { type: 'boolean', default: false, describe: 'Only warn when the tiles are missing (for npm run build)' })
  .help()
  .alias('help', 'h')
  .strict()

// No arguments: the help, not a run.
if (hideBin(process.argv).length === 0) {
  cli.showHelp()
  process.exit(0)
}
const argv = cli.parseSync()

if (argv.check) {
  if (!existsSync(path.join(OUT, 'metadata.json'))) {
    console.warn('\n[tiles] public/tiles/caves is missing: the cave layer will be empty. Run `npm run build:tiles` (needs _data/ and Docker).\n')
  }
  process.exit(0)
}

// Inputs, as line-delimited GeoJSON in a temp folder mounted into Docker.
const work = path.join(os.tmpdir(), 'opencaves-tiles')
rmSync(work, { recursive: true, force: true })
mkdirSync(work, { recursive: true })
const passages = createWriteStream(path.join(work, 'passages.geojsonl'))
const symbols = createWriteStream(path.join(work, 'symbols.geojsonl'))
const counts = { maps: 0, passages: 0, symbols: 0, unverified: 0, untraced: 0 }
const mapIndex = {}

for (const file of readdirSync(MAPS).filter((f) => f.endsWith('.json')).sort()) {
  const name = file.slice(0, -5)
  const config = JSON.parse(readFileSync(path.join(MAPS, file), 'utf8'))
  if (config.unverified) {
    counts.unverified++
    continue
  }
  const traced = [`${name}-walls.geojson`, `${name}.geojson`].map((f) => path.join(SCANS, f)).find(existsSync)
  if (!traced) {
    counts.untraced++
    continue
  }
  if (!config.id) {
    console.error(`[tiles] ${file} has no "id": run node scripts/map-layer/assign-ids.js --write first.`)
    process.exit(1)
  }
  counts.maps++
  const id = config.id
  mapIndex[id] = { name, title: config.title || name, ...(config.date && { date: config.date }), ...(config.sistemaId && { sistemaId: config.sistemaId }), ...(config.mapImportKey && { mapImportKey: config.mapImportKey }) }
  const sistema = config.sistemaId ? { sistemaId: config.sistemaId } : {}
  // The drawing's extent, for its centre (the admin's map layers page links
  // to it on the map).
  const box = [Infinity, Infinity, -Infinity, -Infinity]
  const extend = (c) => (typeof c[0] === 'number' ? ((box[0] = Math.min(box[0], c[0])), (box[1] = Math.min(box[1], c[1])), (box[2] = Math.max(box[2], c[0])), (box[3] = Math.max(box[3], c[1]))) : c.forEach(extend))
  for (const feature of JSON.parse(readFileSync(traced, 'utf8')).features) {
    if (feature.geometry?.coordinates) extend(feature.geometry.coordinates)
    // "survey" is the Arianne line's former kind name (outputs traced before).
    const kind = feature.properties?.kind === 'survey' ? 'arianne' : feature.properties?.kind || 'wall'
    passages.write(`${JSON.stringify({ type: 'Feature', geometry: feature.geometry, properties: { map: id, ...sistema, kind }, tippecanoe: { minzoom: ['detail', 'relief', 'slope'].includes(kind) ? DETAIL_ZOOM : MIN_ZOOM } })}\n`)
    counts.passages++
  }
  if (Number.isFinite(box[0])) {
    mapIndex[id].center = [+((box[0] + box[2]) / 2).toFixed(5), +((box[1] + box[3]) / 2).toFixed(5)]
    mapIndex[id].bounds = box.map((v) => +v.toFixed(5))
  }
  const symbolFile = path.join(SCANS, `${name}-symbols.geojson`)
  if (existsSync(symbolFile)) {
    for (const feature of JSON.parse(readFileSync(symbolFile, 'utf8')).features) {
      const p = feature.properties || {}
      const properties = { map: id, ...sistema, type: p.type, ...(p.label && { label: p.label }), ...(p.name && { name: p.name }), ...(p.value != null && { value: p.value }), ...(p.bearing != null && { bearing: p.bearing }) }
      symbols.write(`${JSON.stringify({ type: 'Feature', geometry: feature.geometry, properties, tippecanoe: { minzoom: p.type === 'entrance' ? MIN_ZOOM : SYMBOL_ZOOM } })}\n`)
      counts.symbols++
    }
  }
}
await Promise.all([passages, symbols].map((stream) => new Promise((resolve) => stream.end(resolve))))
console.log(`[tiles] ${counts.maps} maps (${counts.unverified} unverified and ${counts.untraced} untraced left out): ${counts.passages} passage features, ${counts.symbols} symbols`)

const docker = (args) => execFileSync('docker', args, { stdio: 'inherit' })
try {
  execFileSync('docker', ['image', 'inspect', IMAGE], { stdio: 'ignore' })
} catch {
  console.log(`[tiles] building the ${IMAGE} image (once)...`)
  docker(['build', '-t', IMAGE, '-f', path.join(import.meta.dirname, 'tippecanoe.Dockerfile'), import.meta.dirname])
}
docker(['run', '--rm', '-v', `${work}:/data`, IMAGE, 'tippecanoe',
  '--output-to-directory=/data/tiles', '--force', '--no-tile-compression',
  `--minimum-zoom=${MIN_ZOOM}`, `--maximum-zoom=${MAX_ZOOM}`,
  // Dense maps at low zooms: the busiest features thinned rather than tiles refused.
  '--drop-densest-as-needed', '--simplification=4', '--quiet',
  '--named-layer=passages:/data/passages.geojsonl', '--named-layer=symbols:/data/symbols.geojsonl'])

rmSync(OUT, { recursive: true, force: true })
mkdirSync(path.dirname(OUT), { recursive: true })
cpSync(path.join(work, 'tiles'), OUT, { recursive: true })
rmSync(work, { recursive: true, force: true })
// The tiles that exist, as "z/x/y": empty ones have no file, and Hosting
// answers a missing file with the app's index.html (its catch-all rewrite),
// so the app asks only for these.
const tiles = readdirSync(OUT, { recursive: true }).filter((f) => f.endsWith('.pbf')).map((f) => f.replaceAll(path.sep, '/').replace(/\.pbf$/, '')).sort()
writeFileSync(path.join(OUT, 'index.json'), JSON.stringify(tiles))
// The maps' images on the ground (Python, like the tracing scripts).
execFileSync('python', [path.join(import.meta.dirname, 'georef_scans.py'), GEOREF], { stdio: 'inherit' })
mkdirSync(path.join(OUT, 'scans'))
for (const id of Object.keys(mapIndex)) {
  const corners = path.join(GEOREF, `${id}.json`)
  if (!existsSync(corners)) continue
  cpSync(path.join(GEOREF, `${id}.webp`), path.join(OUT, 'scans', `${id}.webp`))
  mapIndex[id].scan = JSON.parse(readFileSync(corners, 'utf8')).corners
}
writeFileSync(path.join(OUT, 'maps.json'), JSON.stringify(mapIndex))
// An empty tile (no layers), what the app gets for the tiles not listed.
writeFileSync(path.join(OUT, 'empty.pbf'), Buffer.alloc(0))
console.log(`[tiles] ${tiles.length} tiles -> ${path.relative(ROOT, OUT)}`)

#!/usr/bin/env node
// Gives each map config (maps/*.json) its stable identity, written into the
// file once and never changed:
//
// - "id": a push id (the database's id format), the drawing's key in the cave
//   layer - its tiles' "map" property, maps.json, the hidden drawings list
//   (settings/caveLayer.hiddenMaps) - so renaming a config file breaks nothing.
// - "mapImportKey": the importKey of the scan's document in the "maps"
//   collection, when the drawing was traced from an imported scan (its image,
//   or the original named by importImage / sourceImage / imageNote). The same in every
//   database, unlike the document's id; the app finds the document by it.
//   Several drawings can come from one scan (X-Koh's two loops).
//
// Re-runnable: only what's missing is added. Run it after adding a config,
// before `npm run build:tiles`.
import { readdirSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'

const MAPS = path.join(import.meta.dirname, 'maps')
const MATCHED = path.resolve(import.meta.dirname, '../../_data/maps-import/matched.csv')

const cli = yargs(hideBin(process.argv))
  .usage('$0 --dry-run | --write\n\nAdds the missing "id" and "mapImportKey" to the map configs (maps/*.json).')
  .option('dry-run', { type: 'boolean', default: false, describe: 'List what would be added' })
  .option('write', { type: 'boolean', default: false, describe: 'Write it into the configs' })
  .check((args) => {
    if (args.dryRun === args.write) throw new Error('Use exactly one of --dry-run or --write.')
    return true
  })
  .help()
  .alias('help', 'h')
  .strict()

// No arguments: the help, not a run.
if (hideBin(process.argv).length === 0) {
  cli.showHelp()
  process.exit(0)
}
const argv = cli.parseSync()

// Firebase's push ids: 8 characters of time, 12 random, sorting by creation.
const PUSH_CHARS = '-0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ_abcdefghijklmnopqrstuvwxyz'
let lastTime = 0
let lastRandom = []
function pushId() {
  let now = Date.now()
  const duplicateTime = now === lastTime
  lastTime = now
  let time = ''
  for (let i = 0; i < 8; i++) {
    time = PUSH_CHARS.charAt(now % 64) + time
    now = Math.floor(now / 64)
  }
  if (!duplicateTime) {
    lastRandom = Array.from({ length: 12 }, () => Math.floor(Math.random() * 64))
  } else {
    let i = 11
    for (; i >= 0 && lastRandom[i] === 63; i--) lastRandom[i] = 0
    lastRandom[i]++
  }
  return time + lastRandom.map((n) => PUSH_CHARS.charAt(n)).join('')
}

// The import's images (images/<file>) and their importKey (its sha1 column).
function readMatched() {
  const lines = readFileSync(MATCHED, 'utf8').replace(/^﻿/, '').split(/\r?\n/)
  const head = lines[0].split(',')
  const [image, sha1] = [head.indexOf('image'), head.indexOf('sha1')]
  const keys = new Map()
  for (const line of lines.slice(1)) {
    const cols = (line.match(/("(?:[^"]|"")*"|[^,]*)(?:,|$)/g) || []).map((c) => c.replace(/,$/, '').replace(/^"|"$/g, ''))
    if (cols[image] && cols[sha1]) keys.set(cols[image], cols[sha1])
  }
  return keys
}
const importKeys = readMatched()

// The imported scan a config was traced from: its importImage (when it was
// traced from a cleaned-up or straightened copy), its image, its sourceImage,
// or an import image named in its imageNote.
function importKeyOf(config) {
  const candidates = [config.importImage, config.image, config.sourceImage, ...(String(config.imageNote || '').match(/maps-import\/images\/[^\s,;)]+/g) || [])]
  for (const candidate of candidates) {
    const image = String(candidate || '').replace(/^.*maps-import\//, '')
    if (importKeys.has(image)) return importKeys.get(image)
  }
  return null
}

let added = 0
for (const file of readdirSync(MAPS).filter((f) => f.endsWith('.json')).sort()) {
  const filePath = path.join(MAPS, file)
  const raw = readFileSync(filePath, 'utf8')
  const config = JSON.parse(raw)
  const lines = []
  if (!config.id) lines.push(`"id": ${JSON.stringify(pushId())}`)
  const key = !config.mapImportKey && importKeyOf(config)
  if (key) lines.push(`"mapImportKey": ${JSON.stringify(key)}`)
  if (!lines.length) continue
  added++
  console.log(`${file}: ${lines.join(', ')}`)
  if (argv.write) {
    // First in the file, keeping its own formatting.
    const indent = (raw.match(/\n(\s+)"/) || [, '  '])[1]
    const updated = raw.replace(/^\{\r?\n/, (open) => open + lines.map((l) => `${indent}${l},\n`).join(''))
    JSON.parse(updated)
    writeFileSync(filePath, updated)
  }
}
console.log(`\n${added} config(s) ${argv.write ? 'updated' : 'to update (dry run)'}.`)

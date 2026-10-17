#!/usr/bin/env node
// Asks search engines to crawl opencaves.org's pages, two ways:
//
// --bing: the backlog, through the Bing Webmaster API's URL submission (a
// daily quota, 100 for this site): the sitemap's pages, the key pages first
// (the landing page, the lists, the map), then by popularity (_popularity:
// views, saves), each sent once - the ones already sent are skipped. Reads
// the API key from Secret Manager (BING_WEBMASTER_API_KEY, gcloud), unless
// BING_WEBMASTER_API_KEY is set (the environment, or the project's .env).
//
// --indexnow: the pages that changed, through IndexNow (Bing, Yandex and
// others; no daily quota to speak of): the sitemap's pages modified since
// --since (their lastmod), or --urls. The key is public by design: its file,
// public/<key>.txt, is on the site (deployed with Hosting).
//
// Production's site only (its sitemap and public data are only read). What
// was sent, and when, is kept in _data/search-submit.json (not in git): a
// page is sent to Bing once, unless --force. Nothing is sent without --send.
import path from 'node:path'
import { execSync } from 'node:child_process'
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const PROJECT_ID = 'opencaves'
const SITE = 'https://opencaves.org'
const HOST = 'opencaves.org'
// IndexNow's key: public/<key>.txt holds it (the protocol checks it there).
const INDEXNOW_KEY = 'f83c9fc978760122efda398ebbb0c286'
const LOG_FILE = path.join(ROOT, '_data', 'search-submit.json')
const BING_API = 'https://ssl.bing.com/webmaster/api.svc/json'
const FIRESTORE = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents`
// The pages sent first to Bing, in this order.
const KEY_PATHS = ['/', '/caves', '/sistemas', '/map']
// IndexNow takes up to 10,000 addresses a request.
const INDEXNOW_BATCH = 10000

try {
  process.loadEnvFile(path.join(ROOT, '.env'))
} catch {
  // No .env: BING_WEBMASTER_API_KEY from the environment, or Secret Manager.
}

const cli = yargs(hideBin(process.argv))
  .usage('$0 (--bing | --indexnow --since <YYYY-MM-DD> | --indexnow --urls <url,...>) (--dry-run | --send)\n\nAsks search engines to crawl opencaves.org: Bing\'s daily quota on the sitemap\'s pages not sent yet (--bing), or the pages that changed through IndexNow (--indexnow).')
  .option('bing', { type: 'boolean', default: false, describe: 'The next pages of the backlog, up to Bing\'s remaining daily quota' })
  .option('indexnow', { type: 'boolean', default: false, describe: 'The pages that changed, through IndexNow' })
  .option('since', { type: 'string', describe: 'With --indexnow: the sitemap\'s pages modified since this date (YYYY-MM-DD)' })
  .option('urls', { type: 'string', describe: 'With --indexnow: these addresses (comma-separated; on opencaves.org)' })
  .option('limit', { type: 'number', describe: 'With --bing: at most this many (below the quota)' })
  .option('force', { type: 'boolean', default: false, describe: 'With --bing: send pages already sent too' })
  .option('dry-run', { type: 'boolean', default: false, describe: 'List what would be sent' })
  .option('send', { type: 'boolean', default: false, describe: 'Send it' })
  .example('$0 --bing --dry-run', 'The next pages for Bing, and its quota')
  .example('$0 --bing --send', 'Send them')
  .example('$0 --indexnow --since 2026-10-17 --send', 'The pages changed since that day, through IndexNow')
  .help()
  .alias('h', 'help')
  .strict()

const argv = cli.parseSync()
if ((!argv.bing && !argv.indexnow) || argv.bing === argv.indexnow || argv.dryRun === argv.send) {
  cli.showHelp()
  process.exit(argv.bing || argv.indexnow ? 1 : 0)
}
if (argv.indexnow && !argv.since === !argv.urls) {
  console.error('--indexnow takes --since or --urls (one of them).')
  process.exit(1)
}
if (argv.since && !/^\d{4}-\d{2}-\d{2}$/.test(argv.since)) {
  console.error('--since: a date as YYYY-MM-DD.')
  process.exit(1)
}

function readLog() {
  try {
    return JSON.parse(readFileSync(LOG_FILE, 'utf8'))
  } catch {
    return { bing: {}, indexnow: {} }
  }
}

function writeLog(log) {
  mkdirSync(path.dirname(LOG_FILE), { recursive: true })
  writeFileSync(LOG_FILE, `${JSON.stringify(log, null, 2)}\n`)
}

// The sitemap's pages: { url, lastmod }.
async function sitemap() {
  const response = await fetch(`${SITE}/sitemap.xml`)
  if (!response.ok) throw new Error(`sitemap.xml: ${response.status}`)
  const xml = await response.text()
  return [...xml.matchAll(/<url>\s*<loc>([^<]+)<\/loc>(?:\s*<lastmod>([^<]+)<\/lastmod>)?/g)].map(([, url, lastmod]) => ({ url, lastmod: lastmod || null }))
}

// _popularity's numbers by record id ({ views, saves }), public.
async function popularity() {
  const score = {}
  for (const kind of ['caves', 'sistemas']) {
    const response = await fetch(`${FIRESTORE}/_popularity/${kind}`)
    if (!response.ok) continue
    const { fields = {} } = await response.json()
    for (const field of ['views', 'saves']) {
      for (const [id, value] of Object.entries(fields[field]?.mapValue?.fields || {})) score[id] = (score[id] || 0) + Number(value.integerValue || value.doubleValue || 0)
    }
  }
  return score
}

// The Bing Webmaster API key: BING_WEBMASTER_API_KEY if set, else the secret.
function bingKey() {
  if (process.env.BING_WEBMASTER_API_KEY) return process.env.BING_WEBMASTER_API_KEY.trim()
  try {
    return execSync(`gcloud secrets versions access latest --secret=BING_WEBMASTER_API_KEY --project=${PROJECT_ID}`, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim()
  } catch (error) {
    throw new Error(`The Bing key couldn't be read from Secret Manager (gcloud signed in, the BING_WEBMASTER_API_KEY secret created?), and BING_WEBMASTER_API_KEY isn't set: ${String(error.stderr || error.message).trim()}`)
  }
}

// The key, kept out of the messages: Bing's errors can echo the address.
async function bingCall(method, key, body) {
  const query = body ? `?apikey=${encodeURIComponent(key)}` : `?siteUrl=${encodeURIComponent(SITE)}&apikey=${encodeURIComponent(key)}`
  const response = await fetch(`${BING_API}/${method}${query}`, body ? { method: 'POST', headers: { 'content-type': 'application/json; charset=utf-8' }, body: JSON.stringify(body) } : {})
  const text = await response.text()
  if (!response.ok) throw new Error(`Bing ${method}: ${response.status} ${text.replaceAll(key, '<key>').slice(0, 300)}`)
  return text ? JSON.parse(text) : {}
}

async function runBing() {
  const log = readLog()
  const [pages, score] = await Promise.all([sitemap(), popularity()])
  const idOf = (url) => new URL(url).pathname.split('/')[2] || ''
  const keyRank = (url) => {
    const index = KEY_PATHS.indexOf(new URL(url).pathname.replace(/\/$/, '') || '/')
    return index < 0 ? KEY_PATHS.length : index
  }
  const ranked = pages
    .map(({ url }) => url)
    .filter((url) => argv.force || !log.bing[url])
    .sort((a, b) => keyRank(a) - keyRank(b) || (score[idOf(b)] || 0) - (score[idOf(a)] || 0))

  const key = bingKey()
  const quota = (await bingCall('GetUrlSubmissionQuota', key)).d || {}
  const room = Math.min(quota.DailyQuota ?? 0, argv.limit ?? Infinity)
  const batch = ranked.slice(0, room)
  console.log(`Bing: ${pages.length} pages in the sitemap, ${Object.keys(log.bing).length} sent before, ${ranked.length} to send; quota today ${quota.DailyQuota ?? '?'} (this month ${quota.MonthlyQuota ?? '?'}) -> ${batch.length} now`)
  batch.forEach((url, i) => console.log(`${String(i + 1).padStart(3)} ${url}`))
  if (argv.dryRun || batch.length === 0) {
    if (argv.dryRun) console.log('\ndry run: nothing sent (--send to send).')
    return
  }
  await bingCall('SubmitUrlBatch', key, { siteUrl: SITE, urlList: batch })
  const at = new Date().toISOString()
  for (const url of batch) log.bing[url] = at
  writeLog(log)
  console.log(`\nsent ${batch.length} to Bing (logged in _data/search-submit.json).`)
}

async function runIndexNow() {
  let urls
  if (argv.urls) {
    urls = argv.urls.split(',').map((url) => url.trim()).filter(Boolean)
    const foreign = urls.filter((url) => new URL(url).host !== HOST)
    if (foreign.length) throw new Error(`Not on ${HOST}: ${foreign.join(', ')}`)
  } else {
    urls = (await sitemap()).filter(({ lastmod }) => lastmod && lastmod >= argv.since).map(({ url }) => url)
  }
  console.log(`IndexNow: ${urls.length} page(s)${argv.since ? ` modified since ${argv.since}` : ''}`)
  urls.forEach((url) => console.log(`  ${url}`))
  if (argv.dryRun || urls.length === 0) {
    if (argv.dryRun) console.log('\ndry run: nothing sent (--send to send).')
    return
  }
  // The key's file must be on the site, or IndexNow refuses the request.
  const keyFile = await fetch(`${SITE}/${INDEXNOW_KEY}.txt`)
  if (!keyFile.ok || (await keyFile.text()).trim() !== INDEXNOW_KEY) throw new Error(`${SITE}/${INDEXNOW_KEY}.txt isn't on the site yet: deploy Hosting first.`)
  const log = readLog()
  for (let i = 0; i < urls.length; i += INDEXNOW_BATCH) {
    const urlList = urls.slice(i, i + INDEXNOW_BATCH)
    const response = await fetch('https://api.indexnow.org/indexnow', {
      method: 'POST',
      headers: { 'content-type': 'application/json; charset=utf-8' },
      body: JSON.stringify({ host: HOST, key: INDEXNOW_KEY, keyLocation: `${SITE}/${INDEXNOW_KEY}.txt`, urlList }),
    })
    // 200: received; 202: received, the key still being checked.
    if (response.status !== 200 && response.status !== 202) throw new Error(`IndexNow: ${response.status} ${(await response.text()).slice(0, 300)}`)
    const at = new Date().toISOString()
    for (const url of urlList) log.indexnow[url] = at
  }
  writeLog(log)
  console.log(`\nsent ${urls.length} through IndexNow (logged in _data/search-submit.json).`)
}

try {
  if (argv.bing) await runBing()
  else await runIndexNow()
} catch (error) {
  console.error(error.message)
  process.exit(1)
}

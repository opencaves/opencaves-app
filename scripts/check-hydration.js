#!/usr/bin/env node
// Checks the server-rendered public pages of a deployed site (the live one or
// a preview channel) in a real browser: /, /caves, /sistemas, a cave's page,
// a system's page, and a missing cave (404). For each page, in an English
// browser (the server renders the pages in English, and the app hydrates them
// only in the same language: src/index.jsx):
//
// - its HTTP status (200, 404 for the missing cave);
// - that the server rendered it (window.__OC_SSR__, html[data-oc-ssr]) and
//   that the app hydrated it - took over the server's HTML - to the end
//   (src/ssr/HydrationDone.jsx then drops window.__OC_SSR__.queries);
// - no page errors, and no console message about hydration (React's, or the
//   app's "[hydrate]" ones: index.jsx's onRecoverableError);
// - document.title after hydration the same as the server's <title>;
// - the response compressed (Content-Encoding br or gzip: the page functions
//   compress it themselves, functions/js/seo/shared.js's sendHtml).
//
// Each address gets a random ?oc-check= query, so the CDN's cached copy
// doesn't answer. Uses Chrome when installed, else Playwright's own Chromium
// (`npx playwright install chromium` once). Read-only; exits 1 when a check
// fails.
import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'
import { chromium } from 'playwright'

const cli = yargs(hideBin(process.argv))
  .usage('$0 --url <base> [--cave=<id>] [--sistema=<id>]\n\nChecks that the server-rendered public pages at <base> are served compressed, rendered by the server, and hydrated by the app without errors.')
  .option('url', { type: 'string', describe: 'The site to check, e.g. https://opencaves.org or a preview channel\'s https://opencaves--<channel>-<hash>.web.app' })
  .option('cave', { type: 'string', describe: 'The cave whose page to check (default: the first one /caves links to). Cave ids start with "-": write --cave=<id>' })
  .option('sistema', { type: 'string', describe: 'The cave system whose page to check (default: the first one /sistemas links to); --sistema=<id>' })
  .option('timeout', { type: 'number', default: 90, describe: 'Seconds to wait for a page (a cold function can take a while)' })
  .option('verbose', { alias: 'v', type: 'boolean', default: false, describe: 'Also list the pages\' other console errors and warnings' })
  .demandOption('url', 'Give the site to check: --url <base>')
  .example('$0 --url https://opencaves.org', 'The live site')
  .example('$0 --url https://opencaves--ssr-test-jb43g3sk.web.app --cave=-KPZkVMp35At9PGUPyqr', 'A preview channel, a given cave')
  .epilogue('Needs Chrome, or Playwright\'s Chromium: npx playwright install chromium')
  .help()
  .alias('help', 'h')
  .strict()

// No arguments: the help, not a run.
if (hideBin(process.argv).length === 0) {
  cli.showHelp()
  process.exit(0)
}
const argv = cli.parseSync()

const BASE = argv.url.replace(/\/+$/, '')
const TIMEOUT_MS = argv.timeout * 1000
// How long the app may take to hydrate a page once it has loaded.
const HYDRATION_TIMEOUT_MS = 30_000
// After hydration, time for the app's effects (its <head> tags) to run.
const SETTLE_MS = 1_500
// Hydration problems in the console: the app's "[hydrate]" messages
// (src/index.jsx), React's own (development wording, and production's
// minified hydration errors #418-#425).
const HYDRATION_MESSAGE = /\[hydrate\]|hydrat|Minified React error #4(1[89]|2[0-5])\b/i

const random = () => Math.random().toString(36).slice(2, 10)
const withCheck = (path) => `${BASE}${path}${path.includes('?') ? '&' : '?'}oc-check=${random()}`

// The first link to /<section>/<id> in a page's HTML (not the editor's /edit).
function firstLinkId(html, section) {
  for (const [, id] of html.matchAll(new RegExp(`href="/${section}/([-_A-Za-z0-9]{1,64})"`, 'g'))) {
    if (id !== 'edit') return id
  }
  return null
}

async function launchBrowser() {
  try {
    return await chromium.launch({ channel: 'chrome' })
  } catch {
    try {
      return await chromium.launch()
    } catch (error) {
      console.error(`No browser to run: install Chrome, or run \`npx playwright install chromium\`.\n${error.message}`)
      process.exit(1)
    }
  }
}

// Loads one page and checks it. expect: { status, ssr } - ssr: whether the
// server should have rendered it with the app (not a "not found").
async function checkPage(browser, path, { status: expectedStatus = 200, ssr: expectSsr = true } = {}) {
  // A context of its own, in English: nothing stored from another page, and
  // no service worker yet - one installed by an earlier page would answer
  // with the app's shell from its cache, not the server's page.
  const context = await browser.newContext({ locale: 'en-US', extraHTTPHeaders: { 'Accept-Language': 'en-US,en;q=0.9' } })
  const page = await context.newPage()
  const problems = []
  const notes = []
  page.on('pageerror', (error) => problems.push(`page error: ${error.message.split('\n')[0]}`))
  page.on('console', (message) => {
    const text = message.text()
    if (HYDRATION_MESSAGE.test(text)) problems.push(`console ${message.type()}: ${text.split('\n')[0].slice(0, 300)}`)
    else if (argv.verbose && ['error', 'warning'].includes(message.type())) notes.push(`console ${message.type()}: ${text.split('\n')[0].slice(0, 300)}`)
  })
  const result = { path, problems, notes, html: '' }
  try {
    const response = await page.goto(withCheck(path), { waitUntil: 'load', timeout: TIMEOUT_MS })
    if (!response) throw new Error('no response')
    result.status = response.status()
    result.encoding = (await response.headerValue('content-encoding')) || 'none'
    result.html = await response.text()
    if (result.status !== expectedStatus) problems.push(`status ${result.status}, expected ${expectedStatus}`)
    if (!['br', 'gzip'].includes(result.encoding)) problems.push(`Content-Encoding ${result.encoding}, expected br or gzip`)
    if (expectSsr) {
      const flags = await page.evaluate(() => ({ ssr: Boolean(window.__OC_SSR__), attribute: document.documentElement.hasAttribute('data-oc-ssr') }))
      if (!flags.ssr || !flags.attribute) {
        problems.push(`not server-rendered (window.__OC_SSR__ ${flags.ssr ? 'set' : 'missing'}, html[data-oc-ssr] ${flags.attribute ? 'set' : 'missing'})`)
      } else {
        // Hydrated to the end: HydrationDone dropped the server's queries.
        const started = Date.now()
        try {
          await page.waitForFunction(() => window.__OC_SSR__ && !('queries' in window.__OC_SSR__), null, { timeout: HYDRATION_TIMEOUT_MS })
          result.hydrationMs = Date.now() - started
        } catch {
          problems.push(`not hydrated within ${HYDRATION_TIMEOUT_MS / 1000} s`)
        }
      }
      await page.waitForTimeout(SETTLE_MS)
      // The server's <title>, read as the browser reads it (entities decoded).
      const [serverTitle, title] = await page.evaluate((html) => [new DOMParser().parseFromString(html, 'text/html').title, document.title], result.html)
      result.title = title
      if (title !== serverTitle) problems.push(`title after hydration "${title}", the server's "${serverTitle}"`)
    } else {
      await page.waitForTimeout(SETTLE_MS)
    }
  } catch (error) {
    problems.push(error.message.split('\n')[0])
  } finally {
    await context.close()
  }
  return result
}

function report({ path, status, encoding, hydrationMs, title, problems, notes }) {
  const details = [status ?? '-', encoding ?? '-', hydrationMs != null ? `hydrated in ${hydrationMs} ms` : null, title ? `"${title}"` : null].filter(Boolean).join('  ')
  console.log(`${problems.length ? 'FAIL' : 'ok  '}  ${path}  ${details}`)
  problems.forEach((problem) => console.log(`        ${problem}`))
  notes.forEach((note) => console.log(`        (${note})`))
}

const browser = await launchBrowser()
console.log(`Checking ${BASE} (${browser.browserType().name()} ${browser.version()})`)
const results = []
const run = async (path, expect) => {
  const result = await checkPage(browser, path, expect)
  report(result)
  results.push(result)
  return result
}
try {
  await run('/')
  const caves = await run('/caves')
  const sistemas = await run('/sistemas')
  const caveId = argv.cave || firstLinkId(caves.html, 'caves')
  const sistemaId = argv.sistema || firstLinkId(sistemas.html, 'sistemas')
  // Nothing to pick from (the list pages failed): a failure of its own.
  const missing = (path, problem) => {
    const result = { path, problems: [problem], notes: [] }
    report(result)
    results.push(result)
  }
  if (caveId) await run(`/caves/${caveId}`)
  else missing('/caves/<id>', 'no cave linked from /caves: give one with --cave=<id>')
  if (sistemaId) await run(`/sistemas/${sistemaId}`)
  else missing('/sistemas/<id>', 'no system linked from /sistemas: give one with --sistema=<id>')
  await run(`/caves/-nope-${random()}`, { status: 404, ssr: false })
} finally {
  await browser.close()
}

const failed = results.filter(({ problems }) => problems.length).length
console.log(failed ? `${failed} of ${results.length} pages failed.` : `All ${results.length} pages passed.`)
process.exit(failed ? 1 : 0)

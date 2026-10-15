#!/usr/bin/env node
// Checks that the site's build (build/) and the page functions' server build
// (functions/js/ssr/, made by `npm run build` from the same build) are one
// build: the server-rendered pages name the build's files (its scripts and
// stylesheets), and Hosting serves only the latest build's. Deployed apart -
// a Hosting deploy after a new build without the functions, or the functions
// from an older build - the pages would point at files the site no longer
// has. Run by firebase.json's predeploy for both, with --check: the deploy
// stops when they differ.
// It also stops when the build is older than the app's code: the commits
// since the one it was built from (build/.vite/build-info.json, written by
// vite.config.js) changed the files it's made from (BUILD_INPUTS) - a deploy
// would send yesterday's app. Uncommitted changes, in the build or since,
// only warn (a local fix deployed on purpose). OC_DEPLOY_ANY_BUILD=1 skips
// that part.
import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'

const SITE_SHELL = new URL('../build/app.html', import.meta.url)
const SERVER_SHELL = new URL('../functions/js/ssr/app.html', import.meta.url)
const BUILD_INFO = new URL('../build/.vite/build-info.json', import.meta.url)
// The app's entry script, hashed by its content: one name per build.
const ENTRY_PATTERN = /assets\/index-[\w-]+\.js/
// What the build is made from: a change to these needs a new build.
const BUILD_INPUTS = ['src', 'public', 'index.html', 'vite.config.js', 'package.json', 'package-lock.json']

const cli = yargs(hideBin(process.argv))
  .usage('$0 --check\n\nChecks that build/ and functions/js/ssr/ come from the same build (run before deploying Hosting or the functions).')
  .option('check', { type: 'boolean', default: false, describe: 'Run the check (exits 1 when the two builds differ or one is missing)' })
  .help()
  .alias('h', 'help')

const args = cli.parse()
if (!args.check) {
  cli.showHelp()
  process.exit(0)
}

const entryOf = (file) => (existsSync(file) ? readFileSync(file, 'utf8').match(ENTRY_PATTERN)?.[0] || null : null)
const site = entryOf(SITE_SHELL)
const server = entryOf(SERVER_SHELL)
const fail = (message) => {
  console.error(`check-ssr-build: ${message}\nRun \`npm run build\`, then deploy Hosting and the functions together (\`firebase deploy\`).`)
  process.exit(1)
}
if (!site) fail('no site build (build/app.html).')
if (!server) fail('no server build for the pages (functions/js/ssr/app.html).')
if (site !== server) fail(`build/ (${site}) and functions/js/ssr/ (${server}) are different builds.`)
console.log(`check-ssr-build: build/ and functions/js/ssr/ are the same build (${site}).`)

// --- The build against the checkout.
if (process.env.OC_DEPLOY_ANY_BUILD === '1') {
  console.warn('check-ssr-build: OC_DEPLOY_ANY_BUILD=1, the build is not compared with the code.')
  process.exit(0)
}
const git = (...gitArgs) => {
  try {
    return execFileSync('git', gitArgs, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim()
  } catch {
    return null
  }
}
const head = git('rev-parse', 'HEAD')
if (!head) {
  console.warn('check-ssr-build: not a git checkout, the build is not compared with the code.')
  process.exit(0)
}
if (!existsSync(BUILD_INFO)) fail('the build doesn\'t say what it was made from (build/.vite/build-info.json): it predates this check.')
const info = JSON.parse(readFileSync(BUILD_INFO, 'utf8'))
const short = (commit) => commit?.slice(0, 7) ?? 'unknown'
const built = `built ${info.builtAt?.replace('T', ' ').slice(0, 16) ?? '?'} UTC from ${short(info.commit)}`
if (info.commit !== head) {
  // A commit not in this checkout's history (another branch, rewritten): unknown code.
  if (!info.commit || git('merge-base', '--is-ancestor', info.commit, head) === null) {
    fail(`the build (${built}) isn't from this checkout's history (at ${short(head)}).`)
  }
  const changed = git('diff', '--name-only', info.commit, head, '--', ...BUILD_INPUTS)?.split('\n').filter(Boolean) ?? []
  if (changed.length) {
    const listed = changed.slice(0, 5).join(', ') + (changed.length > 5 ? `, and ${changed.length - 5} more` : '')
    fail(`the build (${built}) is older than the code at ${short(head)}: ${changed.length} file(s) changed since - ${listed}.`)
  }
}
if (info.dirty) console.warn(`check-ssr-build: the build (${built}) had uncommitted changes.`)
const pending = git('status', '--porcelain', '--', ...BUILD_INPUTS)
if (pending) console.warn(`check-ssr-build: uncommitted changes since the build, not in it:\n${pending}`)
console.log(`check-ssr-build: the build (${built}) is up to date with the code at ${short(head)}.`)

#!/usr/bin/env node
// Checks that the site's build (build/) and the page functions' server build
// (functions/js/ssr/, made by `npm run build` from the same build) are one
// build: the server-rendered pages name the build's files (its scripts and
// stylesheets), and Hosting serves only the latest build's. Deployed apart -
// a Hosting deploy after a new build without the functions, or the functions
// from an older build - the pages would point at files the site no longer
// has. Run by firebase.json's predeploy for both, with --check: the deploy
// stops when they differ.
import { existsSync, readFileSync } from 'node:fs'
import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'

const SITE_SHELL = new URL('../build/app.html', import.meta.url)
const SERVER_SHELL = new URL('../functions/js/ssr/app.html', import.meta.url)
// The app's entry script, hashed by its content: one name per build.
const ENTRY_PATTERN = /assets\/index-[\w-]+\.js/

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

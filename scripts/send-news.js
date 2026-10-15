#!/usr/bin/env node
// Sends a news email (functions/js/email/news/) to the registered accounts,
// each in its app language: those with a verified email, not frozen, not
// disabled, whose news emails aren't turned off (_users' newsEmails false:
// the account page's switch, or the email's own unsubscribe link) and that
// didn't get this one yet (_users' newsSent.<id>, written after each send).
// Answers go to the team's inbox (FEEDBACK_REPLY_TO); each email carries the
// account's news unsubscribe link and List-Unsubscribe headers.
//
// -l/--local: the local emulators, where nothing is sent or written (the
// recipients are listed, and --preview writes the emails as files);
// -p/--production: the real accounts. Real emails go out only with -p --send, or to one address
// with --test. Sending reads the Resend API key from Secret Manager (gcloud),
// unless RESEND_API_KEY is set (the environment, or the project's .env).
import path from 'node:path'
import { execSync } from 'node:child_process'
import { mkdir, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'
import { initializeApp, applicationDefault } from 'firebase-admin/app'
import { getAuth } from 'firebase-admin/auth'
import { FieldValue, getFirestore } from 'firebase-admin/firestore'
import { FEEDBACK_REPLY_TO, FROZEN_USERS_COLL_NAME, USERS_COLL_NAME } from '../functions/js/constants.js'
import { hasVerifiedEmail } from '../functions/js/users/verifiedEmail.js'
import { UNSUBSCRIBE_TOKEN_LENGTH, isUnsubscribeToken, randomToken, unsubscribeUrl } from '../functions/js/email/unsubscribeUrl.js'
import * as release10 from '../functions/js/email/news/release-1-0.js'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const PROJECT_ID = 'opencaves'
const FROM = 'OpenCaves <noreply@opencaves.org>'
// Resend accepts 2 requests a second.
const PAUSE_MS = 600

// The news emails, by id.
const NEWS = { [release10.ID]: { languages: release10.LANGUAGES, render: release10.renderRelease10 } }

try {
  process.loadEnvFile(path.join(ROOT, '.env'))
} catch {
  // No .env: RESEND_API_KEY from the environment, if sending.
}

const cli = yargs(hideBin(process.argv))
  .usage('$0 <news> (-l | -p) [--dry-run | --preview <dir> | --test <email> | --send]\n\nSends a news email to the registered accounts whose news emails are on, each in its language, once.')
  .command('$0 <news>', 'Send a news email.', (y) => y.positional('news', { type: 'string', describe: `The email: ${Object.keys(NEWS).join(', ')}` }))
  .option('local', { alias: 'l', type: 'boolean', default: false, describe: 'The local emulators (nothing is really sent)' })
  .option('production', { alias: 'p', type: 'boolean', default: false, describe: 'The real accounts (after `gcloud auth application-default login`)' })
  .option('dry-run', { type: 'boolean', default: false, describe: 'List who would get it, and in which language' })
  .option('preview', { type: 'string', describe: 'Write the email, in each language, as HTML and text files in this folder' })
  .option('test', { type: 'string', describe: 'Send it to this address only (really), in --language' })
  .option('language', { type: 'string', default: 'en', describe: 'The language of --test' })
  .option('send', { type: 'boolean', default: false, describe: 'Send it to every recipient (really only with -p)' })
  .option('force', { type: 'boolean', default: false, describe: 'Send it again to those who already got it' })
  .example('$0 release-1-0 -p --dry-run', 'Who would get it in production')
  .example('$0 release-1-0 -l --preview out/news', 'See it in each language')
  .example('$0 release-1-0 -l --test me@example.com --language fr', 'Send the French one to yourself')
  .example('$0 release-1-0 -p --send', 'Send it to the real accounts')
  .check((args) => {
    // No arguments: only the help is shown (below).
    if (hideBin(process.argv).length === 0) return true
    if (!NEWS[args.news]) throw new Error(`Name the email: ${Object.keys(NEWS).join(', ')}.`)
    if (args.local === args.production) throw new Error('Use exactly one of -l/--local or -p/--production.')
    if ([args.dryRun, args.preview !== undefined, args.test !== undefined, args.send].filter(Boolean).length !== 1) throw new Error('Use exactly one of --dry-run, --preview, --test or --send.')
    return true
  })
  .help()
  .alias('help', 'h')
  .strict()

// No arguments: the help, not a run.
if (hideBin(process.argv).length === 0) {
  cli.showHelp('log')
  process.exit(0)
}
const argv = cli.parseSync()
const newsId = String(argv.news)
const news = NEWS[newsId]
const isProd = argv.production

if (!isProd) {
  process.env.FIRESTORE_EMULATOR_HOST ||= '127.0.0.1:8080'
  process.env.FIREBASE_AUTH_EMULATOR_HOST ||= '127.0.0.1:9099'
} else {
  delete process.env.FIRESTORE_EMULATOR_HOST
  delete process.env.FIREBASE_AUTH_EMULATOR_HOST
}
initializeApp(isProd ? { credential: applicationDefault(), projectId: PROJECT_ID } : { projectId: PROJECT_ID })
const auth = getAuth()
const db = getFirestore()

const firstName = (displayName) => String(displayName || '').trim().split(/\s+/)[0] || ''

// The Resend API key: RESEND_API_KEY if set, else the functions' own secret,
// read from Secret Manager with gcloud (the signed-in account's access) -
// kept in memory only.
let resendKey = process.env.RESEND_API_KEY || ''
function apiKey() {
  if (!resendKey) {
    try {
      resendKey = execSync(`gcloud secrets versions access latest --secret=RESEND_API_KEY --project=${PROJECT_ID}`, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim()
    } catch (error) {
      throw new Error(`The Resend key couldn't be read from Secret Manager (gcloud signed in, with access to the opencaves secrets?), and RESEND_API_KEY isn't set: ${String(error.stderr || error.message).trim()}`)
    }
  }
  return resendKey
}

async function sendEmail({ to, subject, html, text, headers }) {
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey()}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: FROM, to: [to], subject, html, text, headers, reply_to: FEEDBACK_REPLY_TO }),
  })
  if (!response.ok) throw new Error(`Resend ${response.status}: ${await response.text()}`)
  return response.json()
}

// The account's unsubscribe token, created (and saved) if it has none yet.
async function tokenOf(uid, settings) {
  const existing = settings?.unsubscribeToken
  if (isUnsubscribeToken(existing)) return existing
  const created = randomToken(UNSUBSCRIBE_TOKEN_LENGTH)
  await db.collection(USERS_COLL_NAME).doc(uid).set({ unsubscribeToken: created }, { merge: true })
  return created
}

// Every account, with whether it gets the email (or why not).
async function recipients() {
  const frozen = new Set((await db.collection(FROZEN_USERS_COLL_NAME).select().get()).docs.map((doc) => doc.id))
  const list = []
  let pageToken
  do {
    const page = await auth.listUsers(1000, pageToken)
    for (const user of page.users) {
      const settings = (await db.collection(USERS_COLL_NAME).doc(user.uid).get()).data() || {}
      const skip = !user.email ? 'no email'
        : !hasVerifiedEmail(user) ? 'email not verified'
          : user.disabled ? 'disabled'
            : frozen.has(user.uid) || user.customClaims?.frozen ? 'frozen'
              : settings.newsEmails === false ? 'news emails off'
                : settings.newsSent?.[newsId] && !argv.force ? 'already sent'
                  : null
      const language = news.languages.includes(settings.language) ? settings.language : 'en'
      list.push({ uid: user.uid, email: user.email, name: firstName(user.displayName), language, settings, skip })
    }
    pageToken = page.pageToken
  } while (pageToken)
  return list
}

const target = isProd ? 'PRODUCTION' : 'emulators'

if (argv.preview !== undefined) {
  const dir = path.resolve(argv.preview)
  await mkdir(dir, { recursive: true })
  for (const language of news.languages) {
    const email = news.render({ language, name: 'Alex', unsubscribeUrl: unsubscribeUrl('x'.repeat(UNSUBSCRIBE_TOKEN_LENGTH), 'news').url })
    await writeFile(path.join(dir, `${newsId}.${language}.html`), email.html)
    await writeFile(path.join(dir, `${newsId}.${language}.txt`), `Subject: ${email.subject}\n\n${email.text}\n`)
    console.log(`${language}: ${email.subject}`)
  }
  console.log(`Written to ${dir}`)
  process.exit(0)
}

if (argv.test !== undefined) {
  // To one address, with a link that unsubscribes nobody (a made-up token).
  const { url, headers } = unsubscribeUrl('x'.repeat(UNSUBSCRIBE_TOKEN_LENGTH), 'news')
  const email = news.render({ language: argv.language, name: '', unsubscribeUrl: url })
  const result = await sendEmail({ to: argv.test, subject: `[Test] ${email.subject}`, html: email.html, text: email.text, headers })
  console.log(`Test sent to ${argv.test} (${argv.language}): ${result.id}`)
  process.exit(0)
}

const all = await recipients()
const to = all.filter((account) => !account.skip)
console.log(`${target}: ${newsId} - ${to.length} recipient(s), ${all.length - to.length} skipped`)
for (const account of all) console.log(`  ${account.skip ? `skip (${account.skip})` : `send (${account.language})`.padEnd(22)}  ${account.email || account.uid}`)
if (argv.dryRun) process.exit(0)
// --send on the emulators: the list above only - no email, nothing written.
if (!isProd) {
  console.log('emulators: nothing sent (use -p to send to the real accounts)')
  process.exit(0)
}

let sent = 0
let failed = 0
for (const account of to) {
  try {
    const token = await tokenOf(account.uid, account.settings)
    const { url, headers } = unsubscribeUrl(token, 'news')
    const email = news.render({ language: account.language, name: account.name, unsubscribeUrl: url })
    await sendEmail({ to: account.email, subject: email.subject, html: email.html, text: email.text, headers })
    await new Promise((resolve) => setTimeout(resolve, PAUSE_MS))
    await db.collection(USERS_COLL_NAME).doc(account.uid).set({ newsSent: { [newsId]: FieldValue.serverTimestamp() } }, { merge: true })
    sent++
  } catch (error) {
    failed++
    console.error(`  failed: ${account.email}: ${error.message}`)
  }
}
console.log(`${target}: ${sent} sent, ${failed} failed`)
process.exit(failed ? 1 : 0)

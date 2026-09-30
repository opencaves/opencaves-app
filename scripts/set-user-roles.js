#!/usr/bin/env node
// Adds or removes a role (the `roles` custom claim, see firestore.rules) on
// an account, found by email. Needed to bootstrap the first admin: the
// in-app Users page (setUserRoles) only works for someone who's already an
// admin, and new accounts only get `editor` (assignRole).
import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'
import { initializeApp, applicationDefault } from 'firebase-admin/app'
import { getAuth } from 'firebase-admin/auth'

const PROJECT_ID = 'opencaves'
const ROLES = ['editor', 'admin']

const cli = yargs(hideBin(process.argv))
  .command('$0 <email>', 'Add or remove a role on an account.', (y) => y.positional('email', { type: 'string', describe: 'The account\'s email address' }))
  .option('add', { type: 'string', choices: ROLES, describe: 'Role to add' })
  .option('remove', { type: 'string', choices: ROLES, describe: 'Role to remove' })
  .option('production', {
    alias: 'p',
    type: 'boolean',
    default: false,
    describe: 'Change the real opencaves project instead of the local Auth emulator (requires `gcloud auth application-default login` with an account that can manage Firebase Auth users)',
  })
  .example('$0 me@example.com --add admin', 'Make an account admin on the local emulator')
  .example('$0 me@example.com --add admin -p', 'Make an account admin in production')
  .check((args) => {
    if (!args.add === !args.remove) throw new Error('Use exactly one of --add or --remove.')
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

const email = argv.email
const isProd = argv.production

// Default to the local Auth emulator (port from firebase.json) so a bare run
// can't touch production; an explicit FIREBASE_AUTH_EMULATOR_HOST still wins.
if (!isProd && !process.env.FIREBASE_AUTH_EMULATOR_HOST) {
  process.env.FIREBASE_AUTH_EMULATOR_HOST = '127.0.0.1:9099'
}

initializeApp(isProd ? { credential: applicationDefault(), projectId: PROJECT_ID } : { projectId: PROJECT_ID })
const auth = getAuth()

const user = await auth.getUserByEmail(email)
const current = Array.isArray(user.customClaims?.roles) ? user.customClaims.roles : []
const roles = argv.add ? [...new Set([...current, argv.add])] : current.filter((role) => role !== argv.remove)

// Keep any other custom claims the account has.
await auth.setCustomUserClaims(user.uid, { ...user.customClaims, roles })

console.log(`${isProd ? 'PRODUCTION' : 'emulator'}: ${email} (${user.uid})`)
console.log(`  roles: [${current.join(', ')}] -> [${roles.join(', ')}]`)
console.log('  Sign out and back in (or wait up to an hour) for the new role to take effect.')

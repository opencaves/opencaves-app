# Maintenance

The recurring tasks for keeping OpenCaves' data and services healthy. Run any
script below with no arguments (or `-h`) to see its help: a bare run does
nothing else. Every script works against the **local emulators** unless told
otherwise - `-l` (`--local`) says so when no other option is needed - so it
can't touch production by accident. Add `-p` (`--production`) to use the real
`opencaves` project, after logging in once with:

```
gcloud auth application-default login
```

## Check the cave photos

```
node scripts/check-cave-images.js -l           # local emulators
node scripts/check-cave-images.js -p           # production
node scripts/check-cave-images.js -p --cave=<caveId>      # = form: cave IDs start with "-"
```

A read-only check that the cave photos (the `cavesAssets` collection) and
their files in Storage agree. Run it after a bulk photo import
([photos-import.md](photos-import.md)), after changing the asset functions
(`functions/js/assets/`, `functions/js/resize-images/`), or whenever photos
look broken in the app. It exits with code 1 when it finds a problem, and
prints each group of problems with what to do about it. Photos in the trash
are counted, and their files checked like the others' (they're kept until
the trash is emptied):

| Problem | Meaning | What to do |
|---|---|---|
| Original file missing | The photo's document points to a file that isn't in Storage | Delete the photo from the cave's page and upload it again |
| Missing thumbnails | The `onAssetUploaded` function failed to resize the photo | Fix the cause (check the function's logs), then upload the photo again. For an imported photo, use `upload-photos.js --redo --only <file>` |
| Photo of a cave that doesn't exist | The cave was deleted, or re-created with another ID | Delete the photo, or move it to the right cave |
| Not exactly one cover | A cave with photos (outside the trash) has no cover, or several | Pick the cover on the cave's page |
| Photo in the trash still a cover | The `onAssetTrashChanged` function didn't hand its cover over | Restore the photo, then delete it again (the function hands the cover over) |
| Document made from a file that isn't a photo | A document created from a stray file (e.g. a failed-resize copy) | Delete that document |
| `images/failed/` copies | When resizing fails, the original is copied there | Delete them once the photo was uploaded again |
| Files with no photo document | Usually an upload whose function failed before creating the document | Upload the photo again from the app, then delete the file |

Files in Storage can be deleted with
`gcloud storage rm gs://opencaves.appspot.com/<path>`.

## Sync the database from the Google Sheet (deprecated)

**Don't run it:** the Google Sheet is no longer used, the app is the data's
only source, and a sync would overwrite what was edited in the app. The
script is kept for now, to be removed.

```
node scripts/migrate-sheet-to-firestore.js -l   # local emulators
node scripts/migrate-sheet-to-firestore.js -p   # production
```

It fetches the Google Sheet and makes the cave-data collections (`caves`,
`sistemas`, `connections`, `accesses`, `accessibilities`, `sources`, `areas`,
`colors`, `languages`) match it **exactly**: rows are written, and documents
that are no longer in the sheet are deleted. This means it also overwrites
edits made in the app's admin pages. It doesn't touch photos (`cavesAssets`),
maps, or users' data.

A fresh clone, or a wiped `.emulator-data/` folder, starts with an empty local
database: run it once against the emulators.

## Mirror the local data to production

```
node scripts/sync-to-production.js --dry-run   # what would change
node scripts/sync-to-production.js --write     # back up production's documents, then mirror
```

The local emulators hold the original data; production (users' tests) is
refreshed from them. The script makes production identical to local -
every collection and the `caves/` (photos) and `maps/` (scans) files - except
its users' data (accounts, `_users/*`: settings and saved caves; the caves'
ratings and `_caveRatings`), frozen accounts and audit log, which stay
untouched - except that the local audit log's additions that production
lacks (its "create" entries for caves, systems, connections, maps and photos,
and the caves' changes that added videos) are copied to it, so the What's new page (`/whats-new`, built from the audit log) lists them
there too. What's only in production is deleted, files included. Production's
documents are first saved to `_data/backups/production-<date>/`; its deleted
files are not. Copied files carry `ocSync=true`, so the upload functions
don't rebuild them. The trash comes along as it is. Production keeps its own
audit log: what testers did there, which the mirror then overwrites.

Accounts named in a record (who moved it to the trash, who uploaded a photo)
become the production account with the same email. A local account whose
email differs from its production one is paired in `.env`:
`SYNC_ACCOUNTS=local@example.org=production@example.org` (comma-separated
pairs); the dry run says how many accounts matched.

Run it with the emulators up, after
`gcloud auth application-default login`, then check with
`node scripts/check-cave-images.js -p`.

## Tag the lengths in the descriptions

```
node scripts/tag-lengths.js -l           # local emulators: dry run, lists the changes
node scripts/tag-lengths.js -l --write   # saves them
node scripts/tag-lengths.js -p           # production (dry run; add --write to save)
```

Turns the lengths and depths written as plain text in the Markdown fields
(caves' and sistemas' descriptions, directions, access and accessibility
details, explorations) into the length tag - `40 ft` becomes `:length[40 ft]` -
which each reader sees in their units. A conversion written next to a length
(`40 ft (12 m)`) is dropped, and a range gets a tag at each end. Without
`--write` it only lists the changes: read them before saving. Re-runnable.
A sync from the Google Sheet brings the untagged text back: run it again after.

## Give someone a role

```
node scripts/set-user-roles.js <email> --add admin       # local Auth emulator
node scripts/set-user-roles.js <email> --add admin -p    # production
node scripts/set-user-roles.js <email> --remove editor -p
```

It adds or removes a role (`editor` or `admin`) on an account, keeping its
other roles. Use it to make the first admin: the app's Users page only works
for someone who's already an admin. The person must sign out and back in to
get the change.

An admin can also **freeze** an account from the Users page: all its editing
rights are removed (kept for unfreezing), the editor role every account gets
automatically is withheld while it's frozen, and the person is told by email
(and again when it's unfrozen). It takes effect at once: the security rules
check the `_frozenUsers` collection, not only the account's sign-in token.

From the Users page, an admin can't remove their own admin role (another
admin must), and nobody can remove the last admin's.

## Who changed what

The `_auditLog` collection, which only admins can read (Firebase console >
Firestore), records:

- each change made from the app to the cave data (caves, sistemas,
  connections, reference data, maps, photos, settings): who (the author's account id, `authorId`), which document,
  created (`after`: the document), updated (`changedFields`, and their values
  in `before` and `after` - a field missing from one was absent) or deleted
  (`before`: the document). An entry whose values would pass 900 KB keeps
  `tooLarge: true` instead, and can't be undone;
- the undos (`undo`, `undoOf`: the entry undone) and the trash emptied
  (`purge`, with the record whole), by admins;
- the admins' user management: roles changed, accounts frozen, unfrozen or
  deleted, and by whom.

Admins undo changes from the Audits page (the `undoAuditEntries` function):
each document is put back as it was before the change, newest change first.
As with `git revert`, a field changed again since is a conflict, and nothing
is written unless the admin forces it. An undo is an entry of its own, so it
can be undone too. User management, purges and `tooLarge` entries can't be
undone, nor a photo or map whose files are gone.

Photos and maps go to a trash first: deleting one sets `deletedAt` and
`deletedBy` on its record, and its files stay; restoring it (or undoing the
delete) removes both. A photo that was its cave's cover hands the cover to
another of the cave's photos (`onAssetTrashChanged`). Emptying the trash (the
`emptyTrash` function, admins) deletes them for good, with their files - a
map is also taken off the sistemas that list it.

Entries are deleted 12 months after they're written (`expireAt`, a TTL
policy deployed with the indexes: `firebase deploy --only firestore:indexes`).

Changes made by scripts and functions (the Google Sheet sync, the mirror to
production, the photo triggers) aren't recorded. The emulators don't say who
made a change, so locally every write is recorded as `emulator`'s - scripts
run against them too (a Sheet sync adds thousands of entries) - except the
server's own photo and map fields, and an undo's or purge's own writes. The
emulator has no TTL: local entries stay until deleted.

## Emails

The Cloud Functions send email with [Resend](https://resend.com) from
`noreply@opencaves.org` (`functions/js/email/sendEmail.js`): the freeze and
unfreeze notices, and the beta feedback's - a new report to the admins
(`onFeedbackCreated`), and each team reply written on the Feedback page
(`onFeedbackReplied`). Only replies email a report's author: changing its
stage emails no one. A reply goes to the author with the whole conversation,
in the language of the report; one sent with "Send and mark as done/rejected"
carries the outcome too. A report's emails share a
subject and `Message-ID`/`References` headers, so mail apps show them as one
conversation. Their Reply-To is the report's own address,
`<replyToken>@reply.opencaves.org` (`FEEDBACK_REPLY_DOMAIN` in
`functions/js/constants.js`; the token, random, is written on the report by
the server on its first team reply): the author's answer comes back into the
report's thread (see "Replies by email" below). With `FEEDBACK_REPLY_DOMAIN`
set to `null`, the Reply-To is `FEEDBACK_REPLY_TO`, `feedback@opencaves.org`,
the team's inbox (a forward to the admin at Porkbun), and answers are read
there by hand. That address must exist and be read. The opencaves.org domain must be verified in the Resend account
(its DNS records), or Resend refuses to send. The API key (a send-only key) is
the `RESEND_API_KEY` secret, in Google Secret Manager - never in a file:

```
firebase functions:secrets:set RESEND_API_KEY   # set or replace it (paste the key)
firebase deploy --only functions                 # the functions use the new version
```

Replace it in Resend (create a new key, set it, delete the old one) if it was
ever shared. In the emulators nothing is sent: the email is written to the
functions' log. Each send shows in the Resend dashboard's logs.

### Unsubscribe

An author can stop the team's reply emails: the **Emails** switch on their
account page (`/account`), or the "Unsubscribe" link at the very end of each
reply email, which works without signing in. Either sets `feedbackEmails:
false` on their `_users/{uid}`; `onFeedbackReplied` then sends nothing (the
reply still joins the thread, and the log says it wasn't emailed), and the
report shows "The author muted feedback emails" on the Feedback page (the
`authorMuted` flag the server mirrors on their reports, `onAuthorMutedChanged`,
since admins don't read `_users`). The switch turns them back on.

The link is `https://opencaves.org/email/unsubscribe?t=<token>`: a Hosting
rewrite (`firebase.json`, before the `**` catch-all) to the
`feedbackUnsubscribe` function. The token is the account's own, 32 random
lowercase letters and digits, written by the server as `unsubscribeToken` on
`_users/{uid}` with the first email that needs it (the rules never let a
client write it; it goes with the account). Opening the link (GET) changes
nothing - mail scanners open every link of an email: a small page in the
account's language asks to confirm, and its Unsubscribe button (a POST with
`confirm=1`) turns the emails off and says so, with a link to the settings
(already off: that page at once). A POST without it is the mail apps' own
one-click Unsubscribe button (RFC 8058: each email carries `List-Unsubscribe:
<that link>` and `List-Unsubscribe-Post: List-Unsubscribe=One-Click`): turned
off, answered 200 with a short text. An unknown or
malformed token gets a 400 page with no detail. Never cached, and the token is
never logged. To deploy it: `firebase deploy --only
functions:js:feedbackUnsubscribe,functions:js:onAuthorMutedChanged,functions:js:onFeedbackReplied,functions:js:onFeedbackCreated,firestore:rules`,
then `firebase deploy --only hosting` (the rewrite needs the function first).

### Replies by email

An author's answer to a team reply joins the report's thread: Resend receives
the mail sent to `reply.opencaves.org` and calls the `feedbackInbound`
function (a webhook, event `email.received`), which checks the webhook's
signature, reads the email from Resend's API, finds the report by the address'
token and, if the email really comes from the report's author, adds its new
text (the quoted conversation and signature removed) to the thread as their
comment ("by email" on the Feedback page; attachments aren't kept, only
counted). A closed report reopens (stage New, no email to the author), and the
admins get an email ("<author> replied to ..."). The admins' emails (a new report, an
author's answer) have their own reply address, `team-<token>@reply.opencaves.org`:
an admin answering one of them writes a team reply, added to the thread and
emailed to the author as if written on the Feedback page (accepted only from
an admin account's address, not disabled or frozen, its mail authenticated;
a team reply doesn't reopen the report). Two addresses, so an admin who sent
a report answers as the email they got. Dropped, and only logged
(never their text): automatic mail (out-of-office, bounces, lists - no mail
loops), an unknown address, and a sender who isn't the author or whose mail
isn't authenticated (DKIM or DMARC passing, or SPF passing for the From's
domain; a DMARC failure is always refused). Each email is added once, even if
Resend delivers the webhook again.

Set up, once:

1. **Resend, Domains**: add `reply.opencaves.org` with **receiving** turned on
   (sending isn't needed for it). Resend shows its MX record.
2. **Porkbun, DNS of opencaves.org**: add that MX record for the host `reply`
   (the exact value and priority Resend shows for it). It touches only the subdomain: opencaves.org's own mail is
   unchanged. Wait for Resend to show the domain verified.
3. **Resend, Webhooks**: add an endpoint
   `https://northamerica-northeast1-opencaves.cloudfunctions.net/feedbackInbound`
   with the event `email.received`. Copy its signing secret (`whsec_...`).
4. **The secrets** (Google Secret Manager):

   ```
   firebase functions:secrets:set RESEND_WEBHOOK_SECRET   # paste the whsec_... secret
   firebase functions:secrets:set RESEND_INBOUND_KEY      # a Resend API key with full access (already set)
   ```

   `RESEND_INBOUND_KEY` reads the received emails (the send-only
   `RESEND_API_KEY` can't).
5. **Deploy, in this order**: the secrets first (step 4), then
   `firebase deploy --only functions:js:feedbackInbound` (the webhook, and its
   URL in step 3 starts answering), check it (below), then
   `firebase deploy --only functions` for `onFeedbackReplied`, whose emails then
   carry the per-report Reply-To. Until that last deploy, answers keep going
   to `feedback@opencaves.org`. Deploying it before receiving works would
   send answers to an address that bounces.

Check it: reply from the app to a report of your own (an account whose email
you read), answer the email from that mailbox, and the answer shows in the
report's thread within a minute; the webhook's deliveries show in Resend's
Webhooks page, and the function's log (`firebase functions:log --only
feedbackInbound`) says why an email was dropped. Locally, the emulator has no
Resend: an email can come from a fixture file
(`<temp folder>/opencaves-inbound-fixtures/<email id>.json`, the shape of
Resend's received email), with a webhook signed with the test secret of
`functions/js/.secret.local` (`RESEND_WEBHOOK_SECRET=whsec_...`; never
committed).

## Apply the Storage CORS config

```
gcloud storage buckets update gs://opencaves.appspot.com --cors-file=storage.cors.json
```

`firebase deploy` does **not** apply `storage.cors.json`. Run this whenever the
file changes, or if bucket images stop loading in the app: the app loads them
with `crossOrigin="anonymous"`, so without this config they fail to load
entirely.

## Deploy

```
firebase deploy                                   # everything
firebase deploy --only hosting
firebase deploy --only functions
firebase deploy --only functions:js:<name>        # one function, e.g. onAssetUploaded
firebase deploy --only firestore:rules,firestore:indexes   # security rules, indexes and the audit log's TTL
```

A deploy uploads the working copy, including uncommitted changes.

`npm run build` also builds the server rendering of the public pages (`/`,
`/caves`, a cave's page, `/sistemas`, a system's page) into `functions/js/ssr/`,
from that same build: after a build, deploy the hosting **and** the
`indexPages` function together (`firebase deploy`, or `--only
hosting,functions:js:indexPages`), or those pages are drawn with the previous
build's code and files. Without `functions/js/ssr/` (or if the server
rendering fails), they are served as the app's shell with the page's title,
description and other `<head>` tags (a cave's page also with its text), and
the browser draws them.

Two safeguards keep the two builds together. `firebase deploy` (Hosting or
the functions) first runs `node scripts/check-ssr-build.js --check`, which
stops the deploy when `build/` and `functions/js/ssr/` come from different
builds, or one is missing: run `npm run build` again. And if Hosting is
deployed alone all the same, the page functions see that the site's build
isn't theirs and serve the pages as the app's shell, drawn in the browser,
until the functions are deployed too: the logs show `[ssr] the site and the
server build differ`.

After deploying Hosting and the functions, check the server-rendered pages in
a real browser, on the live site or on a preview channel:

```
node scripts/check-hydration.js --url https://opencaves.org
node scripts/check-hydration.js --url https://opencaves--<channel>-<hash>.web.app --cave=<id> --sistema=<id>
```

It loads `/`, `/caves`, `/sistemas`, a cave's page and a system's page (the
first ones the lists link to, unless `--cave=`/`--sistema=` name them - with
"=", as cave ids start with "-") and a missing cave, in English, each with a
random `?oc-check=` query so the CDN's cached copy doesn't answer. For each it
checks the status (404 for the missing cave), that the response is compressed
(br or gzip), that the server rendered it (`window.__OC_SSR__`,
`html[data-oc-ssr]`) and the app hydrated it to the end, with no page error
and no hydration message in the console (React's, or the app's `[hydrate]`
ones), and that the title after hydration is the server's. One line per page;
it exits 1 when a check fails (`-v` also lists the pages' other console
errors). It uses Chrome when installed, else Playwright's Chromium: run `npx
playwright install chromium` once.

If a functions deploy fails with *"User code failed to load. Cannot determine
backend specification. Timeout after 10000"*, the CLI took more than 10
seconds to load the functions code. This is usually a slow cold start, not a
bug. Try again, or give it more time (the value is in seconds):

```powershell
$env:FUNCTIONS_DISCOVERY_TIMEOUT=60; firebase deploy --only functions
```

## Local emulators

`npm run dev` starts Vite and the Firebase emulators together, and loads the
emulator data saved in `.emulator-data/`. While they run,
`scripts/emulator-autosave.js` saves their data back there every minute
(`EMULATOR_AUTOSAVE_MINUTES` to change it), so stopping them any way you like
loses at most the last minute of changes. The emulators' own
`--export-on-exit` isn't used: on Windows, `npm run dev`'s Ctrl+C force-kills
them before they can export, and their export fails anyway when the project
isn't on the same drive as the system's temp folder.

- **A callable function fails with a CORS error** (`No 'Access-Control-Allow-Origin'
  header…`): the functions emulator may have gone stale and lost its
  functions. Call the function directly to find out:
  `curl -X POST http://127.0.0.1:5001/opencaves/northamerica-northeast1/<function>`.
  An answer of `Function … does not exist` confirms it. Restart the emulators.
- **Several emulator or dev-server processes** can end up running at once.
  Check which one is listening (`netstat -ano | findstr :8080`) before
  assuming which is being hit.

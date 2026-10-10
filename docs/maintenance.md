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
`noreply@opencaves.org` (`functions/js/email/sendEmail.js`); today only the
freeze and unfreeze notices. The opencaves.org domain must be verified in the Resend account
(its DNS records), or Resend refuses to send. The API key (a send-only key) is
the `RESEND_API_KEY` secret, in Google Secret Manager - never in a file:

```
firebase functions:secrets:set RESEND_API_KEY   # set or replace it (paste the key)
firebase deploy --only functions                 # the functions use the new version
```

Replace it in Resend (create a new key, set it, delete the old one) if it was
ever shared. In the emulators nothing is sent: the email is written to the
functions' log. Each send shows in the Resend dashboard's logs.

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

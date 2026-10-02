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
prints each group of problems with what to do about it:

| Problem | Meaning | What to do |
|---|---|---|
| Original file missing | The photo's document points to a file that isn't in Storage | Delete the photo from the cave's page and upload it again |
| Missing thumbnails | The `onAssetUploaded` function failed to resize the photo | Fix the cause (check the function's logs), then upload the photo again. For an imported photo, use `upload-photos.js --redo --only <file>` |
| Photo of a cave that doesn't exist | The cave was deleted, or re-created with another ID | Delete the photo, or move it to the right cave |
| Not exactly one cover | A cave with photos has no cover, or several | Pick the cover on the cave's page |
| Document made from a file that isn't a photo | A document created from a stray file (e.g. a failed-resize copy) | Delete that document |
| `images/failed/` copies | When resizing fails, the original is copied there | Delete them once the photo was uploaded again |
| Files with no photo document | Usually an upload whose function failed before creating the document | Upload the photo again from the app, then delete the file |

Files in Storage can be deleted with
`gcloud storage rm gs://opencaves.appspot.com/<path>`.

## Sync the database from the Google Sheet

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
```

A deploy uploads the working copy, including uncommitted changes.

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

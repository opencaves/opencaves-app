# AGENTS.md

Guidance for AI coding agents working in this repository. Read this before
making changes — several things here are non-obvious and have already caused
real bugs.

## What this is

OpenCaves: a React/Vite/Ionic web app for finding cenotes (caves) in the
Yucatán, backed by Firebase (Firestore, Auth, Storage, Cloud Functions,
Hosting). Branch `feature/db` currently holds a recent migration off a
Google Sheet onto Firestore, plus a new in-app admin UI — see "Data model"
below before assuming caves/sistemas data still comes from a spreadsheet.

## Stack

- React 19, Vite 8 (build output to `build/`, not `dist/`), react-router-dom
  v7 (data router, using the `lazy` route property for code splitting)
- Ionic React (`@ionic/react`) for mobile-style UI primitives (sheet modals,
  etc.), MUI (`@mui/material`) for everything else
- Design principles are based on **Material Design 3** — `src/theme/Theme.jsx`
  uses M3 token naming (`--md-sys-*`, `--md-palette-*`); follow M3 conventions
  (color roles, typescale, motion tokens) for new UI rather than plain MUI
  defaults or ad hoc values
- Custom CSS custom properties (i.e. anything outside the M3 `--md-*` tokens
  above) must be prefixed `--oc-`, mimicking the OpenCaves namespace.
- Redux Toolkit + redux-persist for state
- Mapbox GL / `react-map-gl` for the map (not Google Maps, despite one
  legacy geocoding call to `maps.googleapis.com` in `Address.jsx`)
- Firebase: Firestore (data), Auth (custom-claim roles), Storage (media),
  Cloud Functions v2 (`functions/js/`, region `northamerica-northeast1`),
  Hosting (two sites: `opencaves` the main app, `opencaves-api` for `/v1/*`)
- `vite-plugin-pwa` (`injectManifest` strategy) builds `src/service-worker.js`
  into a real file with a precache manifest — Vite has no equivalent to
  CRA's webpack plugin for this, so don't remove that plugin config
  thinking it's redundant.
- i18n via `react-i18next`, locale files at `src/locales/{en,fr}.json`
- `functions/py/` exists but is **not** in `firebase.json`'s `functions`
  config — it's not deployed, don't assume it's live.

## Commands

- `npm run dev` — Vite + Firebase emulators together (imports seed data from
  `./.emulator-data` and exports back to it on a clean exit via
  `--export-on-exit`, so emulator state persists across restarts; this
  folder is **not** tracked in git — only `.emulator-data/.gitignore` is —
  so a fresh clone or a wiped `.emulator-data` starts with an empty
  database and needs `node scripts/migrate-sheet-to-firestore.js` run once
  against the emulator to populate it)
- `npm run build` — production build
- `node scripts/migrate-sheet-to-firestore.js` — seed/sync Firestore from
  the Google Sheet against the local emulator (requires
  `FIRESTORE_EMULATOR_HOST` set); add `-p`/`--production` to run against
  the real project (requires `gcloud auth application-default login` first)
- `firebase deploy` — deploys everything; scope with `--only hosting`,
  `--only functions`, or `--only functions:js:<name>` for a single function
- No test suite currently exists in this repo.

## Commit messages

All commit messages must be written in English, regardless of the language
used elsewhere in the conversation or in the app's UI/locale strings.

Do not append a `Co-Authored-By: Claude ...` (or similar agent-attribution)
trailer to commits in this repo, even if a session's default instructions
call for one.

Always push right after committing, as part of the same action rather than
a separate, later step.

## Data model

Firestore collections: `caves`, `sistemas`, `connections`, `accesses`,
`accessibilities`, `sources`, `areas`, `colors`, `languages` (cave data),
plus `cavesAssets` (media) and `ratings`. Document IDs are Firebase
push-ID—formatted and stable (carried over from a previous Firebase-backed
version of the app, then a stint on a Google Sheet, now back to Firestore).

Two things are **deliberately** computed client-side at read time, not
stored in Firestore, so they can't go stale as records are edited
independently of each other:
- Per-cave sistema ancestry (walking `connections`) — see
  `postProcessCaveData.js`.
- Cave-name markdown auto-linking (`[cenote X](oc:id)`) — same file.

`scripts/migrate-sheet-to-firestore.js` is re-runnable and **fully
replaces** each collection on every run (writes current Sheet data, deletes
anything else already in that collection) — safe to re-run repeatedly, and
intentionally lets a fresh Sheet import overwrite admin-made edits during
this transitional period where both the Sheet and the admin UI can edit
data.

## Auth & roles

Custom claim `roles` is an array (checked as `'editor' in ...`/
`'admin' in ...` in `firestore.rules`). `ManageAuth.jsx` currently
auto-grants `editor` to **any** signed-in non-anonymous user via the
`ensureEditorRole` callable — this is intentionally permissive today, not a
bug, but worth flagging if asked to tighten access control.

## Routing conventions

- `/map`, `/map/:caveId` — public browsing (crawlable, listed in the
  dynamic `/sitemap.xml` Cloud Function)
- `/caves`, `/caves/:caveId/edit`, `/sistemas`, `/sistemas/:sistemaId/edit`
  — editor-only CRUD, gated by the `RequireEditor` wrapper in `router.jsx`
- `/admin`, `/admin/reference/:collectionName` — dashboard + generic
  reference-data CRUD (also editor-only)
- Route **component files live under `src/routes/` mirroring their URL**
  (e.g. `routes/caves/CaveEdit.jsx`, not `routes/admin/AdminCaveEdit.jsx`)
  — keep new pages consistent with this rather than dumping everything
  under `routes/admin/`.
- Heavy/rarely-visited routes (admin section, auth pages, the 360°-photo
  viewer) use react-router's `lazy` property to keep them out of the main
  bundle. Heavy vendor libraries (mapbox-gl, MUI, Ionic, Firebase,
  Photo Sphere Viewer, Swiper) get their own chunks via `manualChunks` in
  `vite.config.js`.

## Gotchas (hard-won, don't relearn these)

- **Vite 8 uses Rolldown.** `build.rollupOptions.output.manualChunks` only
  accepts a function, not the legacy `{chunkName: [...]}` object form.
- **MUI 9.4.0's `SpeedDialAction`** uses `title` and `slotProps.fab`, not
  the older `tooltipTitle`/`FabProps` props from earlier MUI versions.
  Passing the old names doesn't error or warn — they silently leak as
  meaningless literal DOM attributes (`tooltiptitle="..."`), leaving the
  action with no accessible name at all. If a MUI component isn't behaving
  as some older doc/tutorial suggests, check the installed version's actual
  `.d.ts` first.
- **Ionic's sheet-style `IonModal`** (used for the mobile result pane)
  always sizes itself to `window.innerHeight`, ignoring any CSS `top`
  offset, `--height`, or `max-height` override. If content near the bottom
  is clipped, pad the content, don't try to resize the modal.
- **`window.innerHeight` is unreliable on mobile Chrome** (toolbar
  show/hide changes it live). Don't trust exact-pixel layout math derived
  from it without generous safety margins, and verify on a real device —
  headless Chromium won't reproduce this class of bug.
- **MUI `CardContent`'s built-in `&:last-child` padding rule** beats a
  plain `pb` override on the same element. Target `'&:last-child': { pb: ... }`
  explicitly in `sx`.
- **The Firestore client SDK rejects `undefined` field values outright**
  (unlike the Admin SDK, which just omits them). The shared model layer
  (`src/models/firestoreCollectionModel.js`) filters these before writing —
  reuse it rather than calling `setDoc` directly from a new admin form.
- **Local Firebase emulator processes can go stale** and silently lose all
  their function registrations after running a while. This shows up in the
  browser as a confusing CORS error on a callable function
  (`No 'Access-Control-Allow-Origin' header...`) even though the real cause
  is the function no longer existing server-side. Rule it out by hitting
  the function's HTTP endpoint directly (`curl -X POST
  http://127.0.0.1:5001/opencaves/<region>/<fn>`); a real registration
  problem responds with `Function ... does not exist, valid functions are:`.
  If in doubt, restart the emulators.
- Multiple emulator/dev-server processes can end up running simultaneously
  across a work session (yours and the user's). Check `netstat`/PIDs before
  assuming which instance is actually being hit.

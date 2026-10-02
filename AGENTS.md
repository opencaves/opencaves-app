# AGENTS.md

Guidance for AI coding agents working in this repository. Read this before making changes — several things here are non-obvious and have already caused real bugs.

## What this is

OpenCaves: a React/Vite/Ionic web app for finding cenotes (caves) in the Yucatán, backed by Firebase (Firestore, Auth, Storage, Cloud Functions, Hosting). Its data moved off a Google Sheet onto Firestore, edited in an in-app admin UI — see "Data model" below before assuming caves/sistemas data still comes from a spreadsheet.

## Stack

- React 19, Vite 8 (build output to `build/`, not `dist/`), react-router-dom v7 (data router, using the `lazy` route property for code splitting)
- Ionic React (`@ionic/react`) for mobile-style UI primitives (sheet modals, etc.), MUI (`@mui/material`) for everything else
- Design principles are based on **Material Design 3** — `src/theme/Theme.jsx` uses M3 token naming (`sys` typescale/motion/color roles, `oc` app tokens), emitted as CSS variables under MUI's `--mui-` prefix (see Gotchas); follow M3 conventions (color roles, typescale, motion tokens) for new UI rather than plain MUI defaults or ad hoc values
- Custom CSS custom properties (i.e. anything outside the M3 `--md-*` tokens above) must be prefixed `--oc-`, mimicking the OpenCaves namespace.
- Redux Toolkit + redux-persist for state
- Mapbox GL / `react-map-gl` for the map (not Google Maps, despite one legacy geocoding call to `maps.googleapis.com` in `Address.jsx`)
- Firebase: Firestore (data), Auth (custom-claim roles), Storage (media), Cloud Functions v2 (`functions/js/`, region `northamerica-northeast1`), Hosting (two sites: `opencaves` the main app, `opencaves-api` for `/v1/*`)
- `vite-plugin-pwa` (`injectManifest` strategy) builds `src/service-worker.js` into a real file with a precache manifest — Vite has no equivalent to CRA's webpack plugin for this, so don't remove that plugin config thinking it's redundant.
- i18n via `react-i18next`, locale files at `src/locales/{en,fr,es,yua}.json` — the app is in English, French and Spanish, plus a partial Yucatec Maya (`yua`) whose missing strings fall back to Spanish (`FALLBACK_LANGUAGES` in `src/config/appLanguages.js`). Outside services (geocoding, auth emails) get `toServiceLanguage()`, not the raw app language. **Never hardcode user-facing labels/strings in component files.** Add the string to both `en.json`/`fr.json` under a namespace matching (or nested under) the component's area — e.g. `quickActions`, `resultPane`, `map` — and render it via `useTranslation('namespace')`'s `t('key')`, following the existing components as precedent. This applies to every user-facing string: buttons, field labels, tooltips, placeholders, dialog text, aria-labels.
- `functions/py/` exists but is **not** in `firebase.json`'s `functions` config — it's not deployed, don't assume it's live.
- **Two kinds of languages — keep them distinct.** *App (UI) languages* are what the interface is shown in: en/fr/es, one per locale file, listed in `src/config/appLanguages.js`. *Content languages* are what cave data is written in (name translations, descriptions): data in the Firestore `languages` collection (ISO 639-2, e.g. eng, spa, myn), which can include languages the UI isn't translated into. The only bridge is `APP_TO_CONTENT_LANGUAGE` in `src/config/contentLanguages.js` (`toContentLanguage()` in `utils/lang.jsx`).

## Config

- Values that describe the product (region, languages, coordinate precision, sizes and timings shared by several components) or that several files must agree on live in `src/config/`; constants that only matter to their own file stay next to their code.
- Config values are `UPPER_SNAKE_CASE` (`APP_NAME`, `PANE_WIDTH`, `INITIAL_VIEW_STATE`, `COORDINATE_DECIMALS`…). The Firebase service handles in `src/config/firebase.js` (`db`, `auth`, `storage`, `functions`, `app`) are live objects, not config values, and stay camelCase.
- `src/services/data-service/` is also loaded by the Node migration script, so it must import config with relative paths, not the `@/` alias — and config files it uses must not import anything browser-only.

## Code comments

Add short comments where they clarify non-obvious behavior, constraints, or reasoning. Keep comments concise and avoid narrating code that is already self-explanatory.

## Documentation

How-to guides for people running and maintaining the app (maintenance tasks, bulk imports) live in `docs/`, listed in `docs/README.md`. Write new guides there, as lowercase kebab-case `.md` files, and add them to that index; keep only `README.md`, `CHANGELOG.md` and `AGENTS.md` at the root. When a command below changes, update its guide too (most are covered in `docs/maintenance.md`).

## Commands

The Node scripts in `scripts/` print their help when run with no arguments (or `-h`), and do nothing else: keep it that way in new ones. Scripts that target the local emulators by default take `-l`/`--local` to run with no other option, and `-p`/`--production` for the real project.

- `npm run dev` — Vite + Firebase emulators together (imports seed data from `./.emulator-data`, and `scripts/emulator-autosave.js` saves the emulators' data back to it every minute while they run, so emulator state persists across restarts - not `--export-on-exit`: concurrently force-kills the emulators on Windows, and the emulators' export can't move its result from the temp folder to another drive, so it never saved anything; this folder is **not** tracked in git — only `.emulator-data/.gitignore` is — so a fresh clone or a wiped `.emulator-data` starts with an empty database and needs `node scripts/migrate-sheet-to-firestore.js -l` run once against the emulator to populate it)
- `npm run build` — production build (warns when the cave layer's tiles are missing)
- `npm run build:tiles` — builds the cave layer's vector tiles (`public/tiles/caves/`, not in git) from the traced maps in `_data/map-layer/scans/`; needs Docker running. Rerun after changing a map, before building/deploying (see `docs/map-layer.md`)
- `node scripts/migrate-sheet-to-firestore.js -l` — seed/sync Firestore from the Google Sheet against the local emulator (`127.0.0.1:8080` by default, overridable via `FIRESTORE_EMULATOR_HOST`); add `-p`/`--production` to run against the real project (requires `gcloud auth application-default login` first)
- `node scripts/set-user-roles.js <email> --add admin` (or `--remove`, roles `editor`/`admin`) — changes an account's `roles` claim, keeping its others; the local Auth emulator by default, `-p`/`--production` for the real project (after `gcloud auth application-default login`). Needed to bootstrap the first admin, since the in-app Users page only works for existing admins. The user must sign out and back in to pick up the change.
- `node scripts/check-cave-images.js -l` (`-p` for production, `--cave=<id>` for one cave - with "=", since cave IDs start with "-") — read-only integrity check of the cave photos: every `cavesAssets` photo has its original and all its thumbnails in Storage, belongs to an existing cave, each cave has exactly one cover, and no file is left without a photo (including `images/failed/` copies the resize leaves when it fails). Exits 1 when it finds problems. Run it after a bulk photo import (see `docs/photos-import.md`) or a change to the asset functions.
- `node scripts/tag-lengths.js -l` (`-p` for production) — turns the plain-text lengths in the Markdown fields into `:length[...]` tags, shown in each reader's units; a dry run that lists the changes unless `--write`. Rerun after a Google Sheet sync, which brings the untagged text back.
- `firebase deploy` — deploys everything; scope with `--only hosting`, `--only functions`, or `--only functions:js:<name>` for a single function
- `gcloud storage buckets update gs://opencaves.appspot.com --cors-file=storage.cors.json` — applies the Storage bucket's CORS config, which `firebase deploy` does **not** carry. The app loads bucket images with `crossOrigin="anonymous"` (so the service worker caches them at real size instead of as opaque responses), so without this CORS config those images fail to load entirely.
- No test suite currently exists in this repo.

## Commit messages

All commit messages must be written in English, regardless of the language used elsewhere in the conversation or in the app's UI/locale strings.

Do not append a `Co-Authored-By: Claude ...` (or similar agent-attribution) trailer to commits in this repo, even if a session's default instructions call for one.

Always push right after committing, as part of the same action rather than a separate, later step.

## Data model

Firestore collections: `caves`, `sistemas`, `connections`, `accesses`, `accessibilities`, `sources`, `areas`, `colors`, `languages` (cave data), plus `cavesAssets` (media) and `maps`. Per-user data lives under `users/{uid}`: `savedCaves/{caveId}` and `ratings/{caveId}` (one 1–5 rating per cave, editors/admins only; a cave's average is a collection-group query on `ratings` by `caveId`, whose index is in `firestore.indexes.json`). Document IDs are Firebase push-ID—formatted and stable (carried over from a previous Firebase-backed version of the app, then a stint on a Google Sheet, now back to Firestore).

Two things are **deliberately** computed client-side at read time, not stored in Firestore, so they can't go stale as records are edited independently of each other:

- Per-cave sistema ancestry (walking `connections`) — see `postProcessCaveData.js`.
- Cave-name markdown auto-linking (`[cenote X](oc:id)`) — same file.

`scripts/migrate-sheet-to-firestore.js` is re-runnable and **fully replaces** each collection on every run (writes current Sheet data, deletes anything else already in that collection). The exception is fields the app owns - a sistema's `maps` (no Sheet column) and `explorations` (the app is now their source of truth; the Sheet's value only fills a sistema that has none): they're listed in its `APP_ONLY_FIELDS` and carried over, so add any new app-owned field there. — safe to re-run repeatedly, and intentionally lets a fresh Sheet import overwrite admin-made edits during this transitional period where both the Sheet and the admin UI can edit data.

## Map layer

`scripts/map-layer/` turns cave survey maps into vector data placed on the ground (configs in `scripts/map-layer/maps/`, outputs in `_data/map-layer/`), shown in the app as vector tiles (`npm run build:tiles`). Read [docs/map-layer.md](docs/map-layer.md) before processing a map - several rules there are not obvious: the north arrow and scale bar are never trusted alone, `"unverified"` maps never reach the database, two lines that don't touch are a jump, map entrances are cenote entrances, cenotes found on maps go to `found-cenotes.json` (never straight to the database or the Google Sheet), and the layer is for underwater caves.

## Auth & roles

Custom claim `roles` is an array (checked as `'editor' in ...`/ `'admin' in ...` in `firestore.rules`). `ManageAuth.jsx` currently auto-grants `editor` to **any** signed-in non-anonymous user via the `ensureEditorRole` callable — this is intentionally permissive today, not a bug, but worth flagging if asked to tighten access control.

## Routing conventions

- `/map`, `/map/:caveId` — public browsing (crawlable, listed in the dynamic `/sitemap.xml` Cloud Function)
- `/map/:caveId` is served by the `cavePage` Cloud Function (`functions/js/seo/cavePage.js`, a Hosting rewrite): the site's `index.html` with the cave's title, description, canonical link and text already in it, because Google's renderer doesn't run the app. The app then replaces `#root` and reuses those `<head>` tags (`src/utils/headTags.js`); keep the two in step when changing a cave page's SEO. CDN-cached for an hour (`firebase.json` headers).
- `/caves`, `/caves/:caveId/edit`, `/sistemas`, `/sistemas/:sistemaId/edit` — editor-only CRUD, gated by the `RequireEditor` wrapper in `router.jsx`
- `/dashboard`, `/:collectionName` (`/accesses`, `/accessibilities`, etc.) — dashboard + reference-data CRUD (also editor-only)
- Route **component files live under `src/routes/` mirroring their URL** (e.g. `routes/caves/CaveEdit.jsx`, not `routes/dashboard/AdminCaveEdit.jsx`) — keep new pages consistent with this rather than dumping everything under `routes/dashboard/`.
- Heavy/rarely-visited routes (admin section, auth pages, the 360°-photo viewer) use react-router's `lazy` property to keep them out of the main bundle. Heavy vendor libraries (React, mapbox-gl, MUI, Ionic, Firebase, Photo Sphere Viewer, Swiper) get their own chunks via `codeSplitting.groups` in `vite.config.js`. Ionic is phone-only: it is only ever imported through `src/utils/ionic.js`, loaded on demand (`loadIonic()`), so desktop never downloads it - don't import `@ionic/react` directly anywhere else.

## Gotchas (hard-won, don't relearn these)

- **The theme's CSS variables are `--mui-*`, not `--md-*`.** The theme used to come from `@mui/material-next`, whose `extendTheme` prefixed them `--md-`; it now uses `@mui/material/styles`' `extendTheme` (no `cssVarPrefix`), which emits `--mui-palette-*`, `--mui-sys-*`, `--mui-oc-*`. Code still written against the old names (`var(--md-palette-…)`, `var(--md-sys-…)`) resolves to nothing, silently: no error, just a missing color/size - e.g. the phone result sheet was transparent below short content. Use `theme.vars.*` in `sx`/styled (prefix-agnostic), or `--mui-*` in SCSS. The old references were all renamed (2026-10); a token the theme doesn't define (e.g. M3 typescale) resolves to nothing too, so add it to the theme or write its value.
- **Vite 8 uses Rolldown.** Vendor chunks are Rolldown's `output.codeSplitting.groups` (`manualChunks` is deprecated there, and only accepted a function anyway). A group also captures its modules' dependencies (`includeDependenciesRecursively`, on by default), so group **priority** decides who owns shared code: with plain `manualChunks`, Ionic's chunk captured React, and every page - desktop included - had to load Ionic just to get React. Keep React the highest priority and Ionic the lowest. Check `build/index.html`'s `modulepreload` list after changing groups.
- **MUI 9.4.0's `SpeedDialAction`** uses `title` and `slotProps.fab`, not the older `tooltipTitle`/`FabProps` props from earlier MUI versions. Passing the old names doesn't error or warn — they silently leak as meaningless literal DOM attributes (`tooltiptitle="..."`), leaving the action with no accessible name at all. If a MUI component isn't behaving as some older doc/tutorial suggests, check the installed version's actual `.d.ts` first.
- **Ionic's sheet-style `IonModal`** (used for the mobile result pane) always sizes itself to `window.innerHeight`, ignoring any CSS `top` offset, `--height`, or `max-height` override. If content near the bottom is clipped, pad the content, don't try to resize the modal.
- **`window.innerHeight` is unreliable on mobile Chrome** (toolbar show/hide changes it live). Don't trust exact-pixel layout math derived from it without generous safety margins, and verify on a real device — headless Chromium won't reproduce this class of bug.
- **MUI `CardContent`'s built-in `&:last-child` padding rule** beats a plain `pb` override on the same element. Target `'&:last-child': { pb: ... }` explicitly in `sx`.
- **The Firestore client SDK rejects `undefined` field values outright** (unlike the Admin SDK, which just omits them). The shared model layer (`src/models/firestoreCollectionModel.js`) filters these before writing — reuse it rather than calling `setDoc` directly from a new admin form.
- **Local Firebase emulator processes can go stale** and silently lose all their function registrations after running a while. This shows up in the browser as a confusing CORS error on a callable function (`No 'Access-Control-Allow-Origin' header...`) even though the real cause is the function no longer existing server-side. Rule it out by hitting the function's HTTP endpoint directly (`curl -X POST http://127.0.0.1:5001/opencaves/<region>/<fn>`); a real registration problem responds with `Function ... does not exist, valid functions are:`. If in doubt, restart the emulators.
- Multiple emulator/dev-server processes can end up running simultaneously across a work session (yours and the user's). Check `netstat`/PIDs before assuming which instance is actually being hit.

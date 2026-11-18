# OpenDives data needs (API requirements)

What OpenDives would like to read from OpenCaves through an API, noted from
its document [opencaves-data-needs.md](https://github.com/remillc/opendives/blob/main/docs/opencaves-data-needs.md)
(13 November 2026, commit `7362a3e0`), and how it compares with what
OpenCaves holds today. Nothing is built yet: it's input for the API's design
(the to-do "an easy REST API"). The source document says its field names are
suggestions and nothing in it is a commitment for OpenCaves.

## What OpenDives is and wants

OpenDives is a mobile dive log (Android first, then iPhone) built on the
Subsurface core. It wants to:

1. **Find a site's position:** when a diver creates or cleans up a dive
   site, suggest the matching cave (name, coordinates, country, region). The
   values are copied into the diver's log only once the diver confirms.
2. **Show a cover photo** on a site's page, with its author, its licence and a
   link to the cave's page.
3. **Link back:** a "View on OpenCaves" link (« Voir sur OpenCaves ») wherever
   the data shows, for access, fees and surveys.
4. **Work offline:** keep a small local copy of the caves near the diver's
   sites, refreshed when online.

It does **not** want descriptions, access details, surveys or videos: those
stay on OpenCaves.

## The fields it asks for, against OpenCaves today

| Asked for | OpenCaves today | Gap |
|---|---|---|
| `id`, stable, never reused | The record's push id: stable, kept through renames | None. Merges delete one of the records today |
| `name` | `name` (`LocalizedName`) | Choose which language's name to send |
| `altNames` (spellings, with and without accents) | `aka`, `nameTranslations` (by content language) | Flatten them; accent-free spellings are for the search, not the data |
| `system` `{ id, name }` | `sistemaId`, the system's `name` | None |
| `lat`, `lon` (WGS 84, 5+ decimals) | `location` (and `entrance`, `parking`) | Which point: `entrance` when set, else `location`? `COORDINATE_DECIMALS` |
| `positionAccuracy` (exact / approximate / metres) | `location.validity`: `valid`, `unknown`, `invalid` | Map `valid` to exact, `unknown` to approximate. Leave out `invalid`? No accuracy in metres |
| `country` (ISO 3166-1), `region`, `locality` | `area` only (e.g. Tulum, Akumal); the address comes on demand from Google (`caveAddress`) | New fields, or derive them: all caves are in MX / Quintana Roo or Yucatán today (`REGION_BBOX`). Google's geocoding terms limit storing its results |
| `type` (`cenote`, `cave`, `spring`, `sinkhole`) | `cenoteEntrance` (boolean) only | A new field, or derive one roughly |
| `maxDepthM` | A system's `maxDepth`; caves have none | Send the system's, or add the field to caves |
| `waterType` (fresh, salt, brackish, halocline) | None | A new field |
| `url` | `/caves/<id>` | None |
| `updatedAt` | Caves have no change date; `_auditLog` has every change from the app (12-month TTL, server-only); scripts write without it | An `updatedAt` kept by the server (a trigger on writes) |
| `deleted`, `mergedInto` (in "changed since" answers) | Deletes are in `_auditLog` only; merges aren't recorded | Tombstones (a small `_deletedCaves` list), `mergedInto` set when merging |

**Cover photo:**

| Asked for | OpenCaves today | Gap |
|---|---|---|
| `photo.url`, `photo.width`, `photo.height` | The cover (`cavesAssets`, `isCover`), its size, its public copies | None |
| `photo.thumbUrl` (~400 px, ≤ 60 KB) | `mediaThumbnail` (400 x 800 inside), `coverImage` (601 x 338) | Check the file sizes |
| `photo.author` | `author` on each photo (public): all 141 photos are Christian Rémillard's, set in production on 2026-11-13 | A photo uploaded since has none: fill it at upload (the uploader's display name, with their consent) or by script. "No photo is better than one with an unknown author" |
| `photo.licence` | `licence` on each photo: `CC-BY-SA-4.0` (the terms' licence for contributions), set with `author` | The same, for new uploads |
| `photo.sourceUrl` | The photo's viewer page in the app | None |
| `photo.alt` | None (the pages' alts are generated from the cave's name) | Generate one the same way |

## The requests it asks for

All read-only, JSON, no account, WGS 84, paged (`limit`, `cursor`,
`nextCursor`), gzip:

1. **Near a point:** `GET /caves?near=lat,lon&radius=5000&limit=20`, by
   distance, with `distanceM`.
2. **By name:** `GET /caves?q=dos%20ojos`. Words in any order, accents and case
   ignored, over `name` and `altNames`, can be combined with `near`.
3. **One cave:** `GET /caves/{id}`.
4. **In a box:** `GET /caves?bbox=minLon,minLat,maxLon,maxLat`, for the offline
   copy.
5. **Changed since:** `GET /caves?changedSince=<ISO date>&bbox=...`, with the
   changed, added, deleted and merged caves.

A box of about 1,000 caves without photos must stay under about 300 KB (gzip).
The whole database (about 900 caves) fits in one answer. A static file
rebuilt on each change, plus a changes feed, could serve requests 3 to 5 with
no function call. Requests 1 and 2 could run in the app's client, or in a
function over the cached data, as `loadPageIndex` does.

## Licence and use

- OpenDives asks for a clear licence that allows showing the data, keeping an
  offline copy, and copying a name and position into a diver's own log.
  It suggests ODbL or CC BY. The terms already say **CC BY-SA 4.0**, credit
  "OpenCaves and contributors". To check: ShareAlike, for names and positions
  copied into personal logs.
- OpenDives will show "OpenCaves data" (« Données OpenCaves ») with a link,
  the photo credit, and the OpenCaves warning: incomplete or outdated data,
  not for dive planning.
- Volume: one app, a few requests per diver per day plus one offline
  refresh. It identifies itself with a `User-Agent` (`OpenDives/1.x`) or an
  API key, whichever OpenCaves prefers. To decide: CORS, rate limits, App
  Check (the API must stay open to an outside app).

## Later, not needed now

- Corrections sent from OpenDives (a better position measured at the
  entrance), with the diver's consent: a fit for `_feedback` reports.
- Entrances as separate points when a system has several: caves are already
  entrances, linked to their system.
- Names and fields in French and Spanish as well as English.

## Contact

Christian Rémillard, for OpenDives.

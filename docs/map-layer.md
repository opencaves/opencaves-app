# The cave map layer

The map layer turns cave survey maps (scans, photos, vector PDFs, line plots
over satellite imagery) into vector data placed on the ground: walls, survey
lines, the water, and typed symbols (depths, restrictions, flow...). It is
open data (CC BY-SA); the warnings say it is not for dive planning. The
scripts are in `scripts/map-layer/`, one config per map in
`scripts/map-layer/maps/<map>.json`; the outputs go to
`_data/map-layer/scans/` (not in git). The symbols' vocabulary and each map
author's conventions are in [map-symbols.md](map-symbols.md).

The layer is for **underwater caves**: a map of a mostly dry cave is skipped,
even when it traces and places well.

## Processing a map

Run from `scripts/map-layer/`, with `<out>` = `../../_data/map-layer/scans`:

```
python trace_scan.py maps/<map>.json <out>       # walls, details, water (also OCRs the map)
python extract_symbols.py maps/<map>.json <out>  # typed symbols
python trace_scan.py maps/<map>.json <out>       # again: symbols' ink isn't drawn as detail
python overlay_scan.py maps/<map>.json <out>     # <map>-overlay.html, to review on the satellite
python cenote_candidates.py <out>/cenote-review.xlsx maps/*.json   # the cenotes, against the database
```

Vector PDFs whose walls are separable strokes use `build_layer.py` instead.
Two scripts prepare an image before tracing: `rectify_photo.py` straightens a
photographed map (and can undo lens distortion, glare and a poster's weave),
and `fill_passages.py` tints the white passages of a bold-wall scan so the
`colour-fill` method can trace them. A map that needs its own preparation
has a script in `prep/` (e.g. `prep/joolis.py`, which merges two editions of
the Joolis map); run it before tracing.
Every script's docstring documents its options; the config keys are
documented where the code reads them.

## Placement

A map is placed with a similarity fit (scale, rotation, shift) on control
points, or by its scale bar and north plus one or more points.

- **Never trust the north arrow or the scale bar alone.** Old magnetic norths
  were several degrees off (Mayan Blue 6.4°, Xel-Há 9.9°) and printed scale
  bars can be wrong (Xel-Há, Yax Chen). Check against the ground: cenote
  ponds visible on the satellite, OpenStreetMap roads and water, and the maps
  already placed in the same area.
- **Trusted positions:** a cave whose coordinates have the *Open Caves*
  source was usually located on site; other sources (Gerrard, diveseven,
  Google Maps, older maps) may be off by hundreds of metres.
- **Unverified maps:** when no cenote of a map has a reliable position (only a
  guess, like a clearing in the canopy), its config carries
  `"unverified": "<why>"`. Its traced geometry never goes into the local or
  production database, and no cenote position is taken from it. What its text
  tells (names, exploration history, depths, the cenotes it lists) is still
  used to correct the database, and the map file stays attached to its
  sistema.

## Tracing

- The passages' **water** fill is decided per map by the user (`"water"`;
  `waterPolygons` limits it to some areas, e.g. a cenote's open water).
- A **stick map** (survey lines only) is traced as lines, with no thickness: they are the Arianne line (the guideline laid in the cave), kind `arianne`, drawn on its own (a continuous yellow line).
- Two lines that don't touch on a map are a **jump**, not a tracing gap:
  gaps are closed only where the map's ink runs on.
- Leader lines, cross-sections and their marks, labels and the page border are
  not drawn; pillars and islands are walls; the drawn details between the
  walls (boulders, slopes...) are kept.

## Symbols

Kept on every map: overlined or underlined numbers (depths), circled ones
(ceiling heights), boxed ones (pit depths), restrictions and other letter
codes, "To ..." and "passage continues" pointers (`leads-to`), named places in
the cave (`place-name`), water-flow arrows (`flow`, with their true
`bearing`), and **bones**, searched for carefully on every map. An entrance is
kept as an `entrance` (a blue dot in the overlay) only when the map **writes**
it as one - "Entrance", "Entrada", "Entrée", "Ent." (config `"written": true`)
- or it's known to be one (`"knownEntrance": true`: the user's first-hand
knowledge, such as the cenotes of their dive log). A cenote dot, an outline or
a cenote's mere presence on a map isn't an entrance: those stay in the
config's `entrances` to place the map, with `"written": false`.

## Cenotes and the database

- `cenote_candidates.py` compares the maps' entrances with the **local
  emulator database** (the reference) and keeps what the database lacks in
  `scripts/map-layer/found-cenotes.json`, for a later direct import: new
  cenotes, positions for caves without one, names for unnamed caves.
  Nothing is written to the database, and nothing goes to the Google Sheet.
  `found_cenotes_map.py <out.html>` shows them on a map for review;
  `node scripts/map-layer/import-found-cenotes.js -l` (or `-p`) then imports
  them: new caves, positions (validity `unknown`), names and cenote-entrance
  flags - only what is missing, so it can be rerun. A Google Sheet sync
  replaces the caves collection: run it again afterwards.
- A position read off a map is always to be verified on site (`validity`
  `unknown`). A database position marked `invalid` may be replaced by a map's;
  one taken on site (*Open Caves* source) never is.
- An entrance **written** on a dive survey (or known to be one) is a cenote
  entrance (the caves' `cenoteEntrance` flag): matched caves not yet flagged
  are kept aside too. Unwritten entrances set no flag. (Before 2026-10-03 any
  marked entrance did; 304 caves were unflagged then, backed up in
  `_data/backups/local-entrances-*.json`.)
- A map's exploration history goes to its sistema through
  `explorations_from_maps.py`, unless it is already there.

## The layer in the app

Each map config has a stable `"id"` (a push id, the drawing's key in the app:
the tiles' `map` property, `maps.json`, the hidden drawings list) and, when
it was traced from an imported scan, a `"mapImportKey"` (that scan's `maps`
document's `importKey`, the same in every database). A config traced from a
cleaned-up or straightened copy names the imported scan in `"importImage"`.
After adding a config, give it its id - never change one afterwards:

```
node scripts/map-layer/assign-ids.js --dry-run   # what would be added
node scripts/map-layer/assign-ids.js --write
```

`npm run build:tiles` stops on a config without an id. It turns every placed map's traced output (unverified maps
left out) into vector tiles in `public/tiles/caves/` - layers `passages`
(walls, Arianne lines, water, details, reliefs, slopes) and `symbols`, each feature with its
`map` and `sistemaId`. It runs tippecanoe in Docker (the image is built from
`scripts/map-layer/tippecanoe.Dockerfile` the first time). The tiles aren't in
git (they come from `_data/`): rebuild them after changing a map, before
`npm run build`, which warns when they're missing; Hosting serves them with
the app. The app draws them in `src/components/Map/CaveLayer.jsx`, coloured by
sistema from the database.

The build also lays each map's image on the ground, for the admin's Map layers
page, where a map opens its original next to its drawing (a divider dragged
sideways): `scripts/map-layer/georef_scans.py` (Python, like the tracing
scripts) writes the image the drawing was traced from, reduced to 2048 px, and
its four corners, placed like the drawing - in `_data/map-layer/georef/`,
redone only for a map whose config or image changed. They're copied to
`public/tiles/caves/scans/<id>.webp`, and `maps.json` gives each map's corners
(`scan`).

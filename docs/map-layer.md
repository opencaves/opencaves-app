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

## Maps added in the app

A map an editor adds in the app (a `maps` record with no `importKey`; the bulk
import's maps are another work list) is **to process** until a config names
it or an admin marks it **not for the layer**. Nothing is stored for it: the
status is worked out from the map records and `configs.json`, which the tiles
build writes (every config's map and state, unverified and untraced ones
included). Admins see the list in the Map layers page's **To process** tab
(the count also shows on the dashboard), with who added each map and when.
"Not for the layer" asks for a reason (a cross-section, a dry cave, a sketch,
a duplicate...) and can be undone there.

Each of these maps also gets a task on the admins' Tasks page (`/tasks`),
which says whether its system is already in the layer (and from an older
survey or not) or whether it duplicates a map OpenCaves has; the server reads
the layer from the published `maps.json` and `configs.json`, so the task closes
by itself once the tiles naming its map are deployed (see
[maintenance.md](maintenance.md), "Map tasks").

To process them:

```
node scripts/map-layer/to-process.js -l            # list them, download their files to _data/map-layer/inbox/
node scripts/map-layer/to-process.js -l --config   # also start a config for each image map
```

(`-p` for production.) A config made for such a map carries `"mapId"` - its
`maps` record's id - instead of `"mapImportKey"`; give it its `"id"` with
`assign-ids.js` as any other. The map leaves the list once `npm run build:tiles`
has run with its config.

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

Two prototypes help start a config; they are not part of the steps above,
and `npm run build:tiles` doesn't run them:
- `prepare_scan.py <image> <name> <output folder>` OCRs a scanned (or
  straightened) map, keeps the text lines naming a cave of the **local
  database** that has a position, and finds the largest group of them that
  agree on one similarity fit (at least three; namesakes and misreadings are
  left out). It writes a starting `maps/<name>.json` (only reports if it
  exists) and crops of each control point to review: the points sit on the
  labels, not the openings, so each one is still moved and checked by hand
  (see "Placement").
- `profile_vector.py <maps-import folder> <output folder>` profiles the vector
  PDF maps listed in a maps-import folder's `matched.csv`: their stroke
  styles and how much line each draws, the scale bar's and the north
  indication's words, and the cave names that match a positioned cave of the
  local database (the control points available - a map with none can't be
  placed yet). Writes `vector-profiles.json` and prints a summary.
Every script's docstring documents its options; the config keys are
documented where the code reads them.

## Placement

A map is placed with a similarity fit (scale, rotation, shift) on control
points, or by its scale bar and north plus one or more points - and, for a
map that bends, a warp after it (see "Warp").

- **Never trust the north arrow or the scale bar alone.** Old magnetic norths
  were several degrees off (Mayan Blue 6.4°, Xel-Há 9.9°) and printed scale
  bars can be wrong (Xel-Há, Yax Chen). Check against the ground: cenote
  ponds visible on the satellite, OpenStreetMap roads and water, and the maps
  already placed in the same area.
- **Trusted positions:** a cave whose coordinates have the *OpenCaves*
  source was usually located on site; other sources (Gerrard, diveseven,
  Google Maps, older maps) may be off by hundreds of metres.
- **Unverified maps:** when no cenote of a map has a reliable position (only a
  guess, like a clearing in the canopy), its config carries
  `"unverified": "<why>"`. Its traced geometry never goes into the local or
  production database, and no cenote position is taken from it. What its text
  tells (names, exploration history, depths, the cenotes it lists) is still
  used to correct the database, and the map file stays attached to its
  sistema.

## Warp

A map whose drawing bends away from the ground - right in one part, tens of
metres off in another, with no single scale, rotation and shift fitting it
everywhere - can be **warped**: a smooth correction (a thin-plate spline,
`scripts/map-layer/warp.py`) applied after its similarity placement. It's
off unless the config has a `"warp"` (the keys are documented in `warp.py`).
`raster_placement` and `vector_placement` apply it, so everything placed
through them moves alike - the traced lines, the symbols, the cenotes, the
overlay - and the image laid on the ground for the Map layers page's
original-vs-drawing viewer is **resampled** (north up, transparent outside
the map, each pixel where the warp puts it) instead of laid by its four
corners, which can't follow a bend. Retrace the map after changing a warp
(`trace_scan.py`, `extract_symbols.py`, `trace_scan.py`), then
`npm run build:tiles`.

- **When:** only when a better-placed survey of the same passages shows the
  map bending, measurably and over areas (not one spot), and a similarity
  or affine fit can't make them overlap. The better map must be placed
  independently of this one (no control point borrowed from it). Never to
  make a single cenote land on its database position: the control points
  and their residuals say how good the placement is.
- **Pairs** (`"pairs"`: a pixel and where it belongs on the ground) come
  from matching areas, not single points: on a grid (about 300 m) over the
  better map's passages, the translation that best lays them on this map's
  lines nearby (about 400 m). **Check every pair visually** - both maps'
  passages, and this map's moved by the pair's shift: a single elongated
  passage lets the shift slide along it, parallel passages let it jump to
  the wrong one, an area across a fold mixes two shifts. Drop the doubtful
  ones (keep them in `"dropped"` with the reason).
- **Limits:** `"extent"` (this map's pixels) keeps the warp to where the
  pairs are, fading out over `"fadeMetres"` beyond; `"pins"` and
  `"pinControlPoints"` hold the page's corners and the independent control
  points where the similarity put them. Choose `"smoothing"` by
  leave-one-out (`python warp.py maps/<map>.json` prints it, with each pair's
  distance before and after).
- **Check:** before/after overlays of both maps (the whole map and
  close-ups of the most moved areas), and the warp's own report. Record in
  the warp's `"why"`: the pairs' source, how many were dropped and why, the
  smoothing, and the gaps between the two maps before and after (median and
  90th percentile) - plus any independent check (satellite pools). The
  pairs' ground positions come from the other map's placement: if that one
  changes, redo them.

`maps/ox-bel-ha-2011.json` is the first warped map (onto the GEO 1999
survey).

## Tracing

- The passages' **water** fill is decided per map by the user (`"water"`;
  `waterPolygons` limits it to some areas, e.g. a cenote's open water).
- A **stick map** (survey lines only) is traced as lines, with no thickness: they are the Arianne line (the guideline laid in the cave), kind `arianne`, drawn on its own (a continuous yellow line).
- The **gold line** - a special guideline that starts in the cavern (the
  daylight zone), and may run on to the next cenote (in Taj Mahal it links
  two cenotes) - is its own kind, `gold`: a wider, deeper gold line than the
  Arianne line. Maps draw it in yellow ("golden lines", "Führungsleine" on a
  cavern sign). On a stick map (`"method": "survey-lines"`), `goldColours`
  (e.g. `["yellow"]`) traces it apart from the other lines, with its own
  `goldEraseLines`/`goldAddLines`; elsewhere `goldLines` draws it by hand
  (pixel polylines, like `arianneLines`).
- An Arianne line the tracing can't find (faint, or drawn like the rest) is
  drawn by hand: `python line_editor.py maps/<map>.json` opens the scan in the
  browser, with the config's `arianneLines` and the traced walls; draw, edit
  or delete lines there, and Save writes them into the config and retraces
  the map.
- Two lines that don't touch on a map are a **jump**, not a tracing gap:
  gaps are closed only where the map's ink runs on.
- Leader lines, cross-sections and their marks, labels and the page border are
  not drawn; pillars and islands are walls; the drawn details between the
  walls (boulders, slopes...) are kept.
- **Slopes** (kind `slope`) are drawn as the maps draw them: a line across
  the slope with its ticks hanging downhill. On a `colour-fill` map whose
  slopes are their own colour (`colouredLines`), each slope's own line and
  ticks are kept (`"slope": {"asDrawn": false}` redraws them evenly instead);
  slopes marked by hand (`slopeAreas`) are redrawn evenly in the same style
  (`slope_drawings`).
- Labels never count as passage. On a `colour-fill` map with `greyFill`, dark
  text reads as fill and the walls wrap round it: `inkColours` masks the ink
  of a colour (e.g. red depth numbers and labels) by hue, saturation and
  value, as text-sized pieces (`minPx`, `maxExtentPx`), and keeps as passage
  the pieces written inside a passage (`inSymbolBoxes` limits it to the
  boxes of the symbols `extract_symbols.py` placed, `exceptNear` leaves out
  ink next to another colour); a fill colour's `maxSaturation` leaves out a
  stronger ink of the same hue. `clearSymbols`, last of all, redraws each
  symbol box lying mostly in a passage from the band around it, so a number
  on a wall neither bulges it nor dents it. Hand-drawn `fillPolygons` with
  `fillPolygonsOverMasks` are passage as drawn, over those masks (e.g.
  `maps/sagitario-la-mina-macdonald-2020.json`).

## Symbols

Kept on every map: overlined or underlined numbers (depths), circled ones
(ceiling heights), boxed ones (pit depths), restrictions and other letter
codes, "To ..." and "passage continues" pointers (`leads-to`), named places in
the cave (`place-name`), water-flow arrows (`flow`, with their true
`bearing`), and **bones**, searched for carefully on every map. An entrance is
kept as an `entrance` (a green ring in the overlay; the map's other cenotes are blue dots) only when the map **writes**
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
  Cenotes of the same name found close together on several maps are one;
  unnamed entrances are never merged (several unnamed openings of one cenote
  are each kept). A config entrance's `"note"` (e.g. "unnamed entry near
  Sagitario") is copied to its entry, for the import's review.
  `found_cenotes_map.py <out.html>` shows them on a map for review;
  `node scripts/map-layer/import-found-cenotes.js -l` (or `-p`) then imports
  them: new caves, positions (validity `unknown`), names and cenote-entrance
  flags - only what is missing, so it can be rerun. A Google Sheet sync
  replaces the caves collection: run it again afterwards.
- A position read off a map is always to be verified on site (`validity`
  `unknown`). A database position marked `invalid` may be replaced by a map's;
  one taken on site (*OpenCaves* source) never is.
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
its four corners, placed like the drawing (a warped map's image resampled
on the ground, see "Warp") - in `_data/map-layer/georef/`,
redone only for a map whose config or image changed. They're copied to
`public/tiles/caves/scans/<id>.webp`, and `maps.json` gives each map's corners
(`scan`).

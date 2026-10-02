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
- A **stick map** (survey lines only) is traced as lines, with no thickness.
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
`bearing`), and **bones**, searched for carefully on every map. Every place a
map marks as an entrance is kept as an `entrance` (a blue dot in the overlay).

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
- An **entrance on a dive survey is a cenote entrance** (the caves'
  `cenoteEntrance` flag): matched caves not yet flagged are kept aside too.
- A map's exploration history goes to its sistema through
  `explorations_from_maps.py`, unless it is already there.

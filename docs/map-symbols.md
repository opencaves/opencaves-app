# Cave map symbols

The shared vocabulary for the symbols taken from the cave maps into the map
layer (see the scripts in `scripts/map-layer/`). Each map draws its symbols
its own way: its config translates them into these types, so the layer shows
one set of icons whatever the map's author used.

Every symbol becomes a point with:

- `type`: one of the types below;
- `value` and `unit`: for measured types, always in **metres** (converted from
  the map's units);
- `label`: the sign as written on the map ("x", "19", "p.1607"), so nothing is
  lost when a map's convention differs from the vocabulary.

## Types

| Type | Meaning | Value | Icon (proposed) |
|---|---|---|---|
| `restriction-minor` | Passage narrows; a diver passes, single file | - | `r` |
| `restriction-major` | Passage narrows a lot; sidemount at least, or impassable | - | `X` |
| `visibility-zero` | Expect zero visibility (silt, clay) | - | `z` |
| `silt` | Silt floor | - | `s` |
| `depth` | Depth at that point | metres | ↓ value |
| `ceiling-height` | Ceiling-to-floor height | metres | ↕ value |
| `penetration` | Distance from the nearest entrance | metres | p value |
| `entrance` | Cenote or cave entrance (also kept as a cenote, see `found-cenotes.json`) | - | dot |
| `unexplored` | Unexplored continuation ("?") | - | ? |

Not taken yet (drawn shapes, hard to recognise on scans and photos, and
cartographic detail rather than information for divers or visitors):
boulders, breakdown, columns, speleothems, slopes, silt dunes, undercut and
overcut sections, domes, pits, chimneys, flow. They can be added as types when
a reliable way to read them exists (on vector maps first).

## Conventions met so far

### QRSS (Quintana Roo Speleological Survey) maps

Letter codes beside the passage, measurements in **feet**:

| On the map | Type |
|---|---|
| `r` | `restriction-minor` (the 2000 Sac Actun map: "divers pass in single file") |
| `x` / `X` | `restriction-major` ("sidemount cannot pass") |
| `z` / `Z` | `visibility-zero` |
| `s` / `S` | `silt` |
| overlined number (<u>19</u>) | `depth` |
| circled number (⑨) | `ceiling-height` |
| `p.1607`, `P 1446` | `penetration` |
| `CE` | `entrance` |
| `?` | `unexplored` |

Variations: the 2000 Sac Actun map draws a pit as a filled dot, the 2006 Sac Be
Ha poster as a small open circle; only the 2000 map has `CE`, dome, flow and
breakdown.

### Peter Sprouse / AMCS vector maps

No letter codes: the symbols are drawn, in the UIS (International Union of
Speleology) style - ledges, breakdown, drip lines, water areas filled in light
blue, survey stations as small red dots. Measurements in **metres**, depths and
lengths given in the title block. Only `?` (`unexplored`) and the entrance
labels ("Entrada ...", "Cenote ...") are taken so far.

## Per-map config

A map's legend goes in its config:

```json
"symbols": {
  "units": "ft",
  "letters": { "r": "restriction-minor", "x": "restriction-major", "z": "visibility-zero", "s": "silt" },
  "templates": { "r": [429, 2146], "x": [428, 2165], "z": [427, 2185], "s": [427, 2204] }
}
```

`templates` points to a clean sample of each letter (usually in the map's own
legend), in the map image's pixels: letters are recognised by their shape in
the map's font. See `scripts/map-layer/extract_symbols.py`.

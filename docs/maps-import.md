# Importing cave maps in bulk

Survey maps (PDFs, scans, drawings) collected in a folder tree can be imported into OpenCaves in three steps: **extract** the map images, **match** each map to a sistema, then **upload** them. An optional fourth step imports the **exploration history** read off the maps into the sistemas. Each step writes files you can review before running the next one.

The scripts live in [`scripts/maps-import/`](../scripts/maps-import/). The examples below assume the maps sit in `_data/` at the root of the project and the import work goes to `_data/maps-import/` (neither is tracked in git).

```
_data/                      source folder tree (PDFs, images, zips)
  maps-import/              output of the scripts
    images/                 the maps, ready to upload
    extracted.csv           inventory of every map found (step 1)
    duplicates.csv          copies removed as duplicates (step 1)
    matched.csv             the inventory plus the sistema(s) of each map (step 2)
    explorations.xlsx       exploration history and map credits read off the maps (step 4)
    backups/                what each exploration import replaced, for --undo (step 4)
```

## Requirements

- Python 3 with PyMuPDF, Pillow and numpy: `pip install pymupdf pillow numpy`
- Node and the project's dependencies (`npm install`)
- For production: `gcloud auth application-default login`, with an account that can write to the `opencaves` project

## 1. Extract the maps

```sh
PYTHONIOENCODING=utf-8 python scripts/maps-import/extract_maps.py _data _data/maps-import
```

The script walks the source tree and turns every map it finds into a file in `images/`:

| Source | Result |
| --- | --- |
| Scanned PDF (a picture covering most of the page) | The picture, cropped to itself, as WebP. The survey archive's text stamp is left out of the image and read into the inventory instead: name, place, publication and year. |
| Vector PDF (real drawn paths) | SVG, cropped to the drawing, with its text as outlines. The script falls back to WebP if the page is rotated or the SVG would exceed 10 MB. |
| PDF with only raster pictures and little vector content | A WebP render (~6000 px on the long side). Such a page is never exported as SVG. |
| JPEG, PNG, WebP, SVG | Used as is (an SVG's root CSS transform is stripped, since it breaks rasterizing). |
| TIFF, GIF | Lossless WebP |
| Zip (in a map folder) | Its images, treated like the ones above |

Along the way it:

- **Chooses what counts as a map.** It takes every PDF, plus the images and zips under a `cartes/` folder and the images whose name suggests a map (`map`, `carte`, `plan`, `survey`, `sistema`...). Journal articles, upscaler outputs and GIS sidecar files are skipped (`SKIP_NAME_PATTERNS`). The output folder is never read as input, so reruns are safe.
- **Trims paper margins.** On scanned paper pages, the wide blank border is cut down to a margin of 3% of the drawing's size.
- **Caps file size.** No raster file stays over 10 MB: bigger ones are re-encoded as lossy WebP at lower quality, then at a smaller size, until they fit.
- **Removes duplicates.** Every map gets a perceptual fingerprint, and copies of the same map are reduced to the best one. Examples are the same map saved as .jpg and .pdf, a "(1)" copy, or one sheet filed under each cave it shows. The kept map lists the names its copies were filed under (`alsoFiledAs`) so it can be matched to all of them. The removed copies go to `duplicates.csv`. Near matches the script isn't sure about are only flagged (`possibleDuplicateOf`) for you to check.
- **Removes reviewed duplicates.** Some copies look too different for the fingerprint: a photo of a wall poster next to a scan of it, a recoloured or redrawn copy, a reprint. They're listed by hand in [`known-duplicates.csv`](../scripts/maps-import/known-duplicates.csv), next to the scripts: each row names a copy to drop, the copy to keep (its source file, plus `#p<page>` for a PDF page) and why. Different editions of a map (a later survey, added passages, another layout) are not duplicates: both stay. To apply a change to the list without extracting everything again:

  ```sh
  PYTHONIOENCODING=utf-8 python scripts/maps-import/extract_maps.py --known-duplicates _data/maps-import
  ```

  Then rerun the match (step 2) and the upload (step 3).

**Review:** go through `extracted.csv` and the `images/` folder. If a source file shouldn't be imported, delete or move it out of `_data/` and rerun the script. The output is rebuilt from scratch every time.

## 2. Match maps to sistemas

```sh
python scripts/maps-import/match_maps.py _data/maps-import --production
```

It reads the sistemas and caves (from production with `--production`, which needs no login since they're public; otherwise from the local Firestore emulator). Then it finds the sistema(s) of each map:

- **The map's name** comes from the archive stamp, or else from the file name ("Name, Type., Place" → "Name").
- **Names are compared** ignoring accents, apostrophe variants, punctuation and generic words (Sistema, Cenote, Cueva, section...).
- **A cave's name also counts**: a map named after a cave goes to that cave's sistema.
- **Combined names are split.** A name like "A and B", "A, B", "Sistema X East & West" or "Cave (part of Sistema Y)" matches every sistema it names. So does each `alsoFiledAs` name.
- **Close names count as matches.** Without an exact match, the closest name scoring at least 0.85 is used, and the row is marked `similar`.

The script writes `matched.csv`, which adds `mapName`, `matchHow` (`exact`, `similar` or `none`), `sistemaIds`, `sistemaNames` and `matchDetails` (how each name matched) to the inventory.

**Review:** check the `similar` rows, and the maps going to several sistemas. Maps with `matchHow` = `none` are skipped by the upload: either create their sistema first and rerun the match, or fill in `sistemaIds` by hand.

**Corrections that last:** [`map-overrides.csv`](../scripts/maps-import/map-overrides.csv), next to the scripts, fixes the match for good (hand edits to `matched.csv` are lost on the next run). Each row names a map (its source file, plus `#p<page>` for a PDF page), the sistema names it belongs to (`A | B`), or `exclude` for a map that shouldn't be published, and why. The match applies it last (`matchHow` = `override` or `excluded`).

### Editing the CSV before uploading

`matched.csv` (or a reviewed copy of it, passed with `--csv`) can take these optional columns, which the upload uses instead of what the scripts found:

| Column | Effect |
| --- | --- |
| `name` | The map's name (default: `mapName`) |
| `date` | Its date (default: the stamp's publication year) |
| `authors` | Its authors, separated by `\|` (default: none) |
| `note` | A note (default: the stamp's publication) |
| `sistemaIds` | The sistema ids to attach it to, separated by `\|` |
| `include` | `no` to skip the row |

## 3. Upload

```sh
node scripts/maps-import/upload-maps.js -l             # dry run, local emulators
node scripts/maps-import/upload-maps.js --apply        # upload to the local emulators
node scripts/maps-import/upload-maps.js -p             # dry run, production
node scripts/maps-import/upload-maps.js -p --apply     # upload to production
```

**Every run is a dry run unless you pass `--apply`**: it lists what it would do, and writes nothing. Other options:

- `--limit N` handles only the first N maps (to try a few first).
- `--only <text>` handles only the maps whose name or file contains the text.
- `--csv <file>` reads another CSV instead of `matched.csv`.

The local mode needs the emulators running (`npm run dev`), with the sistemas already in the local Firestore.

For each map, the script does what the app's own upload does:

1. It saves the file in Storage at `maps/<id>`, with a download token.
2. It writes a `maps/<id>` document with `name`, `url`, `contentType`, plus `date`, `authors` and `note` when there are any. It also records `importKey` (the file's hash) and `importSource` (its source path).
3. It adds the map's id to the `maps` list of each of its sistemas. A cave then shows the maps of its sistema and of the sistemas above it.

The Storage upload then triggers the `onMapImageUploaded` Cloud Function (`functions/js/maps/onUploaded.js`). For a raster map, the function writes a WebP viewing copy (`previewUrl`) and a thumbnail (`thumbnailUrl`) under `maps/derived/`. An SVG map only gets the thumbnail. The function takes a few seconds per map, so right after a large upload some maps still show no preview. The local emulator processes them one at a time, which takes several minutes for a large batch.

**Before a production upload**, make sure the deployed map functions are up to date (`firebase deploy --only functions:js:onMapImageUploaded,functions:js:onMapPdfUploaded`). The upload doesn't rerun the functions for maps that already exist.

### Rerunning

The upload can be rerun safely. A map whose file was already imported (same `importKey`) isn't uploaded again. Instead, its name, date, authors and note are updated from the CSV, and it is attached to any new sistema in the row. The usual loop is to fill in authors and dates in the CSV, then run again with `--apply`.

A rerun also applies what changed in the CSV, and the dry run lists it all:

- **Links follow the CSV:** a map already imported is linked to exactly the sistemas its row lists. A sistema dropped from the row (a corrected match) loses its link.
- **Duplicates are retired:** a map already imported that `duplicates.csv` now lists as a copy of another has its sistema links moved to the kept copy, then its document and files are deleted.
- **Excluded maps are removed:** a map already imported whose row now has `include` = `no` is unlinked from its sistemas and deleted.

A changed image file counts as a new map, since its hash is different.

### Undoing

```sh
node scripts/maps-import/upload-maps.js --undo -p           # list what would be removed
node scripts/maps-import/upload-maps.js --undo -p --apply   # remove it
```

This removes every imported map (every `maps` document with an `importKey`). That covers its document, its file and derived WebPs in Storage, and its links from the sistemas. Maps added through the app are not touched.

## 4. Import the exploration history

Many maps carry their exploration history: who explored and surveyed, when, and sometimes a dated account. `explorations.xlsx` holds what was read off them, one row per exploration (or per map without one):

| Column | Meaning |
| --- | --- |
| `image` | The map (a link to its file) |
| `sistemaNames` | The sistema(s) the row goes to. It defaults to the map's; narrow it when one sheet shows two systems |
| `mapTitle`, `mapAuthors`, `mapDate` | The map's credits: its authors (separated by `\|`) and date are written to its `maps` document |
| `explorationDate`, `explorationTeam`, `explorationDescription` | One exploration entry: its date, its team, and what was explored (it goes to the entry's Description) |
| `currentExplorations` | What the sistema has today (for review only) |
| `readQuality`, `comment` | How legible the source was, and review notes. A `comment` starting with `EXCLUDED` leaves the row out |

The workbook isn't produced by a script: it was filled in by reading each map. Review it, then:

```sh
node scripts/maps-import/import-explorations.js -l                 # dry run, local emulators
node scripts/maps-import/import-explorations.js -l --apply         # import locally
node scripts/maps-import/import-explorations.js -p --apply         # import to production
```

The dry run lists, for each sistema, the entries the maps add, and which existing entries they replace or keep:

- **Replaced:** an existing entry about the same exploration, meaning a team name in common and no later than the map's period. For an entry without a team, a year in common is enough.
- **Kept:** every other existing entry, such as a later exploration by the same people.
- **Dates:** the app takes a year, a month, a day or a range of years. A date it can't hold (`2013-08 - 2014-12`) becomes the closest it can (`2013-2014`), and the text as read is added to the description.
- **Source:** each entry's Notes field names the map it was read from, and holds nothing else.

A rerun replaces the entries an earlier import added (they're marked `importedFrom: 'maps'`) instead of adding them again. `upload-maps.js` also reads the workbook, so a rerun of the upload keeps the map authors and dates.

### Undoing an exploration import

Before writing, the import saves every sistema's explorations and every map's authors and date it's about to change to `backups/explorations-<target>-<time>.json`.

```sh
node scripts/maps-import/import-explorations.js -p --undo latest            # list what would be restored
node scripts/maps-import/import-explorations.js -p --undo latest --apply    # restore it
node scripts/maps-import/import-explorations.js -p --undo <backup file> --apply
```

`--undo latest` reverts the latest import of that target. To go back to before the first import, pass the first backup file. A sistema or map edited after the import (in the app, say) is skipped, so newer edits aren't erased. Add `--force` to restore it anyway.

## Known limits

- **Authors and survey dates aren't extracted automatically.** The archive stamp gives the publication and its year, not the surveyors. They come from `explorations.xlsx` (step 4), or the `authors`/`date` columns of the CSV.
- **The matching is heuristic.** Check the `similar` matches, which are the most likely to be wrong.
- **Maps without a sistema are skipped.** Maps of caves that aren't in the database yet (and loose photos) stay in the `none` rows until their sistema exists.

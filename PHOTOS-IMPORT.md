# Importing cave photos

How to bulk-import the cave photos kept in the `_data` folder (a Google Drive
folder, not tracked in git) into the app, as if each had been uploaded from a
cave's page. Maps are **not** part of this: they have their own import in
`scripts/maps-import/` (extract_maps.py → match_maps.py → upload-maps.js).

The scripts are in `scripts/photos-import/`. The process has three steps, each
writing into `_data/photos-import/`, with a manual review before the upload:

```
python scripts/photos-import/extract_photos.py _data _data/photos-import   # 1. inventory
python scripts/photos-import/match_photos.py _data/photos-import           # 2. match to caves
# review _data/photos-import/matched.csv
node scripts/photos-import/upload-photos.js                                # 3. upload (dry run)
```

## Prerequisites

- Python with Pillow, numpy and PyMuPDF (`pip install pillow numpy pymupdf`). The
  photo scripts reuse helpers from the map import's scripts.
- The local emulators running **with functions** (`npm run dev`). The upload
  relies on the `onAssetUploaded` function to create each photo's document.
- The map import run first (`_data/maps-import/` present), so the photo import
  can leave out the files it took as maps.
- For production: `gcloud auth application-default login`.

## 1. Inventory: `extract_photos.py`

It reads only the top-level `Cenote …` folders and their subfolders. The
`Sistema …` folders, `cartes/`, `À traiter/` and the loose files at the root
hold maps and documents, and are ignored.

- **Maps are left out:** files the map import already took, and images whose
  name says map (`map`, `carte`, `plan`, `sistema`, `directions`, `trajet`,
  `clé`…). Images that look like line art (mostly white paper, little colour)
  are kept as kind `map?`, and the upload skips them unless marked
  `include=yes`.
- **Photos are not re-encoded.** The upload function reads their EXIF (date,
  GPS, orientation) and 360° XMP data, which re-encoding would lose. The CSV
  points at the files where they are. Only TIFF and GIF files are converted
  to JPEG, into `_data/photos-import/images/`.
- **Duplicates:** byte-identical copies (the same photo in two cave folders, or
  `name (1).jpg` copies) become one row. The kept row lists the other folders
  in `alsoFiledIn`, and the removed copies go to `duplicates.csv`. Near-identical
  photos (burst shots) are only flagged in `possibleDuplicateOf`.
- **Flags:** `third-party?` for images with no phone or camera maker in their
  EXIF (downloads, article figures, messenger attachments).
- GPS 0,0 (a phone's "no fix") is ignored.
- Skipped files (maps, videos) are listed in `skipped.csv`. Videos aren't
  imported: cave assets are images only.

## 2. Matching: `match_photos.py`

Each folder is matched to a **cave** by name (photos belong to caves, not
sistemas), with the same name comparison as the map import: accents,
punctuation and generic words (Cenote, Sistema…) are ignored. An exact match
wins; otherwise the closest name above 0.85 similarity is used, with
`matchHow` = `similar (…)` for you to confirm.

- **Several caves with the same name** (e.g. "Escondido"): the one nearest the
  folder's photos (by their GPS) is chosen.
- **A folder spelled too differently** from its cave's name (e.g. "Minotoro"
  for Minotauro): add it to `FOLDER_CAVES` at the top of the script.
- **A cave missing from the database:** add it to the Google Sheet, run
  `node scripts/migrate-sheet-to-firestore.js` (and with `-p` for production),
  then re-run the match.
- **GPS cross-check:** a photo more than 1 km from its cave is flagged
  `far from cave`. This is a hint only, and is often wrong: the photo's GPS fix
  can be bad (panoramas especially), or it was taken on the way there.
- A photo filed in several cave folders goes to the nearest cave when it has
  GPS. Without GPS all caves are listed (`several caves`), and the upload
  skips it until one is left.

By default the match reads the local emulator; add `--production` to read the
real database. Cave IDs are the same in both when both were migrated from the
same sheet.

## Review `matched.csv`

Open it in a spreadsheet and edit it (or a copy, passed with `--csv`):

| Column | Use |
|---|---|
| `flags` | `third-party?`, `far from cave` - check these rows |
| `matchHow` | `similar (…)`, `none`, `several caves` need a decision |
| `caveIds` | the cave the photo goes to; edit to reassign (exactly one ID) |
| `include` | `no` leaves a photo out; `yes` includes a `map?` row |
| `isCover` | `yes` makes the photo its cave's cover |

Re-running `match_photos.py` rewrites `matched.csv`. Put lasting decisions in
the script (`FOLDER_CAVES`) or the data (the sheet), or review a copy.

## 3. Upload: `upload-photos.js`

It uploads each photo the way the app does: to Storage at
`caves/<caveId>/images/<assetId>`. From there the `onAssetUploaded` function
makes the thumbnails, reads the EXIF and panorama data, and creates the
`cavesAssets` document. The script then marks the document with an
`importKey` (the file's hash) and `importSource`.

```
node scripts/photos-import/upload-photos.js                    # dry run, local emulators
node scripts/photos-import/upload-photos.js --apply            # upload locally
node scripts/photos-import/upload-photos.js --apply --limit 5  # try a few first
node scripts/photos-import/upload-photos.js --only calimba     # only matching cave/folder/file
node scripts/photos-import/upload-photos.js -p                 # dry run, production
node scripts/photos-import/upload-photos.js -p --apply         # upload to production
node scripts/photos-import/upload-photos.js --undo --apply     # remove everything imported
```

- **Re-runnable:** a photo already imported (same `importKey`) is skipped. A
  file uploaded earlier that never got a document is uploaded again.
- **Covers:** each cave's cover (or first) photo is uploaded alone and waits
  for the `setCoverImage` function to make it the cover. Only then do the
  rest go up, 4 at a time. Uploaded together, several photos could each find
  "no cover yet" and all become covers. `isCover=yes` replaces a cave's
  existing cover.
- **A photo fails with "no cavesAssets document after 180s"** when the
  function didn't create the document: the functions aren't running (locally),
  or the function failed on that file (check its logs). Fix the cause and
  re-run.
- `--undo` deletes the imported documents, files and thumbnails. Photos
  uploaded from the app have no `importKey` and are never touched.
- `migrate-sheet-to-firestore.js` does not touch `cavesAssets`, so re-running
  it doesn't remove imported photos.

## Known limitations

- **Pixel panoramas (`PXL_….PANO.jpg`)** carry 360° crop data but no
  `UsePanoramaViewer` tag, which is the only thing the upload function checks.
  They are imported as plain photos.
- **Panoramas without a heading:** `onAssetUploaded` used to fail on panoramas
  whose XMP has no `PoseHeadingDegrees` (cylindrical ones). It wrote
  `undefined`, which Firestore rejects, so no document was created. This is
  fixed in `functions/js/assets/onUploaded.js`, but the fix has to be deployed
  (`firebase deploy --only functions:js:onAssetUploaded`) before those photos
  can be imported to production.
- A photo's GPS is stored as it is (`position`), even when flagged far from
  its cave. The app doesn't display it.

"""Triage of the imported cave maps for the map layer: how hard each one will
be to turn into georeferenced vector passages, to pick a pilot and order the
work. Reads the maps import's matched.csv (scripts/maps-import) and writes
triage.csv, best candidates first.

Per map:
- category: vector (an SVG from a vector PDF: passages are real paths),
  scan, render (a PDF page rendered to an image), photo (taken with a phone or
  camera: perspective to correct first) or image (any other picture).
- colour: share of saturated pixels - coloured passages (e.g. the blue of
  QRSS sheets) separate from the background by colour; black-and-white maps
  need ink thresholding and text removal.
- text: read from the source PDF where it has a text layer, else by OCR
  (Tesseract, English + Spanish; cached in <output>/ocr): printed
  coordinates (UTM, degrees) and the names of caves with GPS found on the
  map - each one a candidate control point for georeferencing, to confirm.
- sistemaCavesWithGps: caves with GPS in the map's sistema(s): the control
  points available at best, whether or not they're labelled on the map.
- score and tier (easy / medium / hard) from all of the above.

Usage: python scripts/map-layer/triage_maps.py <maps-import folder> <output folder> [--production] [--no-ocr]
Reads the caves from the local Firestore emulator by default.
Needs PyMuPDF, Pillow, numpy and pytesseract, and Tesseract with the eng
and spa models (see TESSERACT and TESSDATA below).
"""
import csv
import os
import re
import sys
from pathlib import Path

import numpy
import pymupdf
from PIL import ExifTags, Image

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / 'maps-import'))
from match_maps import fetch_collection, normalize  # noqa: E402

Image.MAX_IMAGE_PIXELS = None

# A pixel is "coloured" above this HSV saturation (0-255); a map is colour
# when at least COLOUR_MIN_SHARE of its pixels are.
SATURATED = 80
COLOUR_MIN_SHARE = 0.03
# Cave names shorter than this (normalized) match too much text by chance.
MIN_NAME_LENGTH = 4
COORDINATE_PATTERNS = [
    ('UTM', re.compile(r'\bUTM\b[^\n]{0,60}', re.I)),
    ('UTM easting/northing', re.compile(r'\b[0-9]{6}(?:\.[0-9]+)?\s*[EN]?\b[\s,/]+\b2[0-9]{6}(?:\.[0-9]+)?\b')),
    ('degrees', re.compile(r'\b(?:N\s*)?(?:19|20|21)\s*°\s*[0-9]{1,2}[^\n]{0,30}', re.I)),
    ('decimal degrees', re.compile(r'\b(?:19|20|21)\.[0-9]{3,}\s*[,;/ ]\s*-?8[6-9]\.[0-9]{3,}\b')),
]
# Tesseract (winget install UB-Mannheim.TesseractOCR) and its models: eng and
# spa, in a folder of the user's (Program Files needs admin rights to add one).
TESSERACT = os.environ.get('TESSERACT', r'C:\Program Files\Tesseract-OCR\tesseract.exe')
TESSDATA = os.environ.get('TESSDATA_PREFIX', str(Path.home() / 'tessdata'))
OCR_LONG_SIDE = 5000
CATEGORY_BASE = {'vector': 3, 'scan': 2, 'render': 2, 'image': 1, 'photo': 0}
TAG = {name: key for key, name in ExifTags.TAGS.items()}


def category(row, image_path):
    if image_path.suffix == '.svg':
        return 'vector'
    if row['kind'] == 'pdf-scan':
        return 'scan'
    if row['kind'] == 'pdf-render':
        return 'render'
    try:
        with Image.open(image_path) as image:
            if image.getexif().get(TAG['Make']):
                return 'photo'
    except Exception:  # noqa: BLE001 - unreadable: just an image
        pass
    return 'image'


def colour_share(image_path):
    """Share of clearly coloured pixels (an SVG is rendered first)."""
    if image_path.suffix == '.svg':
        with pymupdf.open(image_path) as doc:
            page = doc[0]
            zoom = 800 / max(page.rect.width, page.rect.height)
            pixmap = page.get_pixmap(matrix=pymupdf.Matrix(zoom, zoom), alpha=False)
            image = Image.frombytes('RGB', (pixmap.width, pixmap.height), pixmap.samples)
    else:
        image = Image.open(image_path).convert('RGB')
    image.thumbnail((800, 800))
    saturation = numpy.asarray(image.convert('HSV'))[:, :, 1]
    return float((saturation >= SATURATED).mean())


def pdf_text(data_root, row):
    """The map page's text, when its source is a PDF with a text layer."""
    source = row['source'].split('#')[0]
    if not source.lower().endswith('.pdf'):
        return ''
    path = data_root / source
    if not path.exists():
        return ''
    with pymupdf.open(path) as doc:
        index = int(row['page']) - 1 if row.get('page') else 0
        return doc[index].get_text() if index < doc.page_count else ''


def ocr_text(image_path, cache_dir):
    """The map's text read by Tesseract (English and Spanish), cached: OCR
    of a large map takes a while. Sparse-text mode: labels scattered over a
    drawing, not paragraphs."""
    cache = cache_dir / f'{image_path.stem}.txt'
    if cache.exists():
        return cache.read_text(encoding='utf-8')
    import pytesseract
    pytesseract.pytesseract.tesseract_cmd = TESSERACT
    image = Image.open(image_path).convert('L')
    # Small labels need resolution, but a 12000 px scan takes minutes.
    image.thumbnail((OCR_LONG_SIDE, OCR_LONG_SIDE))
    # Through the environment: pytesseract passes a quoted --tessdata-dir
    # path on to Tesseract quotes and all.
    os.environ['TESSDATA_PREFIX'] = TESSDATA
    text = pytesseract.image_to_string(image, lang='eng+spa', config='--psm 11')
    cache_dir.mkdir(parents=True, exist_ok=True)
    cache.write_text(text, encoding='utf-8')
    return text


def main(folder, output, production, no_ocr):
    folder, out = Path(folder), Path(output)
    data_root = folder.parent
    rows = list(csv.DictReader(open(folder / 'matched.csv', encoding='utf-8-sig')))
    caves = fetch_collection('caves', production)

    def name_of(cave):
        name = cave.get('name')
        return (name or {}).get('value', '') if isinstance(name, dict) else (name or '')

    located = [c for c in caves if (c.get('location') or {}).get('latitude') is not None]
    located_by_sistema = {}
    for cave in located:
        located_by_sistema.setdefault(cave.get('sistemaId'), []).append(cave)
    # Normalized name -> caves with GPS, for finding names in a map's text.
    names = {}
    for cave in located:
        for name in [name_of(cave)] + list(cave.get('aka') or []):
            key = normalize(name)
            if len(key.replace(' ', '')) >= MIN_NAME_LENGTH and not re.fullmatch(r'[0-9. ,-]+', key):
                names.setdefault(key, []).append(cave)

    results = []
    for row in rows:
        if not row.get('image') or row.get('kind') == 'error' or (row.get('include') or '').lower() == 'no':
            continue
        image_path = folder / row['image']
        result = {'image': row['image'], 'mapName': row.get('mapName', ''), 'sistemaNames': row.get('sistemaNames', ''), 'source': row['source']}
        try:
            result['category'] = category(row, image_path)
            share = colour_share(image_path)
            result['colourShare'] = f'{share:.3f}'
            result['colour'] = 'colour' if share >= COLOUR_MIN_SHARE else 'b/w'

            # A scanned PDF's text layer is only the archive's stamp under the
            # map: every raster map is OCR'd too, its labels being pixels.
            text = pdf_text(data_root, row)
            sources = ['pdf'] if text.strip() else []
            if image_path.suffix != '.svg' and not no_ocr:
                ocr = ocr_text(image_path, out / 'ocr')
                if ocr.strip():
                    text = f'{text}\n{ocr}'
                    sources.append('ocr')
            result['textSource'] = '+'.join(sources)
            found = [f'{label}: {m.group(0).strip()[:40]}' for label, pattern in COORDINATE_PATTERNS for m in [pattern.search(text)] if m]
            result['coordinatesPrinted'] = ' | '.join(found)
            norm_text = f' {normalize(text)} '
            # A name found only as part of a longer one found too ("Maya" in
            # "Misterio Maya") is that longer cave, not another one.
            found_keys = [key for key in names if f' {key} ' in norm_text]
            found_keys = [key for key in found_keys if not any(key != other and f' {key} ' in f' {other} ' for other in found_keys)]
            entrances = {}
            for key in found_keys:
                for cave in names[key]:
                    entrances[cave['id']] = name_of(cave)
            result['namedEntrancesWithGps'] = len(entrances)
            result['namedEntrances'] = ' | '.join(sorted(set(entrances.values())))

            sistema_caves = {c['id'] for sid in (row.get('sistemaIds') or '').split(' | ') if sid for c in located_by_sistema.get(sid, [])}
            result['sistemaCavesWithGps'] = len(sistema_caves)

            # Control points: the named entrances count fully; without a text
            # layer, the sistema's caves count half (not known to be on the map).
            points = len(entrances) if entrances else len(sistema_caves) / 2
            score = CATEGORY_BASE[result['category']] + (2 if found else 0) + min(points, 6) / 2 + (1 if result['colour'] == 'colour' else 0)
            result['score'] = round(score, 1)
            result['tier'] = 'easy' if score >= 6 else 'medium' if score >= 3.5 else 'hard'
        except Exception as error:  # noqa: BLE001 - report and go on
            result.update({'category': 'error', 'score': -1, 'tier': 'error', 'error': str(error)})
        results.append(result)
        print(f'  {result.get("tier", ""):6} {result.get("score", "")!s:>4}  {result.get("category", ""):7} {row["image"]}', flush=True)

    results.sort(key=lambda r: -float(r['score']))
    out.mkdir(parents=True, exist_ok=True)
    fields = ['score', 'tier', 'category', 'colour', 'colourShare', 'coordinatesPrinted', 'namedEntrancesWithGps', 'namedEntrances',
              'sistemaCavesWithGps', 'textSource', 'mapName', 'sistemaNames', 'image', 'source', 'error']
    with open(out / 'triage.csv', 'w', newline='', encoding='utf-8-sig') as f:
        writer = csv.DictWriter(f, fieldnames=fields, extrasaction='ignore')
        writer.writeheader()
        writer.writerows(results)

    print(f'\n{len(results)} maps -> {out / "triage.csv"}')
    for tier in ('easy', 'medium', 'hard', 'error'):
        group = [r for r in results if r['tier'] == tier]
        if group:
            counts = {}
            for r in group:
                counts[r['category']] = counts.get(r['category'], 0) + 1
            print(f'  {tier:6} {len(group):3}  ({", ".join(f"{n} {c}" for c, n in sorted(counts.items()))})')
    print('\nPilot suggestion (the best of each category):')
    for cat in ('vector', 'scan', 'photo'):
        best = next((r for r in results if r['category'] == cat), None)
        if best:
            print(f'  {cat:7} {best["mapName"]} ({best["sistemaNames"] or "no sistema"}): score {best["score"]}, '
                  f'{best["namedEntrancesWithGps"]} named entrances with GPS, {best["sistemaCavesWithGps"]} sistema caves with GPS'
                  + (f', coordinates printed' if best['coordinatesPrinted'] else '') + f' - {best["image"]}')


if __name__ == '__main__':
    if len(sys.argv) < 3:
        sys.exit(__doc__)
    main(sys.argv[1], sys.argv[2], '--production' in sys.argv[3:], '--no-ocr' in sys.argv[3:])

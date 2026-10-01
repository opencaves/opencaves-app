"""Extracts a raster map's text symbols as points, in a shared vocabulary
(prototype, for the map layer): restrictions, zero visibility, silt, depths,
ceiling-to-floor heights and penetrations. See docs/map-symbols.md.

The map's config "symbols" gives its legend:
  "symbols": {
    "units": "ft",                       depth/height/penetration units
    "letters": {"r": "restriction-minor", "x": "restriction-major",
                "z": "visibility-zero", "s": "silt"},
    "templates": {"r": [x, y], ...}      a clean sample of each letter, e.g. in
                                         the legend: the font to match
  }

- Letters: the map's small, isolated dark marks are compared by shape with
  the templates, and with the marks Tesseract reads confidently on their
  own (seeds: the map's own font). Marks inside a word or number OCR read are left
  out: fragments of labels match letters too.
- Numbers (OCR): a line just above means a depth (overlined), a ring around
  means a ceiling-to-floor height (circled); others are left out.
- Penetrations: "p.1857" (OCR).

Writes <output>/<name>-symbols.geojson (points: type, value in metres, the
original label) and <output>/<name>-symbols-sheet.png to review every one.

Usage: python scripts/map-layer/extract_symbols.py <config.json> <output folder>
Needs the OCR cache of trace_scan.py (run it first).
"""
import json
import math
import re
import sys
from pathlib import Path

import cv2
import numpy
from PIL import Image, ImageDraw
from pyproj import Transformer
from scipy import ndimage
from shapely.geometry import mapping, Point

import trace_scan
from overlay_scan import raster_placement

Image.MAX_IMAGE_PIXELS = None
UNIT_METRES = {'ft': 0.3048, 'm': 1.0}
# Marks this dark against the local paper are ink (letters are solid black).
INK_CONTRAST = 60
LETTER_SIZE = ((7, 18), (5, 18))  # (height range, width range), pixels
# Shape similarity (0-1) to accept a letter; "s" matches less tightly.
LETTER_SCORE = {'s': 0.65}
DEFAULT_LETTER_SCORE = 0.75
SHAPE_PX = 12
# A mark Tesseract reads alone at least this confidently seeds a template.
SEED_CONF = 60
# Depths are written with two digits at least ("09"): single digits are stipple.
MIN_DEPTH_DIGITS = 2
# OCR words read at least this confidently mask the marks inside them.
WORD_CONF = 60


def shape_of(mask):
    shape = cv2.resize(mask.astype(numpy.float32), (SHAPE_PX, SHAPE_PX), interpolation=cv2.INTER_AREA)
    shape -= shape.mean()
    norm = numpy.linalg.norm(shape)
    return shape / norm if norm else shape


def ring_score(dark, box, pad):
    """Share of a ring around a box that's ink: a circled number scores high."""
    x0, y0, x1, y1 = box
    cx, cy = (x0 + x1) / 2, (y0 + y1) / 2
    r = max(x1 - x0, y1 - y0) / 2 + pad
    hits = total = 0
    for a in range(0, 360, 10):
        x, y = int(round(cx + r * math.cos(math.radians(a)))), int(round(cy + r * math.sin(math.radians(a))))
        if 0 <= y < dark.shape[0] and 0 <= x < dark.shape[1]:
            total += 1
            hits += dark[max(0, y - 1):y + 2, max(0, x - 1):x + 2].any()
    return hits / total if total else 0


def overline_score(dark, box):
    """How much of a straight horizontal line runs just above a box: the best
    single row's share of the box's width. A wall or a spray of short lines
    above a number isn't a straight row."""
    x0, y0, x1, y1 = box
    h = y1 - y0
    band = dark[max(0, y0 - h // 2 - 3):max(0, y0 - 1), x0:x1]
    return float(band.mean(axis=1).max()) if band.size else 0


def main(config_path, output):
    config_path = Path(config_path)
    config = json.loads(config_path.read_text(encoding='utf-8'))
    name = config_path.stem
    out = Path(output)
    legend = config['symbols']
    to_metres = UNIT_METRES[legend.get('units', 'm')]
    image = Image.open(config_path.parent.joinpath(config['image']).resolve()).convert('RGB')
    grey = numpy.asarray(image.convert('L')).astype(numpy.float32)
    dark = (trace_scan.local_level(grey - 128, 500) + 128 - grey) >= INK_CONTRAST
    excluded = numpy.zeros(dark.shape, bool)
    for item in config.get('exclude', []):
        x0, y0, x1, y1 = item['box']
        excluded[max(0, y0):y1, max(0, x0):x1] = True
    words = json.loads((out / f'{name}-ocr-words.json').read_text(encoding='utf-8'))

    def outside(box):
        return not excluded[(box[1] + box[3]) // 2, (box[0] + box[2]) // 2]

    symbols = []
    # Numbers and penetrations, from OCR.
    word_mask = numpy.zeros(dark.shape, bool)
    for word in words:
        x0, y0, x1, y1 = word['box']
        if word['conf'] >= WORD_CONF and len(word['t']) >= 2:
            word_mask[max(0, y0 - 2):y1 + 2, max(0, x0 - 2):x1 + 2] = True
        if not outside(word['box']):
            continue
        penetration = re.fullmatch(r'[pP][.,]?(\d{3,5})', word['t'])
        # Two digits at least: the legend writes depths "09"; a single digit is
        # more likely stipple read as one.
        number = re.fullmatch(r'\(?(\d{1,3})\)?', word['t'])
        if penetration:
            symbols.append({'type': 'penetration', 'value': int(penetration.group(1)), 'label': word['t'], 'box': word['box']})
        elif number and word['conf'] >= 50:
            ring = ring_score(dark, word['box'], 4)
            line = overline_score(dark, word['box'])
            digits = len(number.group(1))
            kind = 'ceiling-height' if ring >= 0.6 else 'depth' if line >= 0.6 and digits >= MIN_DEPTH_DIGITS else None
            if kind:
                symbols.append({'type': kind, 'value': int(number.group(1)), 'label': word['t'], 'box': word['box']})

    # Letters, by shape.
    labels, _ = ndimage.label(dark, structure=numpy.ones((3, 3)))
    objects = ndimage.find_objects(labels)

    def mark_at(x, y):
        window = labels[max(0, y - 3):y + 4, max(0, x - 3):x + 4]
        found = window[window > 0]
        return int(found[0]) - 1 if found.size else None

    templates = {}
    for letter, (x, y) in legend['templates'].items():
        i = mark_at(x, y)
        if i is not None:
            templates.setdefault(letter, []).append(shape_of(labels[objects[i]] == i + 1))
    (h_min, h_max), (w_min, w_max) = LETTER_SIZE
    marks = []
    for i, s in enumerate(objects):
        h, w = s[0].stop - s[0].start, s[1].stop - s[1].start
        if not (h_min <= h <= h_max and w_min <= w <= w_max):
            continue
        cy, cx = (s[0].start + s[0].stop) // 2, (s[1].start + s[1].stop) // 2
        if excluded[cy, cx] or word_mask[cy, cx]:
            continue
        marks.append(([s[1].start, s[0].start, s[1].stop, s[0].stop], shape_of(labels[s] == i + 1)))

    def classify():
        result = []
        for box, shape in marks:
            scores = {letter: max(float((shape * t).sum()) for t in shapes) for letter, shapes in templates.items()}
            letter = max(scores, key=scores.get)
            if scores[letter] >= LETTER_SCORE.get(letter, DEFAULT_LETTER_SCORE) and letter in legend['letters']:
                result.append((box, shape, letter, scores[letter]))
        return result

    # Seeds: the map's own letters differ a little from the legend's (size,
    # weight). Each mark is read alone by Tesseract as one character; those
    # read confidently (always right in testing) become templates too.
    import os
    import pytesseract
    pytesseract.pytesseract.tesseract_cmd = trace_scan.TESSERACT
    os.environ['TESSDATA_PREFIX'] = trace_scan.TESSDATA
    grey8 = grey.astype(numpy.uint8)
    whitelist = ''.join(legend['letters'])
    for box, shape in marks:
        x0, y0, x1, y1 = box
        crop = Image.fromarray(grey8[max(0, y0 - 4):y1 + 4, max(0, x0 - 4):x1 + 4])
        crop = crop.resize((crop.width * 5, crop.height * 5), Image.LANCZOS)
        read = pytesseract.image_to_data(crop, lang='eng', config=f'--psm 10 -c tessedit_char_whitelist={whitelist}', output_type=pytesseract.Output.DICT)
        for text, conf in zip(read['text'], read['conf']):
            letter = text.strip().lower()
            if len(letter) == 1 and letter in templates and float(conf) >= SEED_CONF:
                templates[letter].append(shape)

    for box, shape, letter, score in classify():
        symbols.append({'type': legend['letters'][letter], 'label': letter, 'box': box, 'score': round(score, 2)})

    to_lnglat = Transformer.from_crs(config['utmEpsg'], 4326, always_xy=True)
    place, _, _ = raster_placement(config)
    features = []
    for s in symbols:
        x0, y0, x1, y1 = s['box']
        lng, lat = to_lnglat.transform(*place((x0 + x1) / 2, (y0 + y1) / 2))
        properties = {'map': name, 'kind': 'symbol', 'type': s['type'], 'label': s['label'], 'sistemaId': config.get('sistemaId')}
        if 'value' in s:
            properties['value'] = round(s['value'] * to_metres, 1)
            properties['unit'] = 'm'
        features.append({'type': 'Feature', 'properties': properties, 'geometry': mapping(Point(lng, lat))})
    path = out / f'{name}-symbols.geojson'
    path.write_text(json.dumps({'type': 'FeatureCollection', 'features': features}, ensure_ascii=False), encoding='utf-8')

    # Review sheet: every symbol found, with what it was read as.
    size, cols = 100, 12
    rows = (len(symbols) + cols - 1) // cols or 1
    sheet = Image.new('RGB', (cols * size, rows * (size + 14)), 'white')
    draw = ImageDraw.Draw(sheet)
    for j, s in enumerate(sorted(symbols, key=lambda s: s['type'])):
        x0, y0, x1, y1 = s['box']
        cx, cy = (x0 + x1) // 2, (y0 + y1) // 2
        r = max(20, (x1 - x0) // 2 + 8)
        sheet.paste(image.crop((cx - r, cy - r, cx + r, cy + r)).resize((size, size)), ((j % cols) * size, (j // cols) * (size + 14)))
        value = f" {s['value']}" if 'value' in s else ''
        draw.text(((j % cols) * size + 2, (j // cols) * (size + 14) + size), f"{s['type'][:12]}{value}", fill=(200, 0, 0))
    sheet.save(out / f'{name}-symbols-sheet.png')

    counts = {}
    for s in symbols:
        counts[s['type']] = counts.get(s['type'], 0) + 1
    print(f"{len(symbols)} symbols: " + ', '.join(f'{n} {t}' for t, n in sorted(counts.items())) + f' -> {path}')


if __name__ == '__main__':
    if len(sys.argv) != 3:
        sys.exit(__doc__)
    main(sys.argv[1], sys.argv[2])

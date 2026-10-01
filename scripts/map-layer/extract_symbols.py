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
from PIL import Image, ImageDraw, ImageOps
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
# Codes ("tb", "tt", "a"...) read by OCR at least this confidently.
CODE_CONF = 40
# Single-character codes ("a", "?") are easily misread from stipple.
SINGLE_CODE_CONF = 75
# Numbers: stipple and hatching are often "read" as digits, with low confidence.
NUMBER_CONF = 75
# Digits read inside a circle or box.
FRAME_CONF = 60
# Digits read by a depth bar.
BAR_CONF = 70
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


def underline_score(dark, box):
    """Like overline_score, just below the box."""
    x0, y0, x1, y1 = box
    h = y1 - y0
    band = dark[y1 + 1:y1 + h // 2 + 3, x0:x1]
    return float(band.mean(axis=1).max()) if band.size else 0


def frame_score(dark, box, pad):
    """Share of a rectangle around a box that's ink: a boxed number."""
    x0, y0, x1, y1 = box[0] - pad, box[1] - pad, box[2] + pad, box[3] + pad
    points = [(x, y0) for x in range(x0, x1, 2)] + [(x, y1) for x in range(x0, x1, 2)] +              [(x0, y) for y in range(y0, y1, 2)] + [(x1, y) for y in range(y0, y1, 2)]
    hits = sum(dark[max(0, y - 1):y + 2, max(0, x - 1):x + 2].any() for x, y in points
               if 0 <= y < dark.shape[0] and 0 <= x < dark.shape[1])
    return hits / len(points) if points else 0


def framed_numbers(grey, dark, excluded, legend):
    """Numbers in a circle or a box: rings (an ink shape with one hole) of
    "frameSizePx" (min, max diameter), about as wide as tall; the hole is read
    by Tesseract as digits. Round: ceiling-height; square: pit-depth."""
    import os
    import pytesseract
    pytesseract.pytesseract.tesseract_cmd = trace_scan.TESSERACT
    os.environ['TESSDATA_PREFIX'] = trace_scan.TESSDATA
    low, high = legend.get('frameSizePx', [30, 120])
    labels, _ = ndimage.label(dark, structure=numpy.ones((3, 3)))
    found = []
    for i, s in enumerate(ndimage.find_objects(labels)):
        h, w = s[0].stop - s[0].start, s[1].stop - s[1].start
        if not (low <= h <= high and low <= w <= high and 0.75 <= w / h <= 1.33):
            continue
        if excluded[(s[0].start + s[0].stop) // 2, (s[1].start + s[1].stop) // 2]:
            continue
        shape = labels[s] == i + 1
        holes, count = ndimage.label(~shape)
        # The hole: background not touching the box's edge, most of the area.
        edge = set(numpy.unique(numpy.concatenate([holes[0], holes[-1], holes[:, 0], holes[:, -1]])))
        inner = [k for k in range(1, count + 1) if k not in edge]
        if len(inner) != 1 or (holes == inner[0]).sum() < 0.3 * h * w:
            continue
        hole = holes == inner[0]
        ys, xs = numpy.nonzero(hole)
        crop = grey[s][ys.min():ys.max() + 1, xs.min():xs.max() + 1].copy()
        crop[~hole[ys.min():ys.max() + 1, xs.min():xs.max() + 1]] = 255
        image = Image.fromarray(crop.astype(numpy.uint8)).resize((crop.shape[1] * 4, crop.shape[0] * 4), Image.LANCZOS)
        image = ImageOps.expand(image, 20, fill=255)
        read = pytesseract.image_to_data(image, lang='eng', config='--psm 7 -c tessedit_char_whitelist=0123456789.,',
                                         output_type=pytesseract.Output.DICT)
        text = ''.join(t.strip() for t in read['text']).replace(',', '.')
        confs = [float(c) for c, t in zip(read['conf'], read['text']) if t.strip()]
        if not re.fullmatch(r'\d{1,3}(\.\d)?', text) or not confs or min(confs) < FRAME_CONF or (legend.get('decimals') and '.' not in text):
            continue
        # Round or square: a circle fills pi/4 of its box, a square frame more.
        filled = ndimage.binary_fill_holes(shape).sum() / (h * w)
        kind = 'pit-depth' if filled > 0.88 else 'ceiling-height'
        value = float(text) if '.' in text else int(text)
        found.append({'type': kind, 'value': value, 'label': text, 'box': [s[1].start, s[0].start, s[1].stop, s[0].stop]})
    return found


def barred_numbers(grey, dark, excluded, legend, known):
    """Depths whose number OCR missed on the whole map: each short straight
    horizontal bar ("barWidthPx": [min, max]) is a candidate; the strip just
    below it (overline) then just above it (underline) is read alone as
    digits. Bars by an already known symbol are skipped."""
    import os
    import pytesseract
    pytesseract.pytesseract.tesseract_cmd = trace_scan.TESSERACT
    os.environ['TESSDATA_PREFIX'] = trace_scan.TESSDATA
    low, high = legend.get('barWidthPx', [12, 120])
    labels, _ = ndimage.label(dark, structure=numpy.ones((3, 3)))
    found = []

    def near_known(box):
        return any(not (box[2] < k[0] - 10 or box[0] > k[2] + 10 or box[3] < k[1] - 15 or box[1] > k[3] + 15) for k in known)

    for i, s in enumerate(ndimage.find_objects(labels)):
        h, w = s[0].stop - s[0].start, s[1].stop - s[1].start
        if not (low <= w <= high and h <= max(3, 0.2 * w)):
            continue
        bar = labels[s] == i + 1
        if bar.mean() < 0.7 or excluded[(s[0].start + s[0].stop) // 2, (s[1].start + s[1].stop) // 2]:
            continue
        x0, x1 = s[1].start - w // 4, s[1].stop + w // 4
        digit_h = int(w * 0.9)
        for y0, y1 in ((s[0].stop + 1, s[0].stop + 1 + digit_h), (s[0].start - 1 - digit_h, s[0].start - 1)):
            if y0 < 0 or y1 > grey.shape[0] or x0 < 0 or x1 > grey.shape[1]:
                continue
            box = [x0, y0, x1, y1]
            if near_known(box):
                break
            crop = Image.fromarray(grey[y0:y1, x0:x1].astype(numpy.uint8))
            crop = ImageOps.expand(crop.resize((crop.width * 4, crop.height * 4), Image.LANCZOS), 20, fill=255)
            read = pytesseract.image_to_data(crop, lang='eng', config='--psm 7 -c tessedit_char_whitelist=0123456789.,',
                                             output_type=pytesseract.Output.DICT)
            text = ''.join(t.strip() for t in read['text']).replace(',', '.')
            confs = [float(c) for c, t in zip(read['conf'], read['text']) if t.strip()]
            if re.fullmatch(r'\d{1,3}(\.\d)?', text) and confs and min(confs) >= BAR_CONF and (legend.get('decimals') is not True or '.' in text):
                value = float(text) if '.' in text else int(text)
                found.append({'type': 'depth', 'value': value, 'label': text, 'box': box,
                              'ink': [x0, min(y0, s[0].start) - 2, x1, max(y1, s[0].stop) + 2]})
                known.append(box)
                break
    return found


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
        number = re.fullmatch(r'\(?(\d{1,3}(?:[.,]\d)?)\)?', word['t'])
        code = legend.get('words', {}).get(word['t'])
        if penetration:
            symbols.append({'type': 'penetration', 'value': int(penetration.group(1)), 'label': word['t'], 'box': word['box']})
        elif code and word['conf'] >= (CODE_CONF if len(word['t']) > 1 else SINGLE_CODE_CONF):
            symbols.append({'type': code, 'label': word['t'], 'box': word['box']})
        elif number and word['conf'] >= NUMBER_CONF:
            text = number.group(1).replace(',', '.')
            value = float(text) if '.' in text else int(text)
            # Overlined or underlined: a depth - a convention shared by cave
            # map authors. Circled: a ceiling-to-floor height. Boxed: a pit's
            # depth. A lone digit needs its decimal ("09", "4.2"): bare single
            # digits are more likely stipple read as one.
            ring = ring_score(dark, word['box'], 4)
            framed = frame_score(dark, word['box'], 5)
            line = max(overline_score(dark, word['box']), underline_score(dark, word['box']))
            significant = len(text.replace('.', '')) >= MIN_DEPTH_DIGITS and ('.' in text or not legend.get('decimals'))
            # Framed numbers are left to framed_numbers(), which reads them better.
            kind = None if framed >= 0.8 or ring >= 0.6 else 'depth' if line >= 0.6 and significant else None
            if kind:
                x0, y0, x1, y1 = word['box']
                pad = (y1 - y0) // 2 + 4
                symbols.append({'type': kind, 'value': value, 'label': word['t'], 'box': word['box'],
                                'ink': [x0 - pad, y0 - pad, x1 + pad, y1 + pad]})

    # Letters, by shape.
    labels, _ = ndimage.label(dark, structure=numpy.ones((3, 3)))
    objects = ndimage.find_objects(labels)

    def mark_at(x, y):
        window = labels[max(0, y - 3):y + 4, max(0, x - 3):x + 4]
        found = window[window > 0]
        return int(found[0]) - 1 if found.size else None

    templates = {}
    for letter, (x, y) in legend.get('templates', {}).items():
        i = mark_at(x, y)
        if i is not None:
            templates.setdefault(letter, []).append(shape_of(labels[objects[i]] == i + 1))
    # Letter size: the map's own ("letterSizePx": [min, max]) or the default.
    if legend.get('letterSizePx'):
        low, high = legend['letterSizePx']
        (h_min, h_max), (w_min, w_max) = (low, high), (int(low * 0.6), high)
    else:
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

    def crosses(box):
        # An x is two strokes crossing: its skeleton has a junction. Slope
        # hatching ticks and stipple dashes, x-like at template size, don't.
        from skimage.morphology import skeletonize
        x0, y0, x1, y1 = box
        # The mark's own ink: the biggest piece in its box.
        pieces, n = ndimage.label(dark[y0:y1, x0:x1], structure=numpy.ones((3, 3)))
        if not n:
            return False
        mark = skeletonize(pieces == 1 + int(numpy.argmax(ndimage.sum(numpy.ones_like(pieces), pieces, range(1, n + 1)))))
        count = ndimage.convolve(mark.astype(int), numpy.ones((3, 3), int), mode='constant') - mark
        ends = int((mark & (count == 1)).sum())
        return bool((mark & (count >= 3)).any()) and ends >= 3

    def classify():
        result = []
        for box, shape in marks:
            scores = {letter: max(float((shape * t).sum()) for t in shapes) for letter, shapes in templates.items()}
            letter = max(scores, key=scores.get)
            if scores[letter] >= LETTER_SCORE.get(letter, DEFAULT_LETTER_SCORE) and letter in legend.get('letters', {}):
                if letter.lower() == 'x' and not crosses(box):
                    continue
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
    whitelist = ''.join(legend.get('letters', {}))
    if not whitelist:
        marks = []
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
        symbols.append({'type': legend.get('letters', {})[letter], 'label': letter, 'box': box, 'score': round(score, 2)})

    # Numbers inside a circle (ceiling height) or a box (pit depth): OCR of
    # the whole map misses most, the frame confusing it. Closed rings about
    # the size of a number are found, and each one's inside read alone.
    symbols += framed_numbers(grey, dark, excluded, legend)
    # Overlined/underlined numbers OCR missed: found from their bar.
    symbols += barred_numbers(grey, dark, excluded, legend, [s['box'] for s in symbols])

    # Values corrected by hand ("fix": [{"px": [x, y], "value": v}]): the
    # symbol found nearest that spot (within 40 px) gets that value, or is
    # dropped with "value": null - for bold digits OCR misreads, and ovals
    # read as numbers.
    for item in legend.get('fix', []):
        x, y = item['px']
        near = [(abs((b[0] + b[2]) / 2 - x) + abs((b[1] + b[3]) / 2 - y), i) for i, b in enumerate(s['box'] for s in symbols)]
        d, i = min(near) if near else (None, None)
        if d is None or d > 40:
            print(f"fix at {item['px']}: no symbol there")
            continue
        if item.get('value') is None:
            symbols.pop(i)
        else:
            symbols[i]['value'] = item['value']
            symbols[i]['label'] = str(item['value'])

    # The map's entrances (config "entrances"): kept in the layer too, named.
    for entrance in config.get('entrances', []):
        if 'px' in entrance:
            x, y = entrance['px']
            symbols.append({'type': 'entrance', 'label': entrance['name'], 'box': [x - 6, y - 6, x + 6, y + 6]})

    # Symbols added by hand ("extra": [{"type", "label", "px", "value"?}]):
    # the ones recognition misses (a blurred letter on a photo).
    for item in legend.get('extra', []):
        x, y = item['px']
        # A number's box covers its digits and bar, so its ink isn't drawn too.
        half = item.get('halfPx', 45 if 'value' in item else 6)
        symbols.append({'type': item['type'], 'label': item.get('label', ''), 'box': [x - half, y - half, x + half, y + half],
                        **({'value': item['value']} if 'value' in item else {})})

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
    # The symbols' ink, so trace_scan.py doesn't also draw them as details.
    (out / f'{name}-symbols-px.json').write_text(json.dumps([s.get('ink', s['box']) for s in symbols]), encoding='utf-8')
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

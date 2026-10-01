"""Traces a scanned cave map's walls into vector lines (prototype, for the map
layer pilot).

1. Ink: pixels darker than INK_LEVEL.
2. Masked out: the config's "exclude" boxes (title, legend, cross-sections,
   inset map...) and the labels OCR finds (Tesseract, cached).
3. Walls: the long connected ink shapes - depth numbers and symbols standing
   apart are compact (see MIN_WALL_EXTENT_PX).
4. Passages as solid bands: a closing merges each passage's two walls and the
   floor stipple between them; an opening then drops the thin strokes left
   (leader lines, hatching).
5. Lines: the bands' outlines - one line along each wall, pillars and
   islands as inner outlines - smoothed, simplified and placed with the same
   similarity fit as overlay_scan.py (scale, rotation, shift through the
   control points).

Writes <output>/<name>-walls-review.png (the bands tinted, the outlines
black, masked areas pale orange) and <output>/<name>-walls.geojson, which
overlay_scan.py's preview then shows over the satellite imagery.

Usage: python scripts/map-layer/trace_scan.py <config.json> <output folder>
Needs Pillow, numpy, opencv, scipy, pyproj, shapely, pytesseract.
"""
import json
import os
import sys
from pathlib import Path

import cv2
import numpy
from PIL import Image
from pyproj import Transformer
from scipy import ndimage
from shapely.geometry import LineString, mapping

from overlay_scan import fit_similarity
from triage_maps import TESSDATA, TESSERACT

Image.MAX_IMAGE_PIXELS = None
INK_LEVEL = 140
# A wall is a long ink shape: its bounding box's longest side reaches
# MIN_WALL_EXTENT_PX. Symbols and depth numbers standing apart are compact.
MIN_WALL_EXTENT_PX = 60
# Only real labels are masked: OCR words of letters, read confidently - its
# misreadings of station numbers or wall wiggles would cut the walls apart.
MIN_WORD_CONF = 60
MIN_WORD_LETTERS = 2
# ... and longer words even when read less confidently: labels too.
LONG_WORD_CONF = 30
LONG_WORD_LETTERS = 3
# Margin around each OCR word, in pixels.
WORD_PAD = 4
# Passage bands: the closing bridges the gap between a passage's walls and
# its floor stipple; the opening removes strokes thinner than its size.
CLOSE_PX = 9
OPEN_PX = 5
# Outlines kept: at least MIN_OUTLINE_METRES long; an outer one enclosing at
# least MIN_BAND_SQ_METRES (smaller: a symbol); a hole (pillar, island) at
# least MIN_HOLE_SQ_METRES (smaller: a gap in the stipple).
MIN_OUTLINE_METRES = 8
MIN_BAND_SQ_METRES = 60
MIN_HOLE_SQ_METRES = 60
SIMPLIFY_METRES = 0.5
# Chaikin corner-cutting passes: smooth out the pixel staircase.
SMOOTH_PASSES = 2


def ocr_words(image, cache):
    if cache.exists():
        return json.loads(cache.read_text(encoding='utf-8'))
    import pytesseract
    pytesseract.pytesseract.tesseract_cmd = TESSERACT
    os.environ['TESSDATA_PREFIX'] = TESSDATA
    data = pytesseract.image_to_data(image, lang='eng+spa', config='--psm 11', output_type=pytesseract.Output.DICT)
    words = [{'t': data['text'][i].strip(), 'box': [data['left'][i], data['top'][i], data['left'][i] + data['width'][i], data['top'][i] + data['height'][i]], 'conf': float(data['conf'][i])}
             for i in range(len(data['text'])) if data['text'][i].strip()]
    cache.write_text(json.dumps(words), encoding='utf-8')
    return words


def smooth(line, passes=SMOOTH_PASSES):
    """Chaikin's corner cutting, keeping the line's ends (and a loop closed)."""
    coords = list(line.coords)
    closed = coords[0] == coords[-1]
    for _ in range(passes):
        if len(coords) < 3:
            break
        out = [] if closed else [coords[0]]
        for (x0, y0), (x1, y1) in zip(coords, coords[1:]):
            out += [(0.75 * x0 + 0.25 * x1, 0.75 * y0 + 0.25 * y1), (0.25 * x0 + 0.75 * x1, 0.25 * y0 + 0.75 * y1)]
        coords = out + ([out[0]] if closed else [coords[-1]])
    return LineString(coords)


def main(config_path, output):
    config_path = Path(config_path)
    config = json.loads(config_path.read_text(encoding='utf-8'))
    name = config_path.stem
    out = Path(output)
    out.mkdir(parents=True, exist_ok=True)

    grey = Image.open(config_path.parent.joinpath(config['image']).resolve()).convert('L')
    ink = numpy.asarray(grey) < INK_LEVEL
    height, width = ink.shape

    masked = numpy.zeros_like(ink)
    for item in config.get('exclude', []):
        x0, y0, x1, y1 = item['box']
        masked[max(0, y0):y1, max(0, x0):x1] = True
    words = ocr_words(grey, out / f'{name}-ocr-words.json')
    letters = lambda w: sum(c.isalpha() for c in w['t'])  # noqa: E731
    labels_only = [w for w in words if (w['conf'] >= MIN_WORD_CONF and letters(w) >= MIN_WORD_LETTERS)
                   or (w['conf'] >= LONG_WORD_CONF and letters(w) >= LONG_WORD_LETTERS)]
    for word in labels_only:
        x0, y0, x1, y1 = word['box']
        masked[max(0, y0 - WORD_PAD):y1 + WORD_PAD, max(0, x0 - WORD_PAD):x1 + WORD_PAD] = True

    candidate = ink & ~masked
    labels, count = ndimage.label(candidate, structure=numpy.ones((3, 3)))
    extents = [max(s[0].stop - s[0].start, s[1].stop - s[1].start) for s in ndimage.find_objects(labels)]
    walls = numpy.isin(labels, [i + 1 for i, extent in enumerate(extents) if extent >= MIN_WALL_EXTENT_PX])

    band = cv2.morphologyEx(walls.astype(numpy.uint8) * 255, cv2.MORPH_CLOSE, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (CLOSE_PX, CLOSE_PX)))
    band = cv2.morphologyEx(band, cv2.MORPH_OPEN, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (OPEN_PX, OPEN_PX)))
    contours, hierarchy = cv2.findContours(band, cv2.RETR_CCOMP, cv2.CHAIN_APPROX_NONE)

    to_utm = Transformer.from_crs(4326, config['utmEpsg'], always_xy=True)
    to_lnglat = Transformer.from_crs(config['utmEpsg'], 4326, always_xy=True)
    fitted = [p for p in config['controlPoints'] if not p.get('check')]
    place, scale, _ = fit_similarity([p['px'] for p in fitted], [to_utm.transform(p['longitude'], p['latitude']) for p in fitted])

    review = numpy.full((height, width, 3), 255, numpy.uint8)
    review[masked] = (255, 236, 200)
    review[band > 0] = (200, 225, 255)
    features = []
    for index, contour in enumerate(contours):
        if len(contour) < 4:
            continue
        hole = hierarchy[0][index][3] != -1
        area = abs(cv2.contourArea(contour)) * scale ** 2
        if cv2.arcLength(contour, True) * scale < MIN_OUTLINE_METRES or area < (MIN_HOLE_SQ_METRES if hole else MIN_BAND_SQ_METRES):
            continue
        points = [tuple(p) for p in contour[:, 0, :].astype(float)]
        line = smooth(LineString(points + points[:1])).simplify(SIMPLIFY_METRES / scale)
        cv2.polylines(review, [numpy.array(line.coords, numpy.int32)], False, (0, 0, 0), 2)
        features.append({'type': 'Feature', 'properties': {'map': name, 'kind': 'wall', 'sistemaId': config.get('sistemaId'), 'credits': config.get('credits')},
                         'geometry': mapping(LineString([to_lnglat.transform(*place(x, y)) for x, y in line.coords]))})
    Image.fromarray(review).save(out / f'{name}-walls-review.png')

    geojson = out / f'{name}-walls.geojson'
    geojson.write_text(json.dumps({'type': 'FeatureCollection', 'features': features}, separators=(',', ':')), encoding='utf-8')
    print(f'{len(labels_only)} of {len(words)} OCR words masked as labels; {len(contours)} outlines -> {len(features)} wall lines -> {geojson} '
          f'({geojson.stat().st_size // 1024} KB); scale {scale:.4f} m/px')


if __name__ == '__main__':
    if len(sys.argv) != 3:
        sys.exit(__doc__)
    main(sys.argv[1], sys.argv[2])

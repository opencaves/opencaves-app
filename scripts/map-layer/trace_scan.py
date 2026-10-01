"""Traces a scanned cave map's walls into vector lines (prototype, for the map
layer pilot).

1. Ink: pixels darker than INK_LEVEL.
2. Masked out: the config's "exclude" boxes (title, legend, cross-sections,
   inset map...) and the labels OCR finds (Tesseract, cached).
3. Walls: the long connected ink shapes - floor stippling, depth numbers
   and symbols are compact (see MIN_WALL_EXTENT_PX).
4. Lines: the walls thinned to one-pixel centrelines (skeleton), traced into
   polylines, simplified; placed with the same similarity fit as
   overlay_scan.py (scale, rotation, shift through the control points).

Writes <output>/<name>-walls-review.png (kept ink black, removed ink pale,
masked areas tinted), <output>/<name>-walls.geojson and a satellite preview
<output>/<name>-walls.html.

Usage: python scripts/map-layer/trace_scan.py <config.json> <output folder>
Needs Pillow, numpy, scikit-image, pyproj, shapely, pytesseract.
"""
import json
import os
import sys
from pathlib import Path

import numpy
from PIL import Image
from pyproj import Transformer
from scipy import ndimage
from shapely.geometry import LineString, mapping
from skimage.morphology import skeletonize

from overlay_scan import fit_similarity
from triage_maps import TESSDATA, TESSERACT

Image.MAX_IMAGE_PIXELS = None
INK_LEVEL = 140
# A wall is a long ink shape: its bounding box's longest side reaches
# MIN_WALL_EXTENT_PX. Symbols, depth numbers and floor stipples are compact.
MIN_WALL_EXTENT_PX = 60
# Only real labels are masked: OCR words of letters, read confidently - its
# misreadings of station numbers or wall wiggles would cut the walls apart.
MIN_WORD_CONF = 60
MIN_WORD_LETTERS = 2
# ... and longer words even when read less confidently: labels too.
LONG_WORD_CONF = 30
LONG_WORD_LETTERS = 3
# Leader lines (label -> passage) end at their label: a dead-end branch whose
# free end is this close (px) to a label is one, not a wall.
LEADER_END_PX = 30
# Margin around each OCR word, in pixels.
WORD_PAD = 4
# Traced lines shorter than this (metres) are dropped; simplification tolerance.
MIN_LINE_METRES = 3
SIMPLIFY_METRES = 0.5


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


def trace_skeleton(skeleton):
    """The skeleton's pixel paths between junctions and ends, as point lists."""
    pixels = set(zip(*numpy.nonzero(skeleton)))
    neighbours = lambda p: [(p[0] + dy, p[1] + dx) for dy in (-1, 0, 1) for dx in (-1, 0, 1) if (dy or dx) and (p[0] + dy, p[1] + dx) in pixels]
    degree = {p: len(neighbours(p)) for p in pixels}
    nodes = {p for p, d in degree.items() if d != 2}
    visited_edges = set()
    paths = []

    def walk(start, nxt):
        path = [start, nxt]
        previous, current = start, nxt
        while current not in nodes:
            following = [n for n in neighbours(current) if n != previous]
            if not following:
                break
            previous, current = current, following[0]
            if (previous, current) in visited_edges:
                break
            visited_edges.add((previous, current))
            path.append(current)
        return path

    for node in nodes:
        for n in neighbours(node):
            if (node, n) in visited_edges:
                continue
            visited_edges.add((node, n))
            path = walk(node, n)
            visited_edges.add((path[-1], path[-2]))
            paths.append(path)
    # Closed loops with no junction at all.
    remaining = pixels - {p for path in paths for p in path}
    while remaining:
        start = remaining.pop()
        loop = [start]
        current, previous = start, None
        while True:
            following = [n for n in neighbours(current) if n != previous and n in remaining]
            if not following:
                break
            previous, current = current, following[0]
            remaining.discard(current)
            loop.append(current)
        loop.append(start)
        paths.append(loop)
    return paths


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
    letters = lambda w: sum(c.isalpha() for c in w['t'])
    labels_only = [w for w in words if (w['conf'] >= MIN_WORD_CONF and letters(w) >= MIN_WORD_LETTERS)
                   or (w['conf'] >= LONG_WORD_CONF and letters(w) >= LONG_WORD_LETTERS)]
    near_label = numpy.zeros_like(ink)
    for word in labels_only:
        x0, y0, x1, y1 = word['box']
        near_label[max(0, y0 - LEADER_END_PX):y1 + LEADER_END_PX, max(0, x0 - LEADER_END_PX):x1 + LEADER_END_PX] = True
    for word in labels_only:
        x0, y0, x1, y1 = word['box']
        masked[max(0, y0 - WORD_PAD):y1 + WORD_PAD, max(0, x0 - WORD_PAD):x1 + WORD_PAD] = True

    candidate = ink & ~masked
    labels, count = ndimage.label(candidate, structure=numpy.ones((3, 3)))
    extents = [max(s[0].stop - s[0].start, s[1].stop - s[1].start) for s in ndimage.find_objects(labels)]
    keep_ids = [i + 1 for i, extent in enumerate(extents) if extent >= MIN_WALL_EXTENT_PX]
    walls = numpy.isin(labels, keep_ids)
    print(f'{len(labels_only)} of {len(words)} OCR words masked as labels; {count} ink shapes, {len(keep_ids)} kept as walls ({walls.sum()} px)')

    # Review image: kept ink black, removed ink pale grey, masked areas tinted.
    review = numpy.full((height, width, 3), 255, numpy.uint8)
    review[masked] = (255, 236, 200)
    review[ink & ~walls] = (190, 190, 190)
    review[walls] = (0, 0, 0)
    Image.fromarray(review).save(out / f'{name}-walls-review.png')

    # Centrelines of the wall ink, traced and placed.
    skeleton = skeletonize(walls)
    paths = trace_skeleton(skeleton)
    # Leader lines: branches with a free end (one neighbour) by a label.
    neighbour_count = ndimage.convolve(skeleton.astype(int), numpy.ones((3, 3), int), mode='constant') - skeleton
    def is_leader(path):
        ends = [p for p in (path[0], path[-1]) if neighbour_count[p] == 1]
        return any(near_label[p] for p in ends)
    leaders = [p for p in paths if is_leader(p)]
    paths = [p for p in paths if not is_leader(p)]
    print(f'{len(leaders)} leader-line branches dropped')
    to_utm = Transformer.from_crs(4326, config['utmEpsg'], always_xy=True)
    to_lnglat = Transformer.from_crs(config['utmEpsg'], 4326, always_xy=True)
    fitted = [p for p in config['controlPoints'] if not p.get('check')]
    place, scale, rotation = fit_similarity([p['px'] for p in fitted], [to_utm.transform(p['longitude'], p['latitude']) for p in fitted])
    features = []
    for path in paths:
        line = LineString([(x, y) for y, x in path])
        if line.length * scale < MIN_LINE_METRES:
            continue
        line = line.simplify(SIMPLIFY_METRES / scale)
        coords = [to_lnglat.transform(*place(x, y)) for x, y in line.coords]
        features.append({'type': 'Feature', 'properties': {'map': name, 'kind': 'wall', 'sistemaId': config.get('sistemaId'), 'credits': config.get('credits')},
                         'geometry': mapping(LineString(coords))})
    collection = {'type': 'FeatureCollection', 'features': features}
    geojson = out / f'{name}-walls.geojson'
    geojson.write_text(json.dumps(collection, separators=(',', ':')), encoding='utf-8')
    print(f'{len(paths)} skeleton paths -> {len(features)} wall lines -> {geojson} ({geojson.stat().st_size // 1024} KB); scale {scale:.4f} m/px')


if __name__ == '__main__':
    if len(sys.argv) != 3:
        sys.exit(__doc__)
    main(sys.argv[1], sys.argv[2])

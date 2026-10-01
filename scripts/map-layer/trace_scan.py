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

Fine line drawings (bold wall strokes, thinner stipple and boulders, e.g.
James Coke's maps) use "trace": {"method": "wall-strokes"}.
Survey line plots (a Google Earth screenshot with the survey lines drawn on
it) use "trace": {"method": "survey-lines"}: centrelines, not walls.
Maps whose passages are filled with a pale blue (e.g. a photographed QRSS
poster) use "trace": {"method": "colour-fill"} instead of steps 3-4: see
colour_fill_band().

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
from skimage.morphology import skeletonize

from overlay_scan import raster_placement
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
# Real labels (see real_labels): letters and OCR confidence.
REAL_LABEL_LETTERS = 3
REAL_LABEL_CONF = 70
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


def local_level(values, window_px, factor=8):
    """The background level of an image channel, per area: the median over a
    window wider than any passage (the paper then fills most of it, even next
    to a large basin), smoothed. Computed on a reduced copy (fast)."""
    small = cv2.resize(values, None, fx=1 / factor, fy=1 / factor, interpolation=cv2.INTER_AREA)
    window = window_px // factor | 1
    level = cv2.medianBlur(numpy.clip(small + 128, 0, 255).astype(numpy.uint8), window).astype(numpy.float32) - 128
    level = cv2.GaussianBlur(level, (0, 0), window / 4)
    return cv2.resize(level, (values.shape[1], values.shape[0]), interpolation=cv2.INTER_LINEAR)


def colour_fill_band(image_path, masked, trace):
    """Passage bands for maps whose passages are filled with a pale blue
    (config "trace": {"method": "colour-fill"}). Blueness is blue minus red,
    compared with the paper's own blueness around it (local_level), so the
    uneven lighting of a photo cancels out. Three ways in, combined:
    - strong: pixels clearly bluer than the paper ("threshold"), after a
      blur - wide passages;
    - enclosed: the regions the dark wall outlines enclose, when their
      average blueness is above the paper's ("regionThreshold") - narrow
      passages, whose few blue pixels a blur would wash out, still show on
      average;
    - connected: faintly blue pixels ("weakThreshold") joined to either -
      the thinnest passage ends."""
    rgb = numpy.asarray(Image.open(image_path).convert('RGB')).astype(numpy.float32)
    blueness = rgb[..., 2] - rgb[..., 0]
    grey = rgb.mean(axis=2)
    window = trace.get('paperWindowPx', 500)
    paper = local_level(blueness, window)
    ink = (local_level(grey - 128, window) + 128 - grey) >= trace.get('inkContrast', 35)
    ink = cv2.morphologyEx(ink.astype(numpy.uint8), cv2.MORPH_CLOSE, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (3, 3))) > 0

    strong = (cv2.GaussianBlur(blueness, (0, 0), 3) - paper) >= trace.get('threshold', 8)
    regions, count = ndimage.label(~ink & ~masked)
    ids = numpy.arange(1, count + 1)
    excess = blueness - paper
    mean = ndimage.mean(excess, regions, ids)
    size = ndimage.sum(numpy.ones_like(regions), regions, ids)
    overlap = ndimage.mean(strong.astype(numpy.float32), regions, ids)
    # Only small regions: narrow passages enclose little, while paper inside a
    # loop of passages, often faintly blue on a photo, encloses a lot.
    max_region = trace.get('maxRegionPx', 20000)
    enclosed = numpy.isin(regions, [int(i) for i, m, n, o in zip(ids, mean, size, overlap)
                                    if 40 <= n <= max_region and (m >= trace.get('regionThreshold', 4) or o >= 0.3)])
    core = (strong | enclosed) & ~masked
    weak_excess = cv2.GaussianBlur(blueness, (0, 0), 1) - paper
    weak = (weak_excess >= trace.get('weakThreshold', 4)) & ~ink & ~masked
    # Local low-threshold areas (config "lowThresholdAreas": [{"box": [x0, y0,
    # x1, y1], "threshold": t}]): passage ends whose fill has faded almost to
    # the paper's colour. A lower threshold anywhere would flood the paper;
    # inside a box drawn around a tip, a leak can't spread beyond it. Enclosed
    # regions there count from the same lower average too.
    for area in trace.get('lowThresholdAreas', []):
        x0, y0, x1, y1 = area['box']
        window = (slice(max(0, y0), y1), slice(max(0, x0), x1))
        low = area.get('threshold', 1.5)
        weak[window] |= (weak_excess[window] >= low) & ~ink[window] & ~masked[window]
        local = regions[window]
        for i in numpy.unique(local[local > 0]):
            if mean[i - 1] >= low and size[i - 1] <= max_region:
                core[window] |= local == i
    core &= ~masked
    joined, _ = ndimage.label(weak | core)
    touching = numpy.unique(joined[core])
    band = numpy.isin(joined, touching[touching > 0]).astype(numpy.uint8)
    # Specks off, then grown over the wall ink so the band reaches the drawn wall.
    band = cv2.morphologyEx(band, cv2.MORPH_OPEN, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (3, 3)))
    band = cv2.dilate(band, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (5, 5)))
    return (band > 0).astype(numpy.uint8) * 255 & ~(masked.astype(numpy.uint8) * 255)


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


def contrast_ink(grey, trace):
    """Ink by contrast with its own surroundings (the median over a window
    wider than any stroke), not a fixed level: symbols are often drawn in
    grey, lighter than the walls, and on a grey fill (water) as well as on
    the paper."""
    window = trace.get('contrastWindowPx', 31) | 1
    background = cv2.medianBlur(grey.astype(numpy.uint8), window).astype(numpy.int16)
    return (background - grey.astype(numpy.int16)) >= trace.get('detailContrast', 35)


def grey_fill_mask(grey, masked, trace):
    """Grey fills (flooded passage, water on black-and-white maps): between
    the paper and the ink, in large smooth areas."""
    lo, hi = trace.get('greyRange', [150, 225])
    fill = (grey >= lo) & (grey <= hi) & ~masked
    fill = cv2.morphologyEx(fill.astype(numpy.uint8), cv2.MORPH_OPEN, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (7, 7)))
    return cv2.morphologyEx(fill, cv2.MORPH_CLOSE, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (9, 9))) > 0


def detail_features(detail_ink, water, place, to_lnglat, scale, trace, properties):
    """Everything drawn between the walls, as the map shows it: the inked
    symbols (boulders, columns, stalagmites, stipple, slopes...) as filled
    shapes - their ink outlines, holes included, so a ring stays a ring and a
    solid column stays solid - and the grey areas (flooded passage, water) as
    grey polygons. Kind "detail" and "water"."""
    from shapely.geometry import Polygon
    features = []
    tolerance = trace.get('detailSimplifyMetres', 0.03) / scale

    def polygons(mask, kind, min_px):
        contours, hierarchy = cv2.findContours(mask.astype(numpy.uint8), cv2.RETR_CCOMP, cv2.CHAIN_APPROX_SIMPLE)
        if hierarchy is None:
            return
        for index, contour in enumerate(contours):
            if hierarchy[0][index][3] != -1 or cv2.contourArea(contour) < min_px:
                continue
            holes = []
            child = hierarchy[0][index][2]
            while child != -1:
                if len(contours[child]) >= 3:
                    holes.append([tuple(p) for p in contours[child][:, 0, :].astype(float)])
                child = hierarchy[0][child][0]
            if len(contour) < 3:
                continue
            shape = Polygon([tuple(p) for p in contour[:, 0, :].astype(float)], holes).buffer(0).simplify(tolerance)
            for part in getattr(shape, 'geoms', [shape]):
                if part.is_empty or part.geom_type != 'Polygon':
                    continue
                exterior = [to_lnglat.transform(*place(x, y)) for x, y in part.exterior.coords]
                interiors = [[to_lnglat.transform(*place(x, y)) for x, y in ring.coords] for ring in part.interiors]
                features.append({'type': 'Feature', 'properties': {**properties, 'kind': kind},
                                 'geometry': {'type': 'Polygon', 'coordinates': [exterior] + interiors}})

    polygons(detail_ink, 'detail', trace.get('minDetailPx', 6))
    if water is not None:
        polygons(water, 'water', trace.get('minWaterPx', 4000))
    return features


def rounded(collection, digits=7):
    """Coordinates rounded to ~1 cm (7 decimals of a degree): the file
    otherwise carries 15 meaningless decimals per coordinate."""
    def walk(c):
        return round(c, digits) if isinstance(c, float) else [walk(v) for v in c]
    for feature in collection['features']:
        feature['geometry']['coordinates'] = walk(feature['geometry']['coordinates'])
    return collection


def real_labels(words):
    """The OCR words that are real labels - masked, so they aren't traced as
    walls or drawn as symbols: 3 letters or more, nearly all letters, read
    confidently. On a dense drawing Tesseract also "reads" symbols ("(DA",
    "GE)", "OO"), and short codes ("tb", "a", "tt") are themselves map
    symbols: both stay, to be drawn."""
    def letters(w):
        return sum(c.isalpha() for c in w['t'])
    return [w for w in words if letters(w) >= REAL_LABEL_LETTERS and letters(w) >= 0.8 * len(w['t']) and w['conf'] >= REAL_LABEL_CONF]


def leader_lines(ink, labels, height, width, trace):
    """Ink shapes that are a label's leader line: one open stroke - no loop
    (pillars and wall outlines are closed or branched), exactly two ends,
    its ink about its length times its width with no blob - between
    "leaderMinPx" and "leaderMaxPx" long, one END within "leaderReachPx" of a
    label. Stroke weight varies from map to map, so width is judged from the
    stroke itself."""
    reach = trace.get('leaderReachPx', 60)
    near_label = numpy.zeros((height, width), bool)
    for word in labels:
        x0, y0, x1, y1 = word['box']
        near_label[max(0, y0 - reach):y1 + reach, max(0, x0 - reach):x1 + reach] = True
    shapes, _ = ndimage.label(ink, structure=numpy.ones((3, 3)))
    depth = cv2.distanceTransform(ink.astype(numpy.uint8), cv2.DIST_L2, 3)
    leaders = numpy.zeros_like(ink)
    min_len, max_len = trace.get('leaderMinPx', 40), trace.get('leaderMaxPx', 400)
    for i, s in enumerate(ndimage.find_objects(shapes)):
        extent = max(s[0].stop - s[0].start, s[1].stop - s[1].start)
        if not min_len <= extent <= max_len:
            continue
        shape = shapes[s] == i + 1
        if not near_label[s][shape].any():
            continue
        # No loop: the background around and inside the shape is one piece.
        if ndimage.label(numpy.pad(~shape, 1, constant_values=True))[1] != 1:
            continue
        skeleton = skeletonize(shape)
        neighbours = ndimage.convolve(skeleton.astype(int), numpy.ones((3, 3), int), mode='constant') - skeleton
        ends = numpy.argwhere(skeleton & (neighbours == 1))
        if len(ends) != 2:
            continue
        values = depth[s][shape]
        half = float(numpy.median(values[values >= numpy.percentile(values, 75)]))
        length = skeleton.sum()
        if shape.sum() > length * 2 * half * 1.5 or values.max() > half * 1.4:
            continue
        if any(near_label[s][y, x] for y, x in ends):
            leaders[s] |= shape
    return leaders


def survey_line_paths(image_path, boxes, trace):
    """Survey line plots (config "trace": {"method": "survey-lines"}): the
    lines of the survey colour (blue on a Google Earth screenshot), thinned
    to one pixel and traced into paths - centrelines, not walls."""
    rgb = numpy.asarray(Image.open(image_path).convert('RGB')).astype(int)
    r, g, b = rgb[..., 0], rgb[..., 1], rgb[..., 2]
    lines = (b - numpy.maximum(r, g) >= trace.get('minBlueExcess', 30)) & ~boxes
    # Thin lines on a compressed screenshot break up: bridge small gaps first.
    gap = trace.get('bridgePx', 3)
    lines = cv2.morphologyEx(lines.astype(numpy.uint8), cv2.MORPH_CLOSE, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (gap, gap))) > 0
    return trace_skeleton(skeletonize(lines))


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
    labels_only = real_labels(words)
    for word in labels_only:
        x0, y0, x1, y1 = word['box']
        masked[max(0, y0 - WORD_PAD):y1 + WORD_PAD, max(0, x0 - WORD_PAD):x1 + WORD_PAD] = True

    trace = config.get('trace', {})
    # Leader lines (a label's line to what it names - "Entrada" to its
    # entrance): thin strokes standing alone, one end by a label. Entrances
    # get their own pins, so the lines go.
    leaders = leader_lines(ink & ~masked, labels_only, height, width, trace)
    ink &= ~leaders
    # The contrast-based detail detection sees a stroke's soft edge too.
    grown_leaders = cv2.dilate(leaders.astype(numpy.uint8), cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (7, 7))) > 0
    if leaders.any():
        print(f'{ndimage.label(leaders, structure=numpy.ones((3, 3)))[1]} leader lines removed')
    if trace.get('method') == 'survey-lines':
        boxes = numpy.zeros_like(ink)
        for item in config.get('exclude', []):
            x0, y0, x1, y1 = item['box']
            boxes[max(0, y0):y1, max(0, x0):x1] = True
        to_lnglat = Transformer.from_crs(config['utmEpsg'], 4326, always_xy=True)
        place, scale, _ = raster_placement(config)
        features = []
        for path in survey_line_paths(config_path.parent.joinpath(config['image']).resolve(), boxes, trace):
            line = LineString([(x, y) for y, x in path])
            if line.length * scale < MIN_OUTLINE_METRES:
                continue
            line = line.simplify(max(SIMPLIFY_METRES, scale / 2) / scale)
            features.append({'type': 'Feature', 'properties': {'map': name, 'kind': 'survey', 'sistemaId': config.get('sistemaId'), 'credits': config.get('credits')},
                             'geometry': mapping(LineString([to_lnglat.transform(*place(x, y)) for x, y in line.coords]))})
        geojson = out / f'{name}-walls.geojson'
        geojson.write_text(json.dumps(rounded({'type': 'FeatureCollection', 'features': features}), separators=(',', ':')), encoding='utf-8')
        print(f'{len(features)} survey lines -> {geojson} ({geojson.stat().st_size // 1024} KB); scale {scale:.4f} m/px')
        return
    if trace.get('method') == 'wall-strokes':
        # Fine line drawings (walls as bold strokes around open passages, with
        # thinner stipple, hatching and boulder outlines): an opening keeps the
        # strokes at least as bold as the walls; of those, the long ones are
        # walls (columns and stalagmites are bold but compact). Their
        # centrelines are the wall lines.
        drawn = (ink & ~masked).astype(numpy.uint8)

        def opened(r):
            return cv2.morphologyEx(drawn, cv2.MORPH_OPEN, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (2 * r + 1, 2 * r + 1)))

        def long_parts(mask, min_extent):
            labels, _ = ndimage.label(mask, structure=numpy.ones((3, 3)))
            extents = [max(sl[0].stop - sl[0].start, sl[1].stop - sl[1].start) for sl in ndimage.find_objects(labels)]
            return numpy.isin(labels, [i + 1 for i, extent in enumerate(extents) if extent >= min_extent])

        radius = trace.get('openRadiusPx', 3)
        min_extent = trace.get('minExtentPx', 150)
        strong = long_parts(opened(radius), min_extent)
        # Walls aren't drawn equally bold everywhere: the thinner strokes
        # (one radius less) count too when they touch a bold wall or are long
        # on their own - stipple and boulders do neither.
        weak = opened(radius - 1)
        weak_labels, _ = ndimage.label(weak, structure=numpy.ones((3, 3)))
        touching = numpy.unique(weak_labels[strong & (weak_labels > 0)])
        strokes = strong | numpy.isin(weak_labels, touching[touching > 0]) | long_parts(weak, 2 * min_extent)
        to_lnglat = Transformer.from_crs(config['utmEpsg'], 4326, always_xy=True)
        place, scale, _ = raster_placement(config)
        features = []
        review = numpy.full((height, width, 3), 255, numpy.uint8)
        review[masked] = (255, 236, 200)
        review[ink & ~strokes] = (200, 200, 255)
        skeleton = skeletonize(strokes)
        neighbours = ndimage.convolve(skeleton.astype(int), numpy.ones((3, 3), int), mode='constant') - skeleton
        for path in trace_skeleton(skeleton):
            line = LineString([(x, y) for y, x in path])
            # The minimum length drops stray spurs only (a free end): a segment
            # between two junctions - a column's ring with its spokes - is
            # short but part of the drawing.
            free_end = any(neighbours[p] <= 1 for p in (path[0], path[-1]))
            if free_end and line.length * scale < trace.get('minLineMetres', 1):
                continue
            line = smooth(line).simplify(max(SIMPLIFY_METRES / 5, scale) / scale)
            cv2.polylines(review, [numpy.array(line.coords, numpy.int32)], False, (0, 0, 0), 3)
            features.append({'type': 'Feature', 'properties': {'map': name, 'kind': 'wall', 'sistemaId': config.get('sistemaId'), 'credits': config.get('credits')},
                             'geometry': mapping(LineString([to_lnglat.transform(*place(x, y)) for x, y in line.coords]))})
        walls_count = len(features)
        if trace.get('details', True):
            # Water only respects the excluded boxes: a label's mask would cut
            # a hole in the grey fill it's printed on.
            boxes = numpy.zeros_like(masked)
            for item in config.get('exclude', []):
                x0, y0, x1, y1 = item['box']
                boxes[max(0, y0):y1, max(0, x0):x1] = True
            features += detail_features(contrast_ink(numpy.asarray(grey), trace) & ~masked & ~strokes & ~grown_leaders, grey_fill_mask(numpy.asarray(grey), boxes, trace), place, to_lnglat, scale, trace,
                                        {'map': name, 'sistemaId': config.get('sistemaId')})
        Image.fromarray(review).save(out / f'{name}-walls-review.png')
        geojson = out / f'{name}-walls.geojson'
        geojson.write_text(json.dumps(rounded({'type': 'FeatureCollection', 'features': features}), separators=(',', ':')), encoding='utf-8')
        counts = {}
        for feature in features[walls_count:]:
            counts[feature['properties']['kind']] = counts.get(feature['properties']['kind'], 0) + 1
        print(f'{walls_count} wall lines (bold strokes), ' + ', '.join(f'{n} {k}' for k, n in counts.items())
              + f' -> {geojson} ({geojson.stat().st_size // 1024} KB); scale {scale:.4f} m/px')
        return
    if trace.get('method') == 'colour-fill':
        # Only the excluded boxes: labels are dark text, never blue fill, and
        # their masks would cut notches into the passages they sit on.
        boxes = numpy.zeros_like(ink)
        for item in config.get('exclude', []):
            x0, y0, x1, y1 = item['box']
            boxes[max(0, y0):y1, max(0, x0):x1] = True
        band = colour_fill_band(config_path.parent.joinpath(config['image']).resolve(), boxes, trace)
    else:
        candidate = ink & ~masked
        labels, count = ndimage.label(candidate, structure=numpy.ones((3, 3)))
        extents = [max(s[0].stop - s[0].start, s[1].stop - s[1].start) for s in ndimage.find_objects(labels)]
        walls = numpy.isin(labels, [i + 1 for i, extent in enumerate(extents) if extent >= MIN_WALL_EXTENT_PX])
        band = cv2.morphologyEx(walls.astype(numpy.uint8) * 255, cv2.MORPH_CLOSE, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (CLOSE_PX, CLOSE_PX)))
        band = cv2.morphologyEx(band, cv2.MORPH_OPEN, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (OPEN_PX, OPEN_PX)))
    contours, hierarchy = cv2.findContours(band, cv2.RETR_CCOMP, cv2.CHAIN_APPROX_NONE)

    to_utm = Transformer.from_crs(4326, config['utmEpsg'], always_xy=True)
    to_lnglat = Transformer.from_crs(config['utmEpsg'], 4326, always_xy=True)
    place, scale, _ = raster_placement(config)

    review = numpy.full((height, width, 3), 255, numpy.uint8)
    review[masked] = (255, 236, 200)
    review[band > 0] = (200, 225, 255)
    features = []
    for index, contour in enumerate(contours):
        if len(contour) < 4:
            continue
        hole = hierarchy[0][index][3] != -1
        area = abs(cv2.contourArea(contour)) * scale ** 2
        # Colour fill: passage ends cut off at a narrow neck are small but real.
        min_band = trace.get('minBandSqMetres', MIN_BAND_SQ_METRES)
        if cv2.arcLength(contour, True) * scale < MIN_OUTLINE_METRES or area < (MIN_HOLE_SQ_METRES if hole else min_band):
            continue
        points = [tuple(p) for p in contour[:, 0, :].astype(float)]
        line = smooth(LineString(points + points[:1])).simplify(SIMPLIFY_METRES / scale)
        cv2.polylines(review, [numpy.array(line.coords, numpy.int32)], False, (0, 0, 0), 2)
        features.append({'type': 'Feature', 'properties': {'map': name, 'kind': 'wall', 'sistemaId': config.get('sistemaId'), 'credits': config.get('credits')},
                         'geometry': mapping(LineString([to_lnglat.transform(*place(x, y)) for x, y in line.coords]))})

    # Walls from the ink (config "trace": {"inkWalls": [{"box": [...]}]}):
    # where a passage's fill has faded to the paper's colour, its drawn wall
    # outlines are still there. Inside each box, the dark ink - minus labels -
    # is thinned and traced as wall lines; pieces along an already traced
    # passage (its outline is there already) are left out.
    if trace.get('inkWalls'):
        grey_values = numpy.asarray(grey).astype(numpy.float32)
        wall_ink = (local_level(grey_values - 128, 500) + 128 - grey_values) >= trace.get('inkContrast', 45)
        covered = cv2.dilate(band, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (5, 5))) > 0
        for area in trace['inkWalls']:
            x0, y0, x1, y1 = area['box']
            local = numpy.zeros_like(wall_ink)
            local[y0:y1, x0:x1] = wall_ink[y0:y1, x0:x1] & ~masked[y0:y1, x0:x1]
            # Each wall path runs along traced and missing parts alike: keep
            # its stretches away from the traced passages.
            runs = []
            for path in trace_skeleton(skeletonize(local)):
                run = []
                for y, x in path:
                    if covered[y, x]:
                        if len(run) >= 2:
                            runs.append(run)
                        run = []
                    else:
                        run.append((x, y))
                if len(run) >= 2:
                    runs.append(run)
            for points in runs:
                line = LineString(points)
                if line.length * scale < trace.get('inkMinMetres', 3):
                    continue
                line = smooth(line).simplify(SIMPLIFY_METRES / scale)
                cv2.polylines(review, [numpy.array(line.coords, numpy.int32)], False, (200, 0, 120), 2)
                features.append({'type': 'Feature', 'properties': {'map': name, 'kind': 'wall', 'from': 'ink', 'sistemaId': config.get('sistemaId'), 'credits': config.get('credits')},
                                 'geometry': mapping(LineString([to_lnglat.transform(*place(x, y)) for x, y in line.coords]))})
    walls_count = len(features)
    if trace.get('details', True):
        # Between the walls: the ink inside the passage bands, kept back from
        # their edges (the wall itself is the band's outline). On a colour-fill
        # map the band is the passage's blue fill: water.
        inside = cv2.erode(band, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (2 * trace.get('wallMarginPx', 4) + 1,) * 2)) > 0
        dark = contrast_ink(numpy.asarray(grey), trace) & ~grown_leaders
        water = band > 0 if trace.get('method') == 'colour-fill' else None
        features += detail_features(dark & inside & ~masked, water, place, to_lnglat, scale, trace, {'map': name, 'sistemaId': config.get('sistemaId')})
    Image.fromarray(review).save(out / f'{name}-walls-review.png')

    geojson = out / f'{name}-walls.geojson'
    geojson.write_text(json.dumps(rounded({'type': 'FeatureCollection', 'features': features}), separators=(',', ':')), encoding='utf-8')
    print(f'{len(labels_only)} of {len(words)} OCR words masked as labels; {len(contours)} outlines -> {walls_count} wall lines, {len(features) - walls_count} details/water -> {geojson} '
          f'({geojson.stat().st_size // 1024} KB); scale {scale:.4f} m/px')


if __name__ == '__main__':
    if len(sys.argv) != 3:
        sys.exit(__doc__)
    main(sys.argv[1], sys.argv[2])

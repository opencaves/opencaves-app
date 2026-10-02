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
import re
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


def symbol_boxes(path, config):
    """The ink boxes of extract_symbols.py's typed points. With
    "keepEntranceInk", an entrance's box (its dot, +-6 px) is left out, so the
    cenote ring or shaft it sits on stays drawn."""
    if not path.exists():
        return []
    boxes = [tuple(map(int, b)) for b in json.loads(path.read_text(encoding='utf-8'))]
    if config.get('trace', {}).get('keepEntranceInk'):
        entrances = {(x - 6, y - 6, x + 6, y + 6) for x, y in (e['px'] for e in config.get('entrances', []) if 'px' in e)}
        boxes = [b for b in boxes if b not in entrances]
    return boxes


def ocr_words(image, cache, config=None):
    words = ocr_words_cached(image, cache)
    # Ink OCR misreads as a label ("notLabelBoxes": [[x0, y0, x1, y1], ...],
    # e.g. a wall tick read "Yor"): its mask would cut the wall it sits on.
    boxes = ((config or {}).get('trace') or {}).get('notLabelBoxes', [])
    inside = lambda wd, b: b[0] <= (wd['box'][0] + wd['box'][2]) / 2 <= b[2] and b[1] <= (wd['box'][1] + wd['box'][3]) / 2 <= b[3]  # noqa: E731
    return [wd for wd in words if not any(inside(wd, b) for b in boxes)]


def ocr_words_cached(image, cache):
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


def carve_paper_islands(band, image_path, masked, rule):
    """"paperIslands": small white (paper) islands inside a passage are
    pillars, but the band's enclosed/blur steps fill them as passage: cut
    back out (so they become hole outlines, walls) when "ringInBand" of a
    "ringPx" ring around them is passage. {"minGrey", "maxBlue" (blue over
    red, for paper), "minPx", "maxPx", "ringPx", "ringInBand"}."""
    rgb = numpy.asarray(Image.open(image_path).convert('RGB')).astype(numpy.int16)
    white = (rgb.mean(axis=2) >= rule.get('minGrey', 225)) & ((rgb[..., 2] - rgb[..., 0]) <= rule.get('maxBlue', 12)) & ~masked
    white = cv2.morphologyEx(white.astype(numpy.uint8), cv2.MORPH_OPEN, numpy.ones((3, 3), numpy.uint8)) > 0
    parts, count = ndimage.label(white)
    sizes = ndimage.sum(numpy.ones_like(parts), parts, numpy.arange(1, count + 1))
    inside = band > 0
    out = band.copy()
    k = rule.get('ringPx', 10)
    outer = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (2 * k + 1,) * 2)
    inner = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (2 * k - 5,) * 2)
    for i, window in enumerate(ndimage.find_objects(parts)):
        if not rule.get('minPx', 60) <= sizes[i] <= rule.get('maxPx', 20000):
            continue
        y0, y1 = max(0, window[0].start - k - 2), window[0].stop + k + 2
        x0, x1 = max(0, window[1].start - k - 2), window[1].stop + k + 2
        island = (parts[y0:y1, x0:x1] == i + 1).astype(numpy.uint8)
        ring = (cv2.dilate(island, outer) > 0) & ~(cv2.dilate(island, inner) > 0)
        if inside[y0:y1, x0:x1][ring].mean() >= rule.get('ringInBand', 0.9) and inside[y0:y1, x0:x1][island > 0].mean() > 0.5:
            out[y0:y1, x0:x1][cv2.dilate(island, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (5, 5))) > 0] = 0
    return out


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
    image = Image.open(image_path).convert('RGB')
    rgb = numpy.asarray(image).astype(numpy.float32)
    blueness = rgb[..., 2] - rgb[..., 0]
    if trace.get('greyFill'):
        # A grey fill ("greyFill": true, b/w maps): darkness plays the part
        # of blueness - the passages are darker than the paper.
        blueness = 255 - rgb.mean(axis=2)
        if trace.get('blueWeight'):
            # Plus the blue: a tan shadow drawn along the walls' outer side is
            # as dark as a pale fill, but not blue.
            blueness = blueness + trace['blueWeight'] * (rgb[..., 2] - rgb[..., 0])
    if trace.get('cyanFill'):
        # Cyan fill only ("cyanFill": true): green above red too. Survey lines
        # drawn in blue-violet (passages surveyed but not drawn) have green
        # about equal to red, so they and their halo don't read as fill.
        blueness = numpy.minimum(blueness, 2 * (rgb[..., 1] - rgb[..., 0]))
    grey = rgb.mean(axis=2)
    window = trace.get('paperWindowPx', 500)
    paper = local_level(blueness, window)
    if trace.get('inkTopHatPx'):
        size = trace['inkTopHatPx'] | 1
        ink = cv2.morphologyEx(grey, cv2.MORPH_BLACKHAT, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (size, size))) >= trace.get('inkContrast', 35)
    else:
        ink = (local_level(grey - 128, window) + 128 - grey) >= trace.get('inkContrast', 35)
    ink = cv2.morphologyEx(ink.astype(numpy.uint8), cv2.MORPH_CLOSE, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (3, 3))) > 0

    if trace.get('paperOutside'):
        # The paper's level from the paper itself: the large non-ink areas
        # outside the passages (closed wall outlines keep them apart), averaged
        # broadly - a photo's uneven light, without dense passages pulling it.
        gap = trace.get('paperGapPx', 3)
        closed = cv2.dilate(ink.astype(numpy.uint8), cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (gap, gap))) > 0
        parts, n = ndimage.label(~closed & ~masked)
        sizes = ndimage.sum(numpy.ones_like(parts), parts, numpy.arange(1, n + 1))
        outside = numpy.isin(parts, 1 + numpy.flatnonzero(sizes >= trace['paperOutside'])).astype(numpy.float32)
        s_ = trace.get('paperSigmaPx', 60)
        w_ = cv2.GaussianBlur(outside, (0, 0), s_)
        paper = numpy.where(w_ > 0.02, cv2.GaussianBlur(blueness * outside, (0, 0), s_) / numpy.maximum(w_, 0.02), paper)
    if trace.get('fillOffInk'):
        off = (~ink).astype(numpy.float32)
        sigma = trace.get('offInkSigmaPx', 6)
        weight = cv2.GaussianBlur(off, (0, 0), sigma)
        blurred = numpy.where(weight > 0.05, cv2.GaussianBlur(blueness * off, (0, 0), sigma) / numpy.maximum(weight, 0.05), cv2.GaussianBlur(blueness, (0, 0), 3))
    else:
        blurred = cv2.GaussianBlur(blueness, (0, 0), 3)
    strong = (blurred - paper) >= trace.get('threshold', 8)
    if trace.get('paperOutside') and trace.get('notOutside'):
        # Never the paper outside the walls: a blur reaches across a wall.
        strong &= ~(outside > 0)
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
    # Fills of other colours that are passage too ("fillColours": [{"hue":
    # [h0, h1], "minSaturation": s}], hue and saturation 0-255): e.g. a
    # cenote's basin drawn in tan.
    if trace.get('fillColours'):
        hsv = numpy.asarray(image.convert('HSV')).astype(numpy.int16)
        blue = cv2.dilate(core.astype(numpy.uint8), cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (9, 9))) > 0
        for colour in trace['fillColours']:
            h0, h1 = colour['hue']
            fill = ((hsv[..., 0] >= h0) & (hsv[..., 0] <= h1) & (hsv[..., 1] >= colour.get('minSaturation', 40))).astype(numpy.float32)
            # By density, as the blue: a basin's fill is broken by stipple.
            fill = (cv2.GaussianBlur(fill, (0, 0), 3) >= colour.get('density', 0.35)) & ~masked
            # Only patches opening onto a blue passage, as a basin does.
            patches, _ = ndimage.label(fill)
            if colour.get('alone'):
                # "alone": true - the colour is passage wherever it is (a
                # collapse zone drawn apart from the blue passages).
                core |= fill
                continue
            touching = numpy.unique(patches[fill & blue])
            core |= numpy.isin(patches, touching[touching > 0])
    weak_excess = cv2.GaussianBlur(blueness, (0, 0), 1) - paper
    weak = (weak_excess >= trace.get('weakThreshold', 4)) & ~ink & ~masked
    if trace.get('paperOutside') and trace.get('notOutside'):
        weak &= ~(outside > 0)
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
    # "fillPolygons": [[[x, y], ...]] - passage drawn by hand, for open water
    # whose fill is only a pattern of dashes on white (a lake).
    for polygon in trace.get('fillPolygons', []):
        area = numpy.zeros(core.shape, numpy.uint8)
        cv2.fillPoly(area, [numpy.array(polygon, numpy.int32)], 1)
        core |= area > 0
    core &= ~masked
    joined, _ = ndimage.label(weak | core)
    touching = numpy.unique(joined[core])
    band = numpy.isin(joined, touching[touching > 0]).astype(numpy.uint8)
    # Specks off, then grown over the wall ink so the band reaches the drawn wall.
    band = cv2.morphologyEx(band, cv2.MORPH_OPEN, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (3, 3)))
    band = cv2.dilate(band, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (5, 5)))
    # "inkBand": true - united with the default band of the drawn walls (long
    # ink shapes, closed, then opened): narrow passages whose fill is mostly
    # stipple and wall ink read there, wide pale ones in the fill.
    if trace.get('inkBand'):
        drawn = (numpy.asarray(Image.open(image_path).convert('L')) < INK_LEVEL) & ~masked
        labels, _ = ndimage.label(drawn, structure=numpy.ones((3, 3)))
        extents = [max(s.stop - s.start for s in sl) for sl in ndimage.find_objects(labels)]
        walls = numpy.isin(labels, [i + 1 for i, e in enumerate(extents) if e >= MIN_WALL_EXTENT_PX])
        closing, opening = trace.get('inkBandClosePx', CLOSE_PX), trace.get('inkBandOpenPx', OPEN_PX)
        walls = cv2.morphologyEx(walls.astype(numpy.uint8) * 255, cv2.MORPH_CLOSE, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (closing, closing)))
        walls = cv2.morphologyEx(walls, cv2.MORPH_OPEN, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (opening, opening)))
        band = (band > 0) | (walls > 0)
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

    # Big shapes are cut along a grid: a water area spanning the whole system,
    # or a network of ink with hundreds of holes, is more than the map's
    # tiling can fill reliably - simplified and snapped to each tile's grid,
    # its rings cross and it shows as wedges and blocks of colour.
    cell = trace.get('splitMetres', 50) / scale

    def split(shape):
        import shapely
        from shapely.geometry import box
        if shape.is_empty:
            return []
        x0, y0, x1, y1 = shape.bounds
        if x1 - x0 <= cell and y1 - y0 <= cell:
            return [shape]
        boxes = [box(x, y, x + cell, y + cell) for x in numpy.arange(x0, x1, cell) for y in numpy.arange(y0, y1, cell)]
        pieces = shapely.intersection(shape, boxes)
        return [g for p in pieces if not p.is_empty for g in getattr(p, 'geoms', [p]) if g.geom_type == 'Polygon' and g.area > 0]

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
            for part in [g for piece in split(shape) for g in getattr(piece, 'geoms', [piece])]:
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
    import shapely
    from shapely.geometry import mapping, shape

    def walk(c):
        return round(c, digits) if isinstance(c, float) else [walk(v) for v in c]
    kept = []
    for feature in collection['features']:
        geometry = feature['geometry']
        if geometry['type'] in ('Polygon', 'MultiPolygon'):
            # Snapped to the grid with shapely, which keeps polygons valid:
            # rounding (or simplifying) can make an outline cross itself, and
            # Mapbox then fills it differently on each tile - white patches
            # flickering as the map zooms.
            snapped = shapely.set_precision(shapely.make_valid(shape(geometry)), 10 ** -digits)
            parts = [g for g in getattr(snapped, 'geoms', [snapped]) if g.geom_type in ('Polygon', 'MultiPolygon') and not g.is_empty]
            if not parts:
                continue
            geometry = mapping(shapely.union_all(parts))
        feature['geometry'] = {'type': geometry['type'], 'coordinates': walk(json.loads(json.dumps(geometry['coordinates'])))}
        kept.append(feature)
    collection['features'] = kept
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
        r = word.get('reach', reach)
        near_label[max(0, y0 - r):y1 + r, max(0, x0 - r):x1 + r] = True
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
        if shape.sum() > length * 2 * half * 1.5 or values.max() > half * 1.6:
            continue
        if any(near_label[s][y, x] for y, x in ends):
            leaders[s] |= shape
    return leaders


def box_spurs(ink, boxes, trace):
    """Leader lines joined to a wall, running to an excluded box (a cross-
    section, a label block): leader_lines() takes strokes standing alone,
    these touch a passage. From each stroke end found by an excluded box, the
    stroke is followed back to the first junction (its wall); when that path
    is long enough and about straight (one elbow allowed), it's a leader, removed up to a few
    pixels short of the wall so the wall stays whole."""
    reach = trace.get('spurReachPx', 40)
    min_len, max_len = trace.get('leaderMinPx', 40), trace.get('leaderMaxPx', 400)
    found = numpy.zeros_like(ink)
    height, width = ink.shape
    steps = [(dy, dx) for dy in (-1, 0, 1) for dx in (-1, 0, 1) if dy or dx]
    for x0, y0, x1, y1 in boxes:
        # Ink around the box, within a leader's length of it.
        wy0, wx0 = max(0, y0 - max_len), max(0, x0 - max_len)
        wy1, wx1 = min(height, y1 + max_len), min(width, x1 + max_len)
        skeleton = skeletonize(ink[wy0:wy1, wx0:wx1])
        count = ndimage.convolve(skeleton.astype(int), numpy.ones((3, 3), int), mode='constant') - skeleton
        ring = numpy.zeros_like(skeleton)
        ring[max(0, y0 - reach - wy0):y1 + reach - wy0, max(0, x0 - reach - wx0):x1 + reach - wx0] = True
        for ey, ex in numpy.argwhere(skeleton & (count == 1) & ring):
            path, previous, current, junction = [(ey, ex)], None, (ey, ex), False
            while len(path) <= max_len:
                nxt = [(current[0] + dy, current[1] + dx) for dy, dx in steps
                       if 0 <= current[0] + dy < skeleton.shape[0] and 0 <= current[1] + dx < skeleton.shape[1]
                       and skeleton[current[0] + dy, current[1] + dx] and (current[0] + dy, current[1] + dx) != previous
                       and (current[0] + dy, current[1] + dx) not in path[-3:]]
                if len(nxt) != 1 or count[nxt[0]] > 2:
                    # The next pixel joins other strokes: the wall.
                    junction = len(nxt) > 1 or (len(nxt) == 1 and count[nxt[0]] > 2)
                    break
                previous, current = current, nxt[0]
                path.append(current)
            chord = numpy.hypot(path[-1][0] - path[0][0], path[-1][1] - path[0][1])
            if not junction or len(path) < min_len or len(path) > trace.get('spurBend', 1.35) * chord + 5:
                continue
            for py, px in path[:-trace.get('spurKeepPx', 6)]:
                found[wy0 + py, wx0 + px] = True
    # The stroke's full width, not just its centre line.
    return cv2.dilate(found.astype(numpy.uint8), cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (9, 9))) > 0


def join_short_paths(paths, min_px, near_ends=False):
    """Short junction-to-junction pieces joined to a neighbour sharing an
    end, so a minimum length only drops free spurs. With near_ends
    ("joinNearEnds"), ends one pixel apart count as shared too - a junction
    drawn as a cluster of node pixels - which keeps more short spurs."""
    def near(a, b):
        if not near_ends:
            return a == b
        return abs(int(a[0]) - int(b[0])) <= 1 and abs(int(a[1]) - int(b[1])) <= 1

    changed = True
    while changed:
        changed = False
        for i, p in enumerate(paths):
            if len(p) >= min_px:
                continue
            for j, q in enumerate(paths):
                if i == j:
                    continue
                if near(p[-1], q[0]):
                    joined = p + q[(1 if p[-1] == q[0] else 0):]
                elif near(p[0], q[-1]):
                    joined = q + p[(1 if p[0] == q[-1] else 0):]
                elif near(p[0], q[0]):
                    joined = p[::-1] + q[(1 if p[0] == q[0] else 0):]
                elif near(p[-1], q[-1]):
                    joined = q + p[::-1][(1 if p[-1] == q[-1] else 0):]
                else:
                    continue
                paths[j] = joined
                paths.pop(i)
                changed = True
                break
            if changed:
                break
    return paths


def survey_line_paths(image_path, boxes, trace, ink=None, pool_points=()):
    """Survey line plots (config "trace": {"method": "survey-lines"}): the
    lines of the survey colour (blue on a Google Earth screenshot), thinned
    to one pixel and traced into paths - centrelines, not walls."""
    rgb = numpy.asarray(Image.open(image_path).convert('RGB')).astype(int)
    r, g, b = rgb[..., 0], rgb[..., 1], rgb[..., 2]
    # "lineColours": the survey colours to take (blue by default; red for a
    # second region drawn in red).
    excess = trace.get('minBlueExcess', 30)
    tests = {'blue': b - numpy.maximum(r, g), 'red': r - numpy.maximum(g, b), 'green': g - numpy.maximum(r, b),
             'yellow': numpy.minimum(r, g) - b,
             'cyan': numpy.minimum(g, b) - r}
    lines = numpy.zeros(b.shape, bool)
    for colour in trace.get('lineColours', ['blue']):
        lines |= ink if colour == 'black' else tests[colour] >= excess
    lines &= ~boxes
    for line in trace.get('eraseLines', []):
        stroke = numpy.zeros(lines.shape, numpy.uint8)
        cv2.line(stroke, tuple(line['from']), tuple(line['to']), 1, line.get('widthPx', 15))
        lines &= ~(stroke > 0)
    # "addLines": [{"from": [x, y], "to": [x, y]}] - line pieces drawn in
    # another colour (a short blue stretch of a red guideline), added by hand.
    for piece in trace.get('addLines', []):
        stroke = numpy.zeros(lines.shape, numpy.uint8)
        cv2.line(stroke, tuple(piece['from']), tuple(piece['to']), 1, piece.get('widthPx', 5))
        lines |= stroke > 0
    # Thin lines on a compressed screenshot break up: bridge small gaps first.
    gap = trace.get('bridgePx', 3)
    lines = cv2.morphologyEx(lines.astype(numpy.uint8), cv2.MORPH_CLOSE, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (gap, gap))) > 0
    # "poolInsides": {"maxHolePx", "reachPx", "closePx"} - the drawings
    # inside a cenote pool's outline (hatching, rubble, water) aren't survey:
    # the holes of closed outlines at the entrances (and "poolPoints"),
    # joined over those drawings by a closing, are emptied.
    if trace.get('poolInsides'):
        rule = trace['poolInsides']
        holes, count = ndimage.label(ndimage.binary_fill_holes(lines) & ~lines)
        sizes = ndimage.sum(numpy.ones_like(holes), holes, numpy.arange(1, count + 1))
        near = numpy.zeros(lines.shape, numpy.uint8)
        for x, y in list(pool_points) + trace.get('poolPoints', []):
            cv2.circle(near, (int(x), int(y)), rule.get('reachPx', 40), 1, -1)
        ids = numpy.unique(holes[(near > 0) & (holes > 0)])
        pools = numpy.isin(holes, [i for i in ids if sizes[i - 1] <= rule.get('maxHolePx', 30000)])
        k = rule.get('closePx', 25)
        inside = cv2.morphologyEx(pools.astype(numpy.uint8), cv2.MORPH_CLOSE, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (k, k))) > 0
        lines &= ~ndimage.binary_fill_holes(inside)
    paths = trace_skeleton(skeletonize(lines))
    return join_short_paths(paths, trace['joinShortPx'], trace.get('joinNearEnds')) if trace.get('joinShortPx') else paths


def thin_walls(config_path, config, out, name):
    """Walls drawn as thin wiggly lines, the same weight as the guideline, the
    passages left white ("method": "thin-walls"; Hutcheson's Nohoch Nah
    Chich): ink minus labels, symbols and leaders; the straight lines
    (guideline, leaders, section brackets: straight pieces of at least
    straightMinPx after a Douglas-Peucker simplification - a scanned wall
    wiggles every few px) erased; the long shapes kept as walls, with the small
    closed outlines and solid blobs near them (pillars, boulders)."""
    trace = config.get('trace', {})
    grey = numpy.asarray(Image.open(config_path.parent.joinpath(config['image']).resolve()).convert('L'))
    ink = grey < trace.get('inkLevel', 160)
    h, w = ink.shape
    masked = numpy.zeros_like(ink)
    for item in config.get('exclude', []):
        x0, y0, x1, y1 = item['box']; masked[max(0, y0):y1, max(0, x0):x1] = True
    words = ocr_words(Image.fromarray(grey), out / f'{name}-ocr-words.json', config)
    letters = lambda wd: sum(c.isalpha() for c in wd['t'])  # noqa: E731
    # OCR also "reads" wall wiggles as words ("Ny", "NES", "HOTS"): only letter words of a label's height, read confidently.
    label_words = [wd for wd in words if (letters(wd) >= 3 and letters(wd) >= 0.8 * len(wd['t']) and wd['conf'] >= trace.get('labelConf', 60) and wd['box'][3] - wd['box'][1] <= trace.get('labelMaxHeightPx', 30))
                   or (re.fullmatch(r'[Cc]?ent[.,]?', wd['t']) and wd['box'][3] - wd['box'][1] <= 35)]
    # Labels OCR misses or reads too poorly to trust ("labelBoxes": [[x0, y0, x1, y1], ...]).
    label_words += [{'t': '', 'box': b, 'conf': 100} for b in trace.get('labelBoxes', [])]
    # A label's ink only - the pieces lying inside its box (its letters), not
    # a wall that runs through it.
    pieces, _ = ndimage.label(ink & ~masked, structure=numpy.ones((3, 3)))
    spans = ndimage.find_objects(pieces)
    for wd in label_words:
        x0, y0, x1, y1 = wd['box']
        x0, y0, x1, y1 = max(0, x0 - 4), max(0, y0 - 4), x1 + 4, y1 + 4
        window = pieces[y0:y1, x0:x1]
        for i in numpy.unique(window[window > 0]):
            sl = spans[i - 1]
            if sl[0].start >= y0 and sl[0].stop <= y1 and sl[1].start >= x0 and sl[1].stop <= x1:
                masked[sl] |= pieces[sl] == i
    symbol_ink = numpy.zeros_like(ink)
    for x0, y0, x1, y1 in symbol_boxes(out / f'{name}-symbols-px.json', config):
        symbol_ink[max(0, y0 - 3):y1 + 3, max(0, x0 - 3):x1 + 3] = True
    drawn = ink & ~masked & ~symbol_ink
    anchors = real_labels(words) + [{'box': item['box'], 'reach': trace.get('sectionReachPx', 120)} for item in config.get('exclude', []) if re.search(r'profile|section', item.get('why', ''), re.I)]
    leaders = leader_lines(drawn, anchors, h, w, trace)
    for line in trace.get('eraseLines', []):
        stroke = numpy.zeros(ink.shape, numpy.uint8)
        cv2.line(stroke, tuple(line['from']), tuple(line['to']), 1, line.get('widthPx', 9)); leaders |= stroke > 0
    drawn &= ~leaders
    # 2. straight lines
    straight = numpy.zeros(ink.shape, numpy.uint8)
    straight_pieces = []
    eps, min_len = trace.get('straightEps', 1.3), trace.get('straightMinPx', 20)
    for path in trace_skeleton(skeletonize(drawn)):
        if len(path) < min_len: continue
        pts = numpy.array([(x, y) for y, x in path], numpy.int32).reshape(-1, 1, 2)
        approx = cv2.approxPolyDP(pts, eps, False).reshape(-1, 2)
        for a, b in zip(approx[:-1], approx[1:]):
            if numpy.hypot(*(b - a)) >= min_len:
                cv2.line(straight, tuple(int(v) for v in a), tuple(int(v) for v in b), 1, trace.get('straightWidthPx', 4))
                straight_pieces.append((tuple(int(v) for v in a), tuple(int(v) for v in b)))
    walls = drawn & ~(straight > 0)
    # 3. long shapes and islands
    # The scan breaks thin lines here and there: pieces "bridgePx" apart count as one shape.
    k = trace.get('bridgePx', 3)
    lab, n = ndimage.label(cv2.dilate(walls.astype(numpy.uint8), numpy.ones((k, k), numpy.uint8)) > 0, structure=numpy.ones((3, 3)))
    lab[~walls] = 0
    objs = ndimage.find_objects(lab)
    min_ext, min_isl = trace.get('minExtentPx', 60), trace.get('minIslandPx', 8)
    long_ids, small = [], []
    for i, sl in enumerate(objs):
        ext = max(sl[0].stop - sl[0].start, sl[1].stop - sl[1].start)
        if ext >= min_ext: long_ids.append(i + 1)
        elif ext >= min_isl:
            m = lab[sl] == i + 1
            if not m.any(): continue
            # A hollow outline (pillar, island) or a solid blob (a boulder or
            # dark rock drawn filled: kept as its outline, below).
            if ndimage.binary_fill_holes(m).sum() >= 1.4 * m.sum() or (cv2.distanceTransform(numpy.pad(m, 1).astype(numpy.uint8), cv2.DIST_L2, 3).max() >= trace.get('solidHalfPx', 2.5) and m.mean() >= 0.35):
                # (a section bracket is bold too, but a thin L in its box)
                small.append(i + 1)
    longs = numpy.isin(lab, long_ids)
    near = cv2.distanceTransform((~longs).astype(numpy.uint8), cv2.DIST_L2, 5) <= trace.get('islandReachPx', 30)
    isl_ok = [i for i in small if near[objs[i - 1]][lab[objs[i - 1]] == i].any()]
    islands = numpy.isin(lab, isl_ok)
    # Solid blobs (filled boulders, dark rock) traced along their outline, not their centre.
    islands &= ~(cv2.erode(islands.astype(numpy.uint8), numpy.ones((5, 5), numpy.uint8)) > 0)
    strokes = longs | islands
    # "outlineAreas": [{"box": [x0, y0, x1, y1]}] - narrow passages whose two
    # walls touch at the scan's resolution: their centrelines would tangle
    # into beads, so there the walls are the outer edge of the inked band.
    outline_bands = numpy.zeros(strokes.shape, numpy.uint8)
    for area in trace.get('outlineAreas', []):
        x0, y0, x1, y1 = area['box']
        window = (slice(y0, y1), slice(x0, x1))
        close = area.get('closePx', 9)
        band = cv2.morphologyEx((ink & ~masked)[window].astype(numpy.uint8), cv2.MORPH_CLOSE, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (close, close)))
        band = cv2.morphologyEx(band, cv2.MORPH_OPEN, numpy.ones((3, 3), numpy.uint8))
        outline_bands[window] = band
        strokes[window] = False
    # "wallLines": [[[x, y], ...]] - walls drawn by hand from the scan where
    # the ink breaks into pieces too short to keep (stipple, tick marks).
    for line in trace.get('wallLines', []):
        drawn_line = numpy.zeros(strokes.shape, numpy.uint8)
        cv2.polylines(drawn_line, [numpy.array(line, numpy.int32)], False, 1, 3)
        strokes |= drawn_line > 0
    # The scan's breaks in the thin lines (1-2 px) closed, so the lines run on.
    strokes = (cv2.morphologyEx(strokes.astype(numpy.uint8), cv2.MORPH_CLOSE, numpy.ones((k, k), numpy.uint8)) > 0) | strokes
    print(f'{len(long_ids)} wall shapes, {len(isl_ok)} islands kept of {len(small)} closed small shapes')
    # 4. lines
    to_lnglat = Transformer.from_crs(config['utmEpsg'], 4326, always_xy=True)
    place, scale, _ = raster_placement(config)
    skeleton = skeletonize(strokes)
    neighbours = ndimage.convolve(skeleton.astype(int), numpy.ones((3, 3), int), mode='constant') - skeleton
    review = numpy.full((h, w, 3), 255, numpy.uint8)
    review[masked] = (255, 236, 200)
    review[ink & ~strokes] = (170, 170, 255)
    review[ink & (straight > 0) & ~masked & ~symbol_ink] = (255, 120, 120)
    features = []
    for path in trace_skeleton(skeleton):
        line = LineString([(x, y) for y, x in path])
        free_end = any(neighbours[p] <= 1 for p in (path[0], path[-1]))
        if free_end and line.length < trace.get('minSpurPx', 10):
            continue
        if line.length < 2: continue
        line = smooth(line).simplify(trace.get('wallSimplifyMetres', 0.5) / scale)
        cv2.polylines(review, [numpy.array(line.coords, numpy.int32)], False, (0, 0, 0), 2)
        features.append({'type': 'Feature', 'properties': {'map': name, 'kind': 'wall', 'sistemaId': config.get('sistemaId'), 'credits': config.get('credits')},
                         'geometry': mapping(LineString([to_lnglat.transform(*place(x, y)) for x, y in line.coords]))})
    # "guideline": true - the straight runs erased above are the guideline:
    # kept as survey lines (joined where their ends meet), not walls.
    if trace.get('guideline'):
        from shapely.ops import linemerge
        pieces = [LineString([a, b]) for a, b in straight_pieces]
        # Gaps bridged: where the line ran close to a wall or bent, pieces are
        # missing - each loose end is joined to the nearest other piece within
        # "guidelineGapPx".
        from shapely.geometry import Point
        from shapely.strtree import STRtree
        gap = trace.get('guidelineGapPx', 40)
        ink_near = cv2.dilate((ink & ~masked).astype(numpy.uint8), numpy.ones((3, 3), numpy.uint8)) > 0
        merged = linemerge(pieces)
        lines = list(getattr(merged, 'geoms', [merged]))
        tree = STRtree(lines)
        bridges = []
        for i, line in enumerate(lines):
            for end in (Point(line.coords[0]), Point(line.coords[-1])):
                best = None
                for j in tree.query(end.buffer(gap)):
                    if j == i:
                        continue
                    d = lines[j].distance(end)
                    if d <= gap and (best is None or d < best[0]):
                        best = (d, j)
                if best and best[0] > 0:
                    target = lines[best[1]].interpolate(lines[best[1]].project(end))
                    bridge = LineString([end, target])
                    # Never through a wall: that's another passage.
                    crossing = [strokes[min(int(p.y), h - 1), min(int(p.x), w - 1)]
                                for p in (bridge.interpolate(d) for d in numpy.arange(3, bridge.length - 3, 1))]
                    # Only where the map's line actually goes on (ink along
                    # the bridge): two lines that don't touch are a jump.
                    samples = [bridge.interpolate(d) for d in numpy.arange(0, bridge.length, 1)]
                    on_ink = [ink_near[min(int(p.y), h - 1), min(int(p.x), w - 1)] for p in samples]
                    if not any(crossing) and on_ink and sum(on_ink) >= 0.8 * len(on_ink):
                        bridges.append(bridge)
        merged = linemerge(lines + bridges)
        # Inside the cave: the guideline runs between walls, a label's leader
        # out in the open.
        to_wall = cv2.distanceTransform((~strokes).astype(numpy.uint8), cv2.DIST_L2, 5)
        reach = trace.get('guidelineReachPx', 45)
        near_label = cv2.dilate(masked.astype(numpy.uint8), cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (31, 31))) > 0
        for line in getattr(merged, 'geoms', [merged]):
            if line.length * scale < trace.get('guidelineMinMetres', 10):
                continue
            samples = [line.interpolate(d) for d in numpy.arange(0, line.length, 3)]
            inside = [to_wall[min(int(p.y), h - 1), min(int(p.x), w - 1)] <= reach for p in samples]
            if sum(inside) < 0.85 * len(inside):
                continue
            # A leader ends at its label.
            if any(near_label[min(int(y), h - 1), min(int(x), w - 1)] for x, y in (line.coords[0], line.coords[-1])):
                continue
            cv2.polylines(review, [numpy.array(line.coords, numpy.int32)], False, (220, 160, 0), 2)
            features.append({'type': 'Feature', 'properties': {'map': name, 'kind': 'survey', 'sistemaId': config.get('sistemaId'), 'credits': config.get('credits')},
                             'geometry': mapping(LineString([to_lnglat.transform(*place(x, y)) for x, y in line.coords]))})
    contours, hierarchy = cv2.findContours(outline_bands, cv2.RETR_CCOMP, cv2.CHAIN_APPROX_NONE)
    for index, contour in enumerate(contours):
        if len(contour) < 4 or cv2.arcLength(contour, True) * scale < MIN_OUTLINE_METRES:
            continue
        points = [tuple(p) for p in contour[:, 0, :].astype(float)]
        line = smooth(LineString(points + points[:1])).simplify(trace.get('wallSimplifyMetres', 0.5) / scale)
        cv2.polylines(review, [numpy.array(line.coords, numpy.int32)], False, (0, 0, 200), 2)
        features.append({'type': 'Feature', 'properties': {'map': name, 'kind': 'wall', 'sistemaId': config.get('sistemaId'), 'credits': config.get('credits')},
                         'geometry': mapping(LineString([to_lnglat.transform(*place(x, y)) for x, y in line.coords]))})
    Image.fromarray(review).save(out / f'{name}-walls-review.png')
    geojson = out / f'{name}-walls.geojson'
    geojson.write_text(json.dumps(rounded({'type': 'FeatureCollection', 'features': features}), separators=(',', ':')), encoding='utf-8')
    print(f'{len(features)} wall lines -> {geojson} ({geojson.stat().st_size // 1024} KB); scale {scale:.4f} m/px')


def compass_fill(config_path, config, out, name):
    """Compass exports ("method": "compass-fill"): passages are a flat cyan
    fill computed from the survey's left/right widths, with no wall ink. The
    walls are the pure fill's own outlines (no blur, no growth; the slit the
    survey line cuts closed, the survey line's thin cyan edging opened away),
    and the survey lines running outside any fill (passages surveyed without
    widths) are kept as survey lines."""
    trace = config.get('trace', {})
    image_path = config_path.parent.joinpath(config['image']).resolve()
    rgb = numpy.asarray(Image.open(image_path).convert('RGB')).astype(int)
    r, g, b = rgb[..., 0], rgb[..., 1], rgb[..., 2]

    # 1. Fill: pure cyan; the slit the survey line cuts through it closed.
    fill = (r < 120) & (g > 215) & (b > 215)
    close = trace.get('fillClosePx', 5)
    fill = cv2.morphologyEx(fill.astype(numpy.uint8), cv2.MORPH_CLOSE, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (close, close)))
    # The thin cyan edging Compass gives every survey line (1-2 px, no real width)
    # is not passage: an opening drops fills narrower than ~minFillPx.
    k = trace.get('minFillPx', 5)
    fill = cv2.morphologyEx(fill, cv2.MORPH_OPEN, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (k, k))) > 0
    # Walls: the fill's own outlines (no wall ink to reach: colour_fill_band's
    # blur and 2 px growth would widen every passage).
    place, scale, _ = raster_placement(config)
    to_lnglat = Transformer.from_crs(config['utmEpsg'], 4326, always_xy=True)
    band = fill.astype(numpy.uint8) * 255
    for item in config.get('exclude', []):
        x0, y0, x1, y1 = item['box']
        band[y0:y1, x0:x1] = 0
    contours, hierarchy = cv2.findContours(band, cv2.RETR_CCOMP, cv2.CHAIN_APPROX_NONE)
    review = numpy.full(rgb.shape, 255, numpy.uint8)
    review[band > 0] = (200, 225, 255)
    wall_features = []
    for index, contour in enumerate(contours):
        hole = hierarchy[0][index][3] != -1
        area = abs(cv2.contourArea(contour)) * scale ** 2
        if len(contour) < 4 or area < (trace.get('minHoleSqMetres', 4) if hole else trace.get('minBandSqMetres', 4)):
            continue
        pts = [tuple(p) for p in contour[:, 0, :].astype(float)]
        ls = smooth(LineString(pts + pts[:1])).simplify(trace.get('wallSimplifyMetres', 0.3) / scale)
        cv2.polylines(review, [numpy.array(ls.coords, numpy.int32)], False, (0, 0, 0), 2)
        wall_features.append({'type': 'Feature', 'properties': {'map': name, 'kind': 'wall', 'sistemaId': config.get('sistemaId'), 'credits': config.get('credits')},
                              'geometry': mapping(LineString([to_lnglat.transform(*place(x, y)) for x, y in ls.coords]))})
    walls = rounded({'type': 'FeatureCollection', 'features': wall_features})

    # 2. Survey lines: dark teal (green = blue > red), plus the black core pixels
    # touching it; away from the fill.
    teal = ((g - r) >= 12) & (numpy.abs(g - b) < 12) & (g < 200)
    dark = rgb.sum(-1) < 250
    line = teal.copy()
    for _ in range(4):
        line |= dark & (cv2.dilate(line.astype(numpy.uint8), numpy.ones((3, 3), numpy.uint8)) > 0)
    for item in config.get('exclude', []):
        x0, y0, x1, y1 = item['box']
        line[y0:y1, x0:x1] = False
    lab, n = ndimage.label(line, structure=numpy.ones((3, 3)))
    size = ndimage.sum(line, lab, range(1, n + 1))
    line = numpy.isin(lab, [i + 1 for i, s in enumerate(size) if s >= 20])
    if trace.get('stickMap'):
        # Where the line fades into the fill's edge (grey, or teal paler than
        # the core) the trace broke: any ink near the line, pure fill and
        # paper aside, carries it on - a gap only where the map draws none.
        reach_px = trace.get('lineReachPx', 4)
        faint = (numpy.minimum(g, b) < 215) & ~((r < 60) & (g > 235) & (b > 235))
        for _ in range(reach_px):
            line |= faint & (cv2.dilate(line.astype(numpy.uint8), numpy.ones((3, 3), numpy.uint8)) > 0)
    reach = trace.get('surveyOffFillPx', 2)
    near_fill = cv2.dilate(fill.astype(numpy.uint8), cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (2 * reach + 1,) * 2)) > 0
    # "stickMap": true - a stick map: the survey lines are the whole drawing,
    # the fill is only their decoration; no walls, the lines kept throughout.
    if trace.get('stickMap'):
        near_fill[:] = False
        walls['features'] = []
    features = []
    min_m = trace.get('surveyMinMetres', 3)
    for path in trace_skeleton(skeletonize(line)):
        run = []
        runs = []
        for y, x in path:
            if near_fill[y, x]:
                if len(run) >= 2:
                    runs.append(run)
                run = []
            else:
                run.append((x, y))
        if len(run) >= 2:
            runs.append(run)
        for pts in runs:
            ls = LineString(pts)
            if ls.length * scale < min_m:
                continue
            ls = ls.simplify(max(0.5, scale / 2) / scale)
            features.append({'type': 'Feature', 'properties': {'map': name, 'kind': 'survey', 'sistemaId': config.get('sistemaId'), 'credits': config.get('credits')},
                             'geometry': mapping(LineString([to_lnglat.transform(*place(x, y)) for x, y in ls.coords]))})
    walls['features'] += rounded({'type': 'FeatureCollection', 'features': features})['features']
    out.mkdir(parents=True, exist_ok=True)
    (out / f'{name}-walls.geojson').write_text(json.dumps(walls, separators=(',', ':')), encoding='utf-8')
    review[line & ~near_fill] = (220, 0, 0)
    Image.fromarray(review).save(out / f'{name}-walls-review.png')
    print(f'{len(walls["features"]) - len(features)} wall/detail features + {len(features)} survey lines -> {out / (name + "-walls.geojson")}')


def main(config_path, output):
    config_path = Path(config_path)
    config = json.loads(config_path.read_text(encoding='utf-8'))
    name = config_path.stem
    out = Path(output)
    out.mkdir(parents=True, exist_ok=True)

    if config.get('trace', {}).get('method') == 'compass-fill':
        return compass_fill(config_path, config, out, name)
    if config.get('trace', {}).get('method') == 'thin-walls':
        return thin_walls(config_path, config, out, name)
    grey = Image.open(config_path.parent.joinpath(config['image']).resolve()).convert('L')
    # "inkLevel": ink is darker than this (a map on a dark background).
    ink = numpy.asarray(grey) < config.get('trace', {}).get('inkLevel', INK_LEVEL)
    height, width = ink.shape

    masked = numpy.zeros_like(ink)
    for item in config.get('exclude', []):
        x0, y0, x1, y1 = item['box']
        masked[max(0, y0):y1, max(0, x0):x1] = True
    # Areas excluded by colour (config "trace": {"excludeColours": [{"hue":
    # [h0, h1], "minSaturation": s}]}): e.g. cross-sections drawn on orange
    # brick - each patch of that colour, grown, and its bounding box.
    for colour in config.get('trace', {}).get('excludeColours', []):
        hsv = numpy.asarray(Image.open(config_path.parent.joinpath(config['image']).resolve()).convert('HSV')).astype(int)
        h0, h1 = colour['hue']
        patch = ((hsv[..., 0] >= h0) & (hsv[..., 0] <= h1) & (hsv[..., 1] >= colour.get('minSaturation', 120))).astype(numpy.uint8)
        if not colour.get('keepHoles'):
            patch = cv2.morphologyEx(patch, cv2.MORPH_CLOSE, cv2.getStructuringElement(cv2.MORPH_RECT, (25, 25)))
        pad = colour.get('padPx', 30)
        min_size = colour.get('minSizePx', 40)
        # "minFill": the share of its box a patch must cover, with what it
        # encloses - a brick section is a filled rectangle (its cave drawn
        # inside the brick), sand or pebbles of the colour aren't.
        min_fill = colour.get('minFill', 0)
        patches = ndimage.label(patch)[0]
        for i, sl in enumerate(ndimage.find_objects(patches)):
            if max(sl[0].stop - sl[0].start, sl[1].stop - sl[1].start) >= min_size and ndimage.binary_fill_holes(patches[sl] == i + 1).mean() >= min_fill:
                # Its own shape, not its box: trees drawn on a section (brown
                # trunks) would stretch a box over the passages beside them.
                # Closed first, so a cenote's shaft open to the top is in too.
                y0, x0 = max(0, sl[0].start - pad - 20), max(0, sl[1].start - pad - 20)
                window = (slice(y0, sl[0].stop + pad + 20), slice(x0, sl[1].stop + pad + 20))
                body = (patches[window] == i + 1).astype(numpy.uint8)
                # "keepHoles": what the colour surrounds stays (passages
                # running out into a drawn sea).
                if not colour.get('keepHoles'):
                    body = cv2.morphologyEx(body, cv2.MORPH_CLOSE, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (41, 41)))
                    body = ndimage.binary_fill_holes(body).astype(numpy.uint8)
                masked[window] |= cv2.dilate(body, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (2 * pad + 1, 2 * pad + 1))) > 0
    colour_masked = masked.copy()
    words = ocr_words(grey, out / f'{name}-ocr-words.json', config)
    labels_only = real_labels(words)
    for word in labels_only:
        x0, y0, x1, y1 = word['box']
        masked[max(0, y0 - WORD_PAD):y1 + WORD_PAD, max(0, x0 - WORD_PAD):x1 + WORD_PAD] = True

    trace = config.get('trace', {})
    # Symbols extract_symbols.py turned into typed points (depths, ceiling
    # heights, codes): not drawn too. Run it before this script.
    symbol_ink = numpy.zeros_like(ink)
    symbols_px = out / f'{name}-symbols-px.json'
    if symbols_px.exists():
        for x0, y0, x1, y1 in symbol_boxes(symbols_px, config):
            pad = trace.get('symbolPadPx', 3)  # enough to take a number's ring
            symbol_ink[max(0, y0 - pad):y1 + pad, max(0, x0 - pad):x1 + pad] = True
        # "symbolPiecesOnly": a symbol's box takes only the ink pieces lying
        # wholly inside it (its digits, bar, ring), not a wall running by.
        if trace.get('symbolPiecesOnly'):
            pieces, _ = ndimage.label(ink, structure=numpy.ones((3, 3)))
            spans = ndimage.find_objects(pieces)
            boxes_only = symbol_ink
            symbol_ink = numpy.zeros_like(ink)
            for i in numpy.unique(pieces[boxes_only & ink]):
                if i and boxes_only[spans[i - 1]][pieces[spans[i - 1]] == i].all():
                    symbol_ink[spans[i - 1]] |= pieces[spans[i - 1]] == i
    # Leader lines (a label's line to what it names - "Entrada" to its
    # entrance): thin strokes standing alone, one end by a label. Entrances
    # get their own pins, so the lines go.
    # Cross-sections and profiles have leaders too, to their place in the cave.
    # Their leaders start a little away from the drawing: a longer reach.
    anchors = labels_only + [{'box': item['box'], 'reach': trace.get('sectionReachPx', 120)} for item in config.get('exclude', [])
                             if re.search(r'profile|section', item.get('why', ''), re.I)]
    leaders = leader_lines(ink & ~masked, anchors, height, width, trace)
    if trace.get('method') == 'wall-strokes':
        # A leader drawn up to a wall is one shape with it: looked for again in
        # the thin ink alone, the bold wall strokes taken out.
        r = trace.get('openRadiusPx', 3)
        bold = cv2.morphologyEx((ink & ~masked).astype(numpy.uint8), cv2.MORPH_OPEN, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (2 * r + 1, 2 * r + 1))) > 0
        bold = cv2.dilate(bold.astype(numpy.uint8), numpy.ones((3, 3), numpy.uint8)) > 0
        leaders |= leader_lines(ink & ~masked & ~bold, anchors, height, width, trace)
    if trace.get('boxSpurs'):
        section_boxes = [item['box'] for item in config.get('exclude', []) if re.search(r'profile|section', item.get('why', ''), re.I)]
        # And, with "boxSpurs": "labels", the name labels' leaders too.
        if trace['boxSpurs'] == 'labels':
            section_boxes += [word['box'] for word in labels_only]
        leaders |= box_spurs(ink & ~masked, section_boxes, trace)
    # Lines erased by hand ("eraseLines": [{"from": [x, y], "to": [x, y],
    # "widthPx": w}]): drawn features that aren't cave - a road, a path.
    for line in trace.get('eraseLines', []):
        stroke = numpy.zeros(ink.shape, numpy.uint8)
        cv2.line(stroke, tuple(line['from']), tuple(line['to']), 1, line.get('widthPx', 15))
        leaders |= stroke > 0
    near_anchor = numpy.zeros_like(ink)
    reach = trace.get('leaderReachPx', 60)
    for anchor in anchors:
        x0, y0, x1, y1 = anchor['box']
        r = anchor.get('reach', reach)
        near_anchor[max(0, y0 - r):y1 + r, max(0, x0 - r):x1 + r] = True
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
        # Black survey lines (a b/w line plot) share the ink with the labels
        # and leaders: those are taken out too.
        if 'black' in trace.get('lineColours', []):
            boxes |= masked | leaders
        paths = survey_line_paths(config_path.parent.joinpath(config['image']).resolve(), boxes, trace,
                                  ink=ink, pool_points=[e['px'] for e in config.get('entrances', []) if 'px' in e])
        lines = [LineString([(x, y) for y, x in path]) for path in paths if len(path) >= 2]
        # "snapEndsPx": a line end within this of another line (a junction
        # piece too short to keep, at a coarse scale) is carried onto it.
        if trace.get('snapEndsPx'):
            lines = [line for line in lines if line.length * scale >= MIN_OUTLINE_METRES]
            from shapely.geometry import Point
            from shapely.ops import nearest_points
            snapped = []
            for i, line in enumerate(lines):
                coords = list(line.coords)
                for end in (0, -1):
                    p = Point(coords[end])
                    best = min(((other.distance(p), j) for j, other in enumerate(lines) if j != i), default=(1e9, -1))
                    if 0.3 < best[0] <= trace['snapEndsPx']:
                        q = nearest_points(lines[best[1]], p)[0]
                        coords.insert(0, (q.x, q.y)) if end == 0 else coords.append((q.x, q.y))
                snapped.append(LineString(coords))
            lines = snapped
        for line in lines:
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
        strokes = (strong | numpy.isin(weak_labels, touching[touching > 0]) | long_parts(weak, 2 * min_extent)) & ~symbol_ink
        # "detailLines": [{"from", "to", "widthPx"}] - bold strokes that aren't
        # walls (a ticked cave-limit line at an entrance): drawn as detail.
        for line in trace.get('detailLines', []):
            band = numpy.zeros(strokes.shape, numpy.uint8)
            cv2.line(band, tuple(line['from']), tuple(line['to']), 1, line.get('widthPx', 15))
            strokes &= band == 0
        # "greyWalls": [lo, hi] - walls drawn as a thin neutral-grey line
        # (an underwater or underlying cave's outline): long lines of that
        # tone count too.
        if trace.get('greyWalls'):
            lo, hi = trace['greyWalls']
            rgb = numpy.asarray(Image.open(config_path.parent.joinpath(config['image']).resolve()).convert('RGB')).astype(int)
            neutral = (rgb.max(axis=2) - rgb.min(axis=2)) <= 30
            tone = rgb.mean(axis=2)
            grey_line = ((tone >= lo) & (tone <= hi) & neutral & ~masked).astype(numpy.uint8)
            # "greyWallsBoxes": [[x0, y0, x1, y1], ...] - only there, when the
            # tone also edges every black wall elsewhere.
            if trace.get('greyWallsBoxes'):
                inside = numpy.zeros_like(grey_line)
                for x0, y0, x1, y1 in trace['greyWallsBoxes']:
                    inside[y0:y1, x0:x1] = 1
                grey_line &= inside
            # Lines only: grey areas (boulder and pillar fills) taken out.
            grey_line &= ~(cv2.dilate(cv2.morphologyEx(grey_line, cv2.MORPH_OPEN, numpy.ones((5, 5), numpy.uint8)), numpy.ones((5, 5), numpy.uint8)) > 0)
            grey_line = cv2.morphologyEx(grey_line, cv2.MORPH_CLOSE, numpy.ones((3, 3), numpy.uint8))
            strokes |= long_parts(grey_line, trace.get('greyMinExtentPx', 2 * min_extent)) & ~symbol_ink
        to_lnglat = Transformer.from_crs(config['utmEpsg'], 4326, always_xy=True)
        place, scale, _ = raster_placement(config)
        features = []
        review = numpy.full((height, width, 3), 255, numpy.uint8)
        review[masked] = (255, 236, 200)
        review[ink & ~strokes] = (200, 200, 255)
        # "fillStrokeHolesPx": pin-holes in ragged scanned strokes would each
        # become a tiny skeleton loop: closed, and holes smaller than this
        # filled (a pillar's ring encloses far more).
        if trace.get('fillStrokeHolesPx'):
            strokes = cv2.morphologyEx(strokes.astype(numpy.uint8), cv2.MORPH_CLOSE, numpy.ones((3, 3), numpy.uint8)) > 0
            holes, count = ndimage.label(ndimage.binary_fill_holes(strokes) & ~strokes)
            if count:
                sizes = ndimage.sum(numpy.ones_like(holes), holes, numpy.arange(1, count + 1))
                strokes |= numpy.isin(holes, 1 + numpy.flatnonzero(sizes < trace['fillStrokeHolesPx']))
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
            # A leader joined to the wall it points at: a nearly straight
            # branch whose free end is at a label or a cross-section.
            if free_end and line.length > 0 and any(near_anchor[p] for p in (path[0], path[-1]) if neighbours[p] <= 1)                     and LineString([line.coords[0], line.coords[-1]]).length / line.length >= 0.9:
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
            # Kept off the walls: the contrast test also sees each wall
            # stroke's soft edge, which would come out as slivers along it.
            margin = 2 * (radius + trace.get('wallMarginPx', 3)) + 1
            off_walls = ~(cv2.dilate(strokes.astype(numpy.uint8), cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (margin, margin))) > 0)
            features += detail_features(contrast_ink(numpy.asarray(grey), trace) & ~masked & off_walls & ~grown_leaders & ~symbol_ink, grey_fill_mask(numpy.asarray(grey), boxes, trace) if trace.get('water', True) else None, place, to_lnglat, scale, trace,
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
        # "inside": true on an exclude box - a label or arrow drawn on the
        # passage: its ink is left out, but the passage runs on under it.
        for item in config.get('exclude', []):
            if item.get('inside'):
                continue
            x0, y0, x1, y1 = item['box']
            boxes[max(0, y0):y1, max(0, x0):x1] = True
        boxes |= colour_masked
        for item in config.get('exclude', []):
            if item.get('inside'):
                x0, y0, x1, y1 = item['box']
                boxes[max(0, y0):y1, max(0, x0):x1] = False
        band = colour_fill_band(config_path.parent.joinpath(config['image']).resolve(), boxes, trace)
        if trace.get('paperIslands'):
            band = carve_paper_islands(band, config_path.parent.joinpath(config['image']).resolve(), boxes, trace['paperIslands'])
        for item in config.get('exclude', []):
            if item.get('inside'):
                x0, y0, x1, y1 = item['box']
                window = band[max(0, y0):y1, max(0, x0):x1]
                # Filled where the passage around the box is.
                ring = band[max(0, y0 - 6):y1 + 6, max(0, x0 - 6):x1 + 6]
                if ring.mean() > 0.4 * 255:
                    window[:] = 255
    else:
        candidate = ink & ~masked
        labels, count = ndimage.label(candidate, structure=numpy.ones((3, 3)))
        extents = [max(s[0].stop - s[0].start, s[1].stop - s[1].start) for s in ndimage.find_objects(labels)]
        walls = numpy.isin(labels, [i + 1 for i, extent in enumerate(extents) if extent >= MIN_WALL_EXTENT_PX])
        band = cv2.morphologyEx(walls.astype(numpy.uint8) * 255, cv2.MORPH_CLOSE, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (CLOSE_PX, CLOSE_PX)))
        band = cv2.morphologyEx(band, cv2.MORPH_OPEN, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (OPEN_PX, OPEN_PX)))
    place, scale, _ = raster_placement(config)
    # Small pieces far from any passage ("dropIsolated": {"maxSqMetres",
    # "gapMetres"}): leftovers of survey lines, labels or symbols. A passage
    # end cut off at a narrow neck stays: it's next to its passage.
    if trace.get('dropIsolated'):
        rule = trace['dropIsolated']
        pieces, count = ndimage.label(band > 0, structure=numpy.ones((3, 3)))
        areas = ndimage.sum(numpy.ones_like(pieces), pieces, numpy.arange(1, count + 1)) * scale ** 2
        small = numpy.isin(pieces, [i + 1 for i, a in enumerate(areas) if a < rule.get('maxSqMetres', 100)])
        gap = cv2.distanceTransform(((band > 0) & ~small).astype(numpy.uint8) ^ 1, cv2.DIST_L2, 5) * scale
        near = numpy.unique(pieces[small & (gap <= rule.get('gapMetres', 20))])
        band[small & ~numpy.isin(pieces, near)] = 0
    contours, hierarchy = cv2.findContours(band, cv2.RETR_CCOMP, cv2.CHAIN_APPROX_NONE)

    to_utm = Transformer.from_crs(4326, config['utmEpsg'], always_xy=True)
    to_lnglat = Transformer.from_crs(config['utmEpsg'], 4326, always_xy=True)
    place, scale, _ = raster_placement(config)

    review = numpy.full((height, width, 3), 255, numpy.uint8)
    review[masked] = (255, 236, 200)
    review[band > 0] = (200, 225, 255)
    features = []
    wall_ink = None
    if trace.get('wallCentres'):
        # Walls drawn as bold strokes, as heavy as the boulders beside them
        # ("wallCentres": true): the band's outlines run along both edges of
        # each wall stroke, so they'd be double. The ink along the outlines is
        # the wall stroke; its centreline is the wall, its short free spurs
        # (slope hatching ticks) dropped.
        edge = numpy.zeros((height, width), numpy.uint8)
        for index, contour in enumerate(contours):
            hole = hierarchy[0][index][3] != -1
            area = abs(cv2.contourArea(contour)) * scale ** 2
            if len(contour) >= 4 and cv2.arcLength(contour, True) * scale >= MIN_OUTLINE_METRES and area >= (trace.get('minHoleSqMetres', MIN_HOLE_SQ_METRES) if hole else trace.get('minBandSqMetres', MIN_BAND_SQ_METRES)):
                cv2.drawContours(edge, [contour], -1, 1, trace.get('strokePx', 7))
        wall_ink = ink & (edge > 0) & ~masked & ~symbol_ink
        # Plus the long bold strokes the band missed ("wallOpenPx": the radius
        # an opening keeps walls but not boulder outlines).
        if trace.get('wallOpenPx'):
            r = trace['wallOpenPx']
            bold = cv2.morphologyEx((ink & ~masked).astype(numpy.uint8), cv2.MORPH_OPEN, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (2 * r + 1, 2 * r + 1)))
            parts, _ = ndimage.label(bold, structure=numpy.ones((3, 3)))
            long_ids = [i + 1 for i, sl in enumerate(ndimage.find_objects(parts)) if max(sl[0].stop - sl[0].start, sl[1].stop - sl[1].start) >= trace.get('wallMinExtentPx', 200)]
            # Grown back to the stroke's full width, within the ink.
            wall_ink |= (cv2.dilate(numpy.isin(parts, long_ids).astype(numpy.uint8), cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (2 * r + 3, 2 * r + 3))) > 0) & ink & ~symbol_ink
        wall_ink = cv2.morphologyEx(wall_ink.astype(numpy.uint8), cv2.MORPH_CLOSE, numpy.ones((3, 3), numpy.uint8)) > 0
        # "wallLines": walls drawn by hand where the scan breaks them.
        for line in trace.get('wallLines', []):
            drawn_line = numpy.zeros(wall_ink.shape, numpy.uint8)
            cv2.polylines(drawn_line, [numpy.array(line, numpy.int32)], False, 1, 3)
            wall_ink |= drawn_line > 0
        skeleton = skeletonize(wall_ink)
        neighbours = ndimage.convolve(skeleton.astype(int), numpy.ones((3, 3), int), mode='constant') - skeleton
        for path in trace_skeleton(skeleton):
            line = LineString([(x, y) for y, x in path])
            free_end = any(neighbours[q] <= 1 for q in (path[0], path[-1]))
            if line.length * scale < (trace.get('spurMetres', 2.5) if free_end else 0.3):
                continue
            line = smooth(line).simplify(trace.get('wallSimplifyMetres', SIMPLIFY_METRES) / scale)
            cv2.polylines(review, [numpy.array(line.coords, numpy.int32)], False, (0, 0, 0), 2)
            features.append({'type': 'Feature', 'properties': {'map': name, 'kind': 'wall', 'sistemaId': config.get('sistemaId'), 'credits': config.get('credits')},
                             'geometry': mapping(LineString([to_lnglat.transform(*place(x, y)) for x, y in line.coords]))})
        contours = []
    for index, contour in enumerate(contours):
        if len(contour) < 4:
            continue
        hole = hierarchy[0][index][3] != -1
        area = abs(cv2.contourArea(contour)) * scale ** 2
        # Colour fill: passage ends cut off at a narrow neck are small but real.
        min_band = trace.get('minBandSqMetres', MIN_BAND_SQ_METRES)
        if cv2.arcLength(contour, True) * scale < MIN_OUTLINE_METRES or area < (trace.get('minHoleSqMetres', MIN_HOLE_SQ_METRES) if hole else min_band):
            continue
        points = [tuple(p) for p in contour[:, 0, :].astype(float)]
        runs = [points + points[:1]]
        if trace.get('wallsOnInk'):
            # Only where the map draws a wall line: a cenote's open water
            # fading into the paper has no wall, and gets none.
            reach = trace.get('wallInkReachPx', 6)
            near_ink = wall_ink_near if 'wall_ink_near' in dir() else None
            if near_ink is None:
                wall_ink_near = cv2.dilate(ink.astype(numpy.uint8), cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (2 * reach + 1,) * 2)) > 0
                near_ink = wall_ink_near
            # Nor along an excluded area's edge: that's a cut, not a wall.
            near_mask = cv2.dilate(masked.astype(numpy.uint8), numpy.ones((9, 9), numpy.uint8)) > 0
            on = [bool(near_ink[int(y), int(x)]) and not near_mask[int(y), int(x)] for x, y in points]
            if not all(on):
                # Runs of on-ink points, starting after an off-ink point so a
                # run doesn't wrap around the start.
                start = on.index(False)
                order = points[start:] + points[:start]
                flags = on[start:] + on[:start]
                runs, current = [], []
                for p, f in zip(order, flags):
                    if f:
                        current.append(p)
                    elif current:
                        runs.append(current)
                        current = []
                if current:
                    runs.append(current)
                runs = [r for r in runs if len(r) * scale >= trace.get('minWallRunMetres', 1)]
        for run in runs:
            line = smooth(LineString(run)).simplify(trace.get('wallSimplifyMetres', SIMPLIFY_METRES) / scale)
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
        # Drawn outside the passages but part of the cave (a cenote's
        # breakdown pile beside its passage): config "detailAreas" boxes.
        for area in trace.get('detailAreas', []):
            x0, y0, x1, y1 = area['box']
            inside[max(0, y0):y1, max(0, x0):x1] = True
        dark = contrast_ink(numpy.asarray(grey), trace) & ~grown_leaders & ~symbol_ink
        if wall_ink is not None:
            # Every other ink near the walls is detail: on such maps the band
            # doesn't fill wide passages, so "inside" can't be trusted.
            near = cv2.distanceTransform((~wall_ink).astype(numpy.uint8), cv2.DIST_L2, 5) * scale <= trace.get('detailReachMetres', 25)
            inside = near & ~(cv2.dilate(wall_ink.astype(numpy.uint8), numpy.ones((5, 5), numpy.uint8)) > 0)
        # "water": false - the passages aren't filled, only their walls drawn.
        water = band > 0 if trace.get('method') == 'colour-fill' and trace.get('water', True) else None
        # "waterPolygons": [[[x, y], ...]] - the water fill only there (a
        # cenote's open water at its entrance), not in every passage.
        if water is not None and trace.get('waterPolygons'):
            area = numpy.zeros(water.shape, numpy.uint8)
            cv2.fillPoly(area, [numpy.array(polygon, numpy.int32) for polygon in trace['waterPolygons']], 1)
            water &= area > 0
        # "detailInk": false - a drawing with no symbols between its walls
        # (a vector map's flat fill): only the water is kept.
        if not trace.get('detailInk', True):
            dark = numpy.zeros_like(dark)
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

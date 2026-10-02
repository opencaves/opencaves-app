"""Builds the image traced for Sistema Joolis (maps/joolis.json), in the frame
of the 2004 scan (joolis-sist-tulum.webp; pixel coordinates unchanged,
canvas 1000 px taller). A map-specific preparation, like rectify_photo.py
for a photo:

1. The scan draws the Hoit line plot twice - at its true place, cut by the
   page bottom, and whole, moved up into the empty page area (by +767,
   -1748 px), the two copies joined by dash-dot curves with arrowheads. The
   moved copy is put back on its duplicate and the curves erased
   (-> joolis-hoit-placed.png).
2. The cave comes from the 2013 reprint (Joolis, Sist., Tulum (1).pdf, white
   on black: the same drawing, sharp), inverted and warped onto the scan
   (the config's "prep": {"reprintWarp": 2x3 affine, fitted by SIFT}); its
   thin straight strokes (section-mark shafts, survey legs, hatching) are
   erased. The line plots' boxes (trace.lineTrace.boxes) keep the scan's
   content, which the reprint drops (-> the config's "image").

Usage: python scripts/map-layer/prep/joolis.py
Needs opencv, numpy, Pillow, scipy, scikit-image, PyMuPDF.
"""
import io
import json
import sys
from pathlib import Path

import cv2
import numpy
from PIL import Image
from scipy import ndimage
from skimage.morphology import skeletonize

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from trace_scan import trace_skeleton  # noqa: E402

Image.MAX_IMAGE_PIXELS = None
CONFIG = Path(__file__).resolve().parents[1] / 'maps' / 'joolis.json'
SCAN = CONFIG.parents[3] / '_data/maps-import/images/joolis-sist-tulum.webp'
REPRINT = CONFIG.parents[3] / '_data/cartes/à traiter/Joolis, Sist., Tulum (1).pdf'

# The moved Hoit copy (true place + MOVE) and what to erase around it.
MOVE = (767, -1748)
MOVED = (2280, 2830, 3725, 4560)      # x0, y0, x1, y1 of the moved copy (with its label)
CURVES = (1990, 2830, 3725, 5370)     # where the dash-dot curves run
ARROWS = [(2870, 3030, 2910, 3080), (3265, 3575, 3305, 3620), (2120, 4660, 2160, 4720), (2490, 5280, 2540, 5330)]
KEEP = (2170, 3930, 2370, 4070)       # a cross-section by the moved copy, not part of it
LABEL = (2330, 4320, 2530, 4420)      # the HOIT label, kept


def hoit_placed(grey):
    g = grey.copy()
    h, w = g.shape
    ink = g < 140
    labels, _ = ndimage.label(ink, structure=numpy.ones((3, 3)))
    spans = ndimage.find_objects(labels)
    extents = numpy.array([max(s[0].stop - s[0].start, s[1].stop - s[1].start) for s in spans])
    long_ink = numpy.isin(labels, 1 + numpy.flatnonzero(extents >= 60))
    distance = cv2.distanceTransform((~long_ink).astype(numpy.uint8), cv2.DIST_L2, 5)
    erase = numpy.zeros_like(ink)
    x0, y0, _, _ = CURVES
    for i, s in enumerate(spans):
        if extents[i] >= 60 or s[0].start < y0 or s[1].start < x0:
            continue
        cy, cx = (s[0].start + s[0].stop) // 2, (s[1].start + s[1].stop) // 2
        if LABEL[0] <= cx <= LABEL[2] and LABEL[1] <= cy <= LABEL[3]:
            continue
        piece = labels[s] == i + 1
        # A dash: away from the line plot (depth labels sit by their station).
        if distance[s][piece].min() > 32:
            erase[s] |= piece
    erase = cv2.dilate(erase.astype(numpy.uint8), numpy.ones((7, 7), numpy.uint8)) > 0
    for bx0, by0, bx1, by1 in ARROWS:
        erase[by0:by1, bx0:bx1] = True
    g[erase] = 255
    out = numpy.full((h + 1000, w), 255, numpy.uint8)
    out[:h] = g
    x0, y0, x1, y1 = MOVED
    piece = g[y0:y1, x0:x1].copy()
    keep = out[KEEP[1]:KEEP[3], KEEP[0]:KEEP[2]].copy()
    out[y0:y1, x0:x1] = 255
    out[KEEP[1]:KEEP[3], KEEP[0]:KEEP[2]] = keep
    piece[KEEP[1] - y0:KEEP[3] - y0, max(0, KEEP[0] - x0):KEEP[2] - x0] = 255
    ty, tx = y0 - MOVE[1], x0 - MOVE[0]
    region = out[ty:ty + piece.shape[0], tx:tx + piece.shape[1]]
    numpy.minimum(region, piece, out=region)
    return out


def reprint_grey():
    import pymupdf
    document = pymupdf.open(REPRINT)
    largest = max(document[0].get_images(full=True), key=lambda i: i[2] * i[3])
    return numpy.asarray(Image.open(io.BytesIO(document.extract_image(largest[0])['image'])).convert('L'))


def composite(placed, config):
    h, w = placed.shape
    warp = numpy.array(config['prep']['reprintWarp'], numpy.float64)
    out = cv2.warpAffine(255 - reprint_grey(), warp, (w, h), flags=cv2.INTER_LINEAR, borderValue=255)
    boxes = config['trace']['lineTrace']['boxes']
    for x0, y0, x1, y1 in boxes:
        out[y0:y1, x0:x1] = placed[y0:y1, x0:x1]
    # The reprint's thin strokes that aren't cave: ink an opening that keeps
    # the bold walls doesn't reach, traced, and erased where straight.
    ink = out < 140
    bold = cv2.dilate(cv2.morphologyEx(ink.astype(numpy.uint8), cv2.MORPH_OPEN, numpy.ones((4, 4), numpy.uint8)), numpy.ones((3, 3), numpy.uint8)) > 0
    thin = ink & ~bold
    for x0, y0, x1, y1 in boxes:
        thin[y0:y1, x0:x1] = False
    erase = numpy.zeros_like(ink)
    for path in trace_skeleton(skeletonize(thin)):
        if len(path) < 9:
            continue
        p = numpy.array(path, float)
        chord = numpy.hypot(*(p[-1] - p[0]))
        if chord >= 0.9 * (len(path) - 1) or chord >= 0.92 * numpy.sum(numpy.hypot(*numpy.diff(p, axis=0).T)):
            for y, x in path:
                erase[y, x] = True
    erase = (cv2.dilate(erase.astype(numpy.uint8), numpy.ones((5, 5), numpy.uint8)) > 0) & thin & ~bold
    out = out.copy()
    out[erase] = 255
    return out


def main():
    config = json.loads(CONFIG.read_text(encoding='utf-8'))
    placed = hoit_placed(numpy.asarray(Image.open(SCAN).convert('L')))
    image = CONFIG.parent.joinpath(config['image']).resolve()
    Image.fromarray(placed).save(image.with_name('joolis-hoit-placed.png'))
    Image.fromarray(composite(placed, config)).save(image)
    print('written', image)


if __name__ == '__main__':
    if len(sys.argv) != 1:
        sys.exit(__doc__)
    main()

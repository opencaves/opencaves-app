"""Tints the passages of a bold-wall, white-passage scan pale blue, so
trace_scan.py's colour-fill method can trace it (prototype). On such maps
the walls alone trace badly: dense boulders link them into a mesh, and
thinner strokes drop out.

The config's "prep" block drives it:
- "pdf" (+ "invert"): the scan is the largest image of this PDF's first
  page (inverted when the scan is white on black), written to the
  config's "sourceImage".
- Every area enclosed by the walls (ink of "sourceImage", minus the
  exclude boxes, the OCR labels, "labelBoxes" and "cutLines" - a road's
  double line drawn into the cave) is passage, closed over "closePx" gaps;
  "sealLines" seal wider wall gaps by hand. Only shapes of "minShapePx"
  or more count (the cave, not a legend box).
- Islands (pillars) stay out: enclosed white areas of "minIslandPx" or
  more, ringed by bold wall ink ("islandBold" of their edge) and at least
  "islandMinDepthPx" away from the outside; "islandPoints" and
  "passagePoints" ([x, y] each) force a region either way.
- The passages, eroded by "insetPx" from the walls (pieces smaller than
  "minBandPx" dropped), are tinted (190, 215, 255) and their ink dark blue,
  written to the config's "image" (with a -prep-debug.png beside it).

Usage: python scripts/map-layer/fill_passages.py <config.json> [<output folder with the OCR cache>]
Needs opencv, numpy, Pillow, scipy (and PyMuPDF for "pdf").
"""
import io
import json
import sys
from pathlib import Path

import cv2
import numpy
from PIL import Image
from scipy import ndimage

Image.MAX_IMAGE_PIXELS = None


def extract_pdf_scan(pdf, invert):
    import pymupdf
    document = pymupdf.open(pdf)
    largest = max(document[0].get_images(full=True), key=lambda i: i[2] * i[3])
    grey = Image.open(io.BytesIO(document.extract_image(largest[0])['image'])).convert('L')
    return Image.fromarray(255 - numpy.asarray(grey)) if invert else grey


def main(config_path, ocr_folder=None):
    config_path = Path(config_path)
    config = json.loads(config_path.read_text(encoding='utf-8'))
    prep = config.get('prep', {})
    source = config_path.parent.joinpath(config['sourceImage']).resolve()
    if prep.get('pdf'):
        source.parent.mkdir(parents=True, exist_ok=True)
        extract_pdf_scan(config_path.parent.joinpath(prep['pdf']).resolve(), prep.get('invert')).save(source)
    grey = numpy.asarray(Image.open(source).convert('L'))
    ink = grey < 128
    masked = numpy.zeros_like(ink)
    for item in config.get('exclude', []):
        x0, y0, x1, y1 = item['box']
        masked[max(0, y0):y1, max(0, x0):x1] = True
    for line in prep.get('cutLines', []):
        cut = numpy.zeros(ink.shape, numpy.uint8)
        cv2.line(cut, tuple(line['from']), tuple(line['to']), 1, line.get('widthPx', 7))
        masked |= cut > 0
    ocr = Path(ocr_folder or config_path.parent / '../../_data/map-layer/scans') / f'{config_path.stem}-ocr-words.json'
    if ocr.exists():
        sys.path.insert(0, str(Path(__file__).parent))
        from trace_scan import real_labels
        for word in real_labels(json.loads(ocr.read_text(encoding='utf-8'))):
            x0, y0, x1, y1 = word['box']
            masked[max(0, y0 - 4):y1 + 4, max(0, x0 - 4):x1 + 4] = True
    for x0, y0, x1, y1 in prep.get('labelBoxes', []):
        masked[y0:y1, x0:x1] = True
    wall = (ink & ~masked).astype(numpy.uint8)
    for line in prep.get('sealLines', []):
        cv2.line(wall, tuple(line['from']), tuple(line['to']), 1, line.get('widthPx', 5))
    close = prep.get('closePx', 5)
    closed = cv2.morphologyEx(wall, cv2.MORPH_CLOSE, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (close, close))) > 0
    filled = ndimage.binary_fill_holes(closed)
    shapes, count = ndimage.label(filled, structure=numpy.ones((3, 3)))
    sizes = ndimage.sum(numpy.ones_like(shapes), shapes, numpy.arange(1, count + 1))
    big = numpy.isin(shapes, 1 + numpy.flatnonzero(sizes >= prep.get('minShapePx', 20000)))
    interior = filled & ~closed & big
    bold = cv2.morphologyEx(wall, cv2.MORPH_OPEN, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (5, 5))) > 0
    bold = cv2.dilate(bold.astype(numpy.uint8), numpy.ones((3, 3), numpy.uint8)) > 0
    depth = cv2.distanceTransform(filled.astype(numpy.uint8), cv2.DIST_L2, 5)
    regions, _ = ndimage.label(interior)
    islands = numpy.zeros_like(interior)
    for i, window in enumerate(ndimage.find_objects(regions)):
        region = regions[window] == i + 1
        pad = (slice(max(0, window[0].start - 4), window[0].stop + 4), slice(max(0, window[1].start - 4), window[1].stop + 4))
        padded = regions[pad] == i + 1
        edge = (cv2.dilate(padded.astype(numpy.uint8), numpy.ones((5, 5), numpy.uint8)) > 0) & ~padded
        bold_share = bold[pad][edge].mean() if edge.any() else 0
        island = (region.sum() >= prep.get('minIslandPx', 150) and bold_share >= prep.get('islandBold', 0.85)
                  and depth[window][region].min() >= prep.get('islandMinDepthPx', 25))
        if any(regions[y, x] == i + 1 for x, y in prep.get('islandPoints', [])):
            island = True
        if any(regions[y, x] == i + 1 for x, y in prep.get('passagePoints', [])):
            island = False
        if island:
            islands[window] |= region
    disc = lambda r: cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (2 * r + 1, 2 * r + 1))  # noqa: E731
    inset = prep.get('insetPx', 3)
    band = (filled & big & ~(cv2.dilate(islands.astype(numpy.uint8), disc(inset + 2)) > 0)).astype(numpy.uint8)
    band = cv2.erode(band, disc(inset)) > 0
    parts, count = ndimage.label(band)
    sizes = ndimage.sum(numpy.ones_like(parts), parts, numpy.arange(1, count + 1))
    band = numpy.isin(parts, 1 + numpy.flatnonzero(sizes >= prep.get('minBandPx', 1500)))
    rgb = numpy.stack([grey] * 3, -1).copy()
    rgb[band & ~ink] = (190, 215, 255)
    rgb[band & ink] = (0, 0, 140)
    output = config_path.parent.joinpath(config['image']).resolve()
    Image.fromarray(rgb).save(output)
    debug = numpy.full(rgb.shape, 255, numpy.uint8)
    debug[ink] = (0, 0, 0)
    debug[interior & ~islands & ~ink] = (150, 190, 255)
    debug[band & ink] = (0, 0, 140)
    debug[islands] = (255, 150, 150)
    debug[masked] = (255, 236, 200)
    Image.fromarray(debug).save(output.with_name(output.stem + '-prep-debug.png'))
    print(f'{ndimage.label(islands)[1]} islands, {int(band.sum())} passage px -> {output}')


if __name__ == '__main__':
    if len(sys.argv) not in (2, 3):
        sys.exit(__doc__)
    main(*sys.argv[1:])

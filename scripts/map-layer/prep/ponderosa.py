"""Builds the image traced for Sistema Ponderosa (maps/ponderosa.json): the
sharp scan of the poster (sistema-ponderosa.jpg, 8368 x 6780; pixel
coordinates unchanged), cleaned for the survey-lines trace.

The scan is near bilevel, with toner specks around every stroke and ragged
stroke edges. At this resolution the specks and the raggedness give the
thinned lines thousands of tiny spurs (and trace_scan.py's join of short
pieces takes hours on them), so:

1. Ink pieces smaller than MIN_PIECE_PX (the specks) are dropped, and the
   pin-holes of that size in the strokes filled.
2. The edges are smoothed: the ink mask blurred (SMOOTH_SIGMA px) and cut at
   one half, which keeps the strokes' width and the air domes' dashes.

Usage: python scripts/map-layer/prep/ponderosa.py
Needs opencv, numpy, Pillow, scipy.
"""
import json
import sys
from pathlib import Path

import cv2
import numpy
from PIL import Image
from scipy import ndimage

Image.MAX_IMAGE_PIXELS = None
CONFIG = Path(__file__).resolve().parents[1] / 'maps' / 'ponderosa.json'
SCAN = CONFIG.parents[3] / '_data/maps-import/images/sistema-ponderosa.jpg'
INK_LEVEL = 140
MIN_PIECE_PX = 40
SMOOTH_SIGMA = 2.5


def cleaned(grey):
    ink = grey < INK_LEVEL
    pieces, _ = ndimage.label(ink, structure=numpy.ones((3, 3)))
    sizes = numpy.bincount(pieces.ravel())
    keep = sizes >= MIN_PIECE_PX
    keep[0] = False
    ink = keep[pieces]
    holes, _ = ndimage.label(~ink)
    sizes = numpy.bincount(holes.ravel())
    small = sizes < MIN_PIECE_PX
    small[0] = False
    ink |= small[holes]
    smooth = cv2.GaussianBlur(ink.astype(numpy.float32), (0, 0), SMOOTH_SIGMA)
    return numpy.where(smooth >= 0.5, 0, 255).astype(numpy.uint8)


def main():
    config = json.loads(CONFIG.read_text(encoding='utf-8'))
    image = CONFIG.parent.joinpath(config['image']).resolve()
    image.parent.mkdir(parents=True, exist_ok=True)
    Image.fromarray(cleaned(numpy.asarray(Image.open(SCAN).convert('L')))).save(image)
    print('written', image)


if __name__ == '__main__':
    if len(sys.argv) != 1:
        sys.exit(__doc__)
    main()

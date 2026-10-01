"""Straightens a photographed cave map (a poster on a wall, a page shot at an
angle) so it can be processed like a scan (prototype, for the map layer
pilot).

The config's "perspective" gives four points that form a rectangle on the
paper - the corners of the map's printed border, in the photo's pixels,
clockwise from top-left. The photo is warped so they form a true rectangle
(the average of its sides' lengths), and written where the config's
"image" says; overlay_scan.py, trace_scan.py and cenote_candidates.py then
work on that straightened image.

Usage: python scripts/map-layer/rectify_photo.py <config.json>
Needs opencv, numpy, Pillow.
"""
import json
import math
import sys
from pathlib import Path

import cv2
import numpy
from PIL import Image, ImageOps

Image.MAX_IMAGE_PIXELS = None


def main(config_path):
    config_path = Path(config_path)
    config = json.loads(config_path.read_text(encoding='utf-8'))
    perspective = config['perspective']
    photo = ImageOps.exif_transpose(Image.open(config_path.parent.joinpath(perspective['photo']).resolve())).convert('RGB')
    tl, tr, br, bl = (numpy.array(p, float) for p in perspective['corners'])
    width = round((numpy.linalg.norm(tr - tl) + numpy.linalg.norm(br - bl)) / 2)
    height = round((numpy.linalg.norm(bl - tl) + numpy.linalg.norm(br - tr)) / 2)
    target = numpy.array([[0, 0], [width, 0], [width, height], [0, height]], numpy.float32)
    matrix = cv2.getPerspectiveTransform(numpy.array([tl, tr, br, bl], numpy.float32), target)
    straight = cv2.warpPerspective(numpy.asarray(photo), matrix, (width, height), flags=cv2.INTER_CUBIC, borderValue=(255, 255, 255))
    output = config_path.parent.joinpath(config['image']).resolve()
    output.parent.mkdir(parents=True, exist_ok=True)
    Image.fromarray(straight).save(output)
    skew = math.degrees(math.atan2(tr[1] - tl[1], tr[0] - tl[0]))
    print(f'{photo.size[0]}x{photo.size[1]} photo -> {width}x{height} straightened (top edge was {skew:+.2f} deg, '
          f'top/bottom {numpy.linalg.norm(tr - tl):.0f}/{numpy.linalg.norm(br - bl):.0f} px) -> {output}')


if __name__ == '__main__':
    if len(sys.argv) != 2:
        sys.exit(__doc__)
    main(sys.argv[1])

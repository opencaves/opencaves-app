"""Builds the image traced for the Grotte des Aluxes (maps/aluxes.json): the
Spelunca 98 figure (the PDF's embedded 4277 x 3479 PNG, pixel coordinates
unchanged) with its red ink removed. The red lines (motorway, village road
and grid), the red survey dots and the red labels ("Antenne", "Autoroute",
"Pueblo de Puerto Aventuras") would be read as ink by the thin-walls trace;
where a red line crosses a black wall, plain white would cut the wall, so
the red pixels are inpainted (OpenCV Telea, radius 5) from their
neighbours: the black walls run on through them.

Usage: python scripts/map-layer/prep/aluxes.py
Needs opencv, numpy, Pillow, PyMuPDF.
"""
import io
import json
from pathlib import Path

import cv2
import numpy
import pymupdf
from PIL import Image

Image.MAX_IMAGE_PIXELS = None
CONFIG = Path(__file__).resolve().parents[1] / 'maps' / 'aluxes.json'
PDF = CONFIG.parents[3] / '_data/cartes/à traiter/Aluxes, Grotte des, Puerto Aventuras.pdf'


def red_ink(rgb):
    """Red pixels (and their anti-aliased fringe), minus the black ink."""
    r, g, b = (rgb[..., i].astype(int) for i in range(3))
    red = (r - g > 60) & (r - b > 50) & (r > 150)
    mask = cv2.dilate(red.astype(numpy.uint8), numpy.ones((3, 3), numpy.uint8))
    mask[(r < 90) & (g < 90) & (b < 90)] = 0
    return mask


def main():
    document = pymupdf.open(PDF)
    xref = document[0].get_images(full=True)[0][0]
    rgb = numpy.asarray(Image.open(io.BytesIO(document.extract_image(xref)['image'])).convert('RGB'))
    bgr = cv2.inpaint(cv2.cvtColor(rgb, cv2.COLOR_RGB2BGR), red_ink(rgb), 5, cv2.INPAINT_TELEA)
    config = json.loads(CONFIG.read_text(encoding='utf-8'))
    target = CONFIG.parent.joinpath(config['image']).resolve()
    target.parent.mkdir(parents=True, exist_ok=True)
    Image.fromarray(cv2.cvtColor(bgr, cv2.COLOR_BGR2RGB)).save(target)
    print(f'{rgb.shape[1]} x {rgb.shape[0]} px -> {target}')


if __name__ == '__main__':
    main()

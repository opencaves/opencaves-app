"""Builds the image traced for Cenote Mul Tun (maps/mul-tun-2016.json): the
vector SVG (cenote-mul-tun.svg) rendered at 300 DPI, with the dry cavern
floor under the overhang tinted like the water, so colour-fill takes both.

The map fills only the water (#dcffff); the floor between the water and the
drip line is left white. Tinted: what lies inside the bold wall strokes
(0.736 pt, rendered on their own), less
- the open-air collapse in the middle (flooded from SEED over the ink grown
  by OPEN_RADIUS_PX, the drip line's ticks closing it; OPEN_DISKS adds the
  rock standing in it),
- the water,
- the insides of the small bold rings (pillars).

Usage: python scripts/map-layer/prep/mul_tun.py
Needs Node with Playwright's Chrome (npx playwright install chromium if
missing), opencv, numpy, Pillow, scipy.
"""
import json
import subprocess
import tempfile
from pathlib import Path

import cv2
import numpy
from PIL import Image
from scipy import ndimage

ROOT = Path(__file__).resolve().parents[3]
SVG = ROOT / '_data/found-maps-2026-10/import/images/cenote-mul-tun.svg'
OUT = ROOT / '_data/map-layer/scans/mul-tun-2016-prepared.png'
SCALE = 300 / 72
# The bold walls: the only strokes 0.736 pt wide.
# (The clip paths stay: hidden, they clip the whole drawing away.)
BOLD_ONLY_CSS = 'path:not([stroke-width=".736"]):not(clipPath path), use, image, text { display: none } path { fill: none !important }'
OPEN_RADIUS_PX = 16
SEED = (1160, 1300)
OPEN_DISKS = [(1035, 1172, 48)]

RENDER = r"""
const { chromium } = require('playwright')
const [svg, out, scale, css] = process.argv.slice(1)
;(async () => {
  const browser = await chromium.launch({ channel: 'chrome' }).catch(() => chromium.launch())
  const page = await browser.newPage()
  await page.goto('file:///' + svg)
  const size = await page.evaluate(([s, css]) => {
    const svg = document.querySelector('svg')
    const w = Math.round(svg.width.baseVal.value * s), h = Math.round(svg.height.baseVal.value * s)
    svg.setAttribute('width', w); svg.setAttribute('height', h)
    document.documentElement.style.background = 'white'
    if (css) { const style = document.createElementNS('http://www.w3.org/2000/svg', 'style'); style.textContent = css; svg.appendChild(style) }
    return { width: w, height: h }
  }, [Number(scale), css])
  await page.setViewportSize(size)
  await page.screenshot({ path: out })
  await browser.close()
})()
"""


def render(svg, out, css=''):
    subprocess.run(['node', '-e', RENDER, str(svg).replace('\\', '/'), str(out), str(SCALE), css], cwd=ROOT, check=True)


def disk(r):
    return cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (2 * r + 1, 2 * r + 1))


def main():
    with tempfile.TemporaryDirectory() as tmp:
        full, bold_png = Path(tmp) / 'full.png', Path(tmp) / 'bold.png'
        render(SVG, full)
        render(SVG, bold_png, BOLD_ONLY_CSS)
        rgb = numpy.asarray(Image.open(full).convert('RGB')).astype(int)
        bold = numpy.asarray(Image.open(bold_png).convert('L')) < 160
    grey = rgb.mean(2)
    height, width = bold.shape
    # The page's frame and the title block's rule aren't walls.
    bold[:, :120] = bold[:, -120:] = bold[:120] = bold[-120:] = False
    bold[100:600, 1700:1900] = False
    blue = (rgb[..., 2] - rgb[..., 0]) > 15
    blue = ndimage.binary_fill_holes(cv2.morphologyEx(blue.astype(numpy.uint8), cv2.MORPH_CLOSE, disk(4)) > 0)
    # Outside the cave: flooded from a corner, the walls and water its barrier.
    barrier = (bold | (cv2.dilate(blue.astype(numpy.uint8), disk(3)) > 0)).astype(numpy.uint8)
    barrier = cv2.morphologyEx(barrier, cv2.MORPH_CLOSE, disk(3))
    flood = (1 - barrier).astype(numpy.uint8) * 255
    cv2.floodFill(flood, numpy.zeros((height + 2, width + 2), numpy.uint8), (5, 5), 128)
    outside = flood == 128
    # The open-air collapse.
    ink = cv2.dilate((grey < 150).astype(numpy.uint8), disk(OPEN_RADIUS_PX)) > 0
    labels, _ = ndimage.label(~ink & ~blue)
    open_air = labels == labels[SEED[1], SEED[0]]
    open_air = ndimage.binary_fill_holes(cv2.dilate(open_air.astype(numpy.uint8), disk(OPEN_RADIUS_PX)) > 0) & ~blue
    for x, y, r in OPEN_DISKS:
        rock = numpy.zeros((height, width), numpy.uint8)
        cv2.circle(rock, (x, y), r, 1, -1)
        open_air |= rock > 0
    # The cave: the largest piece not outside.
    labels, count = ndimage.label(~outside)
    sizes = ndimage.sum(~outside, labels, range(1, count + 1))
    cave = labels == numpy.argmax(sizes) + 1
    # Small bold rings are pillars: their insides stay white.
    rings, _ = ndimage.label(bold)
    pillars = numpy.zeros_like(bold)
    for i, box in enumerate(ndimage.find_objects(rings)):
        if box[0].stop - box[0].start < 200 and box[1].stop - box[1].start < 200:
            ring = rings[box] == i + 1
            pillars[box] |= ndimage.binary_fill_holes(ring) & ~ring
    tint = cave & ~open_air & ~blue & ~bold & ~pillars & (grey > 200)
    out = rgb.astype(numpy.uint8).copy()
    out[tint] = (220, 255, 255)
    Image.fromarray(out).save(OUT)
    print(json.dumps({'image': str(OUT), 'size': [width, height], 'tinted px': int(tint.sum())}))


if __name__ == '__main__':
    main()

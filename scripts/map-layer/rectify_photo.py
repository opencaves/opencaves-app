"""Straightens a photographed cave map (a poster on a wall, a page shot at an
angle) so it can be processed like a scan (prototype, for the map layer
pilot).

The config's "perspective" gives four points that form a rectangle on the
paper - the corners of the map's printed border, in the photo's pixels,
clockwise from top-left. The photo is warped so they form a true rectangle
(the average of its sides' lengths), and written where the config's
"image" says; overlay_scan.py, trace_scan.py and cenote_candidates.py then
work on that straightened image.

Photos of glossy or laminated posters may need more ("perspective" keys):
- "k1": the lens's barrel distortion, undone first: a pixel at distance d
  from the photo's centre moves to d * (1 + k1 * (d / half-diagonal)^2).
  The corners are then given in the corrected photo's pixels.
- "flattenPx": glare and uneven light divided out - each channel over its
  local paper level (a grey closing that wide, wider than any passage so its
  pale fill stays, then a blur).
- "flattenMaxPx": the same with the local maximum over that window instead
  of a closing (computed at 1/8 size).
- "destripePx": a canvas weave showing through the glare as vertical stripes
  removed - the fine horizontal detail that stays the same down a column
  that tall (the drawing doesn't).
- "denotch": a laminate's fine periodic weave removed - its peaks in the
  Fourier spectrum zeroed, tile by tile (its period drifts across a photo).

Usage: python scripts/map-layer/rectify_photo.py <config.json>
Needs opencv, numpy, Pillow (and scipy for destripePx).
"""
import json
import math
import sys
from pathlib import Path

import cv2
import numpy
from PIL import Image, ImageOps

Image.MAX_IMAGE_PIXELS = None


def undistorted_warp(photo, corners, k1, width, height):
    """The perspective warp, through the inverse of the lens correction."""
    h0, w0 = photo.shape[:2]
    target = numpy.array([[0, 0], [width, 0], [width, height], [0, height]], numpy.float32)
    inverse = cv2.getPerspectiveTransform(target, numpy.array(corners, numpy.float32))
    xs, ys = numpy.meshgrid(numpy.arange(width, dtype=numpy.float64), numpy.arange(height, dtype=numpy.float64))
    den = inverse[2, 0] * xs + inverse[2, 1] * ys + inverse[2, 2]
    dx = (inverse[0, 0] * xs + inverse[0, 1] * ys + inverse[0, 2]) / den - w0 / 2
    dy = (inverse[1, 0] * xs + inverse[1, 1] * ys + inverse[1, 2]) / den - h0 / 2
    radius = math.hypot(w0 / 2, h0 / 2)
    # The corrected position is d * (1 + k1 r^2): inverted by fixed-point iteration.
    px, py = dx.copy(), dy.copy()
    for _ in range(20):
        factor = 1 + k1 * (px ** 2 + py ** 2) / radius ** 2
        px, py = dx / factor, dy / factor
    return cv2.remap(photo, (px + w0 / 2).astype(numpy.float32), (py + h0 / 2).astype(numpy.float32), cv2.INTER_CUBIC,
                     borderMode=cv2.BORDER_CONSTANT, borderValue=(255, 255, 255))


def denotch(channel, r0=12, k=4.0, window=15):
    """Periodic texture removed: Fourier peaks well above their
    neighbourhood's median (beyond r0 bins from the centre) zeroed."""
    h, w = channel.shape
    mean = channel.mean()
    spectrum = numpy.fft.fftshift(numpy.fft.fft2(channel - mean))
    magnitude = numpy.log1p(numpy.abs(spectrum)).astype(numpy.float32)
    top = magnitude.max()
    median = cv2.medianBlur(numpy.clip(magnitude / top * 255, 0, 255).astype(numpy.uint8), window).astype(numpy.float32) / 255 * top
    yy, xx = numpy.mgrid[:h, :w]
    peak = (magnitude - median > numpy.log(k)) & (numpy.hypot(yy - h / 2, xx - w / 2) > r0)
    spectrum[cv2.dilate(peak.astype(numpy.uint8), numpy.ones((5, 5))) > 0] = 0
    return numpy.real(numpy.fft.ifft2(numpy.fft.ifftshift(spectrum))) + mean


def denotch_tiled(image, tile=640, step=320):
    """denotch on the luminance, tile by tile, blended with a Hann window;
    the same correction added to each channel."""
    lum = image.mean(axis=2)
    h, w = lum.shape
    total, weight = numpy.zeros_like(lum), numpy.zeros_like(lum)
    hann = numpy.outer(numpy.hanning(tile), numpy.hanning(tile)) + 1e-3
    for y in list(range(0, max(1, h - tile), step)) + [max(0, h - tile)]:
        for x in list(range(0, max(1, w - tile), step)) + [max(0, w - tile)]:
            piece = lum[y:y + tile, x:x + tile]
            window = hann[:piece.shape[0], :piece.shape[1]]
            total[y:y + tile, x:x + tile] += denotch(piece) * window
            weight[y:y + tile, x:x + tile] += window
    return image + (total / weight - lum)[..., None]


def main(config_path):
    config_path = Path(config_path)
    config = json.loads(config_path.read_text(encoding='utf-8'))
    perspective = config['perspective']
    photo = ImageOps.exif_transpose(Image.open(config_path.parent.joinpath(perspective['photo']).resolve())).convert('RGB')
    tl, tr, br, bl = (numpy.array(p, float) for p in perspective['corners'])
    width = round((numpy.linalg.norm(tr - tl) + numpy.linalg.norm(br - bl)) / 2)
    height = round((numpy.linalg.norm(bl - tl) + numpy.linalg.norm(br - tr)) / 2)
    if perspective.get('k1'):
        straight = undistorted_warp(numpy.asarray(photo), [tl, tr, br, bl], perspective['k1'], width, height)
    else:
        target = numpy.array([[0, 0], [width, 0], [width, height], [0, height]], numpy.float32)
        matrix = cv2.getPerspectiveTransform(numpy.array([tl, tr, br, bl], numpy.float32), target)
        straight = cv2.warpPerspective(numpy.asarray(photo), matrix, (width, height), flags=cv2.INTER_CUBIC, borderValue=(255, 255, 255))
    if perspective.get('flattenPx'):
        size = perspective['flattenPx'] | 1
        level = cv2.morphologyEx(straight, cv2.MORPH_CLOSE, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (size, size)))
        level = cv2.GaussianBlur(level.astype(numpy.float32), (0, 0), size / 2)
        straight = numpy.clip(straight.astype(numpy.float32) / numpy.maximum(level, 1) * 240, 0, 255).astype(numpy.uint8)
    if perspective.get('destripePx'):
        from scipy import ndimage
        grey = straight.astype(numpy.float32).mean(axis=2)
        fine = grey - cv2.GaussianBlur(grey, (0, 0), sigmaX=12, sigmaY=0.1)
        small = cv2.resize(fine, (fine.shape[1], fine.shape[0] // 8), interpolation=cv2.INTER_AREA)
        stripes = ndimage.median_filter(small, size=(perspective['destripePx'] // 8 | 1, 1))
        stripes = cv2.resize(stripes, (fine.shape[1], fine.shape[0]), interpolation=cv2.INTER_LINEAR)
        straight = numpy.clip(straight.astype(numpy.float32) - stripes[..., None], 0, 255).astype(numpy.uint8)
    image = straight.astype(numpy.float32)
    if perspective.get('flattenMaxPx'):
        window = max(3, perspective['flattenMaxPx'] // 8 | 1)
        channels = []
        for c in range(3):
            small = cv2.resize(image[..., c], None, fx=1 / 8, fy=1 / 8, interpolation=cv2.INTER_AREA)
            level = cv2.GaussianBlur(cv2.dilate(small, numpy.ones((window, window))), (0, 0), window / 1.5)
            level = cv2.resize(level, (image.shape[1], image.shape[0]), interpolation=cv2.INTER_LINEAR)
            channels.append(numpy.clip(image[..., c] / numpy.maximum(level, 1) * 245, 0, 255))
        image = numpy.dstack(channels).astype(numpy.float32)
    if perspective.get('denotch'):
        image = denotch_tiled(image)
    straight = numpy.clip(image, 0, 255).astype(numpy.uint8)
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

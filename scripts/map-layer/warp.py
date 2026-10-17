"""Rubber-sheets a placed map: a smooth correction (a thin-plate spline)
applied after its similarity placement, for a map whose drawing bends away
from the ground - no single scale, rotation and shift fits it everywhere.
Off unless the map's config has a "warp" (see docs/map-layer.md, "Warp").

    "warp": {
      "why": "...",
      "pairs": [{"px": [x, y], "longitude": lng, "latitude": lat, "why": "..."}],
      "pins": [{"px": [x, y], "why": "..."}],
      "pinControlPoints": true,
      "smoothing": 0.5,
      "extent": [[x, y], ...],
      "fadeMetres": 400
    }

- "pairs": a pixel of this map ("pdf": [x, y] for a vector map, like its
  control points) and where it belongs on the ground. A pair with
  "off": true is kept in the config but not used.
- "pins": pixels that don't move (the similarity's position kept);
  "pinControlPoints" pins the control points the similarity is fitted on
  (not the "check" ones).
- "smoothing": how much the spline may miss its pairs to stay smooth
  (scipy's RBFInterpolator smoothing, on coordinates in kilometres; 0
  passes through every pair). Pins are always exact.
- "extent": a polygon (this map's pixels) where the warp acts; beyond it the
  correction fades to nothing over "fadeMetres" (default 400) on the ground.

The warp moves points by metres in UTM. raster_placement (overlay_scan.py)
and vector_placement (build_layer.py) apply it, so everything placed through
them - the traced lines, the symbols, the cenotes, the overlay - is warped
alike; georef_scans.py and overlay_scan.py resample the map's image with
resample_on_ground() instead of laying it by its four corners.

Usage: python scripts/map-layer/warp.py <config.json>
prints each pair's distance to its ground position before and after the warp
(and with each pair left out of the spline: how well the others predict it),
and how far the pins and the control points move.
"""
import json
import math
import sys
from pathlib import Path

import numpy

KM = 1000.0


def affine_of(place):
    """The 2 x 2 matrix and offset of an affine place(x, y) -> (east, north)."""
    o = numpy.array(place(0.0, 0.0), float)
    ex = numpy.array(place(1.0, 0.0), float) - o
    ey = numpy.array(place(0.0, 1.0), float) - o
    return numpy.array([[ex[0], ey[0]], [ex[1], ey[1]]]), o


class Warp:
    """A map's warp: the displacement (metres, UTM) added to its similarity
    placement, and the way back from the ground to the map's pixels."""

    def __init__(self, similarity, spec, key, to_utm, control_points=()):
        from scipy.interpolate import RBFInterpolator
        self.similarity = similarity
        self.matrix, self.offset = affine_of(similarity)
        self.inverse = numpy.linalg.inv(self.matrix)
        self.spec = spec
        self.key = key
        pairs = [p for p in spec.get('pairs', []) if not p.get('off')]
        pins = [p[key] for p in spec.get('pins', [])]
        if spec.get('pinControlPoints'):
            pins += [p[key] for p in control_points if not p.get('check')]
        if not pairs:
            sys.exit('A "warp" needs at least one pair.')
        self.pairs = pairs
        self.pair_from = self.similar([p[key] for p in pairs])
        self.pair_to = numpy.array([to_utm.transform(p['longitude'], p['latitude']) for p in pairs], float)
        self.pins = self.similar(pins) if pins else numpy.zeros((0, 2))
        self.centre = self.pair_from.mean(axis=0)
        self.smoothing = float(spec.get('smoothing', 0))
        points = numpy.vstack([self.pair_from, self.pins])
        values = numpy.vstack([self.pair_to - self.pair_from, numpy.zeros_like(self.pins)])
        smoothing = numpy.r_[numpy.full(len(self.pair_from), self.smoothing), numpy.zeros(len(self.pins))]
        self.spline = RBFInterpolator((points - self.centre) / KM, values, kernel='thin_plate_spline', smoothing=smoothing)
        self.area = None
        if spec.get('extent'):
            import shapely
            self.area = shapely.Polygon(self.similar(spec['extent']))
            self.fade = float(spec.get('fadeMetres', 400))
            shapely.prepare(self.area)

    def similar(self, pixels):
        """Pixels -> UTM by the similarity alone (an n x 2 array)."""
        pixels = numpy.asarray(pixels, float).reshape(-1, 2)
        return pixels @ self.matrix.T + self.offset

    def to_pixels(self, ground):
        """UTM (n x 2, similarity frame) -> pixels: the similarity undone."""
        return (numpy.asarray(ground, float) - self.offset) @ self.inverse.T

    def displacement(self, ground):
        """The correction (n x 2 metres) at points placed by the similarity."""
        ground = numpy.asarray(ground, float).reshape(-1, 2)
        out = numpy.zeros_like(ground)
        weight = numpy.ones(len(ground))
        if self.area is not None:
            import shapely
            distance = shapely.distance(self.area, shapely.points(ground))
            t = numpy.clip(1 - distance / self.fade, 0, 1)
            weight = t * t * (3 - 2 * t)
        moving = weight > 0
        if moving.any():
            out[moving] = self.spline((ground[moving] - self.centre) / KM) * weight[moving, None]
        return out

    def place(self, x, y):
        """Pixels -> UTM, warped: scalars or arrays, like the similarity."""
        scalar = numpy.ndim(x) == 0
        ground = self.similar(numpy.c_[numpy.ravel(x), numpy.ravel(y)])
        ground = ground + self.displacement(ground)
        if scalar:
            return float(ground[0, 0]), float(ground[0, 1])
        return ground[:, 0].reshape(numpy.shape(x)), ground[:, 1].reshape(numpy.shape(x))

    def unwarp(self, ground, iterations=8):
        """UTM -> pixels, the warp undone: the point u with u + D(u) = ground
        (fixed-point iteration: the correction bends slowly, metres per
        hundreds of metres), then the similarity undone."""
        ground = numpy.asarray(ground, float).reshape(-1, 2)
        u = ground.copy()
        for _ in range(iterations):
            u = ground - self.displacement(u)
        return self.to_pixels(u)


def with_warp(place, config, key, to_utm):
    """place, warped by the config's "warp" (unchanged without one); the warped
    place keeps its Warp as its .warp attribute."""
    spec = config.get('warp')
    if not spec:
        return place
    warp = Warp(place, spec, key, to_utm, config.get('controlPoints', []))

    def placed(x, y, *rest):
        return warp.place(x, y)
    placed.warp = warp
    return placed


def resample_on_ground(image, warp, utm_epsg, scale=1.0, offset=0.0, max_side=2048):
    """The map's image as laid on the ground by a warped placement: resampled
    onto a north-up grid (even steps in Web Mercator, as Mapbox stretches an
    image source between its corners) instead of laid by its four corners.
    image: a PIL image whose pixel centres are at scale * x + offset for the
    map's pixel x (a scan reduced by f: scale f, offset (f - 1) / 2; offset
    may be an (x, y) pair).
    Returns (RGBA image, corners [[lng, lat] x 4]: top-left, top-right,
    bottom-right, bottom-left), transparent outside the map."""
    from PIL import Image
    from pyproj import Transformer
    from scipy import ndimage
    image = image.convert('RGBA')
    w, h = image.size
    ox, oy = offset if isinstance(offset, (tuple, list)) else (offset, offset)
    # The image's outline (its outer edges, in the map's pixels), warped, for
    # the grid's extent.
    (left, top), (right, bottom) = [((v - ox) / scale, (u - oy) / scale) for v, u in ((-0.5, -0.5), (w - 0.5, h - 0.5))]
    edge = numpy.linspace(0, 1, 65)
    xs, ys = left + edge * (right - left), top + edge * (bottom - top)
    outline = numpy.r_[numpy.c_[xs, top + 0 * edge], numpy.c_[right + 0 * edge, ys], numpy.c_[xs, bottom + 0 * edge], numpy.c_[left + 0 * edge, ys]]
    east, north = warp.place(outline[:, 0], outline[:, 1])
    to_lnglat = Transformer.from_crs(utm_epsg, 4326, always_xy=True)
    to_utm = Transformer.from_crs(4326, utm_epsg, always_xy=True)
    to_mercator = Transformer.from_crs(4326, 3857, always_xy=True)
    from_mercator = Transformer.from_crs(3857, 4326, always_xy=True)
    lng, lat = to_lnglat.transform(east, north)
    mx, my = to_mercator.transform(lng, lat)
    x0, x1, y0, y1 = min(mx), max(mx), min(my), max(my)
    # About the image's own resolution (Mercator metres are 1/cos(lat) ground
    # metres), at most max_side pixels a side.
    metres_per_pixel = math.sqrt(abs(numpy.linalg.det(warp.matrix))) / scale / math.cos(math.radians(float(numpy.mean(lat))))
    step = max(metres_per_pixel, (x1 - x0) / max_side, (y1 - y0) / max_side)
    width, height = max(2, round((x1 - x0) / step)), max(2, round((y1 - y0) / step))
    # The way back computed on a coarse grid, then interpolated: the warp
    # bends slowly.
    gx = numpy.linspace(0, width - 1, max(2, width // 8 + 1))
    gy = numpy.linspace(0, height - 1, max(2, height // 8 + 1))
    cx, cy = numpy.meshgrid(x0 + (gx + 0.5) * (x1 - x0) / width, y1 - (gy + 0.5) * (y1 - y0) / height)
    glng, glat = from_mercator.transform(cx.ravel(), cy.ravel())
    ge, gn = to_utm.transform(glng, glat)
    source = warp.unwarp(numpy.c_[ge, gn]) * scale + numpy.array([ox, oy])
    shape = (len(gy), len(gx))
    rows, cols = numpy.mgrid[0:height, 0:width]
    at = [rows * (len(gy) - 1) / (height - 1), cols * (len(gx) - 1) / (width - 1)]
    fx = ndimage.map_coordinates(source[:, 0].reshape(shape), at, order=1)
    fy = ndimage.map_coordinates(source[:, 1].reshape(shape), at, order=1)
    pixels = numpy.asarray(image)
    out = numpy.zeros((height, width, 4), numpy.uint8)
    for channel in range(4):
        out[..., channel] = ndimage.map_coordinates(pixels[..., channel], [fy, fx], order=1, mode='nearest')
    out[~((fx >= -0.5) & (fy >= -0.5) & (fx <= w - 0.5) & (fy <= h - 0.5))] = 0
    corners_lng, corners_lat = from_mercator.transform([x0, x1, x1, x0], [y1, y1, y0, y0])
    return Image.fromarray(out, 'RGBA'), [[float(a), float(b)] for a, b in zip(corners_lng, corners_lat)]


def report(config_path):
    """Prints the warp's pairs' distances to the ground, before and after."""
    from pyproj import Transformer
    sys.path.insert(0, str(Path(__file__).resolve().parent))
    config = json.loads(Path(config_path).read_text(encoding='utf-8'))
    if not config.get('warp'):
        sys.exit('This config has no "warp".')
    vector = config.get('pdf') and config.get('walls') and not config.get('trace')
    to_utm = Transformer.from_crs(4326, config['utmEpsg'], always_xy=True)
    if vector:
        from build_layer import vector_placement
        place = vector_placement(config)[0].utm
    else:
        from overlay_scan import raster_placement
        place = raster_placement(config)[0]
    warp = place.warp
    before = numpy.hypot(*(warp.pair_to - warp.pair_from).T)
    after = numpy.hypot(*(warp.pair_to - (warp.pair_from + warp.displacement(warp.pair_from))).T)
    spec = dict(config['warp'])
    left_out = []
    for i in range(len(warp.pairs)):
        spec['pairs'] = [p for j, p in enumerate(warp.pairs) if j != i]
        other = Warp(warp.similarity, spec, warp.key, to_utm, config.get('controlPoints', []))
        left_out.append(math.hypot(*(warp.pair_to[i] - warp.pair_from[i] - other.displacement(warp.pair_from[i:i + 1])[0])))
    left_out = numpy.array(left_out)
    print(f'{len(warp.pairs)} pairs, {len(warp.pins)} pins, smoothing {warp.smoothing}')
    for label, values in (('before (similarity)', before), ('after (warped)', after), ('left out of the spline', left_out)):
        print(f'  {label:24} median {numpy.median(values):6.1f} m  90th percentile {numpy.percentile(values, 90):6.1f} m  max {values.max():6.1f} m')
    pins = numpy.hypot(*warp.displacement(warp.pins).T) if len(warp.pins) else numpy.zeros(1)
    print(f'  pins moved at most {pins.max():.2f} m')
    for p in config.get('controlPoints', []):
        e, n = to_utm.transform(p['longitude'], p['latitude'])
        s = warp.similar([p[warp.key]])[0]
        moved = s + warp.displacement(s[None])[0]
        print(f"  {p['name'][:28]:28} {'check' if p.get('check') else 'fit  '} {math.hypot(s[0] - e, s[1] - n):6.1f} m -> {math.hypot(moved[0] - e, moved[1] - n):6.1f} m")


if __name__ == '__main__':
    if len(sys.argv) != 2 or sys.argv[1] in ('-h', '--help'):
        sys.exit(__doc__)
    report(sys.argv[1])

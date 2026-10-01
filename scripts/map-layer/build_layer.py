"""Builds a vector cave map's layer data from its config (prototype, for the
map layer pilot): the plan view's walls and survey lines, read straight from
the source PDF's drawing commands (picked by stroke colour and width, which
profiles and cross-sections don't share), placed on the ground and written
as GeoJSON lines in longitude/latitude.

Placement: the map's scale bar gives metres per PDF point; "north": "grid"
means the drawing is aligned to the UTM grid, so no rotation. The control
points place it: with one, the map is just shifted onto it; with more, the
shift is their average and each point's residual (metres) is reported - the
map's accuracy.

Writes <output>/<name>.geojson and <output>/<name>-preview.html (the layer
over satellite imagery, for checking the placement: open it in a browser).

Usage: python scripts/map-layer/build_layer.py <config.json> <output folder>
Needs PyMuPDF, shapely, pyproj.
"""
import json
import re
import sys
from pathlib import Path

import pymupdf
from pyproj import Transformer
from shapely.geometry import LineString, box, mapping
from shapely.ops import linemerge, transform, unary_union

ROOT = Path(__file__).resolve().parents[2]
# Simplification tolerance, in metres: below the survey's own precision.
SIMPLIFY_METRES = 0.1
# Points sampled along each Bezier curve segment.
CURVE_STEPS = 8
COLOUR_TOLERANCE = 0.02


def bezier(p0, p1, p2, p3, steps=CURVE_STEPS):
    for i in range(1, steps + 1):
        t = i / steps
        u = 1 - t
        yield (u ** 3 * p0.x + 3 * u * u * t * p1.x + 3 * u * t * t * p2.x + t ** 3 * p3.x,
               u ** 3 * p0.y + 3 * u * u * t * p1.y + 3 * u * t * t * p2.y + t ** 3 * p3.y)


def same_colour(a, b):
    return a is not None and all(abs(x - y) <= COLOUR_TOLERANCE for x, y in zip(a, b))


def stroke_lines(drawing):
    """A stroked drawing's segments as polylines (curves flattened)."""
    lines, current = [], []
    for item in drawing['items']:
        kind = item[0]
        if kind == 're':
            r = item[1]
            lines.append([(r.x0, r.y0), (r.x1, r.y0), (r.x1, r.y1), (r.x0, r.y1), (r.x0, r.y0)])
            continue
        if kind == 'qu':
            q = item[1]
            lines.append([(q.ul.x, q.ul.y), (q.ur.x, q.ur.y), (q.lr.x, q.lr.y), (q.ll.x, q.ll.y), (q.ul.x, q.ul.y)])
            continue
        start = item[1]
        if current and (abs(current[-1][0] - start.x) > 1e-3 or abs(current[-1][1] - start.y) > 1e-3):
            lines.append(current)
            current = []
        if not current:
            current.append((start.x, start.y))
        if kind == 'l':
            current.append((item[2].x, item[2].y))
        elif kind == 'c':
            current.extend(bezier(item[1], item[2], item[3], item[4]))
    if current:
        lines.append(current)
    return [line for line in lines if len(line) >= 2]


def matches_style(drawing, style):
    return drawing.get('color') is not None and same_colour(drawing['color'], style['color']) and abs((drawing.get('width') or 0) - style['width']) < 0.01


def vector_placement(config):
    """PDF points -> (longitude, latitude), for a vector map: scale from the
    scale bar, grid north (y down on the page, up on the ground), shifted onto
    the control points. Returns (place, metres per point, residuals)."""
    (x0, y0), (x1, y1) = config['scaleBar']['from'], config['scaleBar']['to']
    metres_per_point = config['scaleBar']['metres'] / ((x1 - x0) ** 2 + (y1 - y0) ** 2) ** 0.5
    if config.get('north') != 'grid':
        sys.exit('Only "north": "grid" maps are supported so far.')
    to_utm = Transformer.from_crs(4326, config['utmEpsg'], always_xy=True)
    to_lnglat = Transformer.from_crs(config['utmEpsg'], 4326, always_xy=True)
    shifts = []
    for point in config['controlPoints']:
        east, north = to_utm.transform(point['longitude'], point['latitude'])
        shifts.append((east - point['pdf'][0] * metres_per_point, north + point['pdf'][1] * metres_per_point))
    shift_e = sum(s[0] for s in shifts) / len(shifts)
    shift_n = sum(s[1] for s in shifts) / len(shifts)
    residuals = [((s[0] - shift_e) ** 2 + (s[1] - shift_n) ** 2) ** 0.5 for s in shifts]

    def place(x, y, z=None):
        return to_lnglat.transform(shift_e + x * metres_per_point, shift_n - y * metres_per_point)

    return place, metres_per_point, residuals


def main(config_path, output):
    config_path = Path(config_path)
    config = json.loads(config_path.read_text(encoding='utf-8'))
    name = config_path.stem
    out = Path(output)
    out.mkdir(parents=True, exist_ok=True)
    page = pymupdf.open(config_path.parent.joinpath(config['pdf']).resolve())[config.get('page', 1) - 1]
    drawings = page.get_drawings()
    excluded = unary_union([box(*e['box']) for e in config.get('exclude', [])]) if config.get('exclude') else None

    def kept(geometry):
        return excluded is None or not geometry.intersects(excluded)

    def lines_of(style):
        lines = [LineString(points) for d in drawings if d['type'] in ('s', 'fs') and matches_style(d, style) for points in stroke_lines(d)]
        lines = [line for line in lines if line.length > 0 and kept(line)]
        merged_lines = linemerge(unary_union(lines))
        return list(getattr(merged_lines, 'geoms', [merged_lines]))

    walls = lines_of(config['walls'])
    survey = lines_of(config['surveyLines']) if config.get('surveyLines') else []

    place, metres_per_point, residuals = vector_placement(config)

    tolerance = SIMPLIFY_METRES / metres_per_point
    properties = {'map': name, 'sistemaId': config.get('sistemaId'), 'title': config.get('title'), 'credits': config.get('credits')}
    features = []
    for kind, geometries in (('wall', walls), ('survey', survey)):
        for geometry in geometries:
            placed = transform(place, geometry.simplify(tolerance))
            features.append({'type': 'Feature', 'properties': {**properties, 'kind': kind}, 'geometry': mapping(placed)})
    # The cenotes drawn on the map, at their labels (beside each opening:
    # a few metres off).
    for entrance in config.get('entrances', []):
        features.append({'type': 'Feature', 'properties': {**properties, 'kind': 'entrance', 'name': entrance['name'], 'caveId': entrance.get('caveId')},
                         'geometry': {'type': 'Point', 'coordinates': list(place(*entrance['pdf']))}})
    collection = {'type': 'FeatureCollection', 'features': features}
    geojson_path = out / f'{name}.geojson'
    geojson_path.write_text(json.dumps(collection, separators=(',', ':')), encoding='utf-8')

    print(f'{len(walls)} wall lines, {len(survey)} survey lines -> {geojson_path} ({geojson_path.stat().st_size // 1024} KB)')
    print(f'scale: {metres_per_point:.4f} m per PDF point; control points: {len(residuals)}'
          + (f', residuals {", ".join(f"{r:.1f} m" for r in residuals)}' if len(residuals) > 1 else ' (no residual: a single point can\'t be checked)'))

    # Preview: the layer over satellite imagery.
    env = {}
    for env_file in ('.env', '.env.local'):
        path = ROOT / env_file
        if path.exists():
            env.update(dict(re.findall(r'^\s*([A-Z0-9_]+)\s*=\s*"?([^"\n]*)"?', path.read_text(encoding='utf-8'), re.M)))
    token = env.get('REACT_APP_MAPBOX_ACCESS_TOKEN', '')
    anchors = [{'type': 'Feature', 'properties': {'name': p['name']}, 'geometry': {'type': 'Point', 'coordinates': [p['longitude'], p['latitude']]}} for p in config['controlPoints']]
    centre = place(*unary_union(walls).centroid.coords[0]) if walls else (config['controlPoints'][0]['longitude'], config['controlPoints'][0]['latitude'])
    (out / f'{name}-preview.html').write_text(PREVIEW.replace('__TOKEN__', token).replace('__TITLE__', config.get('title', name))
                                             .replace('__DATA__', json.dumps(collection)).replace('__ANCHORS__', json.dumps({'type': 'FeatureCollection', 'features': anchors}))
                                             .replace('__CENTER__', json.dumps(list(centre))), encoding='utf-8')
    print(f'preview: {out / f"{name}-preview.html"}')


PREVIEW = """<!doctype html>
<html><head><meta charset="utf-8"><title>__TITLE__</title>
<link href="https://api.mapbox.com/mapbox-gl-js/v3.9.4/mapbox-gl.css" rel="stylesheet">
<script src="https://api.mapbox.com/mapbox-gl-js/v3.9.4/mapbox-gl.js"></script>
<style>html,body,#map{margin:0;height:100%}#panel{position:absolute;top:10px;left:10px;background:#fff;padding:8px 10px;font:13px sans-serif;border-radius:6px}</style>
</head><body><div id="map"></div>
<div id="panel"><b>__TITLE__</b><br><label><input type="range" id="opacity" min="0" max="1" step="0.05" value="1"> opacity</label>
<p style="margin:6px 0 0">Shift+drag the layer, or arrow keys (Shift: 10 m),<br>to align it with what you know of the site.</p>
<p id="offset" style="margin:4px 0 0;font-family:monospace">offset: 0.0 m E, 0.0 m N</p>
<p id="anchor" style="margin:2px 0 0;font-family:monospace"></p></div>
<script>
mapboxgl.accessToken = '__TOKEN__'
const map = new mapboxgl.Map({ container: 'map', style: 'mapbox://styles/mapbox/satellite-v9', center: __CENTER__, zoom: 17 })
const data = __DATA__
const anchorsData = __ANCHORS__
// Moving the layer: an offset in metres, applied to every coordinate (and the
// control point it implies, to paste back into the map's config).
let offset = [0, 0]
const metresPerDegree = (lat) => [111320 * Math.cos(lat * Math.PI / 180), 110540]
function shifted(geojson) {
  const move = (c) => typeof c[0] === 'number' ? [c[0] + offset[0] / metresPerDegree(c[1])[0], c[1] + offset[1] / metresPerDegree(c[1])[1]] : c.map(move)
  return { ...geojson, features: geojson.features.map((f) => ({ ...f, geometry: { ...f.geometry, coordinates: move(f.geometry.coordinates) } })) }
}
function refresh() {
  map.getSource('cave').setData(shifted(data))
  document.getElementById('offset').textContent = `offset: ${offset[0].toFixed(1)} m E, ${offset[1].toFixed(1)} m N`
  const a = anchorsData.features[0]?.geometry.coordinates
  if (a) {
    // The control point's map spot moved with the layer: its new position is
    // what to put in the config's controlPoints (latitude, longitude).
    const [mx, my] = metresPerDegree(a[1])
    document.getElementById('anchor').textContent = `control point now at: ${(a[1] + offset[1] / my).toFixed(6)}, ${(a[0] + offset[0] / mx).toFixed(6)}`
  }
}
map.on('load', () => {
  map.addSource('cave', { type: 'geojson', data })
  map.addSource('anchors', { type: 'geojson', data: anchorsData })
  map.addLayer({ id: 'walls', type: 'line', source: 'cave', filter: ['==', ['get', 'kind'], 'wall'], paint: { 'line-color': '#ffffff', 'line-width': 1.2, 'line-opacity': 0.9 } })
  map.addLayer({ id: 'survey', type: 'line', source: 'cave', filter: ['==', ['get', 'kind'], 'survey'], paint: { 'line-color': '#ffd400', 'line-width': 1, 'line-dasharray': [2, 1] } })
  map.addLayer({ id: 'entrances', type: 'circle', source: 'cave', filter: ['==', ['get', 'kind'], 'entrance'], paint: { 'circle-radius': 5, 'circle-color': '#9e9e9e', 'circle-stroke-color': '#ffffff', 'circle-stroke-width': 1.5 } })
  // Names as HTML markers: the satellite style has no fonts for map labels.
  const labels = []
  const showLabels = () => {
    labels.forEach((m) => m.remove())
    labels.length = 0
    for (const f of shifted(data).features.filter((f) => f.properties.kind === 'entrance')) {
      const el = document.createElement('div')
      el.textContent = f.properties.name
      el.style.cssText = 'font:11px sans-serif;color:#fff;text-shadow:0 0 3px #000,0 0 2px #000;white-space:nowrap;pointer-events:none'
      labels.push(new mapboxgl.Marker({ element: el, anchor: 'left', offset: [8, 0] }).setLngLat(f.geometry.coordinates).addTo(map))
    }
  }
  map.on('sourcedata', (e) => { if (e.sourceId === 'cave' && e.isSourceLoaded) showLabels() })
  map.addLayer({ id: 'anchors', type: 'circle', source: 'anchors', paint: { 'circle-radius': 6, 'circle-color': '#ff3b30', 'circle-stroke-color': '#fff', 'circle-stroke-width': 2 } })
  let dragFrom = null
  map.on('mousedown', (e) => {
    if (!e.originalEvent.shiftKey) return
    e.preventDefault()
    map.dragPan.disable()
    dragFrom = { lngLat: e.lngLat, offset: [...offset] }
  })
  map.on('mousemove', (e) => {
    if (!dragFrom) return
    const [mx, my] = metresPerDegree(e.lngLat.lat)
    offset = [dragFrom.offset[0] + (e.lngLat.lng - dragFrom.lngLat.lng) * mx, dragFrom.offset[1] + (e.lngLat.lat - dragFrom.lngLat.lat) * my]
    refresh()
  })
  map.on('mouseup', () => { dragFrom = null; map.dragPan.enable() })
  window.addEventListener('keydown', (e) => {
    const step = e.shiftKey ? 10 : 1
    const moves = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, step], ArrowDown: [0, -step] }
    if (!moves[e.key]) return
    e.preventDefault()
    offset = [offset[0] + moves[e.key][0], offset[1] + moves[e.key][1]]
    refresh()
  })
  refresh()
  document.getElementById('opacity').oninput = (e) => {
    const v = +e.target.value
    map.setPaintProperty('walls', 'line-opacity', v)
    map.setPaintProperty('survey', 'line-opacity', v)
  }
})
</script></body></html>
"""

if __name__ == '__main__':
    if len(sys.argv) != 3:
        sys.exit(__doc__)
    main(sys.argv[1], sys.argv[2])

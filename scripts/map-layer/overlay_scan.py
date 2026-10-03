"""Places a scanned cave map on the ground and writes a satellite preview to
check the placement (prototype, for the map layer pilot): the scan's ink
over satellite imagery, semi-transparent, with each control point's ground
position (red: a database position, with its source; orange: anything else -
a pond or road on the satellite, a guess) and its spot on the map (blue).

Placement: a similarity transform (scale, rotation, shift) fitted by least
squares through the config's control points (pixel -> UTM); points marked
"check": true are left out of the fit and only measured against it. Prints
each point's error in metres.

Writes <output>/<name>-overlay.png (the ink, transparent elsewhere) and
<output>/<name>-overlay.html (open it in a browser).

Usage: python scripts/map-layer/overlay_scan.py <config.json> <output folder>
Needs Pillow, numpy, pyproj.
"""
import base64
import io
import json
import math
import re
import sys
from pathlib import Path

import numpy
from PIL import Image
from pyproj import Transformer

ROOT = Path(__file__).resolve().parents[2]
Image.MAX_IMAGE_PIXELS = None
# WebGL textures: keep the overlay within what any GPU accepts.
MAX_SIDE = 4096
INK_LEVEL = 140
INK_COLOUR = (255, 214, 0)


def fit_similarity(pixels, metres):
    """Scale, rotation and shift from pixels (y down) to UTM metres."""
    rows, values = [], []
    for (x, y), (east, north) in zip(pixels, metres):
        X, Y = x, -y
        rows += [[X, -Y, 1, 0], [Y, X, 0, 1]]
        values += [east, north]
    a, b, tx, ty = numpy.linalg.lstsq(numpy.array(rows, float), numpy.array(values, float), rcond=None)[0]
    return lambda x, y: (a * x + b * y + tx, b * x - a * y + ty), math.hypot(a, b), math.degrees(math.atan2(b, a))


def raster_placement(config):
    """Pixels (y down) -> UTM metres for a scan or straightened photo:
    (place, metres per pixel, rotation in degrees).

    With a "scaleBar" ({"from": [x, y], "to": [x, y], "metres": m}) and
    "north": "up" (or {"angle": degrees clockwise from up, for a map whose
    north arrow isn't up}), the scale comes from the bar and the orientation
    from north, then the map is shifted onto the control points (their
    average: one is enough). Otherwise a similarity fit (scale, rotation, shift)
    through at least two control points. Points marked "check" are left out."""
    to_utm = Transformer.from_crs(4326, config['utmEpsg'], always_xy=True)
    fitted = [p for p in config['controlPoints'] if not p.get('check')]
    utm = [to_utm.transform(p['longitude'], p['latitude']) for p in fitted]
    north = config.get('north')
    if config.get('scaleBar') and (north == 'up' or isinstance(north, dict)):
        if not fitted:
            sys.exit('At least one control point (not marked "check") is needed.')
        (x0, y0), (x1, y1) = config['scaleBar']['from'], config['scaleBar']['to']
        scale = config['scaleBar']['metres'] / math.hypot(x1 - x0, y1 - y0)
        # North's direction in the image, in degrees clockwise from up: 0 for a
        # north-up map, 90 for one whose north arrow points right.
        angle = math.radians(north['angle'] if isinstance(north, dict) else 0)
        nx, ny = math.sin(angle), -math.cos(angle)
        ex, ey = math.cos(angle), math.sin(angle)

        def offset(x, y):
            return scale * (x * ex + y * ey), scale * (x * nx + y * ny)
        shift_e = sum(e - offset(*p['px'])[0] for p, (e, _) in zip(fitted, utm)) / len(fitted)
        shift_n = sum(n - offset(*p['px'])[1] for p, (_, n) in zip(fitted, utm)) / len(fitted)
        return (lambda x, y: (shift_e + offset(x, y)[0], shift_n + offset(x, y)[1])), scale, math.degrees(angle)
    if len(fitted) < 2:
        sys.exit('At least two control points (not marked "check") are needed, or a scale bar and "north": "up".')
    return fit_similarity([p['px'] for p in fitted], utm)


# Database sources, shortened for the red dots' labels.
SHORT_SOURCES = {'Open Caves': 'OC', 'Gerrard 2015': 'Gerrard', 'Google Maps': 'Google', 'diveseven.com': 'diveseven',
                 'Cave and Karst Studies': 'CKS', 'map': 'map'}


def database_positions(cave_ids):
    """{caveId: (lng, lat, short source, validity)} from the local Firestore
    emulator (FIRESTORE_EMULATOR_HOST, default 127.0.0.1:8080); empty when
    it isn't running - the labels then stay as the config names them."""
    import os
    import urllib.request
    base = f"http://{os.environ.get('FIRESTORE_EMULATOR_HOST', '127.0.0.1:8080')}/v1/projects/opencaves/databases/(default)/documents"

    def get(path):
        with urllib.request.urlopen(f'{base}/{path}', timeout=3) as response:
            return json.loads(response.read())['fields']
    found, sources = {}, {}
    try:
        for cave_id in cave_ids:
            fields = get(f'caves/{cave_id}')
            location = fields.get('location', {}).get('mapValue', {}).get('fields', {})
            if 'latitude' not in location:
                continue
            source = fields.get('source', {}).get('stringValue')
            if source and source not in sources:
                name = get(f'sources/{source}').get('name', {}).get('stringValue', '')
                sources[source] = SHORT_SOURCES.get(name, name)
            value = lambda f: next(iter(location[f].values()))  # noqa: E731
            found[cave_id] = (float(value('longitude')), float(value('latitude')), sources.get(source, '?'),
                              location.get('validity', {}).get('stringValue', ''))
    except OSError:
        pass
    return found


def main(config_path, output):
    config_path = Path(config_path)
    config = json.loads(config_path.read_text(encoding='utf-8'))
    name = config_path.stem
    out = Path(output)
    out.mkdir(parents=True, exist_ok=True)
    to_utm = Transformer.from_crs(4326, config['utmEpsg'], always_xy=True)
    to_lnglat = Transformer.from_crs(config['utmEpsg'], 4326, always_xy=True)

    points = config['controlPoints']
    place, scale, rotation = raster_placement(config)
    print(f"scale {scale:.4f} m/px, rotation {rotation:.1f} deg, from {len([p for p in points if not p.get('check')])} point(s)"
          + (' + scale bar, north up' if config.get('scaleBar') and config.get('north') else ''))
    markers = []
    database = database_positions({p['caveId'] for p in points if p.get('caveId')})
    for p in points:
        east, north = to_utm.transform(p['longitude'], p['latitude'])
        map_e, map_n = place(*p['px'])
        error = math.hypot(map_e - east, map_n - north)
        print(f"  {p['name']:14} {'check' if p.get('check') else 'fit  '} {error:6.1f} m")
        # A red dot on the database's own position shows that position's source.
        label = p['name']
        db = database.get(p.get('caveId'))
        on_database = bool(db) and math.hypot((db[0] - p['longitude']) * 111320 * math.cos(math.radians(p['latitude'])), (db[1] - p['latitude']) * 111320) < 1
        if on_database:
            label += f" [DB: {db[2]}{'' if db[3] in ('', 'valid') else ', ' + db[3]}]"
        markers.append({'name': label, 'db': on_database, 'gps': [p['longitude'], p['latitude']], 'map': list(to_lnglat.transform(map_e, map_n)), 'error': round(error, 1), 'check': bool(p.get('check'))})

    # The ink only, coloured, on transparency; scaled to fit a texture.
    image = Image.open(config_path.parent.joinpath(config['image']).resolve()).convert('L')
    width, height = image.size
    factor = min(1, MAX_SIDE / max(width, height))
    small = image.resize((round(width * factor), round(height * factor)), Image.LANCZOS)
    if config.get('scanInColour') or config.get('trace', {}).get('method') == 'survey-lines' and config.get('trace', {}).get('lineColours'):
        # A map drawn over imagery (a satellite screenshot): its own colours,
        # so the drawn lines can be told from the background they sit on.
        overlay = Image.open(config_path.parent.joinpath(config['image']).resolve()).convert('RGBA').resize(small.size, Image.LANCZOS)
    else:
        ink = numpy.asarray(small) < config.get('trace', {}).get('inkLevel', INK_LEVEL)
        rgba = numpy.zeros((*ink.shape, 4), numpy.uint8)
        rgba[ink] = (*INK_COLOUR, 255)
        overlay = Image.fromarray(rgba, 'RGBA')
    # Excluded boxes marked "otherPart": a part of the sheet placed by another
    # config - left out, or it would show there misplaced and untraced.
    pixels = numpy.asarray(overlay).copy()
    for item in config.get('exclude', []):
        if item.get('otherPart'):
            x0, y0, x1, y1 = (round(v * factor) for v in item['box'])
            pixels[max(0, y0):y1, max(0, x0):x1, 3] = 0
    overlay = Image.fromarray(pixels, 'RGBA')
    overlay.save(out / f'{name}-overlay.png')
    # Embedded in the page: opened from disk, it may not load a separate file.
    buffer = io.BytesIO()
    overlay.save(buffer, 'PNG', optimize=True)
    data_url = 'data:image/png;base64,' + base64.b64encode(buffer.getvalue()).decode()
    corners = [list(to_lnglat.transform(*place(x, y))) for x, y in ((0, 0), (width, 0), (width, height), (0, height))]

    env = {}
    for env_file in ('.env', '.env.local'):
        path = ROOT / env_file
        if path.exists():
            env.update(dict(re.findall(r'^\s*([A-Z0-9_]+)\s*=\s*"?([^"\n]*)"?', path.read_text(encoding='utf-8'), re.M)))
    centre = markers[0]['gps']
    # The traced walls (trace_scan.py), when there are some yet.
    walls_path = out / f'{name}-walls.geojson'
    walls = walls_path.read_text(encoding='utf-8') if walls_path.exists() else '{"type":"FeatureCollection","features":[]}'
    # The symbols (extract_symbols.py), when there are some yet.
    symbols_path = out / f'{name}-symbols.geojson'
    symbols = symbols_path.read_text(encoding='utf-8') if symbols_path.exists() else '{"type":"FeatureCollection","features":[]}'
    html = (PAGE.replace('__TOKEN__', env.get('VITE_MAPBOX_ACCESS_TOKEN', '')).replace('__TITLE__', config.get('title', name) + (' - UNVERIFIED placement' if config.get('unverified') else ''))
            .replace('__IMAGE__', data_url).replace('__CORNERS__', json.dumps(corners))
            .replace('__MARKERS__', json.dumps(markers)).replace('__CENTER__', json.dumps(centre)).replace('__WALLS__', walls).replace('__SYMBOLS__', symbols))
    (out / f'{name}-overlay.html').write_text(html, encoding='utf-8')
    print(f'preview: {out / f"{name}-overlay.html"}')


PAGE = """<!doctype html>
<html><head><meta charset="utf-8"><title>__TITLE__</title>
<link href="https://api.mapbox.com/mapbox-gl-js/v3.9.4/mapbox-gl.css" rel="stylesheet">
<script src="https://api.mapbox.com/mapbox-gl-js/v3.9.4/mapbox-gl.js"></script>
<style>html,body,#map{margin:0;height:100%}#panel{position:absolute;top:10px;left:10px;background:#fff;padding:8px 10px;font:13px sans-serif;border-radius:6px;max-width:300px}
.symbol{font:bold 11px sans-serif;color:#111;background:#ffd400;border-radius:3px;padding:0 3px;white-space:nowrap;cursor:default}
.label{font:11px sans-serif;color:#fff;text-shadow:0 0 3px #000,0 0 2px #000;white-space:nowrap;pointer-events:none}</style>
</head><body><div id="map"></div>
<div id="panel"><b id="title" title="Click to copy" style="cursor:pointer">__TITLE__</b><span id="copied" style="color:#2e7d32;margin-left:6px"></span><br><label><input type="range" id="opacity" min="0" max="1" step="0.05" value="0.35"> scan opacity</label><br><label><input type="checkbox" id="walls" checked> traced walls (white)</label><br><label><input type="checkbox" id="symbols" checked> symbols</label><br><label><input type="checkbox" id="entrances" checked> cenote entrances (blue dots)</label>
<p style="margin:6px 0 0"><span style="color:#ff3b30">&#9679;</span> database GPS &nbsp; <span style="color:#2f80ff">&#9632;</span> spot on the map<br>(fit points solid, check points hollow)</p></div>
<script>
// The title copied to the clipboard on a click (a review note's heading).
document.getElementById('title').addEventListener('click', () => {
  const text = document.getElementById('title').textContent
  const done = () => { const c = document.getElementById('copied'); c.textContent = 'copied'; setTimeout(() => { c.textContent = '' }, 1500) }
  const fallback = () => { const t = document.createElement('textarea'); t.value = text; document.body.appendChild(t); t.select(); document.execCommand('copy'); t.remove(); done() }
  if (navigator.clipboard) navigator.clipboard.writeText(text).then(done, fallback); else fallback()
})
</script>
<script>
mapboxgl.accessToken = '__TOKEN__'
const markers = __MARKERS__
const map = new mapboxgl.Map({ container: 'map', style: 'mapbox://styles/mapbox/satellite-v9', center: __CENTER__, zoom: 15.5 })
map.on('load', () => {
  map.addSource('scan', { type: 'image', url: '__IMAGE__', coordinates: __CORNERS__ })
  map.addLayer({ id: 'scan', type: 'raster', source: 'scan', paint: { 'raster-opacity': 0.35, 'raster-fade-duration': 0 } })
  // tolerance 0: simplified per tile, the detailed rings cross and fill as wedges.
  map.addSource('walls', { type: 'geojson', data: __WALLS__, tolerance: 0 })
  map.addLayer({ id: 'water', type: 'fill', source: 'walls', filter: ['==', ['get', 'kind'], 'water'], paint: { 'fill-color': '#9ec3d6', 'fill-opacity': 0.55 } })
  map.addLayer({ id: 'details', type: 'fill', source: 'walls', filter: ['==', ['get', 'kind'], 'detail'], paint: { 'fill-color': '#ffffff', 'fill-opacity': 0.9 } })
  map.addLayer({ id: 'walls', type: 'line', source: 'walls', filter: ['!', ['in', ['get', 'kind'], ['literal', ['detail', 'water', 'relief', 'slope', 'arianne', 'survey']]]], paint: { 'line-color': '#ffffff', 'line-width': 1.4 } })
  map.addLayer({ id: 'arianne', type: 'line', source: 'walls', filter: ['in', ['get', 'kind'], ['literal', ['arianne', 'survey']]], paint: { 'line-color': '#ffd400', 'line-width': 1.6 } })
  map.addLayer({ id: 'reliefs', type: 'line', source: 'walls', filter: ['in', ['get', 'kind'], ['literal', ['relief', 'slope']]], paint: { 'line-color': '#ffffff', 'line-width': 2 } })
  // Symbols: a short label per type, the value in metres where there's one.
  const SHORT = { 'restriction-minor': 'r', 'restriction-major': 'X', 'visibility-zero': 'z', 'silt': 's', 'depth': '↓', 'ceiling-height': '↕', 'penetration': 'p' }
  const symbolMarkers = []
  // Cenote entrances: their own layer, a dot like a cenote's on the map.
  map.addSource('entrance-dots', { type: 'geojson', data: { type: 'FeatureCollection', features: (__SYMBOLS__).features.filter((f) => f.properties.type === 'entrance') } })
  map.addLayer({ id: 'entrance-dots', type: 'circle', source: 'entrance-dots', paint: { 'circle-radius': 6, 'circle-color': '#1e88e5', 'circle-stroke-color': '#ffffff', 'circle-stroke-width': 2 } })
  document.getElementById('entrances').onchange = (e) => map.setLayoutProperty('entrance-dots', 'visibility', e.target.checked ? 'visible' : 'none')
  for (const f of (__SYMBOLS__).features) {
    const p = f.properties
    if (p.type === 'entrance') continue
    const el = document.createElement('div')
    el.className = 'symbol'
    // Flow arrows: the marker's own rotation (Mapbox sets the element's
    // transform to place it), the glyph pointing east at 0, aligned to the map.
    if (p.type === 'flow') el.style.background = '#4fc3f7'
    el.textContent = p.type === 'flow' ? '➜' : p.type === 'leads-to' ? `→ ${p.label}` : p.type === 'entrance' ? '●' : p.type === 'place-name' ? p.label : (SHORT[p.type] || p.type) + (p.value !== undefined ? ` ${p.value} m` : '')
    el.title = p.type + (p.value !== undefined ? ` ${p.value} m (map: ${p.label})` : '')
    symbolMarkers.push(new mapboxgl.Marker({ element: el, ...(p.type === 'flow' ? { rotation: p.bearing - 90, rotationAlignment: 'map' } : {}) }).setLngLat(f.geometry.coordinates).addTo(map))
  }
  document.getElementById('symbols').onchange = (e) => symbolMarkers.forEach((m) => { m.getElement().style.display = e.target.checked ? '' : 'none' })
  const points = (key) => ({ type: 'FeatureCollection', features: markers.map((m) => ({ type: 'Feature', properties: m, geometry: { type: 'Point', coordinates: m[key] } })) })
  map.addSource('gps', { type: 'geojson', data: points('gps') })
  map.addSource('spots', { type: 'geojson', data: points('map') })
  map.addSource('links', { type: 'geojson', data: { type: 'FeatureCollection', features: markers.map((m) => ({ type: 'Feature', geometry: { type: 'LineString', coordinates: [m.gps, m.map] } })) } })
  map.addLayer({ id: 'links', type: 'line', source: 'links', paint: { 'line-color': '#ffffff', 'line-width': 1, 'line-dasharray': [2, 2] } })
  map.addLayer({ id: 'spots', type: 'circle', source: 'spots', paint: { 'circle-radius': 5, 'circle-color': ['case', ['get', 'check'], 'rgba(0,0,0,0)', '#2f80ff'], 'circle-stroke-color': '#2f80ff', 'circle-stroke-width': 2 } })
  map.addLayer({ id: 'gps', type: 'circle', source: 'gps', paint: { 'circle-radius': 6, 'circle-color': ['case', ['get', 'check'], 'rgba(0,0,0,0)', ['get', 'db'], '#ff3b30', '#ff9500'], 'circle-stroke-color': ['case', ['get', 'db'], '#ff3b30', '#ff9500'], 'circle-stroke-width': 2.5 } })
  for (const m of markers) {
    const el = document.createElement('div')
    el.className = 'label'
    el.textContent = `${m.name} (${m.error} m${m.check ? ', check' : ''})`
    new mapboxgl.Marker({ element: el, anchor: 'left', offset: [9, 0] }).setLngLat(m.gps).addTo(map)
  }
  document.getElementById('walls').onchange = (e) => ['walls', 'details', 'water'].forEach((id) => map.setLayoutProperty(id, 'visibility', e.target.checked ? 'visible' : 'none'))
  document.getElementById('opacity').oninput = (e) => map.setPaintProperty('scan', 'raster-opacity', +e.target.value)
})
</script></body></html>
"""

if __name__ == '__main__':
    if len(sys.argv) != 3:
        sys.exit(__doc__)
    main(sys.argv[1], sys.argv[2])

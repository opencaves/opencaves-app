"""Writes a satellite map of found-cenotes.json for review: every cenote the
processed maps propose, coloured by what it would do in the database (new
cave, a position for a cave without one, a name for an unnamed cave, a
cenote-entrance flag), over the database's caves (grey). Click a dot for
its name, maps, accuracy and ids.

Usage: python scripts/map-layer/found_cenotes_map.py <output.html>
Reads found-cenotes.json and the local Firestore emulator (for the grey dots;
left out when it isn't running).
"""
import json
import re
import sys
import urllib.request
from pathlib import Path
from mapbox_token import mapbox_token  # noqa: E402

ROOT = Path(__file__).resolve().parents[2]
FOUND = Path(__file__).resolve().parent / 'found-cenotes.json'
DATABASE = 'http://127.0.0.1:8080/v1/projects/opencaves/databases/(default)/documents/caves'
ACTIONS = {
    'create': ('#ffd400', 'New cenote (not in the database)'),
    'position': ('#34c759', 'Position for a cave without one'),
    'fill': ('#af52de', 'Name for an unnamed cave'),
    'cenote-entrance': ('#0a84ff', 'Cave a map shows as an entrance (cenote-entrance flag to set)'),
}


def database_caves():
    """{caveId: (name, lng, lat)} of the database's positioned caves; {} without the emulator."""
    caves, token = {}, ''
    try:
        while True:
            url = f'{DATABASE}?pageSize=300&mask.fieldPaths=name&mask.fieldPaths=location' + (f'&pageToken={token}' if token else '')
            page = json.load(urllib.request.urlopen(urllib.request.Request(url, headers={'Authorization': 'Bearer owner'}), timeout=10))
            for doc in page.get('documents', []):
                fields = doc.get('fields', {})
                location = fields.get('location', {}).get('mapValue', {}).get('fields', {})
                if 'latitude' in location:
                    value = lambda f: float(next(iter(location[f].values())))  # noqa: E731
                    name = fields.get('name', {}).get('mapValue', {}).get('fields', {}).get('value', {}).get('stringValue', '')
                    caves[doc['name'].split('/')[-1]] = (name, value('longitude'), value('latitude'))
            token = page.get('nextPageToken')
            if not token:
                return caves
    except OSError:
        return {}


def main(output):
    entries = json.loads(FOUND.read_text(encoding='utf-8'))['entries']
    database = database_caves()
    # A cenote-entrance flag is for a cave already placed: drawn at its database position.
    for e in entries:
        if e.get('latitude') is None and e.get('caveId') in database:
            e['longitude'], e['latitude'] = database[e['caveId']][1:]
            e.setdefault('placement', 'database position')
    features = [{'type': 'Feature', 'geometry': {'type': 'Point', 'coordinates': [e['longitude'], e['latitude']]},
                 'properties': {'action': e.get('action'), 'name': e.get('name') or '(unnamed)', 'maps': ', '.join(e.get('maps', [])),
                                'accuracy': e.get('accuracy'), 'placement': e.get('placement', ''), 'caveId': e.get('caveId', '')}}
                for e in entries if e.get('latitude') is not None]
    known = [{'type': 'Feature', 'geometry': {'type': 'Point', 'coordinates': [lng, lat]}, 'properties': {'name': name}} for name, lng, lat in database.values()]
    env = {}
    for name in ('.env', '.env.local'):
        if (ROOT / name).exists():
            env.update(dict(re.findall(r'^\s*([A-Z0-9_]+)\s*=\s*"?([^"\n]*)"?', (ROOT / name).read_text(encoding='utf-8'), re.M)))
    counts = {a: sum(f['properties']['action'] == a for f in features) for a in ACTIONS}
    page = PAGE.replace('__TOKEN__', json.dumps(mapbox_token(env))).replace('__FOUND__', json.dumps({'type': 'FeatureCollection', 'features': features}))
    page = page.replace('__KNOWN__', json.dumps({'type': 'FeatureCollection', 'features': known})).replace('__ACTIONS__', json.dumps({a: [c, label, counts[a]] for a, (c, label) in ACTIONS.items()}))
    Path(output).write_text(page, encoding='utf-8')
    print(f'{len(features)} found cenotes, {len(known)} database caves -> {output}')


PAGE = '''<!doctype html><html><head><meta charset="utf-8"><title>Cenotes found on the maps</title>
<link href="https://api.mapbox.com/mapbox-gl-js/v3.9.4/mapbox-gl.css" rel="stylesheet">
<script src="https://api.mapbox.com/mapbox-gl-js/v3.9.4/mapbox-gl.js"></script>
<style>html,body,#map{margin:0;height:100%}#legend{position:absolute;top:10px;left:10px;background:#fff;padding:8px 10px;font:13px sans-serif;border-radius:6px}
#legend label{display:block;margin:2px 0}.dot{display:inline-block;width:10px;height:10px;border-radius:50%;margin-right:4px;border:1px solid #fff}</style>
</head><body><div id="map"></div><div id="legend"><b>Cenotes found on the maps</b></div><script>
mapboxgl.accessToken = __TOKEN__
const found = __FOUND__, known = __KNOWN__, actions = __ACTIONS__
const legend = document.getElementById('legend')
for (const [action, [colour, label, count]] of Object.entries(actions)) legend.insertAdjacentHTML('beforeend', `<label><input type="checkbox" checked data-layer="${action}"> <span class="dot" style="background:${colour}"></span>${label} (${count})</label>`)
legend.insertAdjacentHTML('beforeend', `<label><input type="checkbox" checked data-layer="known"> <span class="dot" style="background:#9e9e9e"></span>Database caves (${known.features.length})</label>`)
const map = new mapboxgl.Map({ container: 'map', style: 'mapbox://styles/mapbox/satellite-streets-v12', center: [-87.4, 20.35], zoom: 9 })
legend.addEventListener('change', (e) => map.setLayoutProperty(e.target.dataset.layer, 'visibility', e.target.checked ? 'visible' : 'none'))
map.on('load', () => {
  map.addSource('known', { type: 'geojson', data: known })
  map.addLayer({ id: 'known', type: 'circle', source: 'known', paint: { 'circle-radius': 3, 'circle-color': '#9e9e9e', 'circle-stroke-color': '#fff', 'circle-stroke-width': 0.5 } })
  map.addSource('found', { type: 'geojson', data: found })
  for (const [action, [colour]] of Object.entries(actions)) {
    map.addLayer({ id: action, type: 'circle', source: 'found', filter: ['==', ['get', 'action'], action], paint: { 'circle-radius': 6, 'circle-color': colour, 'circle-stroke-color': '#000', 'circle-stroke-width': 1 } })
    map.on('click', action, (e) => {
      const p = e.features[0].properties
      new mapboxgl.Popup().setLngLat(e.lngLat).setHTML(`<b>${p.name}</b><br>${actions[p.action][1]}<br>maps: ${p.maps}<br>${p.accuracy ? 'accuracy ~' + p.accuracy + ' m ' : ''}(${p.placement})${p.caveId ? '<br>cave ' + p.caveId : ''}`).addTo(map)
    })
    map.on('mouseenter', action, () => { map.getCanvas().style.cursor = 'pointer' })
    map.on('mouseleave', action, () => { map.getCanvas().style.cursor = '' })
  }
  map.on('click', 'known', (e) => new mapboxgl.Popup().setLngLat(e.lngLat).setHTML(`<b>${e.features[0].properties.name}</b><br>database cave`).addTo(map))
})
</script></body></html>'''

if __name__ == '__main__':
    if len(sys.argv) != 2:
        sys.exit(__doc__)
    main(sys.argv[1])

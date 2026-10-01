"""Finds the cenotes drawn on the processed maps, places them with each map's
placement, compares them with the Google Sheet (by name, then distance) and
writes an Excel file to review and paste from:

- "To add": cenotes missing from the sheet, in the sheet's columns (a new
  id each, area from the nearest cenote, sistema and source from the map).
  GPS valid is left empty: these positions come from maps, not GPS.
- "Fill unnamed rows": cenotes missing by name that may be one of the
  sheet's unnamed rows (a cenote known in a sistema, no name yet): the same
  columns, with that row's id - fill it in rather than add a row.
- "Positions for existing": cenotes already in the sheet without a
  position, with the one the map gives them.
- "Review": every cenote found, its status, the sheet's match and the
  distance - "matched, far" ones are worth a look (a wrong GPS, a road
  access point, or a different cenote of the same name).
- "Sources to add": a map's source that isn't in the sheet yet.

Cenotes come from the map's config "entrances" (curated: name, position on
the map, optional caveId) or, for a scan without such a list, from its OCR'd
labels ("CENOTE X", "X CENOTE"), placed at the label: less accurate.

Usage: python scripts/map-layer/cenote_candidates.py <output.xlsx> <config.json>...
Needs openpyxl, pyproj, plus what the map scripts need.
"""
import csv
import difflib
import io
import json
import math
import random
import re
import sys
import time
import urllib.request
from pathlib import Path

from openpyxl import Workbook
from openpyxl.styles import Font
from pyproj import Transformer

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / 'maps-import'))
from match_maps import normalize  # noqa: E402

from build_layer import vector_placement  # noqa: E402
from overlay_scan import fit_similarity  # noqa: E402

SHEET = 'https://docs.google.com/spreadsheets/d/1ylCUghFn4W_wNFAM9LnhFx-zDp4oVvWJ4RUh_mtDGwc/gviz/tq?tqx=out:csv&sheet='
# Position accuracy (metres) by how the cenote's spot on the map was found.
LABEL_ON_VECTOR = 15
LABEL_ON_SCAN = 75
# A sheet cenote of the same name this close is the same one; up to FAR_METRES
# it's the same but its position disagrees; beyond, a namesake elsewhere.
FAR_METRES = 2000
# A sheet cenote this close under another name may be the same one.
NEARBY_METRES = 30
# Two maps' candidates of the same name this close are one cenote.
SAME_CANDIDATE_METRES = 200
# Close spellings (e.g. "Grande" / "Grand") count as the same name when the
# sheet's cenote is also within FAR_METRES.
SIMILAR_NAME = 0.85
# Map notes, not cenote names: "P 4404 FROM GRAND CENOTE".
NOT_A_NAME = re.compile(r'^(from|to|desde|hacia)\b', re.I)
# Words that only describe the opening: not part of a cenote's name.
OPENING_WORDS = {'entrada', 'colapso', 'entrance'}
ENGLISH_WORDS = {'the', 'of', 'snake', 'bones', 'door', 'doors', 'road', 'well', 'blue', 'big', 'little', 'pit', 'house', 'garden', 'dome', 'swoop', 'wagon', 'wheel'}
PUSH_CHARS = '-0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ_abcdefghijklmnopqrstuvwxyz'
TO_ADD_COLUMNS = ['id', 'Cenote', 'AKA', 'Language Code (ISO-639-2)', 'Spanish', 'English', 'Area', 'Area ID', 'Original Sistema', 'Original Sistema ID',
                  'Latitude', 'Longitude', 'GPS valid', 'Source', 'Source ID', 'Publication status']


def push_id():
    """A Firebase push ID, as the sheet's other ids: time-ordered."""
    now = int(time.time() * 1000)
    stamp = ''
    for _ in range(8):
        stamp = PUSH_CHARS[now % 64] + stamp
        now //= 64
    return stamp + ''.join(random.choice(PUSH_CHARS) for _ in range(12))


def title_case(text):
    """OCR'd capitals as a name: 'LIL'S' -> 'Lil's' (str.title gives 'Lil'S')."""
    return re.sub(r"[A-Za-z]+('[A-Za-z]+)?", lambda m: m.group(0)[0].upper() + m.group(0)[1:].lower(), text)


def key(name):
    return ' '.join(w for w in normalize(name).split() if w not in OPENING_WORDS)


def read_sheet(tab):
    with urllib.request.urlopen(SHEET + urllib.parse.quote(tab)) as response:
        return list(csv.DictReader(io.StringIO(response.read().decode('utf-8'))))


def distance(a, b):
    """Metres between two (latitude, longitude) points."""
    lat1, lon1, lat2, lon2 = (math.radians(v) for v in (*a, *b))
    h = math.sin((lat2 - lat1) / 2) ** 2 + math.cos(lat1) * math.cos(lat2) * math.sin((lon2 - lon1) / 2) ** 2
    return 6371000 * 2 * math.asin(math.sqrt(h))


def scan_labels(config, words):
    """'CENOTE X' and 'X CENOTE' labels from OCR words, outside the map's
    excluded areas (titles, legends, cross-sections, inset maps)."""
    def excluded(x, y):
        return any(b[0] <= x <= b[2] and b[1] <= y <= b[3] for b in (e['box'] for e in config.get('exclude', [])))

    def centre(w):
        return ((w['box'][0] + w['box'][2]) / 2, (w['box'][1] + w['box'][3]) / 2)

    def line_neighbours(word, after):
        x0, y0, x1, y1 = word['box']
        cy = (y0 + y1) / 2
        same = [w for w in words if w is not word and abs(centre(w)[1] - cy) < 12 and sum(c.isalpha() for c in w['t']) >= 2]
        same = sorted([w for w in same if (w['box'][0] > x1 if after else w['box'][2] < x0)], key=lambda w: w['box'][0], reverse=not after)
        found, edge = [], (x1 if after else x0)
        for w in same:
            gap = w['box'][0] - edge if after else edge - w['box'][2]
            if gap > 60:
                break
            found.append(w)
            edge = w['box'][2] if after else w['box'][0]
        return found if after else found[::-1]

    labels = []
    for word in words:
        if re.sub(r'[^A-Za-z]', '', word['t']).upper() != 'CENOTE' or excluded(*centre(word)):
            continue
        after = line_neighbours(word, True)
        if not after:
            # "CENOTE" alone on its line: the name is on the next one, or before it.
            x0, y0, x1, y1 = word['box']
            below = [w for w in words if 0 < w['box'][1] - y1 < 30 and abs(centre(w)[0] - (x0 + x1) / 2) < 120 and sum(c.isalpha() for c in w['t']) >= 2]
            after = sorted(below, key=lambda w: w['box'][0])
        before = [] if after else line_neighbours(word, False)
        group = before + [word] + after
        name = ' '.join(re.sub(r'[^\w\'\-]', '', w['t']) for w in (after or before)).strip()
        if not name or NOT_A_NAME.match(name) or any(re.match(r'(?i)^(from|to)$', w['t']) for w in before[-1:]):
            continue
        x0 = min(w['box'][0] for w in group)
        y0 = min(w['box'][1] for w in group)
        x1 = max(w['box'][2] for w in group)
        y1 = max(w['box'][3] for w in group)
        labels.append({'name': title_case(name), 'px': [(x0 + x1) / 2, (y0 + y1) / 2]})
    return labels


def map_candidates(config_path, output_dir):
    """The map's cenotes: [{name, latitude, longitude, accuracy, caveId?}]."""
    config = json.loads(config_path.read_text(encoding='utf-8'))
    name = config_path.stem
    if config.get('pdf'):
        place, _, residuals = vector_placement(config)
        accuracy = LABEL_ON_VECTOR + (max(residuals) if len(residuals) > 1 else 0)
        found = [{**e, 'position': place(*e['pdf'])} for e in config.get('entrances', [])]
    else:
        to_utm = Transformer.from_crs(4326, config['utmEpsg'], always_xy=True)
        to_lnglat = Transformer.from_crs(config['utmEpsg'], 4326, always_xy=True)
        fitted = [p for p in config['controlPoints'] if not p.get('check')]
        utm = [to_utm.transform(p['longitude'], p['latitude']) for p in fitted]
        fit, _, _ = fit_similarity([p['px'] for p in fitted], utm)
        rms = math.sqrt(sum((fit(*p['px'])[0] - u[0]) ** 2 + (fit(*p['px'])[1] - u[1]) ** 2 for p, u in zip(fitted, utm)) / len(fitted))
        place = lambda x, y: to_lnglat.transform(*fit(x, y))  # noqa: E731
        if config.get('entrances'):
            accuracy = max(10, rms)
            found = [{**e, 'position': place(*e['px'])} for e in config['entrances']]
        else:
            words_path = output_dir / f'{name}-ocr-words.json'
            if not words_path.exists():
                sys.exit(f'{words_path} is missing: run trace_scan.py on {config_path} first (it OCRs the map).')
            accuracy = LABEL_ON_SCAN + rms
            found = [{**label, 'position': place(*label['px'])} for label in scan_labels(config, json.loads(words_path.read_text(encoding='utf-8')))]
    return config, [{'name': f['name'], 'caveId': f.get('caveId'), 'longitude': f['position'][0], 'latitude': f['position'][1], 'accuracy': round(accuracy),
                     'map': config.get('title', name)} for f in found]


def main(output, config_paths):
    cenotes = read_sheet('Cenotes')
    sources = {row['id'] for row in read_sheet('Sources')}
    located = [r for r in cenotes if r['Latitude'] and r['Longitude']]
    by_id = {r['id']: r for r in cenotes}
    by_key = {}
    for row in cenotes:
        for name in [row['Cenote'], row['Spanish'], row['English'], row['Mayan']] + re.split(r'[,;|]', row['AKA'] or ''):
            if name and key(name):
                by_key.setdefault(key(name), []).append(row)
    sistema_names = {r['Original Sistema ID']: r['Original Sistema'] for r in cenotes if r['Original Sistema ID']}

    unnamed = [r for r in cenotes if not r['Cenote'].strip()]
    # Sistemas merged into others ("Dos Ojos" -> "Sac Actun"): a map of a
    # sistema shows cenotes still filed under the ones merged into it.
    merged_into = {r['Sistema ID']: r['New name ID'] for r in read_sheet('Connections') if r['Sistema ID'] and r['New name ID']}

    def merged_family(sistema_id):
        def leads_to(sid, seen=()):
            while sid in merged_into and sid not in seen:
                seen += (sid,)
                sid = merged_into[sid]
                if sid == sistema_id:
                    return True
            return False
        return {sid for sid in merged_into if leads_to(sid)}
    claimed = set()
    review, to_add, fill, positions, new_sources, seen = [], [], [], [], {}, []
    for config_path in map(Path, config_paths):
        config, found = map_candidates(config_path, Path(output).parent)
        source = config.get('source') or {}
        if source and not source.get('id'):
            source['id'] = new_sources.setdefault(source['name'], {**source, 'id': push_id()})['id']
        for c in found:
            spot = (c['latitude'], c['longitude'])
            # Already found on another map: one cenote.
            same = next((s for s in seen if key(s['name']) == key(c['name']) and distance((s['latitude'], s['longitude']), spot) < SAME_CANDIDATE_METRES), None)
            if same:
                same['maps'].append(c['map'])
                continue
            c['maps'] = [c['map']]
            seen.append(c)

            matches = [by_id[c['caveId']]] if c.get('caveId') in by_id else by_key.get(key(c['name']), [])
            if not matches and key(c['name']):
                # A close spelling, nearby only: "Grande" is the Grand Cenote next to it.
                similar = [r for k, rows in by_key.items() if difflib.SequenceMatcher(None, key(c['name']), k).ratio() >= SIMILAR_NAME for r in rows]
                matches = [r for r in similar if r['Latitude'] and r['Longitude'] and distance(spot, (float(r['Latitude']), float(r['Longitude']))) <= FAR_METRES]
            with_gps = sorted(((distance(spot, (float(r['Latitude']), float(r['Longitude']))), r) for r in matches if r['Latitude'] and r['Longitude']), key=lambda t: t[0])
            without_gps = [r for r in matches if not (r['Latitude'] and r['Longitude'])]
            row = {'Map': c['map'], 'Name on the map': c['name'], 'Latitude': round(c['latitude'], 6), 'Longitude': round(c['longitude'], 6), 'Accuracy (m)': c['accuracy']}
            if with_gps and with_gps[0][0] <= FAR_METRES:
                d, match = with_gps[0]
                status = 'matched' if d <= max(100, 3 * c['accuracy']) else 'matched, far'
                row.update({'Status': status, 'Sheet id': match['id'], 'Sheet name': match['Cenote'], 'Sheet latitude': match['Latitude'], 'Sheet longitude': match['Longitude'], 'Distance (m)': round(d)})
            elif without_gps and (not with_gps or c.get('caveId')):
                match = without_gps[0]
                row.update({'Status': 'in sheet, no position', 'Sheet id': match['id'], 'Sheet name': match['Cenote']})
                positions.append({'id': match['id'], 'Cenote': match['Cenote'], 'Latitude': row['Latitude'], 'Longitude': row['Longitude'], 'Accuracy (m)': c['accuracy'], 'From map': c['map']})
            else:
                nearby = min(((distance(spot, (float(r['Latitude']), float(r['Longitude']))), r) for r in located), key=lambda t: t[0])
                note = f"namesake {with_gps[0][1]['Cenote']} is {with_gps[0][0] / 1000:.1f} km away" if with_gps else ''
                if nearby[0] <= NEARBY_METRES:
                    note = f"{note}; " if note else ''
                    note += f"{nearby[1]['Cenote']} is {nearby[0]:.0f} m away: the same cenote under another name?"
                row.update({'Status': 'to add', 'Note': note})
                area = nearby[1]
                words = set(normalize(c['name']).split())
                english = bool(words & ENGLISH_WORDS) or "'s" in c['name'].lower()
                sistema_id = config.get('sistemaId', '')
                new = {'id': push_id(), 'Cenote': c['name'], 'AKA': '', 'Language Code (ISO-639-2)': 'English' if english else 'Spanish',
                       'Spanish': '' if english else c['name'], 'English': c['name'] if english else '', 'Area': area['Area'], 'Area ID': area['Area ID'],
                       'Original Sistema': sistema_names.get(sistema_id, ''), 'Original Sistema ID': sistema_id,
                       'Latitude': row['Latitude'], 'Longitude': row['Longitude'], 'GPS valid': '', 'Source': source.get('name', ''), 'Source ID': source.get('id', ''),
                       'Publication status': 'public'}
                # The sheet's unnamed rows are cenotes known to exist in a sistema,
                # without a name yet: a new one may be one of them - fill it in
                # rather than add another. One with a position nearby first; else
                # one of the same sistema, in the same area if possible.
                pool = [r for r in unnamed if r['id'] not in claimed]
                near = [(distance(spot, (float(r['Latitude']), float(r['Longitude']))), r) for r in pool if r['Latitude'] and r['Longitude']]
                near = [r for d, r in sorted(near, key=lambda t: t[0]) if d <= max(100, 3 * c['accuracy'])]
                same_sistema = [r for r in pool if sistema_id and r['Original Sistema ID'] == sistema_id and not (r['Latitude'] and r['Longitude'])]
                same_sistema.sort(key=lambda r: r['Area ID'] != area['Area ID'])
                # Merged sistemas span other areas: only their rows of this area.
                family = merged_family(sistema_id) if sistema_id else set()
                merged = [r for r in pool if r['Original Sistema ID'] in family and r['Area ID'] and r['Area ID'] == area['Area ID'] and not (r['Latitude'] and r['Longitude'])]
                slot = (near or same_sistema or merged or [None])[0]
                if slot:
                    claimed.add(slot['id'])
                    others = sum(1 for r in unnamed if r['Original Sistema ID'] == slot['Original Sistema ID'] and r['Area ID'] == slot['Area ID'])
                    fill.append({**new, 'id': slot['id'], 'Area': slot['Area'] or new['Area'], 'Area ID': slot['Area ID'] or new['Area ID'],
                                 'Source': slot['Source'] or new['Source'], 'Source ID': slot['Source ID'] or new['Source ID'],
                                 'Original Sistema': slot['Original Sistema'], 'Original Sistema ID': slot['Original Sistema ID'] or sistema_id,
                                 'Unnamed rows in this sistema': others})
                    row.update({'Status': 'fill unnamed row', 'Sheet id': slot['id'],
                                'Note': '; '.join(filter(None, [note, f"one of the {others} unnamed {slot['Original Sistema']} rows in {slot['Area'] or 'no area'} (interchangeable)" if not near else 'unnamed row with a position nearby']))})
                else:
                    to_add.append(new)
            review.append(row)

    workbook = Workbook()
    def sheet(title, columns, rows, first=False):
        ws = workbook.active if first else workbook.create_sheet()
        ws.title = title
        ws.append(columns)
        for cell in ws[1]:
            cell.font = Font(bold=True)
        for r in rows:
            ws.append([r.get(col, '') for col in columns])
        ws.freeze_panes = 'A2'
        for i, col in enumerate(columns, 1):
            width = max([len(str(col))] + [len(str(r.get(col, ''))) for r in rows])
            ws.column_dimensions[ws.cell(1, i).column_letter].width = min(60, width + 2)
    sheet('To add', TO_ADD_COLUMNS, to_add, first=True)
    sheet('Fill unnamed rows', TO_ADD_COLUMNS + ['Unnamed rows in this sistema'], fill)
    sheet('Positions for existing', ['id', 'Cenote', 'Latitude', 'Longitude', 'Accuracy (m)', 'From map'], positions)
    sheet('Review', ['Status', 'Map', 'Name on the map', 'Latitude', 'Longitude', 'Accuracy (m)', 'Sheet id', 'Sheet name', 'Sheet latitude', 'Sheet longitude', 'Distance (m)', 'Note'], review)
    if new_sources:
        sheet('Sources to add', ['id', 'Source', 'Description', 'Link', 'Note'], [{'id': s['id'], 'Source': s['name'], 'Description': s.get('description', ''), 'Note': s.get('note', '')} for s in new_sources.values()])
    Path(output).parent.mkdir(parents=True, exist_ok=True)
    workbook.save(output)

    counts = {}
    for r in review:
        counts[r['Status']] = counts.get(r['Status'], 0) + 1
    print(f"{len(to_add)} to add, {len(fill)} to fill unnamed rows with; {len(review)} cenotes on {len(config_paths)} maps: {', '.join(f'{n} {s}' for s, n in counts.items())} -> {output}")


if __name__ == '__main__':
    if len(sys.argv) < 3:
        sys.exit(__doc__)
    main(sys.argv[1], sys.argv[2:])

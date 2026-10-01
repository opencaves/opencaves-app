"""Finds the cenotes drawn on the processed maps, places them with each map's
placement and compares them with the database (Firestore: the caves, by name
then distance). What the database lacks is kept aside in found-cenotes.json,
next to this script, for a later import straight into the database:

- "create": a cenote missing from the database (name, language, sistema,
  area, position and its accuracy, source, the maps it's on);
- "fill": a missing cenote that may be one of the database's unnamed caves
  (a cave known in a sistema without a name, or named by its coordinates):
  that cave gets the name and position rather than a new one being created;
- "position": a cave in the database without a position, with the one the
  map gives it.

The file accumulates map after map: entries keep their id, entries from
maps not processed in this run are kept, and an entry the database now has
(added meanwhile) is dropped. Positions from maps are never GPS: the import
must not mark them valid.

Also writes an Excel file to review everything found (every cenote, its
status, the database's match and the distance) at the given path.

Cenotes come from the map's config "entrances" (curated: name, spot on the
map, optional caveId, and "replacePosition": a reason, when the cave's
database position is doubtful and the map's should replace it) or, for a scan without such a list, from its OCR'd
labels ("CENOTE X", "X CENOTE"), placed at the label: much less accurate.

Usage: python scripts/map-layer/cenote_candidates.py <review.xlsx> <config.json>... [--production]
Reads the local Firestore emulator by default; --production reads the real
project (publicly readable: no login).
Needs openpyxl, pyproj, plus what the map scripts need.
"""
import difflib
import json
import math
import random
import re
import sys
import time
from pathlib import Path

from openpyxl import Workbook
from openpyxl.styles import Font
from pyproj import Transformer

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / 'maps-import'))
from match_maps import fetch_collection, normalize  # noqa: E402

from build_layer import vector_placement  # noqa: E402
from overlay_scan import raster_placement  # noqa: E402

FOUND_FILE = Path(__file__).resolve().parent / 'found-cenotes.json'
# Position accuracy (metres) by how the cenote's spot on the map was found.
LABEL_ON_VECTOR = 15
LABEL_ON_SCAN = 75
# A curated entrance placed at its label rather than its opening.
LABEL_ON_RASTER = 40
# A database cave of the same name up to FAR_METRES away is the same cenote
# (beyond 3x the accuracy, its position disagrees: "matched, far"); further
# away, a namesake elsewhere.
FAR_METRES = 2000
# A database cave this close under another name may be the same one.
NEARBY_METRES = 30
# Two maps' cenotes of the same name this close are one cenote.
SAME_CANDIDATE_METRES = 200
# Close spellings (e.g. "Grande" / "Grand") count as the same name when the
# database's cave is also within FAR_METRES.
SIMILAR_NAME = 0.85
# Map notes, not cenote names: "P 4404 FROM GRAND CENOTE".
NOT_A_NAME = re.compile(r'^(from|to|desde|hacia)\b', re.I)
# A cave "named" by its coordinates ("20.265736, -87.409042") has no name.
COORDINATES_NAME = re.compile(r'^\s*-?\d+\.\d+\s*,\s*-?\d+\.\d+\s*$')
# Words that only describe the opening: not part of a cenote's name.
OPENING_WORDS = {'entrada', 'colapso', 'entrance'}
ENGLISH_WORDS = {'the', 'of', 'snake', 'bones', 'door', 'doors', 'road', 'well', 'blue', 'big', 'little', 'pit', 'house', 'garden', 'dome', 'swoop', 'wagon', 'wheel'}
PUSH_CHARS = '-0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ_abcdefghijklmnopqrstuvwxyz'


def push_id():
    """A Firebase push ID, like the database's other ids: time-ordered."""
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


def distance(a, b):
    """Metres between two (latitude, longitude) points."""
    lat1, lon1, lat2, lon2 = (math.radians(v) for v in (*a, *b))
    h = math.sin((lat2 - lat1) / 2) ** 2 + math.cos(lat1) * math.cos(lat2) * math.sin((lon2 - lon1) / 2) ** 2
    return 6371000 * 2 * math.asin(math.sqrt(h))


def cave_name(cave):
    name = cave.get('name')
    value = (name or {}).get('value', '') if isinstance(name, dict) else (name or '')
    return '' if COORDINATES_NAME.match(value or '') else (value or '')


def cave_names(cave):
    """Every name a cave goes by: its name, translations and aliases."""
    names = [cave_name(cave)] + list(cave.get('aka') or [])
    for translations in (cave.get('nameTranslations') or {}).values():
        names += translations if isinstance(translations, list) else [translations]
    return [n for n in names if n]


def cave_position(cave):
    location = cave.get('location') or {}
    if location.get('latitude') is None or location.get('longitude') is None:
        return None
    return float(location['latitude']), float(location['longitude'])


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
        if not name or NOT_A_NAME.match(name):
            continue
        x0 = min(w['box'][0] for w in group)
        y0 = min(w['box'][1] for w in group)
        x1 = max(w['box'][2] for w in group)
        y1 = max(w['box'][3] for w in group)
        labels.append({'name': title_case(name), 'px': [(x0 + x1) / 2, (y0 + y1) / 2]})
    return labels


def map_candidates(config_path, output_dir):
    """The map's cenotes: [{name, latitude, longitude, accuracy, placement, caveId?}]."""
    config = json.loads(config_path.read_text(encoding='utf-8'))
    name = config_path.stem
    if config.get('pdf'):
        place, _, residuals = vector_placement(config)
        accuracy = LABEL_ON_VECTOR + (max(residuals) if len(residuals) > 1 else 0)
        found = [{**e, 'position': place(*e['pdf']), 'placement': 'label'} for e in config.get('entrances', [])]
    else:
        to_utm = Transformer.from_crs(4326, config['utmEpsg'], always_xy=True)
        to_lnglat = Transformer.from_crs(config['utmEpsg'], 4326, always_xy=True)
        fitted = [p for p in config['controlPoints'] if not p.get('check')]
        utm = [to_utm.transform(p['longitude'], p['latitude']) for p in fitted]
        fit, _, _ = raster_placement(config)
        rms = math.sqrt(sum((fit(*p['px'])[0] - u[0]) ** 2 + (fit(*p['px'])[1] - u[1]) ** 2 for p, u in zip(fitted, utm)) / len(fitted))
        place = lambda x, y: to_lnglat.transform(*fit(x, y))  # noqa: E731
        if config.get('entrances'):
            accuracy = max(10, rms)
            # An entrance placed at its label ("atLabel": true) is less exact.
            found = [{**e, 'position': place(*e['px']), 'placement': 'label' if e.get('atLabel') else 'opening'} for e in config['entrances']]
        else:
            words_path = output_dir / f'{name}-ocr-words.json'
            if not words_path.exists():
                sys.exit(f'{words_path} is missing: run trace_scan.py on {config_path} first (it OCRs the map).')
            accuracy = LABEL_ON_SCAN + rms
            found = [{**label, 'position': place(*label['px']), 'placement': 'label'} for label in scan_labels(config, json.loads(words_path.read_text(encoding='utf-8')))]
    return config, [{'name': f['name'], 'caveId': f.get('caveId'), 'longitude': f['position'][0], 'latitude': f['position'][1],
                     'accuracy': round(max(accuracy, LABEL_ON_RASTER) if f.get('atLabel') else accuracy),
                     'placement': f['placement'], 'map': config.get('title', name), 'replacePosition': f.get('replacePosition')} for f in found]


def main(review_path, config_paths, production):
    caves = fetch_collection('caves', production)
    sistemas = {s['id']: s for s in fetch_collection('sistemas', production)}
    parents = {c['sistemaId']: c['parentSistemaId'] for c in fetch_collection('connections', production) if c.get('sistemaId') and c.get('parentSistemaId')}
    by_id = {c['id']: c for c in caves}
    by_key = {}
    for cave in caves:
        for name in cave_names(cave):
            if key(name):
                by_key.setdefault(key(name), []).append(cave)
    located = [c for c in caves if cave_position(c)]
    unnamed = [c for c in caves if not cave_name(c)]

    def merged_into(sistema_id):
        """Sistemas merged, directly or not, into this one ("Dos Ojos" -> "Sac Actun")."""
        def leads_to(sid, seen=()):
            while sid in parents and sid not in seen:
                seen += (sid,)
                sid = parents[sid]
                if sid == sistema_id:
                    return True
            return False
        return {sid for sid in parents if leads_to(sid)}

    previous = json.loads(FOUND_FILE.read_text(encoding='utf-8')) if FOUND_FILE.exists() else {'entries': []}
    claimed, review, entries, seen, titles = set(), [], [], [], []
    for config_path in map(Path, config_paths):
        config, found = map_candidates(config_path, Path(review_path).parent)
        titles.append(config.get('title', config_path.stem))
        sistema_id = config.get('sistemaId', '')
        source_id = (config.get('source') or {}).get('id', '')
        for c in found:
            spot = (c['latitude'], c['longitude'])
            # Already found on another map of this run: one cenote.
            same = next((s for s in seen if key(s['name']) == key(c['name']) and distance((s['latitude'], s['longitude']), spot) < SAME_CANDIDATE_METRES), None)
            if same:
                same['maps'].append(c['map'])
                continue
            c['maps'] = [c['map']]
            seen.append(c)

            matches = [by_id[c['caveId']]] if c.get('caveId') in by_id else by_key.get(key(c['name']), [])
            if not matches and key(c['name']):
                # A close spelling, nearby only: "Grande" is the Grand Cenote next to it.
                similar = [cave for k, group in by_key.items() if difflib.SequenceMatcher(None, key(c['name']), k).ratio() >= SIMILAR_NAME for cave in group]
                matches = [cave for cave in similar if cave_position(cave) and distance(spot, cave_position(cave)) <= FAR_METRES]
            # An entrance marked "replacePosition" (its cave's database position
            # is doubtful): compared as a cave without a position, so the map's
            # is kept aside to replace it.
            doubtful = c.get('replacePosition') and c.get('caveId')
            with_position = [] if doubtful else sorted(((distance(spot, cave_position(m)), m) for m in matches if cave_position(m)), key=lambda t: t[0])
            without_position = matches if doubtful else [m for m in matches if not cave_position(m)]
            row = {'Map': c['map'], 'Name on the map': c['name'], 'Latitude': round(c['latitude'], 6), 'Longitude': round(c['longitude'], 6),
                   'Accuracy (m)': c['accuracy'], 'Placed at': c['placement']}
            base = {'name': c['name'], 'latitude': row['Latitude'], 'longitude': row['Longitude'], 'accuracy': c['accuracy'],
                    'placement': c['placement'], 'sourceId': source_id, 'maps': c['maps']}
            if with_position and with_position[0][0] <= FAR_METRES:
                d, match = with_position[0]
                row.update({'Status': 'matched' if d <= max(100, 3 * c['accuracy']) else 'matched, far', 'Database id': match['id'],
                            'Database name': cave_name(match), 'Distance (m)': round(d)})
            elif without_position and (not with_position or c.get('caveId')):
                match = without_position[0]
                row.update({'Status': 'position to replace' if doubtful else 'in database, no position', 'Database id': match['id'], 'Database name': cave_name(match)})
                if doubtful:
                    row['Note'] = c['replacePosition']
                entries.append({**base, 'action': 'position', 'caveId': match['id'], 'name': cave_name(match),
                                **({'replaces': cave_position(match), 'why': c['replacePosition']} if doubtful else {})})
            else:
                nearest = min(((distance(spot, cave_position(m)), m) for m in located), key=lambda t: t[0])
                notes = [f"namesake {cave_name(with_position[0][1])} is {with_position[0][0] / 1000:.1f} km away"] if with_position else []
                if nearest[0] <= NEARBY_METRES and cave_name(nearest[1]):
                    notes.append(f"{cave_name(nearest[1])} is {nearest[0]:.0f} m away: the same cenote under another name?")
                words = set(normalize(c['name']).split())
                english = bool(words & ENGLISH_WORDS) or "'s" in c['name'].lower()
                new = {**base, 'languageCode': 'eng' if english else 'spa', 'sistemaId': sistema_id,
                       'sistemaName': (sistemas.get(sistema_id) or {}).get('name', ''), 'area': nearest[1].get('area', '')}
                # An unnamed cave may be this one: one with a position nearby
                # first; else one of the same sistema (in the same area if
                # possible); else one of a sistema merged into it, in this area.
                pool = [u for u in unnamed if u['id'] not in claimed]
                near = [u for d, u in sorted(((distance(spot, cave_position(u)), u) for u in pool if cave_position(u)), key=lambda t: t[0]) if d <= max(100, 3 * c['accuracy'])]
                own = sorted([u for u in pool if sistema_id and u.get('sistemaId') == sistema_id and not cave_position(u)], key=lambda u: u.get('area') != new['area'])
                family = merged_into(sistema_id) if sistema_id else set()
                merged = [u for u in pool if u.get('sistemaId') in family and u.get('area') and u.get('area') == new['area'] and not cave_position(u)]
                slot = (near or own or merged or [None])[0]
                if slot:
                    claimed.add(slot['id'])
                    group = sum(1 for u in unnamed if u.get('sistemaId') == slot.get('sistemaId') and u.get('area') == slot.get('area'))
                    notes.append('unnamed cave with a position nearby' if near else
                                 f"one of the {group} unnamed {(sistemas.get(slot.get('sistemaId')) or {}).get('name', '?')} caves in {slot.get('area') or 'no area'} (interchangeable)")
                    row.update({'Status': 'fill unnamed cave', 'Database id': slot['id']})
                    entries.append({**new, 'action': 'fill', 'caveId': slot['id'], 'sistemaId': slot.get('sistemaId') or sistema_id, 'area': slot.get('area') or new['area']})
                else:
                    row['Status'] = 'new'
                    entries.append({**new, 'action': 'create'})
                row['Note'] = '; '.join(notes)
            review.append(row)

    # Accumulate: keep the entries from maps not in this run; keep known ids.
    def entry_key(e):
        return (e['action'], e.get('caveId') or key(e['name']))
    known_ids = {entry_key(e): e.get('id') for e in previous['entries']}
    for entry in entries:
        entry['id'] = known_ids.get(entry_key(entry)) or (push_id() if entry['action'] == 'create' else entry['caveId'])
    others = [e for e in previous['entries'] if not set(e['maps']) & set(titles)]
    kept = others + [e for e in entries if entry_key(e) not in {entry_key(o) for o in others}]
    FOUND_FILE.write_text(json.dumps({'note': 'Cenotes found on the cave maps, kept aside for a direct database import (see cenote_candidates.py). '
                                              'Positions come from maps: never mark them as GPS.',
                                      'entries': kept}, indent=1, ensure_ascii=False) + '\n', encoding='utf-8')

    workbook = Workbook()

    def sheet(title, columns, rows, first=False):
        ws = workbook.active if first else workbook.create_sheet()
        ws.title = title
        ws.append(columns)
        for cell in ws[1]:
            cell.font = Font(bold=True)
        for r in rows:
            ws.append([', '.join(r[col]) if isinstance(r.get(col), list) else r.get(col, '') for col in columns])
        ws.freeze_panes = 'A2'
        for i, col in enumerate(columns, 1):
            width = max([len(str(col))] + [len(str(', '.join(r[col]) if isinstance(r.get(col), list) else r.get(col, ''))) for r in rows])
            ws.column_dimensions[ws.cell(1, i).column_letter].width = min(60, width + 2)
    sheet('Kept aside', ['action', 'id', 'caveId', 'name', 'languageCode', 'sistemaName', 'sistemaId', 'area', 'latitude', 'longitude',
                         'accuracy', 'placement', 'sourceId', 'maps'], kept, first=True)
    sheet('Review', ['Status', 'Map', 'Name on the map', 'Latitude', 'Longitude', 'Accuracy (m)', 'Placed at', 'Database id', 'Database name',
                     'Distance (m)', 'Note'], review)
    Path(review_path).parent.mkdir(parents=True, exist_ok=True)
    workbook.save(review_path)

    counts, actions = {}, {}
    for r in review:
        counts[r['Status']] = counts.get(r['Status'], 0) + 1
    for e in kept:
        actions[e['action']] = actions.get(e['action'], 0) + 1
    print(f"{len(review)} cenotes on {len(config_paths)} maps ({'production' if production else 'local emulator'}): "
          f"{', '.join(f'{n} {s}' for s, n in counts.items())}")
    print(f"kept aside in {FOUND_FILE.name}: {', '.join(f'{n} {a}' for a, n in actions.items()) or 'nothing'}; review -> {review_path}")


if __name__ == '__main__':
    args = [a for a in sys.argv[1:] if a != '--production']
    if len(args) < 2:
        sys.exit(__doc__)
    main(args[0], args[1:], '--production' in sys.argv[1:])

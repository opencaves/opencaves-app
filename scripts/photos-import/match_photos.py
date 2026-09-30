"""Matches each photo in extracted.csv (from extract_photos.py) to a cave in
the database, by the name of the folder it was filed in, and writes
matched.csv. Photos belong to caves (cavesAssets.caveId), not sistemas.

Names are compared as the map import does (match_maps.py): ignoring accents,
punctuation and generic words; an exact match wins, else the closest name
above a threshold is suggested, to confirm.

GPS cross-check: a photo whose EXIF position is over FAR_KM from its cave is
flagged "far from cave" (only flagged: the cave's own position may be off).
A photo filed in several cave folders goes to the one nearest its position;
without a position, all of them are listed for review, and the upload skips
it until only one is left.

Usage: python scripts/photos-import/match_photos.py <photos-import folder> [--production]
Reads the local Firestore emulator (127.0.0.1:8080) by default; --production
reads the real project (caves are publicly readable: no login).
"""
import csv
import difflib
import math
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / 'maps-import'))
from match_maps import SUGGEST_THRESHOLD, fetch_collection, name_candidates, normalize  # noqa: E402

FAR_KM = 1.0
# Folders whose name is spelled too differently from their cave's to match:
# folder -> the cave's name.
FOLDER_CAVES = {
    'Cenote Minotoro': 'Minotauro',
}


def distance_km(a, b):
    """Great-circle distance between two (latitude, longitude) points."""
    lat1, lon1, lat2, lon2 = (math.radians(v) for v in (*a, *b))
    h = math.sin((lat2 - lat1) / 2) ** 2 + math.cos(lat1) * math.cos(lat2) * math.sin((lon2 - lon1) / 2) ** 2
    return 6371 * 2 * math.asin(math.sqrt(h))


def cave_name(cave):
    name = cave.get('name')
    return (name or {}).get('value', '') if isinstance(name, dict) else (name or '')


def cave_position(cave):
    location = cave.get('location') or {}
    if location.get('latitude') is None or location.get('longitude') is None:
        return None
    return float(location['latitude']), float(location['longitude'])


def main(folder, production):
    folder = Path(folder)
    rows = list(csv.DictReader(open(folder / 'extracted.csv', encoding='utf-8-sig')))
    caves = fetch_collection('caves', production)

    # name -> every cave with that name or alias ("Escondido" is two caves).
    index = {}
    for cave in caves:
        for name in [cave_name(cave)] + list(cave.get('aka') or []):
            if name and normalize(name) and cave not in index.get(normalize(name), []):
                index.setdefault(normalize(name), []).append(cave)
    names = list(index)
    loose_keys = {key: normalize(key, loose=True) for key in names}

    # Each folder's photo positions: they decide between caves sharing a name.
    folder_positions = {}
    for row in rows:
        if row.get('latitude'):
            for name in [row['folder']] + [f for f in (row.get('alsoFiledIn') or '').split(' | ') if f]:
                folder_positions.setdefault(name, []).append((float(row['latitude']), float(row['longitude'])))

    def pick(name, homonyms, how):
        """One cave among those sharing a name: the nearest to the folder's
        photos (their median position), else none - ambiguous."""
        if len(homonyms) == 1:
            return homonyms[0], how
        positions = folder_positions.get(name, [])
        located = [c for c in homonyms if cave_position(c)]
        if not positions or not located:
            return None, f'ambiguous: {len(homonyms)} caves named so'
        median = (sorted(p[0] for p in positions)[len(positions) // 2], sorted(p[1] for p in positions)[len(positions) // 2])
        return min(located, key=lambda c: distance_km(median, cave_position(c))), f'{how}, nearest of {len(homonyms)} caves named so'

    def match_folder(name):
        """(cave, how) or (None, why not)."""
        if name in FOLDER_CAVES:
            key = normalize(FOLDER_CAVES[name])
            return pick(name, index[key], 'set in FOLDER_CAVES') if key in index else (None, f'FOLDER_CAVES: no cave "{FOLDER_CAVES[name]}"')
        candidates = name_candidates(name)
        for candidate in candidates:
            if normalize(candidate) in index:
                return pick(name, index[normalize(candidate)], 'exact' if candidate == name else f'exact ("{candidate}")')
        best = (0, None, None)
        for candidate in candidates:
            loose = normalize(candidate, loose=True)
            if len(loose.replace(' ', '')) < 3:
                continue
            for key in names:
                if len(loose_keys[key].replace(' ', '')) < 3:
                    continue
                ratio = difflib.SequenceMatcher(None, loose, loose_keys[key]).ratio()
                if ratio > best[0]:
                    best = (ratio, key, candidate)
        if best[0] >= SUGGEST_THRESHOLD:
            return pick(name, index[best[1]], f'similar ({best[0]:.2f}, "{best[2]}")')
        return None, 'none'

    folder_matches = {}
    for row in rows:
        if row.get('kind') == 'error':
            continue
        filed = [row['folder']] + [f for f in (row.get('alsoFiledIn') or '').split(' | ') if f]
        found, details = [], []
        for name in filed:
            if name not in folder_matches:
                folder_matches[name] = match_folder(name)
            cave, how = folder_matches[name]
            details.append(f'{name}: ' + (f'"{cave_name(cave)}" ({how})' if cave else how))
            if cave and cave['id'] not in [c['id'] for c, _ in found]:
                found.append((cave, how))
        row['matchDetails'] = ' | '.join(details)

        position = (float(row['latitude']), float(row['longitude'])) if row.get('latitude') else None
        distances = {c['id']: distance_km(position, cave_position(c)) for c, _ in found if position and cave_position(c)}
        # Filed under several caves: the nearest one, when the photo has a position.
        if len(found) > 1 and len(distances) == len(found):
            found = [min(found, key=lambda match: distances[match[0]['id']])]

        flags = [f for f in (row.get('flags') or '').split(' | ') if f]
        row['caveIds'] = ' | '.join(c['id'] for c, _ in found)
        row['caveNames'] = ' | '.join(cave_name(c) for c, _ in found)
        row['matchHow'] = 'none' if not found else ('several caves' if len(found) > 1 else found[0][1])
        if len(found) == 1 and found[0][0]['id'] in distances:
            km = distances[found[0][0]['id']]
            row['distanceKm'] = f'{km:.2f}'
            if km > FAR_KM:
                flags.append('far from cave')
        row['flags'] = ' | '.join(flags)

    fields = list(rows[0].keys())
    for extra in ['caveIds', 'caveNames', 'matchHow', 'distanceKm', 'matchDetails', 'include', 'isCover']:
        if extra not in fields:
            fields.append(extra)
    with open(folder / 'matched.csv', 'w', newline='', encoding='utf-8-sig') as f:
        writer = csv.DictWriter(f, fieldnames=fields, extrasaction='ignore')
        writer.writeheader()
        writer.writerows(rows)

    print('Folders:')
    for name, (cave, how) in sorted(folder_matches.items()):
        print(f'  {name} -> {cave_name(cave) + " (" + how + ")" if cave else "NO MATCH"}')
    count = lambda test: sum(1 for r in rows if test(r))  # noqa: E731
    print(f'{len(rows)} photos: {count(lambda r: r.get("matchHow", "").startswith("exact"))} exact, '
          f'{count(lambda r: r.get("matchHow", "").startswith("similar"))} with a similar name to confirm, '
          f'{count(lambda r: r.get("matchHow") == "several caves")} under several caves, {count(lambda r: r.get("matchHow") == "none")} with no match, '
          f'{count(lambda r: "far from cave" in (r.get("flags") or ""))} far from their cave')
    print(f'caves: {len(caves)} (from {"production" if production else "the emulator"})')


if __name__ == '__main__':
    if len(sys.argv) < 2:
        sys.exit(__doc__)
    main(sys.argv[1], '--production' in sys.argv[2:])

"""Matches each extracted map (extracted.csv, from extract_maps.py) to a
sistema in the database - directly by name, or through a cave of that name
(whose sistema then holds the map) - and writes matched.csv, plus the maps
with no match at all.

Names are compared ignoring accents, apostrophe variants, punctuation and
generic words (Sistema, Sist., Cenote, Cueva...). An exact match wins; else
the closest name above a similarity threshold is suggested, to confirm.

Usage: python scripts/maps-import/match_maps.py <maps-import folder> [--production]
Reads the local Firestore emulator (127.0.0.1:8080) by default; --production
reads the real project (sistemas and caves are publicly readable: no login).
"""
import csv
import difflib
import json
import re
import sys
import unicodedata
import urllib.request
from pathlib import Path

PROJECT = 'opencaves'
EMULATOR = 'http://127.0.0.1:8080'
SUGGEST_THRESHOLD = 0.85

GENERIC_WORDS = {
    'sistema', 'sist', 'system', 'systema', 'cenote', 'cenotes', 'cen', 'cueva', 'cuevas', 'c', 'cave', 'caves',
    'grutas', 'gruta', 'grotte', 'grottes', 'des', 'de', 'del', 'la', 'las', 'los', 'el', 'the', 'du', 'part', 'parts', 'dzonot',
    'section', 'area', 'map', 'downstream', 'upstream', 'of',
}
# Maya for "cave": part of many names, but two different caves "Actun Ox" and
# "Actun Koh" must not look alike - left out when comparing loosely.
LOOSE_EXTRA_WORDS = {'actun', 'aktun'}
# Stamps that only name a place, or report captions: the file name says more.
NOT_A_NAME = re.compile(r'^(quintana roo|tulum|akumal|yucatan|figure.*|the \d+ kilometers.*)$', re.I)


def normalize(name, loose=False):
    name = unicodedata.normalize('NFKD', name or '').encode('ascii', 'ignore').decode().lower()
    name = re.sub(r"[’'`´]", '', name)
    skip = GENERIC_WORDS | LOOSE_EXTRA_WORDS if loose else GENERIC_WORDS
    words = [w for w in re.split(r'[^a-z0-9]+', name) if w and w not in skip]
    return ' '.join(words)


def name_candidates(name):
    """The names a map may be filed under: the whole name, each cave it
    lists ("A and B", "A, B"), without qualifiers in parentheses, and the
    sistema named in "(part of Sistema X)"."""
    found = [name]
    for inner in re.findall(r'\(([^)]*)\)', name):
        part_of = re.search(r'part of (.+)', inner, re.I)
        found.append(part_of.group(1) if part_of else inner)
    found += [m.group(1) for m in re.finditer(r'part of (sistema [^,()]+)', name, re.I)]
    bare = re.sub(r'\([^)]*\)', '', name)
    found.append(bare)
    pieces = re.split(r'\s+(?:and|&|y)\s+|,\s*|\s+[-–]\s+', bare)
    for i, piece in enumerate(pieces):
        found.append(piece)
        # "Sistema X East & West": a lone second word stands for "Sistema X West".
        words = pieces[i - 1].split() if i else []
        if i and len(piece.split()) == 1 and len(words) > 1:
            found.append(' '.join(words[:-1] + [piece]))
    seen, unique = set(), []
    for candidate in (c.strip() for c in found):
        if candidate and normalize(candidate) and candidate not in seen:
            seen.add(candidate)
            unique.append(candidate)
    return unique


def fetch_collection(name, production):
    """All documents' fields as plain values (REST, paged)."""
    base = f'https://firestore.googleapis.com/v1/projects/{PROJECT}/databases/(default)/documents/{name}' if production else f'{EMULATOR}/v1/projects/{PROJECT}/databases/(default)/documents/{name}'
    headers = {} if production else {'Authorization': 'Bearer owner'}
    docs, token = [], None
    while True:
        url = f'{base}?pageSize=1000' + (f'&pageToken={token}' if token else '')
        data = json.load(urllib.request.urlopen(urllib.request.Request(url, headers=headers)))
        for doc in data.get('documents', []):
            docs.append({'id': doc['name'].rsplit('/', 1)[1], **{k: plain(v) for k, v in doc.get('fields', {}).items()}})
        token = data.get('nextPageToken')
        if not token:
            return docs


def plain(value):
    if 'stringValue' in value:
        return value['stringValue']
    if 'arrayValue' in value:
        return [plain(v) for v in value['arrayValue'].get('values', [])]
    if 'mapValue' in value:
        return {k: plain(v) for k, v in value['mapValue'].get('fields', {}).items()}
    return next(iter(value.values()), None)


def map_name(row):
    """The best name for a map: the archive stamp's, else its file name's."""
    if row.get('stampName') and not NOT_A_NAME.match(row['stampName'].strip()):
        return row['stampName']
    stem = Path(row['source'].split('#')[-1]).stem
    stem = re.sub(r'\s*\(\d+\)$', '', stem)
    # Archive file names: "Name, Type., Place" -> "Name".
    if ', ' in stem:
        stem = stem.split(', ')[0]
    # "Sistema X - Y section" -> "Sistema X".
    stem = re.split(r'\s+-\s+', stem)[0]
    stem = re.sub(r'\((google (e|h)arth|part[^)]*|[^)]*part)\)', '', stem, flags=re.I)
    return stem.strip()


OVERRIDES = Path(__file__).with_name('map-overrides.csv')


def apply_overrides(rows, sistemas):
    """Reviewed corrections (map-overrides.csv, next to this script) over the
    automatic match: the sistema names a map goes to ("A | B"), or "exclude"
    for a map that shouldn't be published (include=no)."""
    if not OVERRIDES.exists():
        return
    by_name = {s.get('name'): s for s in sistemas}
    by_key = {r['source'] + (f"#p{r['page']}" if r.get('page') else ''): r for r in rows if r.get('image')}
    for entry in csv.DictReader(open(OVERRIDES, encoding='utf-8')):
        row = by_key.get(entry['map'])
        if not row:
            continue
        if entry['sistemas'].strip().lower() == 'exclude':
            row['include'] = 'no'
            row['matchHow'] = 'excluded'
        else:
            names = [n.strip() for n in entry['sistemas'].split('|') if n.strip()]
            missing = [n for n in names if n not in by_name]
            if missing:
                print(f'map-overrides.csv: no sistema named {", ".join(missing)} (for {entry["map"]})')
                continue
            row['sistemaIds'] = ' | '.join(by_name[n]['id'] for n in names)
            row['sistemaNames'] = ' | '.join(names)
            row['matchHow'] = 'override'
        row['matchDetails'] = f'override: {entry["reason"]}'


def main(folder, production):
    folder = Path(folder)
    rows = list(csv.DictReader(open(folder / 'extracted.csv', encoding='utf-8-sig')))
    sistemas = fetch_collection('sistemas', production)
    caves = fetch_collection('caves', production)
    sistemas_by_id = {s['id']: s for s in sistemas}

    # name -> (kind, record) for every sistema/cave name and alias.
    index = {}
    for s in sistemas:
        for name in [s.get('name')] + list(s.get('aka') or []):
            if name and normalize(name):
                index.setdefault(normalize(name), ('sistema', s))
    for c in caves:
        cave_name = (c.get('name') or {}).get('value') if isinstance(c.get('name'), dict) else c.get('name')
        for name in [cave_name] + list(c.get('aka') or []):
            if name and normalize(name):
                index.setdefault(normalize(name), ('cave', c))
    names = list(index)
    loose_keys = {key: normalize(key, loose=True) for key in names}

    def match_name(name):
        """[((kind, record), how)] - every cave or sistema the name covers
        ("Sistema X East & West" is two) - or [] with no match."""
        candidates = name_candidates(name)
        if normalize(name) in index:
            return [(index[normalize(name)], 'exact')]
        exact = []
        for candidate in candidates:
            key = normalize(candidate)
            if key in index and index[key] not in [m for m, _ in exact]:
                exact.append((index[key], f'exact ("{candidate}")'))
        if exact:
            return exact
        best = (0, None, None)
        for candidate in candidates:
            loose = normalize(candidate, loose=True)
            # Too little left to compare ("1", "c 1"): no loose match.
            if len(loose.replace(' ', '')) < 3:
                continue
            for key in names:
                if len(loose_keys[key].replace(' ', '')) < 3:
                    continue
                ratio = difflib.SequenceMatcher(None, loose, loose_keys[key]).ratio()
                if ratio > best[0]:
                    best = (ratio, key, candidate)
        if best[0] >= SUGGEST_THRESHOLD:
            return [(index[best[1]], f'similar ({best[0]:.2f}, "{best[2]}")')]
        return []

    for row in rows:
        if row.get('kind') == 'error':
            continue
        # A map kept for several copies was filed under several caves: each.
        filed = [map_name(row)] + [n for n in (row.get('alsoFiledAs') or '').split(' | ') if n]
        row['mapName'] = filed[0]
        found, details = [], []
        for name in dict.fromkeys(filed):
            matches = match_name(name)
            if not matches:
                details.append(f'{name}: none')
            for (kind, record), how in matches:
                sistema = record if kind == 'sistema' else sistemas_by_id.get(record.get('sistemaId'))
                matched_name = record.get('name') if kind == 'sistema' else (record.get('name') or {}).get('value', '')
                details.append(f'{name}: {kind} "{matched_name}" ({how})' + ('' if sistema else ', cave without a sistema'))
                if sistema and sistema['id'] not in [s_['id'] for s_, _ in found]:
                    found.append((sistema, how))
        row['matchDetails'] = ' | '.join(details)
        row['sistemaIds'] = ' | '.join(s_['id'] for s_, _ in found)
        row['sistemaNames'] = ' | '.join(s_.get('name', '') for s_, _ in found)
        hows = [how for _, how in found]
        row['matchHow'] = 'none' if not hows else ('exact' if all(h.startswith('exact') for h in hows) else 'similar')

    apply_overrides(rows, sistemas)

    fields = list(rows[0].keys())
    for extra in ['mapName', 'matchHow', 'sistemaIds', 'sistemaNames', 'matchDetails', 'include']:
        if extra not in fields:
            fields.append(extra)
    with open(folder / 'matched.csv', 'w', newline='', encoding='utf-8-sig') as f:
        writer = csv.DictWriter(f, fieldnames=fields, extrasaction='ignore')
        writer.writeheader()
        writer.writerows(rows)

    unmatched = [r for r in rows if r.get('matchHow') == 'none']
    print(f'{len(rows)} maps: {sum(1 for r in rows if r.get("matchHow") == "exact")} exact, '
          f'{sum(1 for r in rows if r.get("matchHow") == "similar")} with a similar name to confirm, {len(unmatched)} with no match, '
          f'{sum(1 for r in rows if " | " in (r.get("sistemaIds") or ""))} going to several sistemas, '
          f'{sum(1 for r in rows if r.get("matchHow") == "override")} set by map-overrides.csv, {sum(1 for r in rows if r.get("matchHow") == "excluded")} excluded')
    print(f'sistemas: {len(sistemas)}, caves: {len(caves)} (from {"production" if production else "the emulator"})')


if __name__ == '__main__':
    if len(sys.argv) < 2:
        sys.exit(__doc__)
    main(sys.argv[1], '--production' in sys.argv[2:])

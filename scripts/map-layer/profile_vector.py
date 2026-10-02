"""Profiles the vector maps (PDFs whose map is drawn with real vector paths)
before they're set up for the map layer: what each one needs in its config,
and whether it can be placed yet.

Per map: the stroke styles (colour, width) and how much line each draws -
the walls and survey lines are among them -, the scale bar's words and
numbers, the north indication, and every cave name in the map's text that
matches a cave of the database (local emulator) with a position: the
control points available. A map with none can't be placed until one of its
caves gets a position.

Writes <output>/vector-profiles.json and prints a summary.

Usage: python scripts/map-layer/profile_vector.py <maps-import folder> <output folder>
Needs PyMuPDF.
"""
import csv
import json
import re
import sys
from collections import defaultdict
from pathlib import Path

import pymupdf

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / 'maps-import'))
from match_maps import fetch_collection, normalize  # noqa: E402

from cenote_candidates import cave_name, cave_names, cave_position, key  # noqa: E402

SCALE_WORDS = re.compile(r'^(m|metros|meters|metres|ft|feet|pies|escala|scale)$', re.I)
NORTH_WORDS = re.compile(r'^(n|ngrid|nmag|nm|ng|norte|north|mag|true|nv|nt)$', re.I)
# Names this short match words by chance.
MIN_NAME_LENGTH = 4


def stroke_length(drawing):
    total = 0.0
    for item in drawing['items']:
        if item[0] == 'l':
            total += abs(item[2] - item[1])
        elif item[0] == 'c':
            total += abs(item[4] - item[1])
        elif item[0] == 're':
            total += 2 * (item[1].width + item[1].height)
    return total


def profile(pdf_path, page_number, names):
    page = pymupdf.open(pdf_path)[page_number - 1]
    styles = defaultdict(lambda: {'drawings': 0, 'length': 0.0})
    fills = defaultdict(int)
    for drawing in page.get_drawings():
        if drawing.get('color') is not None and drawing.get('width'):
            colour = tuple(round(c, 3) for c in drawing['color'])
            style = styles[(colour, round(drawing['width'], 2))]
            style['drawings'] += 1
            style['length'] += stroke_length(drawing)
        if drawing.get('fill') is not None:
            fills[tuple(round(c, 3) for c in drawing['fill'])] += 1
    words = page.get_text('words')
    scale_words = [w for w in words if SCALE_WORDS.match(w[4])]
    numbers = [w for w in words if re.fullmatch(r'\d{1,4}', w[4])]
    # The scale bar's numbers: those on the line of a scale word.
    scale = []
    for sw in scale_words:
        row = sorted({int(n[4]) for n in numbers if abs((n[1] + n[3]) / 2 - (sw[1] + sw[3]) / 2) < 15 or abs(n[1] - sw[1]) < 25 and abs(n[0] - sw[0]) < 200})
        scale.append({'word': sw[4], 'at': [round(sw[0]), round(sw[1])], 'numbers': row[:8]})
    north = [{'word': w[4], 'at': [round(w[0]), round(w[1])]} for w in words if NORTH_WORDS.match(w[4])]
    # Cave names in the text, line by line, with their position.
    lines = defaultdict(list)
    for w in words:
        lines[(w[5], w[6])].append(w)
    text_lines = [(' '.join(w[4] for w in ws), ws) for ws in lines.values()]
    found = {}
    for text, ws in text_lines:
        k = f' {key(text)} '
        for name_key, caves in names.items():
            if f' {name_key} ' in k:
                for cave in caves:
                    found[cave['id']] = {'name': cave_name(cave), 'text': text, 'at': [round(ws[0][0]), round(ws[0][1])],
                                         'latitude': cave_position(cave)[0], 'longitude': cave_position(cave)[1]}
    top_styles = sorted(styles.items(), key=lambda kv: -kv[1]['length'])[:6]
    return {
        'pageSize': [round(page.rect.width), round(page.rect.height)],
        'textWords': len(words),
        'styles': [{'color': list(c), 'width': w, 'drawings': v['drawings'], 'length': round(v['length'])} for (c, w), v in top_styles],
        'fills': [{'fill': list(f), 'count': n} for f, n in sorted(fills.items(), key=lambda kv: -kv[1])[:5]],
        'scale': scale,
        'north': north,
        'controlPoints': list(found.values()),
    }


def main(import_folder, output):
    import_folder, out = Path(import_folder), Path(output)
    rows = [r for r in csv.DictReader(open(import_folder / 'matched.csv', encoding='utf-8-sig')) if r.get('image', '').endswith('.svg')]
    caves = fetch_collection('caves', False)
    names = defaultdict(list)
    for cave in caves:
        if not cave_position(cave):
            continue
        for name in cave_names(cave):
            k = key(name)
            if len(k.replace(' ', '')) >= MIN_NAME_LENGTH and not re.fullmatch(r'[\d .,-]+', k):
                names[k].append(cave)
    profiles = {}
    for row in rows:
        pdf = import_folder.parent / row['source'].split('#')[0]
        result = profile(pdf, int(row['page'] or 1), names)
        profiles[row['image']] = {'source': row['source'], 'page': int(row['page'] or 1), 'mapName': row.get('mapName'), 'sistemaIds': row.get('sistemaIds'), **result}
        p = result
        scale = '; '.join(f"{s['word']} {s['numbers']}" for s in p['scale']) or 'none found'
        north = ', '.join(sorted({n['word'] for n in p['north']})) or 'none found'
        points = ', '.join(sorted({c['name'] for c in p['controlPoints']})) or '-'
        print(f"{row['image'][7:]:48} text {p['textWords']:4} | scale: {scale[:40]:40} | north: {north[:14]:14} | control points: {points}")
    out.mkdir(parents=True, exist_ok=True)
    (out / 'vector-profiles.json').write_text(json.dumps(profiles, indent=1, ensure_ascii=False), encoding='utf-8')
    placeable = sum(1 for p in profiles.values() if p['controlPoints'])
    print(f'\n{len(profiles)} vector maps: {placeable} with at least one control point, {len(profiles) - placeable} without -> {out / "vector-profiles.json"}')


if __name__ == '__main__':
    if len(sys.argv) != 3:
        sys.exit(__doc__)
    main(sys.argv[1], sys.argv[2])

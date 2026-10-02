"""Prepares a scanned (or straightened) cave map for the map layer: finds its
control points and writes a starting config, so the review is about
confirming rather than searching (prototype).

1. OCR (Tesseract, cached): every text line on the map.
2. Candidates: the lines naming a cave of the database (local emulator)
   that has a position - "Cenote Calimba", "Grand Cenote", "Carwash"...
   placed at the label for now.
3. Consistency: namesakes elsewhere and misreadings would ruin a fit, so
   every pair of candidates is tried as a similarity fit (scale, rotation,
   shift) and the pair agreeing with the most others wins (RANSAC); the
   agreeing ones are refitted together. Two points always fit exactly, so
   a fit counts only when at least three agree. Labels sit beside their openings,
   so agreement is loose (INLIER_METRES): the review then moves each point
   onto its opening, on the crops written for it.
4. Writes maps/<name>.json (unless it exists: then only reports), crops of
   each control point in <output>/<name>-crops/, and prints the fit.

Usage: python scripts/map-layer/prepare_scan.py <image> <name> <output folder> [--sistema <id>] [--title <text>]
Needs Pillow, numpy, pyproj, pytesseract (and what the other scripts need).
"""
import itertools
import json
import math
import re
import sys
from pathlib import Path

import numpy
from PIL import Image, ImageDraw
from pyproj import Transformer

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / 'maps-import'))
from match_maps import fetch_collection  # noqa: E402

from cenote_candidates import cave_name, cave_names, cave_position, key  # noqa: E402
from overlay_scan import fit_similarity  # noqa: E402
from trace_scan import ocr_words  # noqa: E402

Image.MAX_IMAGE_PIXELS = None
UTM_EPSG = 32616
# A candidate agrees with a fit when its label lands this close to its GPS:
# labels sit up to ~100 m from their openings on these maps.
INLIER_METRES = 150
# Two labels closer than this (pixels) can't fix a rotation reliably.
MIN_PAIR_PX = 300
# Plausible scales (metres per pixel) for a cave map scan.
SCALE_RANGE = (0.05, 5)
# Names shorter than this match words by chance.
MIN_NAME_LENGTH = 4
# A label is a short line; longer ones are notes and history paragraphs.
MAX_LABEL_WORDS = 4
# Lines that name a cave without being its label: distance notes ("FROM GRAND
# CENOTE"), cross-section and passage titles ("CALIMBA SECTION").
NOT_A_LABEL = re.compile(r'^(from|to|desde|hacia)\b|\b(section|secci[oó]n|line|passage|loop|restriction)\b', re.I)
OPENING_WORD = re.compile(r'\b(cenote|entrada|cueva|entrance)\b', re.I)
CROP_PX = 300
MAPS_DIR = Path(__file__).resolve().parent / 'maps'


def text_lines(words):
    """OCR words grouped into lines: same height, close horizontally."""
    lines = []
    for word in sorted(words, key=lambda w: (w['box'][1], w['box'][0])):
        cy = (word['box'][1] + word['box'][3]) / 2
        for line in lines:
            last = line[-1]
            if abs((last['box'][1] + last['box'][3]) / 2 - cy) < 12 and 0 <= word['box'][0] - last['box'][2] < 60:
                line.append(word)
                break
        else:
            lines.append([word])
    return [(' '.join(w['t'] for w in line), [min(w['box'][0] for w in line), min(w['box'][1] for w in line),
                                              max(w['box'][2] for w in line), max(w['box'][3] for w in line)]) for line in lines]


def main(image_path, name, output, sistema_id=None, title=None):
    image_path, out = Path(image_path), Path(output)
    out.mkdir(parents=True, exist_ok=True)
    grey = Image.open(image_path).convert('L')
    words = ocr_words(grey, out / f'{name}-ocr-words.json')
    caves = [c for c in fetch_collection('caves', False) if cave_position(c)]
    names = {}
    for cave in caves:
        for n in cave_names(cave):
            k = key(n)
            if len(k.replace(' ', '')) >= MIN_NAME_LENGTH and not re.fullmatch(r'[\d .,-]+', k):
                names.setdefault(k, []).append(cave)

    candidates = []
    for text, box in text_lines(words):
        if len(text.split()) > MAX_LABEL_WORDS or NOT_A_LABEL.search(text):
            continue
        k = f' {key(text)} '
        for name_key, matched in names.items():
            if f' {name_key} ' in k:
                for cave in matched:
                    candidates.append({'text': text, 'px': [(box[0] + box[2]) / 2, (box[1] + box[3]) / 2], 'cave': cave})
    # One candidate per cave: its most label-like line - one saying
    # "Cenote"/"Entrada"/"Cueva" first, then the shortest.
    by_cave = {}
    for c in candidates:
        by_cave.setdefault(c['cave']['id'], []).append(c)
    candidates = [min(group, key=lambda c: (not OPENING_WORD.search(c['text']), len(c['text']))) for group in by_cave.values()]
    to_utm = Transformer.from_crs(4326, UTM_EPSG, always_xy=True)
    for c in candidates:
        lat, lon = cave_position(c['cave'])
        c['utm'] = to_utm.transform(lon, lat)
    print(f'{len(words)} OCR words; {len(candidates)} labels naming a cave with a position: ' + ', '.join(f"{cave_name(c['cave'])} ({c['text']})" for c in candidates))

    def errors(place, group):
        return [math.hypot(place(*c['px'])[0] - c['utm'][0], place(*c['px'])[1] - c['utm'][1]) for c in group]

    best = None
    for a, b in itertools.combinations(candidates, 2):
        if math.hypot(a['px'][0] - b['px'][0], a['px'][1] - b['px'][1]) < MIN_PAIR_PX:
            continue
        place, scale, _ = fit_similarity([a['px'], b['px']], [a['utm'], b['utm']])
        if not SCALE_RANGE[0] <= scale <= SCALE_RANGE[1]:
            continue
        inliers = [c for c, e in zip(candidates, errors(place, candidates)) if e <= INLIER_METRES]
        if best is None or len(inliers) > len(best):
            best = inliers
    # Two points always fit exactly: only a third one agreeing confirms a fit.
    if not best or len(best) < 3:
        found = ', '.join(cave_name(c['cave']) for c in (best or []))
        print(f'No fit confirmed by 3 or more labels{f" (only {found})" if found else ""}: control points to pick by hand, '
              'or a scale bar and one point.')
        return
    place, scale, rotation = fit_similarity([c['px'] for c in best], [c['utm'] for c in best])
    print(f'consistent: {len(best)} of {len(candidates)}; scale {scale:.4f} m/px, rotation {rotation:.1f} deg')
    for c, e in zip(best, errors(place, best)):
        print(f"  {cave_name(c['cave']):24} label '{c['text']}' at {round(c['px'][0])},{round(c['px'][1])}: {e:5.1f} m")
    for c in candidates:
        if c not in best:
            print(f"  rejected: {cave_name(c['cave'])} ('{c['text']}'): a namesake, or a misreading")

    # Crops, one per control point, with a pixel grid: to move each point
    # from its label onto the opening it names.
    crops = out / f'{name}-crops'
    crops.mkdir(exist_ok=True)
    rgb = Image.open(image_path).convert('RGB')
    for c in best:
        x, y = (round(v) for v in c['px'])
        box = (x - CROP_PX, y - CROP_PX, x + CROP_PX, y + CROP_PX)
        crop = rgb.crop(box)
        draw = ImageDraw.Draw(crop)
        for i in range(0, 2 * CROP_PX + 1, 50):
            colour = (255, 0, 0) if i % 100 == 0 else (255, 190, 190)
            draw.line([(i, 0), (i, 2 * CROP_PX)], fill=colour)
            draw.line([(0, i), (2 * CROP_PX, i)], fill=colour)
            if i % 100 == 0:
                draw.text((i + 2, 2), str(box[0] + i), fill=(255, 0, 0))
                draw.text((2, i + 2), str(box[1] + i), fill=(255, 0, 0))
        crop.save(crops / f"{re.sub(r'[^a-z0-9]+', '-', key(cave_name(c['cave'])))}.png")

    config_path = MAPS_DIR / f'{name}.json'
    if config_path.exists():
        print(f'{config_path.name} exists: not overwritten. Crops in {crops}')
        return
    relative = Path('../../..') / image_path.resolve().relative_to(Path(__file__).resolve().parents[2])
    config = {
        'image': relative.as_posix(),
        'title': title or name,
        'credits': '',
        'source': {'id': '-KPZg4jsKUZe0Tf3lyro', 'name': 'QRSS'},
        'sistemaId': sistema_id or '',
        'utmEpsg': UTM_EPSG,
        'exclude': [],
        'controlPoints': [{'caveId': c['cave']['id'], 'name': cave_name(c['cave']), 'px': [round(v) for v in c['px']],
                           'latitude': cave_position(c['cave'])[0], 'longitude': cave_position(c['cave'])[1], 'review': 'at the label: move onto the opening'}
                          for c in best],
        'entrances': [{'caveId': c['cave']['id'], 'name': cave_name(c['cave']), 'px': [round(v) for v in c['px']]} for c in best],
    }
    config_path.write_text(json.dumps(config, indent=2, ensure_ascii=False) + '\n', encoding='utf-8')
    print(f'starting config -> {config_path}; crops -> {crops}')


if __name__ == '__main__':
    args = sys.argv[1:]
    options = {}
    for flag in ('--sistema', '--title'):
        if flag in args:
            i = args.index(flag)
            options[flag[2:]] = args[i + 1]
            del args[i:i + 2]
    if len(args) != 3:
        sys.exit(__doc__)
    main(*args, sistema_id=options.get('sistema'), title=options.get('title'))

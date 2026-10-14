"""Matches photos to caves by where they were taken (their GPS), for photo
collections not filed by cave - e.g. a Google Photos export (Google Takeout)
of trips. Writes, into the output folder:

- gps-matched.csv: every photo with its position, the nearest cave and its
  distance, the second nearest, a status, and whether it's already in
  OpenCaves;
- review.html: a viewer showing the photos one at a time, cave by cave, to
  add or skip each (its choices exported as selected.csv for the upload;
  previews in previews/).

A photo's position: the Takeout sidecar's (<name>.json or
<name>.supplemental-metadata.json - it holds a location set or corrected in
Google Photos, which the file itself doesn't), else the file's EXIF GPS.

A cave's points: its location, entrance, parking and keys - the nearest one
counts. Status:
- match: the nearest cave is within --radius, and no other cave is close
  (the second is over --radius, or over twice as far);
- ambiguous: two caves within --radius at similar distances - choose;
- far: nothing within --radius (the nearest is still named);
- no position: no GPS in the file or its sidecar.

Already in OpenCaves: a stored photo (cavesAssets, not in the trash) at the
same position (within ~1 m, the EXIF GPS the upload kept) with the same size
in pixels -> "yes"; same position, another size -> "maybe" (an edited
copy?); also "yes" when the original file name matches (local emulator only:
production's file names are admin-only).

The database is only read. Production by default (the source of the data
since 1.0); -l / --local for the emulators.

Usage: python scripts/photos-import/match_by_gps.py <photos folder> <output folder> [-l | -p] [--radius 100]
       python scripts/photos-import/match_by_gps.py <photos folder> <output folder> --selected
  (the second turns the review's export, selected.csv, into upload.csv for upload-photos.js)
"""
import argparse
import csv
import hashlib
import html
import os
import json
import math
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / 'maps-import'))
from match_maps import fetch_collection  # noqa: E402

from PIL import ExifTags, Image, ImageOps

# HEIC (iPhone photos): readable with pillow-heif when installed; matched by
# their sidecar's position either way.
try:
    from pillow_heif import register_heif_opener
    register_heif_opener()
except ImportError:
    pass

IMAGE_TYPES = {'.jpg', '.jpeg', '.png', '.webp', '.heic', '.heif', '.tif', '.tiff'}
TAG = {name: code for code, name in ExifTags.TAGS.items()}
GPS_IFD = 0x8825
# Same position: EXIF GPS rounded to 6 decimals (~0.1 m); 1e-5 deg ~ 1 m.
SAME_PLACE_DEG = 1e-5
# The viewer's preview of each photo, its longest side in pixels.
PREVIEW = 1600
# The caves offered for a photo: the nearest ones.
NEARBY = 5


def distance_m(a, b):
    """Great-circle distance in metres between two (latitude, longitude) points."""
    lat1, lon1, lat2, lon2 = (math.radians(v) for v in (*a, *b))
    h = math.sin((lat2 - lat1) / 2) ** 2 + math.cos(lat1) * math.cos(lat2) * math.sin((lon2 - lon1) / 2) ** 2
    return 6371000 * 2 * math.asin(math.sqrt(h))


def point(value):
    if isinstance(value, dict) and value.get('latitude') is not None and value.get('longitude') is not None:
        latitude, longitude = float(value['latitude']), float(value['longitude'])
        if latitude or longitude:
            return latitude, longitude
    return None


def cave_points(cave):
    """A cave's known points: location, entrance, parking, keys."""
    points = [point(cave.get(key)) for key in ('location', 'entrance', 'parking')]
    keys = cave.get('keys')
    points += [point(key) for key in keys] if isinstance(keys, list) else []
    return [p for p in points if p]


def cave_name(cave):
    name = cave.get('name')
    return ((name or {}).get('value') if isinstance(name, dict) else name) or '(unnamed)'


def sidecar(path):
    """The Takeout JSON next to a photo: <name>.json, <name>.supplemental-metadata.json,
    or a truncated form of the latter (Takeout cuts long names)."""
    for candidate in (path.with_name(path.name + '.json'), path.with_name(path.name + '.supplemental-metadata.json')):
        if candidate.exists():
            return candidate
    matches = [p for p in path.parent.glob(path.name[:30] + '*.json') if p.name.startswith(path.name + '.') or p.name.startswith(path.name[:46])]
    return matches[0] if len(matches) == 1 else None


def sidecar_position(data):
    for key in ('geoData', 'geoDataExif'):
        position = point(data.get(key) or {})
        if position:
            return position, f'takeout {key}'
    return None, None


def exif_info(path):
    """Size, EXIF GPS and date - None when Pillow can't read the file (HEIC without pillow-heif)."""
    try:
        with Image.open(path) as image:
            exif = image.getexif()
            size = image.size
            gps = exif.get_ifd(GPS_IFD)
            position = None
            if gps.get(2) and gps.get(4):
                def degrees(value, ref):
                    d, m, s = (float(v) for v in value)
                    result = d + m / 60 + s / 3600
                    return -result if ref in ('S', 'W') else result
                latitude, longitude = degrees(gps[2], gps.get(1)), degrees(gps[4], gps.get(3))
                if latitude or longitude:
                    position = (round(latitude, 6), round(longitude, 6))
            date = exif.get_ifd(0x8769).get(TAG['DateTimeOriginal']) or exif.get(TAG['DateTime'])
            return {'size': size, 'position': position, 'date': str(date).strip('\x00 ') if date else ''}
    except Exception:  # noqa: BLE001 - any unreadable file is reported, not fatal
        return None


def preview(path, target):
    if target.exists():
        return True
    try:
        with Image.open(path) as image:
            image = ImageOps.exif_transpose(image)
            image.thumbnail((PREVIEW, PREVIEW))
            image.convert('RGB').save(target, 'JPEG', quality=82)
        return True
    except Exception:  # noqa: BLE001
        return False


def main():
    parser = argparse.ArgumentParser(description='Matches photos to caves by their GPS (e.g. a Google Takeout export).')
    parser.add_argument('photos', help='The photos folder (searched recursively)')
    parser.add_argument('output', help='Where to write gps-matched.csv, review.html and thumbs/')
    parser.add_argument('-l', '--local', action='store_true', help='Read the local emulators')
    parser.add_argument('-p', '--production', action='store_true', help='Read production (the default)')
    parser.add_argument('--radius', type=float, default=100, help='Metres within which a cave matches (default 100)')
    parser.add_argument('--selected', action='store_true', help="Don't match: turn the review's export (<output>/selected.csv) into <output>/upload.csv for upload-photos.js")
    # No arguments: the help, not a run.
    if len(sys.argv) == 1:
        parser.print_help()
        return
    args = parser.parse_args()
    if args.selected:
        write_upload(Path(args.photos), Path(args.output))
        return
    production = not args.local
    photos_dir, out = Path(args.photos), Path(args.output)
    (out / 'previews').mkdir(parents=True, exist_ok=True)

    caves = [c for c in fetch_collection('caves', production) if cave_points(c)]
    assets = [a for a in fetch_collection('cavesAssets', production) if not a.get('deletedAt')]
    names = {}
    if not production:
        for doc in fetch_collection('_cavesAssetsPrivate', production):
            if doc.get('originalName'):
                names.setdefault(doc['originalName'].lower(), doc['id'])
    by_id = {c['id']: c for c in caves}
    # Sizes as numbers: the REST reader gives integers as text.
    size = lambda a: {int(a[k]) for k in ('width', 'height') if str(a.get(k) or '').isdigit()}
    stored = [(point(a.get('position')), size(a), a) for a in assets]
    print(f'{len(caves)} caves with a position, {len(assets)} photos in OpenCaves ({"production" if production else "local"})')

    rows = []
    files = sorted(p for p in photos_dir.rglob('*') if p.suffix.lower() in IMAGE_TYPES)
    for i, path in enumerate(files, 1):
        info = exif_info(path) or {}
        side = sidecar(path)
        side_data = json.load(open(side, encoding='utf-8')) if side else {}
        position, source = sidecar_position(side_data)
        if not position and info.get('position'):
            position, source = info['position'], 'exif'
        taken = info.get('date') or ''
        if not taken and side_data.get('photoTakenTime', {}).get('formatted'):
            taken = side_data['photoTakenTime']['formatted']
        row = {'file': str(path.relative_to(photos_dir)), 'album': path.parent.name, 'taken': taken,
               'latitude': '', 'longitude': '', 'positionFrom': source or '', 'status': 'no position',
               'cave': '', 'caveId': '', 'distanceM': '', 'second': '', 'secondId': '', 'secondM': '',
               'inOpenCaves': '', 'storedId': '', 'width': '', 'height': ''}
        if info.get('size'):
            row['width'], row['height'] = info['size']
        if position:
            row['latitude'], row['longitude'] = f'{position[0]:.6f}', f'{position[1]:.6f}'
            ranked = sorted(((min(distance_m(position, p) for p in cave_points(c)), c) for c in caves), key=lambda t: t[0])
            (d1, c1), (d2, c2) = ranked[0], ranked[1]
            row.update(cave=cave_name(c1), caveId=c1['id'], distanceM=round(d1), second=cave_name(c2), secondId=c2['id'], secondM=round(d2))
            row['nearby'] = [{'id': c['id'], 'name': cave_name(c), 'm': round(d)} for d, c in ranked[:NEARBY]]
            if d1 > args.radius:
                row['status'] = 'far'
            elif d2 <= args.radius and d2 < 2 * d1:
                row['status'] = 'ambiguous'
            else:
                row['status'] = 'match'
            # Already stored: same place (EXIF GPS kept by the upload), same size.
            exif_position = info.get('position') or position
            for stored_position, sizes, asset in stored:
                if stored_position and abs(stored_position[0] - exif_position[0]) < SAME_PLACE_DEG and abs(stored_position[1] - exif_position[1]) < SAME_PLACE_DEG:
                    same_size = info.get('size') and set(info['size']) == sizes
                    if same_size or not row['inOpenCaves']:
                        row['inOpenCaves'], row['storedId'] = ('yes' if same_size else 'maybe'), asset['id']
                        row['storedCave'] = cave_name(by_id.get(asset.get('caveId'), {}))
                    if same_size:
                        break
        original = (side_data.get('title') or path.name).lower()
        if not row['inOpenCaves'] and original in names:
            row['inOpenCaves'], row['storedId'] = 'yes', names[original]
        image = f'previews/{i:05d}.jpg'
        row['preview'] = image if preview(path, out / image) else ''
        rows.append(row)
        if i % 200 == 0:
            print(f'  {i}/{len(files)} photos')

    fields = ['file', 'album', 'taken', 'latitude', 'longitude', 'positionFrom', 'status', 'cave', 'caveId', 'distanceM', 'second', 'secondId', 'secondM', 'inOpenCaves', 'storedId', 'storedCave', 'width', 'height', 'preview']
    with open(out / 'gps-matched.csv', 'w', encoding='utf-8-sig', newline='') as f:
        writer = csv.DictWriter(f, fieldnames=fields, extrasaction='ignore')
        writer.writeheader()
        writer.writerows(rows)
    write_review(rows, out / 'review.html', args.radius)

    count = lambda key, value: sum(1 for r in rows if r.get(key) == value)
    print(f'\n{len(rows)} photos: {count("status", "match")} matched, {count("status", "ambiguous")} ambiguous, {count("status", "far")} far (> {args.radius:g} m), {count("status", "no position")} without a position')
    print(f'already in OpenCaves: {count("inOpenCaves", "yes")} yes, {count("inOpenCaves", "maybe")} maybe')
    print(f'caves with new photos: {len({r["caveId"] for r in rows if r["status"] == "match" and not r["inOpenCaves"]})}')
    print(f'-> {out / "gps-matched.csv"}, {out / "review.html"}')


def write_upload(photos_dir, out):
    """The review's choices (selected.csv: file, caveId, cave...) as upload-photos.js reads
    them (upload.csv): the image's path relative to the CSV, its hash (the import key, as
    extract_photos.py computes it - a photo is never imported twice), its source and cave."""
    rows = []
    for row in csv.DictReader(open(out / 'selected.csv', encoding='utf-8-sig')):
        path = photos_dir / row['file']
        rows.append({
            'image': os.path.relpath(path, out).replace(os.sep, '/'),
            'source': f"Google Photos/{row['file'].replace(os.sep, '/')}",
            'folder': row.get('album', ''),
            'kind': 'photo',
            'date': row.get('taken', ''),
            'latitude': row.get('latitude', ''),
            'longitude': row.get('longitude', ''),
            'sha1': hashlib.sha1(path.read_bytes()).hexdigest()[:12],
            'caveIds': row['caveId'],
            'caveNames': row.get('cave', ''),
        })
    with open(out / 'upload.csv', 'w', encoding='utf-8-sig', newline='') as f:
        writer = csv.DictWriter(f, fieldnames=list(rows[0]) if rows else ['image'])
        writer.writeheader()
        writer.writerows(rows)
    print(f'{len(rows)} photos -> {out / "upload.csv"}')
    print(f'next: node scripts/photos-import/upload-photos.js --csv "{out / "upload.csv"}" -l   (a dry run; --apply to upload, -p for production)')


VIEWER = Path(__file__).with_name('gps_review.html')


def write_review(rows, target, radius):
    """The one-photo-at-a-time viewer (gps_review.html), with the photos embedded as data."""
    data = json.dumps({'radius': radius, 'dataset': f'{target.parent.name}-{len(rows)}', 'photos': rows}, ensure_ascii=False).replace('</', '<\\/')
    target.write_text(VIEWER.read_text(encoding='utf-8').replace('/*DATA*/null', data), encoding='utf-8')


if __name__ == '__main__':
    main()

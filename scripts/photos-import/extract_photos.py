"""Collect the cave photos found under the _data folder tree into a CSV
inventory to review before uploading (upload-photos.js). Maps are left out:
they have their own import (scripts/maps-import).

- Only the "Cenote ..." folders (and their subfolders) are read: the Sistema
  folders, cartes/ and the loose files at the root hold maps and documents.
- Maps are skipped: files the map import already took (its extracted.csv
  and duplicates.csv), and images whose name says map (map, carte, plan,
  sistema, directions...). Images that look like line art (mostly white
  paper, little colour) are kept but marked kind "map?", for review: the
  upload leaves them out unless marked include=yes.
- Photos are uploaded as they are, not re-encoded, so the upload function
  still finds their EXIF (date, GPS, orientation) and 360° panorama XMP. The
  CSV points at them in place (paths relative to the output folder); only
  TIFF and GIF files are converted, to JPEG, into <output>/images.
- Images without a phone or camera maker in their EXIF are flagged
  "third-party?" (downloads, figures from articles, messenger attachments).
- Duplicates: byte-identical copies are reduced to one row, which keeps the
  other folders it was filed in (alsoFiledIn); removed copies are listed in
  duplicates.csv. Near-identical photos (a re-saved copy, burst shots) are
  only flagged (possibleDuplicateOf) - different shots can look alike.
- Videos are listed as skipped: cave assets are images only for now.

Usage: python scripts/photos-import/extract_photos.py <_data folder> <output folder>
Needs Pillow and numpy (pip install pillow numpy).
"""
import csv
import hashlib
import os
import re
import sys
import unicodedata
from pathlib import Path

import numpy
from PIL import ExifTags, Image

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / 'maps-import'))
from extract_maps import average_hash, hamming, slug  # noqa: E402

Image.MAX_IMAGE_PIXELS = None

PHOTO_TYPES = {'.jpg', '.jpeg', '.png', '.webp'}
CONVERTED_TYPES = {'.tif', '.tiff', '.gif'}
VIDEO_TYPES = {'.mp4', '.mov', '.avi', '.3gp'}
JPEG_QUALITY = 92
# The app's own upload limit (storage.rules).
MAX_FILE_BYTES = 30 * 1024 * 1024

# Top-level folders holding a cave's photos.
CAVE_FOLDER = re.compile(r'^cenote\b', re.I)
MAP_NAME_HINT = re.compile(r'\b(map|maps|carte|plan|survey|sistema|systema|system|directions|trajet|cle|key)\b', re.I)
SKIP_NAME_PATTERNS = [r'desktop\.ini$', r'\.OLD\.', r'\.aux\.xml$', r'\.points$']
COPY_SUFFIX = re.compile(r'\s*\(\d+\)$')

# Line art: at least this share of near-white (paper) pixels, and a mean
# saturation below this (0-255) - a photo of water and rock is neither.
PAPER_LEVEL = 225
MAP_MIN_PAPER = 0.45
MAP_MAX_SATURATION = 40
# Fingerprints this close (bits, of 256), same proportions: flagged only.
REVIEW_DUPLICATE_BITS = 8
DUPLICATE_ASPECT_TOLERANCE = 0.03

EXIF_IFD, GPS_IFD = 0x8769, 0x8825
TAG = {name: key for key, name in ExifTags.TAGS.items()}


def ascii_name(text):
    return unicodedata.normalize('NFKD', text).encode('ascii', 'ignore').decode()


def map_sources(maps_dir):
    """Every source file the map import took, kept or removed as a duplicate."""
    taken = set()
    for name, columns in (('extracted.csv', ('source', 'duplicateSources')), ('duplicates.csv', ('source',))):
        path = maps_dir / name
        if not path.exists():
            continue
        for row in csv.DictReader(open(path, encoding='utf-8-sig')):
            for column in columns:
                for source in (row.get(column) or '').split(' | '):
                    if source:
                        taken.add(source.split('#')[0])
    return taken


def gps_degrees(value, ref):
    degrees, minutes, seconds = (float(v) for v in value)
    result = degrees + minutes / 60 + seconds / 3600
    return -result if ref in ('S', 'W') else result


def read_metadata(image, data):
    """EXIF camera, date and GPS, and whether it's a 360° panorama (XMP GPano)."""
    info = {}
    exif = image.getexif()
    camera = ' '.join(str(exif.get(TAG[t], '')).strip('\x00 ') for t in ('Make', 'Model')).strip()
    if camera:
        info['camera'] = camera
    date = exif.get_ifd(EXIF_IFD).get(TAG['DateTimeOriginal']) or exif.get(TAG['DateTime'])
    if date:
        info['date'] = str(date).strip('\x00 ')
    gps = exif.get_ifd(GPS_IFD)
    try:
        if gps.get(2) and gps.get(4):
            latitude, longitude = gps_degrees(gps[2], gps.get(1)), gps_degrees(gps[4], gps.get(3))
            # 0,0 is a phone's "no fix", not a position.
            if latitude or longitude:
                info['latitude'], info['longitude'] = round(latitude, 6), round(longitude, 6)
    except (TypeError, ValueError, ZeroDivisionError):
        pass
    if re.search(rb'UsePanoramaViewer(="|>)True', data):
        info['panorama'] = 'yes'
    return info


def looks_like_map(image):
    """Line art on paper: mostly near-white pixels, and little colour."""
    small = image.convert('RGB')
    small.thumbnail((512, 512))
    grey = numpy.asarray(small.convert('L'))
    saturation = numpy.asarray(small.convert('HSV'))[:, :, 1]
    return (grey >= PAPER_LEVEL).mean() >= MAP_MIN_PAPER and saturation.mean() <= MAP_MAX_SATURATION


def candidates(root, out, maps_taken):
    """(path, rel, reason to skip or None) for every file in the cave folders."""
    out = out.resolve()
    for folder in sorted(p for p in root.iterdir() if p.is_dir() and CAVE_FOLDER.match(ascii_name(p.name))):
        for path in sorted(folder.rglob('*')):
            if not path.is_file() or out in path.resolve().parents:
                continue
            rel = path.relative_to(root).as_posix()
            suffix = path.suffix.lower()
            if any(re.search(p, path.name, re.I) for p in SKIP_NAME_PATTERNS):
                continue
            if suffix in VIDEO_TYPES:
                yield path, rel, 'video'
            elif suffix not in PHOTO_TYPES | CONVERTED_TYPES:
                continue
            elif rel in maps_taken:
                yield path, rel, 'map (map import)'
            elif MAP_NAME_HINT.search(ascii_name(path.stem).replace('_', ' ')):
                yield path, rel, 'map (name)'
            else:
                yield path, rel, None


def main(source, output):
    root, out = Path(source), Path(output)
    images_dir = out / 'images'
    maps_taken = map_sources(root / 'maps-import')
    rows, skipped = [], []

    for path, rel, skip in candidates(root, out, maps_taken):
        if skip:
            skipped.append({'source': rel, 'reason': skip})
            print(f'  skip       {rel} ({skip})', flush=True)
            continue
        try:
            data = path.read_bytes()
            row = {'source': rel, 'folder': rel.split('/')[0], 'kind': 'photo'}
            with Image.open(path) as image:
                image.seek(0)
                row['width'], row['height'] = image.size
                row.update(read_metadata(image, data))
                row['fingerprint'] = average_hash(image)
                if looks_like_map(image):
                    row['kind'] = 'map?'
                if path.suffix.lower() in CONVERTED_TYPES:
                    images_dir.mkdir(parents=True, exist_ok=True)
                    target = images_dir / f'{slug(Path(rel).parent.name)}-{slug(path.stem)}.jpg'
                    exif = image.getexif()
                    image.convert('RGB').save(target, 'JPEG', quality=JPEG_QUALITY, exif=exif)
                    data = target.read_bytes()
                    row['image'] = target.relative_to(out).as_posix()
            if 'image' not in row:
                row['image'] = Path(os.path.relpath(path, out)).as_posix()
            if row.get('panorama'):
                row['kind'] = 'panorama'
            if not row.get('camera'):
                row['flags'] = 'third-party?'
            if len(data) > MAX_FILE_BYTES:
                row['flags'] = ' | '.join(filter(None, [row.get('flags'), 'over 30 MB']))
            row['bytes'] = len(data)
            row['sha1'] = hashlib.sha1(data).hexdigest()[:12]
            rows.append(row)
            print(f'  {row["kind"]:10} {rel}' + (f' [{row["flags"]}]' if row.get('flags') else ''), flush=True)
        except Exception as error:  # noqa: BLE001 - report and go on
            print(f'  ERROR      {rel}: {error}', flush=True)
            rows.append({'source': rel, 'folder': rel.split('/')[0], 'kind': 'error', 'error': str(error)})

    # Byte-identical copies: one row, remembering every folder it was filed in.
    by_hash, kept, removed = {}, [], []
    for row in rows:
        first = by_hash.get(row.get('sha1')) if row.get('sha1') else None
        if first is None:
            if row.get('sha1'):
                by_hash[row['sha1']] = row
            kept.append(row)
            continue
        # Keep the original over a "name (1)" copy.
        if COPY_SUFFIX.search(Path(first['source']).stem) and not COPY_SUFFIX.search(Path(row['source']).stem):
            for key in ('image', 'source', 'folder'):
                first[key], row[key] = row[key], first[key]
            for entry in removed:
                if entry['keptSource'] == row['source']:
                    entry['keptSource'] = first['source']
        folders = [f for f in (first.get('alsoFiledIn') or '').split(' | ') if f]
        if row['folder'] != first['folder'] and row['folder'] not in folders:
            folders.append(row['folder'])
        first['alsoFiledIn'] = ' | '.join(f for f in folders if f != first['folder'])
        removed.append({'source': row['source'], 'keptSource': first['source']})

    # Near-identical photos: flagged only.
    usable = [r for r in kept if r.get('fingerprint')]
    for i, a in enumerate(usable):
        for b in usable[:i]:
            wa, ha, wb, hb = a['width'], a['height'], b['width'], b['height']
            if abs(wa / ha - wb / hb) <= DUPLICATE_ASPECT_TOLERANCE * (wa / ha) and hamming(a['fingerprint'], b['fingerprint']) <= REVIEW_DUPLICATE_BITS:
                a['possibleDuplicateOf'] = b['source']
                break

    out.mkdir(parents=True, exist_ok=True)
    fields = ['image', 'source', 'folder', 'kind', 'flags', 'camera', 'date', 'latitude', 'longitude', 'width', 'height', 'bytes',
              'alsoFiledIn', 'possibleDuplicateOf', 'sha1', 'error']
    with open(out / 'extracted.csv', 'w', newline='', encoding='utf-8-sig') as f:
        writer = csv.DictWriter(f, fieldnames=fields, extrasaction='ignore')
        writer.writeheader()
        writer.writerows(kept)
    with open(out / 'duplicates.csv', 'w', newline='', encoding='utf-8-sig') as f:
        writer = csv.DictWriter(f, fieldnames=['source', 'keptSource'])
        writer.writeheader()
        writer.writerows(removed)
    with open(out / 'skipped.csv', 'w', newline='', encoding='utf-8-sig') as f:
        writer = csv.DictWriter(f, fieldnames=['source', 'reason'])
        writer.writeheader()
        writer.writerows(skipped)
    kinds = {}
    for row in kept:
        kinds[row['kind']] = kinds.get(row['kind'], 0) + 1
    print(f'{len(kept)} images -> {out / "extracted.csv"} ({", ".join(f"{n} {k}" for k, n in kinds.items())}; '
          f'{sum(1 for r in kept if "third-party?" in (r.get("flags") or ""))} third-party?), '
          f'{len(removed)} duplicate copies -> duplicates.csv, {len(skipped)} skipped -> skipped.csv')


if __name__ == '__main__':
    if len(sys.argv) != 3:
        sys.exit(__doc__)
    main(sys.argv[1], sys.argv[2])

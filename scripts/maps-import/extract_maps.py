"""Collect the cave maps found under a folder tree into ready-to-upload images,
plus a CSV inventory to review before uploading (upload-maps.js).

- PDFs: a scanned map (a picture covering much of the page, usually under a
  short text stamp from the survey archive) is rendered at the picture's own
  resolution, cropped to it - which keeps any lines drawn over it, handles
  rotated pages and colour spaces browsers can't show, and drops the stamp.
  A vector map is rendered whole, ~6000 px on its long side. The stamp's text
  (cave name, place, publication and year) goes into the inventory.
- Output is WebP: lossless for vector renders and line-art scans (fine
  lines, small text), lossy at high quality for photo-like scans.
- Images: JPEG/PNG/WebP/SVG are used as they are; TIFF and GIF become
  lossless WebP.
- Zips: their images are extracted and treated like the others.
- No raster image over 10 MB: bigger ones are re-encoded as lossy WebP,
  lowering the quality, then the size, until they fit.
- Every output image gets a perceptual fingerprint, so near-identical copies
  (the same map as .jpg, .png and .pdf, "(1)" copies...) are flagged.

Usage: python scripts/maps-import/extract_maps.py <source folder> <output folder>
Needs PyMuPDF and Pillow (pip install pymupdf pillow).
"""
import csv
import hashlib
import io
import re
import sys
import unicodedata
import zipfile
from pathlib import Path

import pymupdf
from PIL import Image

Image.MAX_IMAGE_PIXELS = None

MAP_IMAGE_TYPES = {'.jpg', '.jpeg', '.png', '.webp', '.svg', '.gif', '.tif', '.tiff'}
# Longest side of a rendered vector page.
VECTOR_RENDER_LONG_SIDE = 6000
# Never render a scanned picture past this (a few archive scans are huge).
MAX_LONG_SIDE = 12000
# A picture covering at least this share of the page is the map itself.
SCAN_MIN_COVER = 0.2
WEBP_QUALITY = 90
# Largest file uploaded: bigger raster images are re-encoded as lossy WebP,
# lowering the quality, then the size, until they fit.
MAX_FILE_BYTES = 10 * 1024 * 1024
CAP_QUALITIES = (90, 85, 80, 75)
CAP_SCALE_STEP = 0.85

# Files that are obviously not maps: articles, work files, georeferencing byproducts.
SKIP_NAME_PATTERNS = [r'journal\.pone', r'^doi-', r'uws\d+vol', r'_waifu2x_', r'\.aux\.xml$', r'\.points$', r'desktop\.ini$']

# Folders scanned for maps; loose images elsewhere count only when their name says map.
MAP_FOLDERS = ('cartes',)
MAP_NAME_HINT = re.compile(r'\b(map|carte|plan|survey|sistema|systema|system)\b', re.I)


def slug(text):
    text = unicodedata.normalize('NFKD', text).encode('ascii', 'ignore').decode()
    return re.sub(r'[^A-Za-z0-9]+', '-', text).strip('-').lower()[:80] or 'map'


def average_hash(image, size=16):
    """64-bit-ish perceptual fingerprint: near-identical images get near-identical hashes."""
    small = image.convert('L').resize((size, size), Image.LANCZOS)
    pixels = list(small.getdata())
    mean = sum(pixels) / len(pixels)
    return ''.join('1' if p > mean else '0' for p in pixels)


def hamming(a, b):
    return sum(x != y for x, y in zip(a, b))


def parse_stamp(text):
    """The survey archive's stamp: name, place, state, then sources ending in a year."""
    lines = [re.sub(r'\s+', ' ', line).strip() for line in text.splitlines()]
    lines = [line for line in lines if line]
    sources = [line for line in lines if re.search(r'\b(1[89]\d\d|20\d\d)\s*$', line)]
    others = [line for line in lines if line not in sources]
    # A web source's "(accessed May 2015" is when it was read, not published.
    years = [int(y) for line in sources if 'accessed' not in line.lower() for y in re.findall(r'\b(1[89]\d\d|20\d\d)\s*$', line)]
    return {
        'stampName': others[0] if others else '',
        'stampPlace': ', '.join(others[1:3]) if len(others) > 1 else '',
        'publications': ' | '.join(sources),
        'publicationYear': str(min(years)) if years else '',
    }


def save_pixmap(pixmap, target, lossless):
    """WebP (PyMuPDF can't write it itself: through Pillow)."""
    if pixmap.alpha:
        pixmap = pymupdf.Pixmap(pixmap, 0)
    if pixmap.n not in (1, 3):
        pixmap = pymupdf.Pixmap(pymupdf.csRGB, pixmap)
    image = Image.frombytes('L' if pixmap.n == 1 else 'RGB', (pixmap.width, pixmap.height), pixmap.samples)
    path = target.with_suffix('.webp')
    save_webp(image, path, lossless)
    return path


def save_webp(image, path, lossless):
    if lossless:
        image.save(path, 'WEBP', lossless=True, method=4)
    else:
        image.save(path, 'WEBP', quality=WEBP_QUALITY, method=4)


def page_layout(page, pictures, margin=0.02):
    """Splits a page into the map and the archive's stamp.

    The map is its drawing's lines and pictures (not a page-sized background
    or frame), plus the text touching them - its own labels. The stamp is the
    text entirely below the map (or, with none there, above it): a few centred
    lines naming the cave, its place and where the map was published.
    Returns (map bounds with a small margin, stamp text)."""
    page_area = page.rect.width * page.rect.height
    drawings = [d for d in page.get_drawings() if not (d['rect'] & page.rect).is_empty]
    content = pymupdf.Rect()
    for drawing in drawings:
        rect = drawing['rect'] & page.rect
        if rect.width * rect.height < 0.95 * page_area:
            content |= rect
    for _, bbox, _ in pictures:
        content |= bbox
    # A map drawn inside a frame (a large rectangle holding nearly all of the
    # drawing) is that frame: what's outside is the stamp, sometimes lettered
    # as outlines rather than text, so only its position gives it away.
    # The smallest such frame: a page can nest one inside a larger box that
    # also encloses the stamp.
    frames = [d['rect'] for d in drawings if any(item[0] == 're' for item in d['items']) and 0.3 * page_area <= d['rect'].width * d['rect'].height < 0.95 * page_area]
    for frame in sorted(frames, key=lambda r: r.width * r.height):
        inside = sum(1 for d in drawings if frame.contains(d['rect']) or d['rect'] == frame)
        if inside >= 0.9 * len(drawings):
            content = frame & page.rect
            break
    blocks = [(pymupdf.Rect(block[:4]), block[4]) for block in page.get_text('blocks') if block[4].strip()]
    if content.is_empty:
        return page.rect, '\n'.join(text for _, text in blocks)

    below = [(rect, text) for rect, text in blocks if rect.y0 >= content.y1 - 1]
    above = [(rect, text) for rect, text in blocks if rect.y1 <= content.y0 + 1]
    stamp_blocks = below or above
    bounds = pymupdf.Rect(content)
    for rect, _ in blocks:
        if rect.intersects(content):
            bounds |= rect
    pad = margin * max(bounds.width, bounds.height)
    bounds = (bounds + (-pad, -pad, pad, pad)) & page.rect
    # Keep the margin off the stamp.
    if below:
        bounds.y1 = min(bounds.y1, min(rect.y0 for rect, _ in below))
    elif above:
        bounds.y0 = max(bounds.y0, max(rect.y1 for rect, _ in above))
    stamp_blocks.sort(key=lambda block: block[0].y0)
    return bounds, '\n'.join(text for _, text in stamp_blocks)


def extract_pdf(path, out_dir, base):
    """Yields (image path, kind, page number, stamp dict) per page that holds a map."""
    doc = pymupdf.open(path)
    for index, page in enumerate(doc):
        area = page.rect.width * page.rect.height
        pictures = []
        for info in page.get_image_info(xrefs=True):
            bbox = pymupdf.Rect(info['bbox']) & page.rect
            if bbox.is_empty:
                continue
            pictures.append((bbox.width * bbox.height / area, bbox, info))
        pictures.sort(key=lambda p: -p[0])
        clip, stamp_text = page_layout(page, pictures)
        stamp = parse_stamp(stamp_text)
        target = out_dir / (f'{base}-p{index + 1}' if doc.page_count > 1 else base)
        if pictures and pictures[0][0] >= SCAN_MIN_COVER:
            cover, bbox, info = pictures[0]
            # The picture's own resolution: its pixels per point, both ways.
            zoom = max(info['width'] / bbox.width, info['height'] / bbox.height)
            zoom = min(zoom, MAX_LONG_SIDE / max(bbox.width, bbox.height))
            pixmap = page.get_pixmap(matrix=pymupdf.Matrix(zoom, zoom), clip=bbox)
            # 1-bit / greyscale line scans: lossless keeps their lines crisp, and small.
            lossless = info.get('bpc', 8) == 1 or info.get('colorspace', 3) == 1
            yield save_pixmap(pixmap, target, lossless), 'pdf-scan', index + 1, stamp
        else:
            zoom = VECTOR_RENDER_LONG_SIDE / max(clip.width, clip.height)
            pixmap = page.get_pixmap(matrix=pymupdf.Matrix(zoom, zoom), clip=clip)
            yield save_pixmap(pixmap, target, True), 'pdf-vector', index + 1, stamp


def cap_file_size(path):
    """Brings a raster image over MAX_FILE_BYTES under it, as lossy WebP:
    the quality first (down to 75), then the pixel size, 15% at a time.
    Returns the (possibly renamed) path."""
    if path.suffix == '.svg' or path.stat().st_size <= MAX_FILE_BYTES:
        return path
    target = path.with_suffix('.webp')
    with Image.open(path) as source:
        image = source.convert('RGBA' if 'A' in source.getbands() else 'RGB')
    scale = 1.0
    while True:
        sized = image if scale == 1.0 else image.resize((round(image.width * scale), round(image.height * scale)), Image.LANCZOS)
        for quality in CAP_QUALITIES:
            buffer = io.BytesIO()
            sized.save(buffer, 'WEBP', quality=quality, method=4)
            if buffer.tell() <= MAX_FILE_BYTES:
                if target != path:
                    path.unlink()
                target.write_bytes(buffer.getvalue())
                return target
        scale *= CAP_SCALE_STEP


def clean_svg(data):
    """Drops a style on the root <svg>: files saved from online editors keep
    the editor's zoom/pan there (e.g. a CSS transform scaling it 10x), which
    browsers apply - showing a zoomed-in corner - while thumbnail renderers
    ignore it."""
    text = data.decode('utf-8', errors='replace')
    return re.sub(r'(<svg\b[^>]*?)\s+style="[^"]*"', r'\1', text, count=1).encode('utf-8')


def convert_image(data, name, out_dir, base):
    suffix = Path(name).suffix.lower()
    if suffix == '.svg':
        path = out_dir / f'{base}.svg'
        path.write_bytes(clean_svg(data))
        return path
    if suffix in {'.jpg', '.jpeg', '.png', '.webp'}:
        path = out_dir / f'{base}{".jpg" if suffix == ".jpeg" else suffix}'
        path.write_bytes(data)
        return path
    image = Image.open(io.BytesIO(data))
    image.seek(0)
    path = out_dir / f'{base}.webp'
    save_webp(image.convert('RGBA' if 'A' in image.getbands() or image.mode == 'P' else 'RGB'), path, True)
    return path


def candidates(root):
    for path in sorted(root.rglob('*')):
        if not path.is_file():
            continue
        rel = path.relative_to(root).as_posix()
        if any(re.search(p, path.name, re.I) for p in SKIP_NAME_PATTERNS):
            continue
        suffix = path.suffix.lower()
        in_map_folder = rel.split('/')[0] in MAP_FOLDERS
        if suffix == '.pdf':
            yield path, rel
        elif suffix == '.zip' and in_map_folder:
            yield path, rel
        elif suffix in MAP_IMAGE_TYPES and (in_map_folder or MAP_NAME_HINT.search(path.stem)):
            yield path, rel


def main(source, output):
    root, out = Path(source), Path(output)
    images_dir = out / 'images'
    images_dir.mkdir(parents=True, exist_ok=True)
    rows, used = [], set()

    def unique_base(name):
        base = slug(name)
        candidate, n = base, 2
        while candidate in used:
            candidate, n = f'{base}-{n}', n + 1
        used.add(candidate)
        return candidate

    def add(image_path, rel, kind, page='', stamp=None):
        image_path = cap_file_size(image_path)
        row = {'image': image_path.relative_to(out).as_posix(), 'source': rel, 'page': page, 'kind': kind, **(stamp or {})}
        if image_path.suffix != '.svg':
            with Image.open(image_path) as image:
                row['width'], row['height'] = image.size
                row['fingerprint'] = average_hash(image)
        row['bytes'] = image_path.stat().st_size
        row['sha1'] = hashlib.sha1(image_path.read_bytes()).hexdigest()[:12]
        rows.append(row)
        print(f'  {kind:10} {rel}' + (f' p{page}' if page else ''), flush=True)

    for path, rel in candidates(root):
        try:
            if path.suffix.lower() == '.pdf':
                for image_path, kind, page, stamp in extract_pdf(path, images_dir, unique_base(path.stem)):
                    add(image_path, rel, kind, page, stamp)
            elif path.suffix.lower() == '.zip':
                with zipfile.ZipFile(path) as archive:
                    for info in archive.infolist():
                        if Path(info.filename).suffix.lower() in MAP_IMAGE_TYPES:
                            image_path = convert_image(archive.read(info), info.filename, images_dir, unique_base(f'{path.stem} {Path(info.filename).stem}'))
                            add(image_path, f'{rel}#{info.filename}', 'zip-image')
            else:
                image_path = convert_image(path.read_bytes(), path.name, images_dir, unique_base(path.stem))
                add(image_path, rel, 'image')
        except Exception as error:  # noqa: BLE001 - report and go on
            print(f'  ERROR      {rel}: {error}', flush=True)
            rows.append({'source': rel, 'kind': 'error', 'error': str(error)})

    # Near-duplicates: same fingerprint within a few bits.
    for i, row in enumerate(rows):
        for other in rows[:i]:
            if row.get('fingerprint') and other.get('fingerprint') and hamming(row['fingerprint'], other['fingerprint']) <= 12:
                row['possibleDuplicateOf'] = other['image']
                break

    fields = ['image', 'source', 'page', 'kind', 'width', 'height', 'bytes', 'stampName', 'stampPlace', 'publications', 'publicationYear', 'possibleDuplicateOf', 'sha1', 'error']
    with open(out / 'extracted.csv', 'w', newline='', encoding='utf-8-sig') as f:
        writer = csv.DictWriter(f, fieldnames=fields, extrasaction='ignore')
        writer.writeheader()
        writer.writerows(rows)
    print(f'{len(rows)} images -> {out / "extracted.csv"}')


if __name__ == '__main__':
    if len(sys.argv) != 3:
        sys.exit(__doc__)
    main(sys.argv[1], sys.argv[2])

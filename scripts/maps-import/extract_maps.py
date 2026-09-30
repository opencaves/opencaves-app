"""Collect the cave maps found under a folder tree into ready-to-upload images,
plus a CSV inventory to review before uploading (upload-maps.js).

- PDFs: a scanned map (a picture covering much of the page, usually under a
  short text stamp from the survey archive) is rendered at the picture's own
  resolution, cropped to it - which keeps any lines drawn over it, handles
  rotated pages and colour spaces browsers can't show, and drops the stamp.
  A vector map (real vector paths) is exported as SVG, cropped to the
  drawing, its text as outlines; a page with only raster pictures is
  rendered to WebP, ~6000 px on its long side, cropped the same way. The
  stamp's text (cave name, place, publication and year) goes into the
  inventory.
- Rasters are WebP: lossless for renders and line-art scans (fine lines,
  small text), lossy at high quality for photo-like scans.
- Scans of paper pages lose their wide blank margins, down to a margin of
  3% of the drawing's size.
- Images: JPEG/PNG/WebP/SVG are used as they are; TIFF and GIF become
  lossless WebP.
- Zips: their images are extracted and treated like the others.
- No raster image over 10 MB: bigger ones are re-encoded as lossy WebP,
  lowering the quality, then the size, until they fit.
- Duplicates: every image gets a perceptual fingerprint. Copies of the same
  map (the same map as .jpg and .pdf, "(1)" copies, one sheet filed under
  each cave it shows) are reduced to the best one, which keeps the names
  the others were filed under (alsoFiledAs); removed copies are listed in
  duplicates.csv. Closer-but-unsure pairs are only flagged.
- Reviewed duplicates: copies the fingerprint can't see (a photo of a wall
  poster and its scan, a redrawn or recoloured copy, another edition's
  reprint) are listed by hand in known-duplicates.csv, next to this script,
  with the copy to keep. They're removed the same way.

Usage: python scripts/maps-import/extract_maps.py <source folder> <output folder>
       python scripts/maps-import/extract_maps.py --known-duplicates <output folder>
         (applies known-duplicates.csv to an existing extraction, without re-extracting)
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

import numpy
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
# Scans of paper pages: wide blank paper around the drawing is trimmed down
# to a margin. A pixel darker than INK_LEVEL (0-255 grey) is ink; a row or
# column holds content with at least INK_MIN_SHARE of ink, as part of a run
# at least CONTENT_MIN_RUN of the side long - so the thin dark lines at a
# scan's edges (the lid, the page's edge) don't count.
INK_LEVEL = 170
INK_MIN_SHARE = 0.003
CONTENT_MIN_RUN = 0.01
# Margin kept around the drawing, as a share of its longest side.
TRIM_MARGIN = 0.03
# Only trimmed when that removes at least this share of the image.
TRIM_MIN_GAIN = 0.10
# Fingerprints this close (bits, of 256) are the same map: only the best copy
# is kept. Up to REVIEW_DUPLICATE_BITS they're only flagged, for review.
DUPLICATE_BITS = 8
REVIEW_DUPLICATE_BITS = 16
# ... and only with the same proportions (width/height within this share).
DUPLICATE_ASPECT_TOLERANCE = 0.03
# A page is a vector map (exported as SVG) with at least this many vector
# paths in the map's area; with fewer - only raster pictures, a frame - it's
# rendered to WebP instead.
MIN_VECTOR_PATHS = 20

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
    pixels = list(small.tobytes())
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


def save_pixmap(pixmap, target, lossless, trim=False):
    """WebP (PyMuPDF can't write it itself: through Pillow)."""
    if pixmap.alpha:
        pixmap = pymupdf.Pixmap(pixmap, 0)
    if pixmap.n not in (1, 3):
        pixmap = pymupdf.Pixmap(pymupdf.csRGB, pixmap)
    image = Image.frombytes('L' if pixmap.n == 1 else 'RGB', (pixmap.width, pixmap.height), pixmap.samples)
    if trim:
        image = trim_margins(image)
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


def count_vector_paths(page, clip):
    return sum(1 for drawing in page.get_drawings() if clip.intersects(drawing['rect']))


def export_svg(page, clip, target):
    """The page's map area as SVG, text as outlines (no fonts needed to show
    it). None when that isn't reliable - a rotated page, whose crop box is in
    unrotated coordinates - or the SVG would be over MAX_FILE_BYTES."""
    if page.rotation:
        return None
    page.set_cropbox(clip)
    svg = page.get_svg_image(text_as_path=True).encode('utf-8')
    if len(svg) > MAX_FILE_BYTES:
        return None
    path = target.with_suffix('.svg')
    path.write_bytes(svg)
    return path


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
            # Scans of paper pages: trim the paper around the drawing.
            yield save_pixmap(pixmap, target, lossless, trim=True), 'pdf-scan', index + 1, stamp
        else:
            # A real vector drawing becomes an SVG: exact, sharp at any zoom.
            # Only raster pictures (or an SVG too large) get a WebP render.
            svg_path = export_svg(page, clip, target) if count_vector_paths(page, clip) >= MIN_VECTOR_PATHS else None
            if svg_path:
                yield svg_path, 'pdf-svg', index + 1, stamp
            else:
                zoom = VECTOR_RENDER_LONG_SIDE / max(clip.width, clip.height)
                pixmap = page.get_pixmap(matrix=pymupdf.Matrix(zoom, zoom), clip=clip)
                yield save_pixmap(pixmap, target, True), 'pdf-render', index + 1, stamp


def content_runs(ink_counts, length, min_share, min_run):
    """First and last index of the content along one axis: positions with
    enough ink, within runs long enough to be drawing rather than an edge line."""
    has_ink = ink_counts >= min_share * length
    runs, start = [], None
    for index, value in enumerate(has_ink):
        if value and start is None:
            start = index
        elif not value and start is not None:
            runs.append((start, index - 1))
            start = None
    if start is not None:
        runs.append((start, len(has_ink) - 1))
    long_runs = [run for run in runs if run[1] - run[0] + 1 >= min_run * len(has_ink)]
    if not long_runs:
        return None
    return long_runs[0][0], long_runs[-1][1]


def content_box(image):
    """The drawing's bounding box on a scanned page, in the image's pixels,
    or None when there's no clear blank margin to speak of."""
    grey = image.convert('L')
    # Measured on a reduced copy: fast, and blurs away specks of dust.
    factor = max(grey.size) / 1500
    small = grey.resize((max(1, round(grey.width / factor)), max(1, round(grey.height / factor))), Image.BILINEAR) if factor > 1 else grey
    ink = numpy.asarray(small) < INK_LEVEL
    columns = content_runs(ink.sum(axis=0), ink.shape[0], INK_MIN_SHARE, CONTENT_MIN_RUN)
    rows = content_runs(ink.sum(axis=1), ink.shape[1], INK_MIN_SHARE, CONTENT_MIN_RUN)
    if not columns or not rows:
        return None
    scale = grey.width / small.width
    return (round(columns[0] * scale), round(rows[0] * scale), round((columns[1] + 1) * scale), round((rows[1] + 1) * scale))


def trim_margins(image):
    """Crops wide blank paper margins down to TRIM_MARGIN around the drawing."""
    box = content_box(image)
    if not box:
        return image
    left, top, right, bottom = box
    pad = round(TRIM_MARGIN * max(right - left, bottom - top))
    left, top = max(0, left - pad), max(0, top - pad)
    right, bottom = min(image.width, right + pad), min(image.height, bottom + pad)
    if (right - left) * (bottom - top) > (1 - TRIM_MIN_GAIN) * image.width * image.height:
        return image
    return image.crop((left, top, right, bottom))


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


def svg_fingerprint(path):
    """An SVG's size and fingerprint, from a render (PyMuPDF opens SVGs)."""
    try:
        with pymupdf.open(path) as doc:
            page = doc[0]
            zoom = 512 / max(page.rect.width, page.rect.height)
            pixmap = page.get_pixmap(matrix=pymupdf.Matrix(zoom, zoom))
            image = Image.frombytes('RGB' if pixmap.n >= 3 else 'L', (pixmap.width, pixmap.height), pixmap.samples if pixmap.n != 4 else pymupdf.Pixmap(pymupdf.csRGB, pixmap).samples)
            return round(page.rect.width), round(page.rect.height), average_hash(image)
    except Exception:  # noqa: BLE001 - no fingerprint: never merged
        return '', '', ''


def filed_as(row):
    """The name a copy was filed under: its stamp's, else its file's."""
    return row.get('stampName') or Path(row['source'].split('#')[-1]).stem


def keeper_rank(row):
    """Which copy of a map to keep: rasters before hand-made SVGs (traced
    or editor exports), then the most pixels, then the smallest file."""
    pixels = int(row['width'] or 0) * int(row['height'] or 0)
    return (row['image'].endswith('.svg'), -pixels, int(row['bytes']))


def remove_duplicates(rows, out):
    """Keeps one copy of each map (see keeper_rank) and deletes the others'
    files, carrying their names over to it: one map sheet is often filed
    under each of the caves it shows, and the upload attaches it to each.
    Closer-but-unsure pairs are only flagged (possibleDuplicateOf).
    Returns (kept rows, removed rows)."""
    def same_shape(a, b):
        wa, ha, wb, hb = (int(v or 0) for v in (a['width'], a['height'], b['width'], b['height']))
        return wa and ha and wb and hb and abs(wa / ha - wb / hb) <= DUPLICATE_ASPECT_TOLERANCE * (wa / ha)

    usable = [r for r in rows if r.get('fingerprint')]
    parent = {id(r): r for r in usable}

    def root(r):
        while parent[id(r)] is not r:
            r = parent[id(r)]
        return r

    for i, a in enumerate(usable):
        for b in usable[:i]:
            distance = hamming(a['fingerprint'], b['fingerprint'])
            if distance <= DUPLICATE_BITS and same_shape(a, b):
                ra, rb = root(a), root(b)
                if ra is not rb:
                    parent[id(ra)] = rb
            elif distance <= REVIEW_DUPLICATE_BITS and not a.get('possibleDuplicateOf'):
                a['possibleDuplicateOf'] = b['image']

    groups = {}
    for r in usable:
        groups.setdefault(id(root(r)), []).append(r)
    removed = []
    for group in groups.values():
        if len(group) < 2:
            continue
        group.sort(key=keeper_rank)
        keeper, others = group[0], group[1:]
        names = [filed_as(keeper)] + [filed_as(o) for o in others]
        keeper['alsoFiledAs'] = ' | '.join(dict.fromkeys(n for n in names[1:] if n and n != names[0]))
        keeper['duplicateSources'] = ' | '.join(o['source'] for o in others)
        for other in others:
            (out / other['image']).unlink(missing_ok=True)
            other['keptImage'] = keeper['image']
            removed.append(other)
    removed_ids = {id(r) for r in removed}
    return [r for r in rows if id(r) not in removed_ids], removed


KNOWN_DUPLICATES = Path(__file__).with_name('known-duplicates.csv')


def source_key(row):
    """How known-duplicates.csv names a map: its source file, plus #p<page> for a PDF page."""
    return row['source'] + (f"#p{row['page']}" if row.get('page') else '')


def remove_known_duplicates(rows, out):
    """Removes the copies listed in known-duplicates.csv (when the copy to keep
    is there too), like remove_duplicates does. Returns (kept rows, removed rows)."""
    if not KNOWN_DUPLICATES.exists():
        return rows, []
    by_key = {source_key(r): r for r in rows if r.get('image')}
    removed = []
    for entry in csv.DictReader(open(KNOWN_DUPLICATES, encoding='utf-8')):
        dup, keeper = by_key.get(entry['duplicate']), by_key.get(entry['keep'])
        if not dup or not keeper or dup is keeper:
            continue
        names = [n for n in (keeper.get('alsoFiledAs') or '').split(' | ') if n]
        names += [filed_as(dup)] + [n for n in (dup.get('alsoFiledAs') or '').split(' | ') if n]
        keeper['alsoFiledAs'] = ' | '.join(dict.fromkeys(n for n in names if n != filed_as(keeper)))
        keeper['duplicateSources'] = ' | '.join(v for v in [keeper.get('duplicateSources'), dup['source'], dup.get('duplicateSources')] if v)
        (out / dup['image']).unlink(missing_ok=True)
        dup['keptImage'] = keeper['image']
        removed.append(dup)
        del by_key[entry['duplicate']]
    removed_ids = {id(r) for r in removed}
    return [r for r in rows if id(r) not in removed_ids], removed


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


def candidates(root, exclude):
    """Map files under root, except under exclude (the output folder, when
    inside the source tree: a rerun must not take its own output as input)."""
    exclude = exclude.resolve()
    for path in sorted(root.rglob('*')):
        if not path.is_file() or exclude in path.resolve().parents:
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
        else:
            row['width'], row['height'], row['fingerprint'] = svg_fingerprint(image_path)
        row['bytes'] = image_path.stat().st_size
        row['sha1'] = hashlib.sha1(image_path.read_bytes()).hexdigest()[:12]
        rows.append(row)
        print(f'  {kind:10} {rel}' + (f' p{page}' if page else ''), flush=True)

    for path, rel in candidates(root, out):
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

    rows, removed = remove_duplicates(rows, out)
    rows, known = remove_known_duplicates(rows, out)
    write_outputs(rows, removed + known, out)


def write_outputs(rows, removed, out):
    fields = ['image', 'source', 'page', 'kind', 'width', 'height', 'bytes', 'stampName', 'stampPlace', 'publications', 'publicationYear', 'alsoFiledAs', 'duplicateSources', 'possibleDuplicateOf', 'sha1', 'error']
    with open(out / 'extracted.csv', 'w', newline='', encoding='utf-8-sig') as f:
        writer = csv.DictWriter(f, fieldnames=fields, extrasaction='ignore')
        writer.writeheader()
        writer.writerows(rows)
    with open(out / 'duplicates.csv', 'w', newline='', encoding='utf-8-sig') as f:
        writer = csv.DictWriter(f, fieldnames=['source', 'image', 'keptImage', 'width', 'height', 'sha1'], extrasaction='ignore')
        writer.writeheader()
        writer.writerows(removed)
    print(f'{len(rows)} maps -> {out / "extracted.csv"} ({len(removed)} duplicate copies removed -> duplicates.csv)')


def apply_known_duplicates(output):
    """known-duplicates.csv applied to an existing extraction: its rows, and
    the duplicates already removed (kept in duplicates.csv)."""
    out = Path(output)
    rows = list(csv.DictReader(open(out / 'extracted.csv', encoding='utf-8-sig')))
    earlier = list(csv.DictReader(open(out / 'duplicates.csv', encoding='utf-8-sig'))) if (out / 'duplicates.csv').exists() else []
    rows, known = remove_known_duplicates(rows, out)
    write_outputs(rows, earlier + known, out)


if __name__ == '__main__':
    if len(sys.argv) == 3 and sys.argv[1] == '--known-duplicates':
        apply_known_duplicates(sys.argv[2])
    elif len(sys.argv) == 3:
        main(sys.argv[1], sys.argv[2])
    else:
        sys.exit(__doc__)

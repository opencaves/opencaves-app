"""Writes each placed map's image as laid on the ground, for the app's
original-vs-drawing viewer (admin map layers page): the image the drawing was
traced from (a scan or straightened photo, or a vector map's PDF page,
rendered), reduced to at most 2048 px, and its four corners in longitude/
latitude - by the same placement as the drawing (overlay_scan's
raster_placement, build_layer's vector_placement), so the two line up.

Writes <output>/<id>.webp and <output>/<id>.json ({"corners": [[lng, lat] x 4]},
top-left, top-right, bottom-right, bottom-left: Mapbox's image source order),
for every map with an "id" and not "unverified". A map whose outputs are newer
than its config and image is skipped.

Usage: python scripts/map-layer/georef_scans.py <output folder>
Needs Pillow, numpy, pyproj, PyMuPDF.
"""
import io
import json
import sys
from pathlib import Path

from PIL import Image
from pyproj import Transformer

sys.path.insert(0, str(Path(__file__).resolve().parent))
from build_layer import vector_placement  # noqa: E402
from overlay_scan import raster_placement  # noqa: E402

MAPS = Path(__file__).resolve().parent / 'maps'
MAX_SIDE = 2048
QUALITY = 70
Image.MAX_IMAGE_PIXELS = None


def placed(config_path, config):
    """(image, corners): the image, and its corners on the ground."""
    # A vector map is traced from its PDF's drawings ("walls" styles); a PDF
    # map traced as a scan ("trace") is placed by its image's pixels.
    if config.get('pdf') and config.get('walls') and not config.get('trace'):
        import pymupdf
        page = pymupdf.open(config_path.parent.joinpath(config['pdf']).resolve())[config.get('page', 1) - 1]
        place, _, _ = vector_placement(config)
        r = page.rect
        corners = [place(r.x0, r.y0), place(r.x1, r.y0), place(r.x1, r.y1), place(r.x0, r.y1)]
        zoom = MAX_SIDE / max(r.width, r.height)
        pixmap = page.get_pixmap(matrix=pymupdf.Matrix(zoom, zoom))
        return Image.open(io.BytesIO(pixmap.tobytes('png'))), corners
    image = Image.open(config_path.parent.joinpath(config['image']).resolve())
    place, _, _ = raster_placement(config)
    to_lnglat = Transformer.from_crs(config['utmEpsg'], 4326, always_xy=True)
    w, h = image.size
    corners = [to_lnglat.transform(*place(x, y)) for x, y in [(0, 0), (w, 0), (w, h), (0, h)]]
    return image, corners


def main(output):
    out = Path(output)
    out.mkdir(parents=True, exist_ok=True)
    written = skipped = 0
    for config_path in sorted(MAPS.glob('*.json')):
        config = json.loads(config_path.read_text(encoding='utf-8'))
        if config.get('unverified') or not config.get('id') or not (config.get('pdf') or config.get('image')) or 'controlPoints' not in config and 'scaleBar' not in config:
            continue
        vector = config.get('pdf') and config.get('walls') and not config.get('trace')
        source = config_path.parent.joinpath(config['pdf'] if vector else config['image']).resolve()
        webp, corners_file = out / f"{config['id']}.webp", out / f"{config['id']}.json"
        newest = max(config_path.stat().st_mtime, source.stat().st_mtime)
        if webp.exists() and corners_file.exists() and min(webp.stat().st_mtime, corners_file.stat().st_mtime) > newest:
            skipped += 1
            continue
        image, corners = placed(config_path, config)
        image = image.convert('RGB')
        image.thumbnail((MAX_SIDE, MAX_SIDE))
        image.save(webp, 'WEBP', quality=QUALITY)
        corners_file.write_text(json.dumps({'corners': [[round(lng, 6), round(lat, 6)] for lng, lat in corners]}), encoding='utf-8')
        written += 1
    print(f'[scans] {written} written, {skipped} up to date -> {out}')


if __name__ == '__main__':
    if len(sys.argv) != 2:
        sys.exit(__doc__)
    main(sys.argv[1])

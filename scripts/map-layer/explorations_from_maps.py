"""Feeds the exploration history printed on the processed maps into the
exploration workbook (_data/maps-import/explorations.xlsx), which
scripts/maps-import/import-explorations.js imports into the sistemas.

For each map config given:
- the map is already in the workbook (a reviewed reading of it, keyed by its
  image in the maps import): reported and left alone - a careful reading
  beats OCR;
- else its history blocks (the config's "exclude" entries marked
  "history": true - exploration history, explorers, credits) are read by
  Tesseract and turned into draft rows, in the workbook's columns, in
  <output folder>/explorations-draft.xlsx: one row per dated paragraph (its
  date in explorationDate), the map's credits in the first row, and the
  sistema's current explorations (from the database) to compare. The raw
  text goes into the comment, readQuality says "ocr - to review".

--append adds the draft rows (after review: edit, delete or mark
"EXCLUDED ..." in the draft first) to the workbook, skipping maps already in
it.

Usage: python scripts/map-layer/explorations_from_maps.py <output folder> <config.json>... [--append] [--production]
Reads the local Firestore emulator by default.
Needs openpyxl, pytesseract, Pillow.
"""
import json
import os
import re
import sys
from pathlib import Path

from openpyxl import Workbook, load_workbook
from openpyxl.styles import Font
from PIL import Image

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / 'maps-import'))
from match_maps import fetch_collection  # noqa: E402

from triage_maps import TESSDATA, TESSERACT  # noqa: E402

Image.MAX_IMAGE_PIXELS = None
ROOT = Path(__file__).resolve().parents[2]
WORKBOOK = ROOT / '_data' / 'maps-import' / 'explorations.xlsx'
COLUMNS = ['image', 'sistemaNames', 'mapTitle', 'mapAuthors', 'mapDate', 'explorationDate', 'explorationTeam',
           'explorationDescription', 'currentExplorations', 'readQuality', 'comment']
MONTHS = {m: i + 1 for i, m in enumerate(['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'])}
MONTHS.update({'ene': 1, 'abr': 4, 'ago': 8, 'dic': 12, 'janv': 1, 'févr': 2, 'avr': 4, 'mai': 5, 'juin': 6, 'juil': 7, 'août': 8, 'déc': 12})


def import_image(config, config_path):
    """The map's key in the maps import: its image there ("images/...")."""
    if config.get('pdf'):
        return config['image']
    source = config.get('perspective', {}).get('photo') or config['image']
    return 'images/' + Path(source).name


def ocr_block(image, box):
    import pytesseract
    pytesseract.pytesseract.tesseract_cmd = TESSERACT
    os.environ['TESSDATA_PREFIX'] = TESSDATA
    crop = image.crop(box)
    if max(crop.size) < 2000:
        crop = crop.resize((crop.width * 2, crop.height * 2), Image.LANCZOS)
    return pytesseract.image_to_string(crop, lang='eng+spa', config='--psm 6')


def paragraphs(text):
    """Lines joined into paragraphs: a blank line, or a line starting with a
    date, starts a new one."""
    result, current = [], []
    for line in (raw.strip() for raw in text.splitlines()):
        if not line:
            if current:
                result.append(' '.join(current))
                current = []
            continue
        if current and DATE.match(line):
            result.append(' '.join(current))
            current = []
        current.append(line)
    if current:
        result.append(' '.join(current))
    return [re.sub(r'\s+', ' ', p).strip() for p in result if len(p.strip()) > 3]


# Dates as written in histories: 1996, 11-04-1996, 11/4/96, April 11, 1996,
# 11 April 1996, April 1996.
DATE = re.compile(r'^\W*((\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})|([A-Za-zéû]{3,9})\.?\s+(\d{1,2}),?\s+(\d{4})|(\d{1,2})\s+([A-Za-zéû]{3,9})\.?\s+(\d{4})|([A-Za-zéû]{3,9})\.?\s+(\d{4})|(1[89]\d\d|20\d\d))\b')


def valid(year, month, day):
    """YYYY-MM-DD when that day exists; else as much as is right (a map's
    "31-11-2004" gives 2004-11)."""
    import datetime
    if not 1 <= month <= 12:
        return str(year)
    try:
        return datetime.date(year, month, day).isoformat()
    except ValueError:
        return f'{year}-{month:02d}'


def partial_date(paragraph):
    """The paragraph's leading date as YYYY, YYYY-MM or YYYY-MM-DD, or ''."""
    m = DATE.match(paragraph)
    if not m:
        return ''
    g = m.groups()

    def year(y):
        y = int(y)
        return y + (1900 if y > 50 else 2000) if y < 100 else y

    def month(name):
        return MONTHS.get(name.lower()[:4]) or MONTHS.get(name.lower()[:3])
    if g[1]:
        day, mon, y = int(g[1]), int(g[2]), year(g[3])
        return valid(y, mon, day)
    if g[4] and month(g[4]):
        return valid(int(g[6]), month(g[4]), int(g[5]))
    if g[8] and month(g[8]):
        return valid(int(g[9]), month(g[8]), int(g[7]))
    if g[10] and month(g[10]):
        return f'{g[11]}-{month(g[10]):02d}'
    return g[12] or ''


def main(output, config_paths, append, production):
    out = Path(output)
    reviewed = load_workbook(WORKBOOK)
    sheet = reviewed.worksheets[0]
    header = [c.value for c in sheet[1]]
    in_workbook = {row[header.index('image')] for row in sheet.iter_rows(min_row=2, values_only=True) if row[0]}
    draft_path = out / 'explorations-draft.xlsx'

    if append:
        draft = load_workbook(draft_path).worksheets[0]
        draft_header = [c.value for c in draft[1]]
        added = 0
        for row in draft.iter_rows(min_row=2, values_only=True):
            record = dict(zip(draft_header, row))
            if not record.get('image') or record['image'] in in_workbook:
                continue
            sheet.append([record.get(column) for column in header])
            added += 1
        reviewed.save(WORKBOOK)
        print(f'{added} draft rows added to {WORKBOOK}; maps already there were skipped. Next: import-explorations.js')
        return

    sistemas = {s['id']: s for s in fetch_collection('sistemas', production)}
    rows, report = [], []
    for config_path in map(Path, config_paths):
        config = json.loads(config_path.read_text(encoding='utf-8'))
        key = import_image(config, config_path)
        if key in in_workbook:
            report.append(f'{config_path.stem}: already in the workbook ({key}) - left alone')
            continue
        blocks = [e for e in config.get('exclude', []) if e.get('history')]
        if not blocks:
            report.append(f'{config_path.stem}: no history block marked ("history": true in its exclude boxes)')
            continue
        image_path = config_path.parent.joinpath(config['image']).resolve()
        image = Image.open(image_path).convert('L')
        sistema = sistemas.get(config.get('sistemaId'), {})
        current = '; '.join(f"{e.get('date', '?')} - {e.get('team', '')}".strip(' -') for e in (sistema.get('explorations') or [])) or '(none)'
        current = f"{sistema.get('name', '?')}: {current}"
        texts = [ocr_block(image, e['box']) for e in blocks]
        first = True
        for block, text in zip(blocks, texts):
            for paragraph in paragraphs(text):
                date = partial_date(paragraph)
                rows.append({
                    'image': key, 'sistemaNames': sistema.get('name', ''),
                    'mapTitle': config.get('title', '') if first else None,
                    'mapAuthors': None, 'mapDate': None,
                    'explorationDate': date, 'explorationTeam': None,
                    'explorationDescription': paragraph,
                    'currentExplorations': current, 'readQuality': 'ocr - to review',
                    'comment': f"From the map's \"{block.get('why', 'history')}\" block." + ('' if date else ' No date found: add it, or merge into another row.'),
                })
                first = False
        report.append(f'{config_path.stem}: {sum(1 for r in rows if r["image"] == key)} draft rows from {len(blocks)} history block(s)')

    out.mkdir(parents=True, exist_ok=True)
    workbook = Workbook()
    ws = workbook.active
    ws.title = 'Draft'
    ws.append(COLUMNS)
    for cell in ws[1]:
        cell.font = Font(bold=True)
    for row in rows:
        ws.append([row.get(column) for column in COLUMNS])
    ws.freeze_panes = 'A2'
    workbook.save(draft_path)
    print('\n'.join(report))
    print(f'{len(rows)} draft rows -> {draft_path}' + (' (review them, then --append)' if rows else ''))


if __name__ == '__main__':
    args = [a for a in sys.argv[1:] if not a.startswith('--')]
    if len(args) < 2 and '--append' not in sys.argv:
        sys.exit(__doc__)
    main(args[0], args[1:], '--append' in sys.argv, '--production' in sys.argv)

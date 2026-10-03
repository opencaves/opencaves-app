"""Draws a map's Arianne lines by hand, in the browser, over its scan: where
the tracing can't tell the line from the rest of the drawing.

Opens a page on http://127.0.0.1:<port>/ showing the scan (the image the
config traces) with the config's "arianneLines" (trace) and the traced walls
(<output>/<name>-walls-review.png, in red) for reference. Save writes the lines
back into the config's "trace" -> "arianneLines" (pixel coordinates, the rest
of the file left as it is), then retraces the map and rebuilds its overlay
(trace_scan.py, overlay_scan.py) - reload the overlay to see them placed.

On the page: Draw (D) - click to add points, double-click or Enter ends the
line, Esc drops it; Edit (E) - click a line to select it, drag its points,
Delete removes it, Alt+click on a point removes that point; Ctrl+Z undoes.
The wheel zooms, a drag with the right button (or Space held) pans.

Usage: python scripts/map-layer/line_editor.py <config.json> [<output folder>] [--port 8765]
The output folder defaults to _data/map-layer/scans. Needs Pillow.
"""
import json
import re
import subprocess
import sys
import threading
import webbrowser
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[1]


def write_lines(config_path, lines):
    """The config with its trace's "arianneLines" replaced by lines, by text:
    the rest of the file keeps its layout."""
    text = config_path.read_text(encoding='utf-8')
    value = json.dumps(lines, separators=(',', ':'))
    match = re.search(r'"arianneLines":\s*\[', text)
    if match:
        # The value's end: its closing bracket at depth 0.
        depth, end = 0, match.end() - 1
        for i in range(end, len(text)):
            depth += {'[': 1, ']': -1}.get(text[i], 0)
            if depth == 0:
                end = i + 1
                break
        text = text[:match.start()] + '"arianneLines": ' + value + text[end:]
    else:
        trace = re.search(r'"trace":\s*\{', text)
        if not trace:
            raise ValueError('no "trace" in the config')
        text = text[:trace.end()] + ' "arianneLines": ' + value + ',' + text[trace.end():]
    json.loads(text)  # still valid
    config_path.write_text(text, encoding='utf-8', newline='')


def walls_only(review):
    """The traced walls of a review image (its black lines) in red, on
    transparency: shown over the scan without hiding it."""
    import io
    import numpy
    from PIL import Image
    pixels = numpy.asarray(Image.open(review).convert('RGB')).astype(int)
    rgba = numpy.zeros((*pixels.shape[:2], 4), numpy.uint8)
    rgba[pixels.sum(axis=2) < 60] = (229, 57, 53, 255)
    buffer = io.BytesIO()
    Image.fromarray(rgba, 'RGBA').save(buffer, 'PNG')
    return buffer.getvalue()


def retrace(config_path, out):
    """trace_scan.py then overlay_scan.py; their last output lines."""
    log = []
    for script in ('trace_scan.py', 'overlay_scan.py'):
        result = subprocess.run([sys.executable, str(HERE / script), str(config_path), str(out)], capture_output=True, text=True, cwd=HERE)
        log.append((result.stdout.strip().splitlines() or [''])[-1] if result.returncode == 0 else (result.stderr.strip().splitlines() or ['failed'])[-1])
        if result.returncode:
            break
    return log


def main(config_path, out, port):
    config = json.loads(config_path.read_text(encoding='utf-8'))
    name = config_path.stem
    image = (config_path.parent / config['image']).resolve()
    review = out / f'{name}-walls-review.png'
    page = (HERE / 'line_editor.html').read_text(encoding='utf-8')
    busy = threading.Lock()

    class Handler(BaseHTTPRequestHandler):
        def log_message(self, *args):
            pass

        def send(self, status, body, kind):
            data = body if isinstance(body, bytes) else body.encode('utf-8')
            self.send_response(status)
            self.send_header('Content-Type', kind)
            self.send_header('Cache-Control', 'no-store')
            self.send_header('Content-Length', str(len(data)))
            self.end_headers()
            self.wfile.write(data)

        def do_GET(self):
            if self.path == '/':
                self.send(200, page, 'text/html; charset=utf-8')
            elif self.path == '/state':
                current = json.loads(config_path.read_text(encoding='utf-8'))
                self.send(200, json.dumps({'title': current.get('title', name), 'lines': current.get('trace', {}).get('arianneLines', []), 'review': review.exists()}), 'application/json')
            elif self.path == '/scan':
                self.send(200, image.read_bytes(), {'.png': 'image/png', '.webp': 'image/webp'}.get(image.suffix.lower(), 'image/jpeg'))
            elif self.path == '/favicon.ico':
                self.send(204, b'', 'image/x-icon')
            elif self.path.startswith('/review') and review.exists():
                self.send(200, walls_only(review), 'image/png')
            else:
                self.send(404, 'not found', 'text/plain')

        def do_POST(self):
            if self.path != '/save':
                return self.send(404, 'not found', 'text/plain')
            lines = json.loads(self.rfile.read(int(self.headers['Content-Length'])))
            lines = [[[round(x), round(y)] for x, y in line] for line in lines if len(line) >= 2]
            if not busy.acquire(blocking=False):
                return self.send(409, json.dumps({'error': 'still saving the previous version'}), 'application/json')
            try:
                write_lines(config_path, lines)
                log = retrace(config_path, out)
                self.send(200, json.dumps({'saved': len(lines), 'log': log}), 'application/json')
            except Exception as error:  # reported on the page
                self.send(500, json.dumps({'error': str(error)}), 'application/json')
            finally:
                busy.release()

    server = ThreadingHTTPServer(('127.0.0.1', port), Handler)
    url = f'http://127.0.0.1:{port}/'
    print(f'{name}: {url} (Ctrl+C to stop)')
    webbrowser.open(url)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass


if __name__ == '__main__':
    args = [a for a in sys.argv[1:] if not a.startswith('--')]
    port = 8765
    if '--port' in sys.argv:
        port = int(sys.argv[sys.argv.index('--port') + 1])
        args = [a for a in args if a != str(port)]
    if not args or '-h' in sys.argv or '--help' in sys.argv:
        print(__doc__)
        sys.exit(0)
    main(Path(args[0]).resolve(), Path(args[1]).resolve() if len(args) > 1 else ROOT / '_data' / 'map-layer' / 'scans', port)

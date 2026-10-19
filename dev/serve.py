"""Dev server for the gallery UI harness.

Serves the repository root so the real `web/` modules load, plus the two things
ComfyUI would otherwise provide:

  /scripts/app.js             the host module the registration module imports
  /preset_gallery/presets     GET/POST, backed by dev/.data/presets.json

The scratch library lives under dev/ and is never the repository's own
presets.json, which is gitignored - an overwrite there would be unrecoverable.

Run:  python dev/serve.py [port]     (default 8878)
Then: http://127.0.0.1:8878/dev/index.html
"""

import json
import os
import sys
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer

DEV_DIR = os.path.dirname(os.path.realpath(__file__))
REPO_ROOT = os.path.dirname(DEV_DIR)
DATA_FILE = os.path.join(DEV_DIR, ".data", "presets.json")
HOST_MODULE = os.path.join(DEV_DIR, "host.js")

# Python's mimetypes has no .js entry on Windows, so it serves JavaScript as
# text/plain and the browser refuses every ES module import. Set it explicitly.
SimpleHTTPRequestHandler.extensions_map = {
    **SimpleHTTPRequestHandler.extensions_map,
    ".js": "text/javascript",
    ".mjs": "text/javascript",
}

SAMPLE_LIBRARY = {
    "Faces/Portrait": {"preset": "portrait, studio lighting"},
    "Faces/Macro": {"preset": "macro, close-up"},
    "Scenery/Hills": {"preset": "rolling hills, golden hour"},
    "Scenery/Sky": {"preset": "dramatic sky"},
    "_/combo/_default": {"preset": "masterpiece, best quality"},
}


class HarnessHandler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=REPO_ROOT, **kwargs)

    def _send_bytes(self, body, content_type):
        self.send_response(200)
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def _send_json(self, payload, status=200):
        body = json.dumps(payload).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def _library(self):
        if os.path.exists(DATA_FILE):
            with open(DATA_FILE, encoding="utf-8") as f:
                return json.load(f)
        return SAMPLE_LIBRARY

    def do_GET(self):
        if self.path.split("?")[0] == "/scripts/app.js":
            with open(HOST_MODULE, "rb") as f:
                self._send_bytes(f.read(), "text/javascript")
            return
        if self.path.split("?")[0] == "/preset_gallery/presets":
            self._send_json(self._library())
            return
        super().do_GET()

    def do_POST(self):
        if self.path.split("?")[0] == "/preset_gallery/presets":
            length = int(self.headers.get("Content-Length", 0))
            raw = self.rfile.read(length) if length else b"{}"
            os.makedirs(os.path.dirname(DATA_FILE), exist_ok=True)
            with open(DATA_FILE, "w", encoding="utf-8") as f:
                json.dump(json.loads(raw), f, indent=2, ensure_ascii=False)
            self._send_json({"status": "success"})
            return
        self.send_error(404)

    def log_message(self, *args):
        pass


def main():
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8878
    print(f"preset gallery harness: http://127.0.0.1:{port}/dev/index.html")
    ThreadingHTTPServer(("127.0.0.1", port), HarnessHandler).serve_forever()


if __name__ == "__main__":
    main()

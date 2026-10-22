"""Dev server for the gallery UI harness.

Serves the repository root so the real `web/` modules load, plus the two things
ComfyUI would otherwise provide:

  /scripts/app.js             the host module the registration module imports
  /preset_gallery/libraries   the library list, so the merge has something to merge
  /preset_gallery/presets     GET/POST one library, backed by dev/.data/presets.json

The scratch library lives under dev/ and is never the repository's own
presets.json, which is gitignored - an overwrite there would be unrecoverable.

Run:  python dev/serve.py [port]     (default 8878)
Then: http://127.0.0.1:8878/dev/index.html
"""

import json
import os
import sys
import urllib.parse
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

# A second library, so the merge has somewhere to go. It shares one name with
# the bundled library on purpose: that is what makes the merge order visible.
EXTRA_LIBRARY = {
    "Faces/Portrait": {"preset": "extra portrait, rim light"},
    "Sample/Cinematic": {"preset": "cinematic lighting, dramatic shadows"},
    "Sample/Pixel": {"preset": "16-bit retro pixel art"},
}

# The bundled library lives in dev/.data/presets.json; the others are in memory,
# which is enough for the harness and keeps the repo's own presets.json untouched.
LIBRARY_FILES = {
    "sample": EXTRA_LIBRARY,
}


def _libraries():
    """The library list, so one created by a save appears without a restart."""
    libs = [{"id": "main", "name": "Main", "default": True}]
    for stem in sorted(LIBRARY_FILES):
        libs.append(
            {"id": stem, "name": stem.replace("_", " ").replace("-", " ").title(), "default": False}
        )
    return libs


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

    def _library_for(self, library_id):
        """One library's own entries - `main` is the bundled file."""
        if library_id in (None, "", "main"):
            return self._library()
        return LIBRARY_FILES.get(library_id, {})

    def _save_library(self, library_id, data):
        if library_id in (None, "", "main"):
            os.makedirs(os.path.dirname(DATA_FILE), exist_ok=True)
            with open(DATA_FILE, "w", encoding="utf-8") as f:
                json.dump(data, f, indent=2, ensure_ascii=False)
            return
        LIBRARY_FILES[library_id] = data

    def do_GET(self):
        if self.path.split("?")[0] == "/scripts/app.js":
            with open(HOST_MODULE, "rb") as f:
                self._send_bytes(f.read(), "text/javascript")
            return
        if self.path.split("?")[0] == "/preset_gallery/libraries":
            self._send_json(_libraries())
            return
        if self.path.split("?")[0] == "/preset_gallery/presets":
            library_id = urllib.parse.urlparse(self.path).query
            params = urllib.parse.parse_qs(library_id)
            self._send_json(self._library_for(params.get("library", [""])[0]))
            return
        super().do_GET()

    def do_POST(self):
        if self.path.split("?")[0] == "/preset_gallery/presets":
            length = int(self.headers.get("Content-Length", 0))
            raw = self.rfile.read(length) if length else b"{}"
            params = urllib.parse.parse_qs(urllib.parse.urlparse(self.path).query)
            self._save_library(params.get("library", [""])[0], json.loads(raw))
            self._send_json({"status": "success"})
            return
        self.send_error(404)

    def do_DELETE(self):
        if self.path.split("?")[0] == "/preset_gallery/presets":
            params = urllib.parse.parse_qs(urllib.parse.urlparse(self.path).query)
            library_id = params.get("library", [""])[0]
            if library_id in (None, "", "main"):
                self._send_json(
                    {"status": "error", "message": "The bundled library cannot be removed"},
                    status=400,
                )
                return
            data = LIBRARY_FILES.get(library_id)
            if data:
                self._send_json(
                    {"status": "error", "message": "Library is not empty"}, status=409
                )
                return
            LIBRARY_FILES.pop(library_id, None)
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

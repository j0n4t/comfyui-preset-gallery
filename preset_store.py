"""File storage for the preset library.

Deliberately free of ComfyUI imports so it can be exercised with the standard
library alone. `preset_gallery.py` owns the HTTP routes and passes the path in.
"""

import json
import os

DEFAULT_PRESETS_FILE = os.path.join(
    os.path.dirname(os.path.realpath(__file__)), "presets.json"
)

# Extra libraries live in one folder: dropping a *.json file in adds a library
# and removing it drops that one. presets.json itself stays at the root as the
# bundled default, so nothing moves unless someone adds another library.
PRESETS_DIR = os.path.join(os.path.dirname(os.path.realpath(__file__)), "presets")

DEFAULT_LIBRARY_ID = "main"
DEFAULT_LIBRARY_NAME = "Main"

# The bundled library was served as `default` before it was renamed. Saved
# workflows and localStorage from an older install still carry that id, so it
# keeps resolving to the same file rather than 404-ing.
LEGACY_DEFAULT_LIBRARY_ID = "default"

LIBRARY_EXTENSIONS = (".json",)


def resolve_library_path(library_id=None, create=False):
    """Resolve a library id to its file, or None when it is not one we serve.

    The id is used as a bare filename stem inside the presets folder, so a value
    carrying separators can never reach outside it. An empty id and the legacy
    `default` alias both mean the bundled library.

    `create` lets a *write* resolve an id that has no file yet - the editor names
    a library in the folder field (`sdxl#wear/sock`) and the save is what brings
    it into being. Reads keep requiring the file to exist, so a GET for an
    unknown id still 404s rather than conjuring an empty library.
    """
    if not library_id or library_id in (DEFAULT_LIBRARY_ID, LEGACY_DEFAULT_LIBRARY_ID):
        return DEFAULT_PRESETS_FILE
    stem = str(library_id)
    if os.path.basename(stem) != stem:
        return None
    for ext in LIBRARY_EXTENSIONS:
        candidate = os.path.join(PRESETS_DIR, stem + ext)
        if os.path.isfile(candidate) or (create and ext == LIBRARY_EXTENSIONS[0]):
            return candidate
    return None


def list_libraries():
    """The libraries the server can serve, the bundled default first."""
    libraries = [
        {"id": DEFAULT_LIBRARY_ID, "name": DEFAULT_LIBRARY_NAME, "default": True}
    ]
    if os.path.isdir(PRESETS_DIR):
        for name in sorted(os.listdir(PRESETS_DIR)):
            stem, ext = os.path.splitext(name)
            if not stem or ext.lower() not in LIBRARY_EXTENSIONS:
                continue
            libraries.append(
                {
                    "id": stem,
                    "name": stem.replace("_", " ").replace("-", " ").title(),
                    "default": False,
                }
            )
    return libraries


def load_presets(path=None):
    """Return the stored library, or an empty one when it cannot be read.

    A missing file and a corrupt file are indistinguishable to the caller: both
    yield `{}`. The frontend writes the whole library back on any edit, so a
    corrupt file is replaced by whatever the UI is holding on the next save.
    """
    target = DEFAULT_PRESETS_FILE if path is None else path
    if os.path.exists(target):
        try:
            with open(target, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception as e:
            print(f"[PresetGallery] Error reading presets.json: {e}")
    return {}


def save_presets(data, path=None):
    """Write the library, returning False instead of raising on failure.

    The write is not atomic: a crash part-way through truncates the file.
    """
    target = DEFAULT_PRESETS_FILE if path is None else path
    try:
        with open(target, "w", encoding="utf-8") as f:
            json.dump(data, f, indent=2, ensure_ascii=False)
        return True
    except Exception as e:
        print(f"[PresetGallery] Error writing presets.json: {e}")
        return False

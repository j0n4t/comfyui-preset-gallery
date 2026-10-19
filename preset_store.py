"""File storage for the preset library.

Deliberately free of ComfyUI imports so it can be exercised with the standard
library alone. `preset_gallery.py` owns the HTTP routes and passes the path in.
"""

import json
import os

DEFAULT_PRESETS_FILE = os.path.join(
    os.path.dirname(os.path.realpath(__file__)), "presets.json"
)


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

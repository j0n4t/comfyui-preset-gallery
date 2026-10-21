"""Generate a synthetic preset library that mirrors the shape of a real one.

Reads the *skeleton* of a real `presets.json` (folder taxonomy, per-folder entry
counts, value shapes, preset-text length and syntax mix) and emits a library with
invented, neutral content at the same scale. The result is committed as
`tests/fixtures/presets.synthetic.json` so the perf and behaviour tests have a
stable fixture that does not depend on any user's private library.

Content is invented on purpose: the fixture must be safe to ship, while the
*shape* - which is what drives the engine's cost - stays faithful.

Usage:
    python tools/make_synthetic_library.py [real_presets.json] [out.json]

Defaults: presets.json -> tests/fixtures/presets.synthetic.json
"""

import json
import os
import random
import re
import sys

SEED = 20261020

# Franchise/namespace names are structural (the engine matches on folder paths),
# so the taxonomy is preserved; only the leaf vocabulary is invented.
FOLDER_RENAME = {
    "anime": "atlas",
    "genshin": "quartz",
    "hololive": "ember",
    "rozen": "fable",
    "touhou": "prism",
    "zzz": "lantern",
    "xxx": "shade",
    "anima": "baseline",
    "anima_base": "baseline_model",
}

ADJECTIVES = [
    "soft", "crisp", "muted", "vivid", "warm", "cool", "pale", "deep", "bright",
    "matte", "glossy", "faded", "rich", "subtle", "bold", "airy", "dense",
]
NOUNS = [
    "linen", "marble", "cedar", "lantern", "ribbon", "meadow", "harbor", "atlas",
    "ember", "quartz", "fable", "prism", "willow", "hollow", "thicket", "signal",
    "beacon", "tundra", "vellum", "cobalt", "amber", "slate", "ivory", "moss",
]
MODIFIERS = [
    "gentle rim light", "shallow depth", "clean linework", "wide framing",
    "low contrast", "high contrast", "cool shadows", "warm highlights",
    "flat shading", "soft gradient", "sharp edges", "loose brushwork",
]

# Groups that a tab-style preset chains. These names must match folders that
# actually exist in the generated library, so the expansion does real work.
CHAIN_GROUPS = ["place", "pose", "hair", "color", "qty", "art", "artist", "pattern"]


def renamed_folder(folder: str) -> str:
    """Rename each path segment through FOLDER_RENAME, preserving depth."""
    if not folder:
        return folder
    return "/".join(FOLDER_RENAME.get(seg, seg) for seg in folder.split("/"))


def renamed_key(key: str) -> tuple[str, str]:
    """Rename the folder part of a key, keep the leaf name slot (regenerated later)."""
    parts = key.split("/")
    folder = renamed_folder("/".join(parts[:-1]))
    return folder, parts[-1]


def renamed_path(key: str) -> str:
    """Rename every segment of a full key path.

    Used for folder-level entries (`__color__`), where the key *is* the folder
    path - including the bare `_` root, which must survive as `_`.
    """
    return "/".join(FOLDER_RENAME.get(seg, seg) for seg in key.split("/"))


def phrase(rng: random.Random, n_words: int = 3) -> str:
    return " ".join(rng.sample(ADJECTIVES, 1) + rng.sample(NOUNS, n_words - 1))


def make_preset_text(rng: random.Random, real_text: str) -> str:
    """Build neutral preset text mirroring the *structure* of `real_text`.

    Three properties are mirrored deliberately, because each drives cost in the
    engine and a fixture that misses them measures the wrong thing:

      - length: the real median preset is ~10 chars
      - bare `{group}` refs: each one triggers a whole-cache group scan
      - `<tag>` and `(weight)` presence

    The tab/config entries chain many bare `{group}` refs; that shape is the
    library's dominant cost, so it is reproduced per entry rather than averaged.
    """
    target_len = max(len(real_text), 2)

    n_bare = len(re.findall(r"\{([^{}:]+)\}", real_text))
    n_valued = len(re.findall(r"\{[^{}:]+:[^{}]*\}", real_text))
    n_tags = len(re.findall(r"<[^<>]+>", real_text))
    has_weight = bool(re.search(r"\(.+:\d", real_text))

    parts: list[str] = []
    for _ in range(n_tags):
        parts.append(f"<{rng.choice(['model', 'lora', 'steps', 'cfg'])}:{rng.choice(NOUNS)}>")
    for _ in range(n_bare):
        parts.append("{" + rng.choice(CHAIN_GROUPS) + "}")
    for _ in range(n_valued):
        parts.append("{" + rng.choice(CHAIN_GROUPS) + ":" + rng.choice(NOUNS) + "}")

    used = sum(len(p) + 2 for p in parts)

    # Pad to the real entry's length with neutral prose.
    guard = 0
    while target_len - used > 2 and guard < 40:
        guard += 1
        remaining = target_len - used
        n_words = 2 if remaining < 26 else rng.randint(2, 4)
        part = phrase(rng, n_words)
        parts.append(part)
        used += len(part) + 2

    if not parts:
        parts.append(phrase(rng, 1))

    text = ", ".join(parts)
    if has_weight:
        text = f"({text}:{rng.choice(['1.1', '1.2', '1.25', '0.9'])})"
    return text


def build_synthetic(real: dict[str, dict]) -> dict[str, dict]:
    rng = random.Random(SEED)
    out: dict[str, dict] = {}
    used_leaves: dict[tuple[str, str], int] = {}

    def unique_leaf(folder: str) -> str:
        """A readable leaf name that never collides within its folder.

        Collisions would silently shrink the library and deflate every perf
        number the fixture is meant to track.
        """
        base = f"{os.path.basename(folder) or 'root'}_{rng.choice(NOUNS)}"
        seen = used_leaves.get((folder, base), 0)
        used_leaves[(folder, base)] = seen + 1
        return base if seen == 0 else f"{base}_{seen + 1}"

    for key, item in real.items():
        folder, leaf = renamed_key(key)
        shape = tuple(sorted(item.keys()))

        # Preserve the value shape exactly: the engine branches on which keys exist.
        if shape == ("__color__",):
            # A folder-level entry: the key is the folder path itself.
            out[renamed_path(key)] = {"__color__": item["__color__"]}
            continue

        preset = make_preset_text(rng, item.get("preset", ""))

        # Config entries keep their own names: the engine addresses them by key
        # (e.g. `_/config/prepend/<folder>` is looked up by folder path).
        if folder.startswith("_/config"):
            new_key = f"{folder}/{leaf}"
        else:
            new_key = f"{folder}/{unique_leaf(folder)}" if folder else unique_leaf(folder)

        entry: dict[str, str] = {"preset": preset}
        if "filename" in shape:
            # The real values are 8-16KB base64 thumbnails; a short valid-looking
            # data URL exercises the same code path without bloating the fixture.
            entry["filename"] = (
                "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJ"
                "AAAADUlEQVR42mP8z8DwHwAFAAH/q842iQAAAABJRU5ErkJggg=="
            )
        out[new_key] = entry

    return out


def main():
    repo = os.path.dirname(os.path.dirname(os.path.realpath(__file__)))
    src = sys.argv[1] if len(sys.argv) > 1 else os.path.join(repo, "presets.json")
    dst = sys.argv[2] if len(sys.argv) > 2 else os.path.join(
        repo, "tests", "fixtures", "presets.synthetic.json"
    )

    with open(src, encoding="utf-8") as f:
        real = json.load(f)

    synthetic = build_synthetic(real)

    # Same ordering rule the API uses, so the fixture reads like a saved library.
    ordered = dict(
        sorted(synthetic.items(), key=lambda kv: (kv[0].startswith("_"), kv[0]))
    )

    os.makedirs(os.path.dirname(dst), exist_ok=True)
    with open(dst, "w", encoding="utf-8") as f:
        json.dump(ordered, f, indent=2, ensure_ascii=False)
        f.write("\n")

    real_presets = sum(1 for v in real.values() if v.get("preset"))
    syn_presets = sum(1 for v in ordered.values() if v.get("preset"))
    print(f"{src} -> {dst}")
    print(f"  entries:  {len(real)} -> {len(ordered)}")
    print(f"  presets:  {real_presets} -> {syn_presets}")
    print(f"  folders:  {len({k.rsplit('/', 1)[0] for k in ordered})}")
    print(f"  bytes:    {os.path.getsize(dst)}")


if __name__ == "__main__":
    main()

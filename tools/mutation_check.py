#!/usr/bin/env python3
"""Mutation probe: break each module, run its matching test file, expect failure.

This is the committed guard for the claim that the suite actually catches
broken assertions. It applies a mutation, runs the affected test file,
checks it fails, then restores the source via `git checkout`.

Usage: python tools/mutation_check.py
Exit 0 if every mutation was caught, 1 if any was missed.
"""

import pathlib
import subprocess
import sys

ROOT = pathlib.Path(__file__).resolve().parent.parent

# (file, exact text to mutate, replacement, test file that must fail)
MUTATIONS = [
    ("web/RollManager.js",
     "this.counts[group] = idx + 1;",
     "this.counts[group] = idx;",
     "tests/unit/roll_manager.test.ts"),
    ("web/NestedPresetUtils.js",
     "if (!includeColors) continue;",
     "if (false) continue;",
     "tests/unit/nested_preset_utils.test.ts"),
    ("web/PresetLogic.js",
     "if (char === ',' && depthParen === 0 && depthAngle === 0 && depthBrace === 0) {",
     "if (char === ',') {",
     "tests/unit/preset_logic.test.ts"),
    ("web/PngMetadata.js",
     '} else if (type === "zTXt") {',
     '} else if (type === "zTXt-off") {',
     "tests/unit/png_metadata.test.ts"),
    ("web/PresetGalleryAPI.js",
     "if (isAHidden !== isBHidden) {",
     "if (false) {",
     "tests/unit/preset_gallery_api.test.ts"),
    ("web/ExportUtils.js",
     "summary.replacedCount++;\n                } else {",
     "summary.sameCount++;\n                } else {",
     "tests/unit/export_utils.test.ts"),
    ("web/PresetEditor.js",
     "return uniqueKey !== editingKey && !!cache[uniqueKey];",
     "return !!cache[uniqueKey];",
     "tests/unit/preset_editor.test.ts"),
    ("web/RawTextareaManager.js",
     "return (colonIdx === -1 ? inner : inner.slice(0, colonIdx)).trim();",
     "return inner;",
     "tests/unit/variant_color.test.ts"),

    # The perf/behaviour guards. Each of these must be caught by the test named
    # in the comment, or the guard is decorative.
    # lookup entries the chips resolve through (drop each -> its own test fails)
    ("web/PresetLogic.js",
     "lookupMap.set(trimmedPreset, { foundKey: key, foundItem: item });",
     "lookupMap.set(trimmedPreset + '\\u0000', { foundKey: key, foundItem: item });",
     "tests/unit/preset_logic.perf.test.ts"),   # raw-text resolution
    ("web/PresetLogic.js",
     "lookupMap.set(wrappedPreset, { foundKey: key, foundItem: item });",
     "lookupMap.set(wrappedPreset + '\\u0000', { foundKey: key, foundItem: item });",
     "tests/unit/preset_logic.perf.test.ts"),   # wrapped resolution
    # Both key lines, or the .trim() one still supplies the entry and the
    # mutation changes nothing.
    ("web/PresetLogic.js",
     "      lookupMap.set(key, { foundKey: key, foundItem: item });\n"
     "      lookupMap.set(key.trim(), { foundKey: key, foundItem: item });",
     "      lookupMap.set(key + '\\u0000', { foundKey: key, foundItem: item });\n"
     "      lookupMap.set(key.trim() + '\\u0000', { foundKey: key, foundItem: item });",
     "tests/unit/preset_logic.perf.test.ts"),   # weighted-token resolution
    # the roll must stay observable, or a cache-keyed memo would silently win
    ("web/PresetLogic.js",
     "matches[Math.floor(Math.random() * matches.length)]",
     "matches[0]",
     "tests/unit/preset_logic.perf.test.ts"),
    # The build is where the catastrophic regression lives: re-adding the
    # per-entry expansion that step 2 removed takes it from ~1.5 ms to ~150 ms.
    ("web/PresetLogic.js",
     "    if (item.preset?.trim()) {\n      const wrappedPreset = PresetLogic.getWrappedPreset(key, item.preset, cache);",
     "    if (item.preset?.trim()) {\n      PresetLogic.expandRecursively(key, cache);\n      const wrappedPreset = PresetLogic.getWrappedPreset(key, item.preset, cache);",
     "tests/unit/preset_logic.perf.test.ts"),
]


def main() -> int:
    all_caught = True
    before = {}

    for src, old, new, testfile in MUTATIONS:
        path = ROOT / src
        before[src] = path.read_bytes()
        original = before[src].decode("utf-8")

        # Patterns are written with \n, but these files are CRLF on Windows.
        # Normalise to the file's own ending, or a multi-line pattern matches
        # nothing and the mutation silently never applies.
        eol = "\r\n" if "\r\n" in original else "\n"
        old = old.replace("\n", eol)
        new = new.replace("\n", eol)

        assert old in original, f"pattern not found in {src}"
        path.write_bytes(original.replace(old, new, 1).encode("utf-8"))
        try:
            r = subprocess.run(
                ["node", "--test", testfile],
                cwd=ROOT,
                capture_output=True,
                text=True,
                timeout=300,
            )
            caught = r.returncode != 0
            first_fail = next(
                (line.strip() for line in r.stdout.splitlines() if line.startswith("not ok")),
                "",
            )
            status = "CAUGHT" if caught else "MISSED!!"
            if not caught:
                all_caught = False
            print(f"{status:10} {src}: {first_fail}")
        finally:
            # restore the exact pre-run bytes: text-mode I/O would rewrite the
            # file's line endings and make the check below fail spuriously
            path.write_bytes(before[src])

    # verify every mutated file was restored to its exact pre-run bytes
    not_restored = [src for src, snapshot in before.items() if (ROOT / src).read_bytes() != snapshot]
    if not_restored:
        print("WARNING: files not restored:", not_restored)
        all_caught = False

    print("result:", "all mutations caught" if all_caught else "SOME MUTATIONS MISSED")
    return 0 if all_caught else 1


if __name__ == "__main__":
    sys.exit(main())

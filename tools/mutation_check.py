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
    # Prompt composition starts the roll counters from zero so the displayed
    # value and the queued prompt reach the same picks. Without the reset a
    # second composition advances the counters and draws a different variant.
    ("web/PresetSession.js",
     "    this.rollManager.resetCounts();\n"
     "    return PresetLogic.expandRecursively",
     "    return PresetLogic.expandRecursively",
     "tests/unit/preset_session.test.ts"),
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
     "return uniqueKey !== editingPlainKey && !!cache[uniqueKey];",
     "return !!cache[uniqueKey];",
     "tests/unit/preset_editor.test.ts"),
    ("web/RawTextareaManager.js",
     "return (colonIdx === -1 ? inner : inner.slice(0, colonIdx)).trim();",
     "return inner;",
     "tests/unit/variant_color.test.ts"),
    # A tab is a snapshot of the selection AND the pins and rolls in force. If
    # the snapshot stops carrying the pins, a tab saved from a pinned basket
    # comes back unpinned on the next switch or reload.
    ("web/PresetBasketTabs.js",
     "    tab.basket = [...basket];\n"
     "    tab.pins = this.context.pinnedChips ? Array.from(this.context.pinnedChips) : [];",
     "    tab.basket = [...basket];\n"
     "    tab.pins = [];",
     "tests/unit/preset_basket_tabs.test.ts"),
    # The saved active tab id decides which tab comes back. Falling back to the
    # first tab every time restores the wrong selection after a reload.
    ("web/PresetBasketTabs.js",
     "          parsed.activeTabId && parsed.tabs.some((/** @type {BasketTab} */ t) => t.id === parsed.activeTabId)\n"
     "            ? parsed.activeTabId\n"
     "            : parsed.tabs[0].id,",
     "          parsed.tabs[0].id,",
     "tests/unit/preset_basket_tabs.test.ts"),
    # Removing the active tab has to install the neighbour it falls back to, or
    # the widget keeps running the deleted tab's selection.
    ("web/PresetBasketTabs.js",
     "    this.activeTabId = null;\n"
     "    this.switchTo(next.id);",
     "    this.activeTabId = null;\n"
     "    this.persist();",
     "tests/unit/preset_basket_tabs.test.ts"),
    # Chips dropped on the active tab must reach the widget, not only the
    # snapshot - otherwise the prompt never changes.
    ("web/PresetBasketTabs.js",
     "    if (this.activeTabId === tabId) this.context.updateWidgetValue(tab.basket);",
     "    if (false) this.context.updateWidgetValue(tab.basket);",
     "tests/unit/preset_basket_tabs.test.ts"),
    # A range selection includes both ends.
    ("web/BasketSelectionController.js",
     "for (let index = Math.min(start, end); index <= Math.max(start, end); index++) {",
     "for (let index = Math.min(start, end); index < Math.max(start, end); index++) {",
     "tests/unit/basket_selection.test.ts"),
    # Shift-click selects from the anchor, not from the clicked chip, or the
    # range collapses to a single chip.
    ("web/BasketSelectionController.js",
     "      this.selectRange(this.anchor ?? index, index);",
     "      this.selectRange(index, index);",
     "tests/unit/basket_selection.test.ts"),
    # The clipboard payload is versioned: accepting another version's shape
    # would paste chips this build cannot resolve.
    ("web/BasketSelectionController.js",
     "    return payload.type === \"comfyui-preset-gallery-basket\" &&\n"
     "      payload.version === 1 &&\n",
     "    return payload.type === \"comfyui-preset-gallery-basket\" &&\n",
     "tests/unit/basket_selection.test.ts"),
    # Only image files are metadata sources; treating any file as one makes the
    # drop modal try to parse a text file.
    ("web/BasketDragDrop.js",
     "      if (file.type.startsWith(\"image/\")) return file;",
     "      return file;",
     "tests/unit/basket_drag_drop.test.ts"),

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
    # The build is where the catastrophic regression lives - or did. The entry
    # this once used (re-adding the per-entry expansion step 2 removed) is now
    # caught by nothing: the group and match indexes made expandRecursively ~35x
    # cheaper, so it reads 27.5x against a 70x budget. What the budget still
    # catches is the class it was built for - a whole-cache operation inside the
    # per-entry loop - which is what this models.
    ("web/PresetLogic.js",
     "    if (item.preset?.trim()) {\n      const wrappedPreset = PresetLogic.getWrappedPreset(key, item.preset, cache);",
     "    if (item.preset?.trim()) {\n      Object.keys(cache).forEach((k) => PresetLogic.getWrappedPreset(k, cache[k]?.preset || \"\", cache));\n      const wrappedPreset = PresetLogic.getWrappedPreset(key, item.preset, cache);",
     "tests/unit/preset_logic.perf.test.ts"),
    # The group index enumerates a folder's prefixes AND suffixes. Dropping the
    # suffixes silently loses every group named after a leaf folder.
    ("web/PresetLogic.js",
     "      groups.add(segments.slice(0, i).join(\"/\"));\n"
     "      groups.add(segments.slice(segments.length - i).join(\"/\"));",
     "      groups.add(segments.slice(0, i).join(\"/\"));",
     "tests/unit/preset_logic.test.ts"),
    # The index is shared between calls, so the result must be a copy - callers
    # sort it in place.
    ("web/PresetLogic.js",
     "return (derived.groupIndex.get(groupName.toLowerCase()) || []).slice();",
     "return derived.groupIndex.get(groupName.toLowerCase()) || [];",
     "tests/unit/preset_logic.test.ts"),
    # The match index must keep the FIRST claimant; last-wins silently changes
    # which preset a chip resolves to, and 510 strings in a real library are
    # claimed more than once.
    ("web/PresetLogic.js",
     "      if (matchStr && !index.has(matchStr)) {",
     "      if (matchStr) {",
     "tests/unit/preset_logic.test.ts"),
    # ...and it must skip entries without a preset, as the scan did.
    ("web/PresetLogic.js",
     "    if (!item || !item.preset) continue;\n\n    const wrapped = PresetLogic.getWrappedPreset(key, item.preset, cache);",
     "    if (!item) continue;\n\n    const wrapped = PresetLogic.getWrappedPreset(key, item.preset || \"\", cache);",
     "tests/unit/preset_logic.test.ts"),
    # The variant index must keep the FIRST key claiming a name: last-wins
    # silently changes which preset a `{group:value}` resolves to, and 32
    # lowercased names in a real library are claimed more than once.
    ("web/PresetLogic.js",
     "    if (lowerKey && !index.has(lowerKey)) index.set(lowerKey, key);",
     "    if (lowerKey) index.set(lowerKey, key);",
     "tests/unit/preset_logic.test.ts"),
    # ...and it must index the preset name, not only the full key.
    ("web/PresetLogic.js",
     "    if (name && !index.has(name)) index.set(name, key);",
     "    if (false && name) index.set(name, key);",
     "tests/unit/preset_logic.test.ts"),
    # The walk finds candidates through a bucket keyed on the first character.
    # Keying it on the whole string leaves every multi-character candidate
    # unreachable, and its text degrades to plain text with no error.
    ("web/PresetLogic.js",
     "    const first = cand.matchStr[0];",
     "    const first = cand.matchStr;",
     "tests/unit/preset_logic.perf.test.ts"),
    # Candidates are longest-first and the walk takes the first match, so a
    # bucket in any other order picks the shorter candidate instead.
    ("web/PresetLogic.js",
     "    bucket.push(cand);",
     "    bucket.unshift(cand);",
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

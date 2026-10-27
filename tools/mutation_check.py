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
    # Tokens leave no trace unless the overlay is cleared; an empty input
    # must leave an empty layer, or a stale highlight could be confused with
    # real content by a later re-render.
    ("web/RawTextHighlighting.js",
     "this.highlightsEl.innerHTML = \"\";",
     "this.highlightsEl.innerHTML = \" \";",
     "tests/unit/raw_text_highlighting.test.ts"),
    # The negative-position clamp must snap back to 0; a negative offset would
    # send the tooltip pointer to the left of the line.
    ("web/RawTextHover.js",
     "if (pos < 0) return 0;",
     "if (pos < 0) return -1;",
     "tests/unit/raw_text_hover.test.ts"),
    # Constructor default wiring: ignorePreset must be preserved, not thrown
    # away to the empty string, so a raw-text autocomplete keeps the caller's
    # filter on subsequent edits.
    ("web/RawTextAutocomplete.js",
     "this.ignorePreset = ignorePreset || \"\";",
     "this.ignorePreset = \"\";",
     "tests/unit/raw_text_autocomplete.test.ts"),
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
     "        parsed.activeTabId && parsed.tabs.some((/** @type {BasketTab} */ t) => t.id === parsed.activeTabId)\n"
     "          ? parsed.activeTabId\n"
     "          : parsed.tabs[0].id,",
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
    #
    # Chip grouping (`web/ChipProjection.js`). These pin the decisions that
    # decide which chip a user sees, so a silent change is a wrong basket.
    # A qualified token must keep its qualifier as the styleKey: resolving it to
    # the plain key points the chip at the other library's entry.
    ("web/ChipProjection.js",
     "        const resolvedStyleKey = qualifiedInput ? coreJoined : (cached?.foundKey || subArray[0]);",
     "        const resolvedStyleKey = cached?.foundKey || subArray[0];",
     "tests/unit/chip_projection.test.ts"),
    # Only a single token may collapse onto a preset; without the guard a run of
    # tokens that spells a preset body re-joins into the original preset chip,
    # undoing a spread.
    ("web/ChipProjection.js",
     "      const cached = (len === 1)",
     "      const cached = (true)",
     "tests/unit/chip_projection.test.ts"),
    # The lookup is keyed on the weight-stripped core, so a weighted chip
    # resolves to the preset underneath it rather than to its "(key:1.5)" text.
    ("web/ChipProjection.js",
     "      const { core: coreJoined } = PresetLogic.parseWeight(joined);",
     "      const coreJoined = joined;",
     "tests/unit/chip_projection.test.ts"),
    # The lookup must be memoised per cache: rebuilding it per call is the
    # cold-start cost the build budget measures.
    ("web/ChipProjection.js",
     "    if (!derived.lookupMap) derived.lookupMap = buildLookupMap(cache);",
     "    derived.lookupMap = buildLookupMap(cache);",
     "tests/unit/chip_projection.test.ts"),
    # lookup entries the chips resolve through (drop each -> its own test fails)
    ("web/ChipProjection.js",
     "lookupMap.set(trimmedPreset, { foundKey: key, foundItem: item });",
     "lookupMap.set(trimmedPreset + '\\u0000', { foundKey: key, foundItem: item });",
     "tests/unit/preset_logic.perf.test.ts"),   # raw-text resolution
    ("web/ChipProjection.js",
     "lookupMap.set(wrappedPreset, { foundKey: key, foundItem: item });",
     "lookupMap.set(wrappedPreset + '\\u0000', { foundKey: key, foundItem: item });",
     "tests/unit/preset_logic.perf.test.ts"),   # wrapped resolution
    # Both key lines, or the .trim() one still supplies the entry and the
    # mutation changes nothing.
    ("web/ChipProjection.js",
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
    ("web/ChipProjection.js",
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

    # Display metadata (`web/PresetDisplay.js`). Moved out of PresetLogic in
    # phase 4b, so the guard follows the code: each of these must be caught by
    # the new test file, or the suite no longer covers what it moved.
    #
    # The folder helper must drop the last segment: keeping it makes the folder
    # the whole key, so every grid group header collapses to the key itself.
    ("web/PresetDisplay.js",
     '  return PresetLogic.splitQualifiedKey(key).key.split("/").slice(0, -1).join("/");',
     '  return PresetLogic.splitQualifiedKey(key).key.split("/").join("/");',
     "tests/unit/preset_display.test.ts"),
    # ...and the name helper must keep it, not the first segment.
    ("web/PresetDisplay.js",
     '  return PresetLogic.splitQualifiedKey(key).key.split("/").pop() || "";',
     '  return PresetLogic.splitQualifiedKey(key).key.split("/").shift() || "";',
     "tests/unit/preset_display.test.ts"),
    # The colour walks up the path; a loop that never runs falls back to the
    # hash for a folder that has an assigned colour.
    ("web/PresetDisplay.js",
     "  for (let i = parts.length; i > 0; i--) {",
     "  for (let i = parts.length; i > parts.length; i--) {",
     "tests/unit/preset_display.test.ts"),
    # The colour must read the plain path, so a qualifier does not become part
    # of the hashed name.
    ("web/PresetDisplay.js",
     '  const parts = PresetLogic.splitQualifiedKey(presetKey).key.split("/");',
     '  const parts = presetKey.split("/");',
     "tests/unit/preset_display.test.ts"),
    # The hash is what the user sees; a changed constant is a visible change.
    ("web/PresetDisplay.js",
     "  for (let i = 0; i < 6; i++) hash = Math.imul(hash ^ str.charCodeAt(i), 15485863);",
     "  for (let i = 0; i < 6; i++) hash = Math.imul(hash ^ str.charCodeAt(i), 15485864);",
     "tests/unit/preset_display.test.ts"),
    # Initials are capped at six characters.
    ("web/PresetDisplay.js",
     '    .substring(0, 6);',
     '    .substring(0, 99);',
     "tests/unit/preset_display.test.ts"),
    # The blob carries the library qualifier, which is how a merged library's
    # entries are told apart in search.
    ("web/PresetDisplay.js",
     '  const libPrefix = split.libraryId ? `${split.libraryId}# ` : "";',
     '  const libPrefix = "";',
     "tests/unit/preset_display.test.ts"),
    # Fuzzy matches are ordered by where the query appears, not alphabetically.
    ("web/PresetDisplay.js",
     "    arr.sort((a, b) => (a.idx !== b.idx ? a.idx - b.idx : a.item.localeCompare(b.item)));",
     "    arr.sort((a, b) => (a.idx !== b.idx ? b.idx - a.idx : a.item.localeCompare(b.item)));",
     "tests/unit/preset_display.test.ts"),
    # The title prepends the evaluated value when it differs from the body -
    # otherwise a chip that expands past its own text shows only the body.
    ("web/PresetDisplay.js",
     "  if (expanded !== preset) return `${expanded}\\n\\n${title}`;",
     "  return title;",
     "tests/unit/preset_display.test.ts"),

    # Chip evaluation (`web/PresetLogic.js`). Phase 4c was probed rather than
    # split - see docs/app-logic-refactor-plan.md - and the probe found these
    # two decisions were covered by tests in another file, with no guard entry
    # pointing at them. Both are user-visible: the icon the user clicks, and the
    # segment spans the chip renders in place of its label.
    #
    # A chip that still hides a variant shows the ⋯ affordance; a chip that does
    # not must not, or every chip carries a control that offers nothing.
    ("web/PresetLogic.js",
     'const hasMoreVar = /\\{[^{}:]+(?::[^{}]+)?\\}/.test(coreStr + basePreset);',
     'const hasMoreVar = true;',
     "tests/unit/preset_dom.test.ts"),
    # Segmented labels are for chips whose text carries a variant or a tag. The
    # gate is what stops a plain chip getting segment spans in place of its label.
    ("web/PresetLogic.js",
     'if (tokens.length > 0 && tokens.some(t => /[{<]/.test(t))) {',
     'if (tokens.length > 0) {',
     "tests/unit/preset_basket.test.ts"),

    # The storage boundary (`web/GalleryStorage.js`). Phase 5a. It is the only
    # module that knows the key names and the meaning of a bad value, so every
    # decision here is one the rest of the app depends on silently.
    #
    # A corrupt value must degrade, not throw: the pins read is in the session
    # constructor, so a throw there means the gallery never mounts.
    ("web/GalleryStorage.js",
     "  try {\n    return JSON.parse(raw);\n  } catch {\n    return fallback;\n  }",
     "  return JSON.parse(raw);",
     "tests/unit/preset_session.test.ts"),
    # A valid JSON that is not an array must not reach a caller doing includes.
    ("web/GalleryStorage.js",
     "  if (!Array.isArray(parsed)) return [];",
     "  if (false) return [];",
     "tests/unit/gallery_storage.test.ts"),
    # ...and a mixed array keeps only its strings.
    ("web/GalleryStorage.js",
     '  return parsed.filter((/** @type {*} */ item) => typeof item === "string");',
     "  return parsed;",
     "tests/unit/gallery_storage.test.ts"),
    # Only the exact string "true" is on. "TRUE" and "1" are what a future
    # tidy-up would write, and reading them as on flips a default-off
    # preference for every existing user.
    ("web/GalleryStorage.js",
     '  return storage?.getItem(key) === "true" ? true : fallback;',
     '  return storage?.getItem(key) !== null ? true : fallback;',
     "tests/unit/gallery_storage.test.ts"),
    # A browser that throws on storage access must yield the defaults.
    ("web/GalleryStorage.js",
     "  try {\n    return typeof localStorage !== \"undefined\" ? localStorage : null;\n  } catch {\n    return null;\n  }",
     "  return localStorage;",
     "tests/unit/gallery_storage.test.ts"),
    # The key names are the user's saved state, not a detail.
    ("web/GalleryStorage.js",
     '  settings: "pg_settings",',
     '  settings: "pg_settings_v2",',
     "tests/unit/gallery_storage.test.ts"),

    # Library targeting (`web/PresetGalleryAPI.js`). Phase 5b removed the
    # module-level `activeLibraryId`, so every call names its library. These pin
    # the three decisions that a silent regression would get wrong.
    #
    # The URL must carry the library: an unqualified URL reads the bundled one,
    # which is the wrong library for any call that named another.
    ("web/PresetGalleryAPI.js",
     '    return `${PresetGalleryAPI.API_ENDPOINT}?library=${encodeURIComponent(libraryId)}`;',
     "    return PresetGalleryAPI.API_ENDPOINT;",
     "tests/unit/preset_gallery_api.test.ts"),
    # ...and the default is the bundled library, not an empty id.
    ("web/PresetGalleryAPI.js",
     "  static libraryUrl(libraryId = PresetGalleryAPI.DEFAULT_LIBRARY_ID) {",
     '  static libraryUrl(libraryId = "") {',
     "tests/unit/preset_gallery_api.test.ts"),
    # A save must read the library it writes to, or it reads one and overwrites
    # another with a half-built cache.
    ("web/PresetGalleryAPI.js",
     "    const presets = await PresetGalleryAPI.getPresets(libraryId);\n\n    let cleanFolder",
     "    const presets = await PresetGalleryAPI.getPresets();\n\n    let cleanFolder",
     "tests/unit/preset_gallery_api.test.ts"),
    # Deleting from the wrong library is the destructive one. The test names a
    # non-default library AND gives the two libraries different keys, because
    # with the same key in both the mutation is indistinguishable.
    ("web/PresetGalleryAPI.js",
     "  static async deletePreset(uniqueKey, libraryId = PresetGalleryAPI.DEFAULT_LIBRARY_ID) {\n    const presets = await PresetGalleryAPI.getPresets(libraryId);",
     "  static async deletePreset(uniqueKey, libraryId = PresetGalleryAPI.DEFAULT_LIBRARY_ID) {\n    const presets = await PresetGalleryAPI.getPresets();",
     "tests/unit/preset_gallery_api.test.ts"),
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

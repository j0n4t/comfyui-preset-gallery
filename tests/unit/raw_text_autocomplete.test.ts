import { test } from "node:test";
import assert from "node:assert/strict";
import "./dom-harness.ts";
import RawTextAutocomplete from "../../web/RawTextAutocomplete.js";

// Minimal stand-in for GalleryContext; the autocomplete module carries the
// cache by reference into AutocompleteManager's getMatches.
const CACHE: PresetCache = {
  "Faces/Portrait": { preset: "portrait" },
};

function makeAuto(textareaValue = "", ignorePreset: string | null = null) {
  const textarea = document.createElement("textarea");
  textarea.value = textareaValue;
  const context = { cache: CACHE } as unknown as GalleryContext;
  const onSync = () => {};
  const manager = { updateHighlights: () => {} };
  return new RawTextAutocomplete(
    textarea,
    context,
    ignorePreset,
    onSync,
    manager,
  );
}

test("ignorePreset is preserved from the constructor", () => {
  const auto = makeAuto("{Faces:y}", "Faces/Portrait");
  assert.equal(auto.ignorePreset, "Faces/Portrait");
});

test("init wires the textarea input and the manager", () => {
  const auto = makeAuto("hello");
  assert.equal(auto.textarea.value, "hello");
  assert.ok(
    auto.manager !== undefined,
    "the raw-text manager is forwarded to AutocompleteManager",
  );
});

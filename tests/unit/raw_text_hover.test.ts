import { test } from "node:test";
import assert from "node:assert/strict";
import "./dom-harness.ts";
import RawTextHover from "../../web/RawTextHover.js";

// Minimal stand-in for GalleryContext; the hover module only reads
// context.cache inside getTokenAtPosition.
const CACHE: PresetCache = {
  "Faces/Portrait": { preset: "portrait" },
};

function makeHover(value = "Faces/Portrait, plain") {
  const textarea = document.createElement("textarea");
  textarea.value = value;
  const context = { cache: CACHE } as unknown as GalleryContext;
  return new RawTextHover(textarea, context, null);
}

test("_normalizeTokenPosition clamps out-of-range positions", () => {
  const h = makeHover();
  const textarea = h.textarea;
  textarea.value = "aa, bb";
  assert.equal(h._normalizeTokenPosition(10), 6, "past the end clamps to the length");
  assert.equal(h._normalizeTokenPosition(-1), 0, "negative clamps to 0");
});

test("_normalizeTokenPosition resolves a separator to the nearest token", () => {
  const h = makeHover();
  const textarea = h.textarea;
  textarea.value = "aa, bb";
  assert.equal(h._normalizeTokenPosition(2), 2, "comma resolves to itself");
  assert.equal(h._normalizeTokenPosition(3), 2, "following space resolves to the comma");
  assert.equal(h._normalizeTokenPosition(4), 4, "mid-token positions are unchanged");
});

test("getTokenAtPosition finds the token under the position", () => {
  const h = makeHover();
  const textarea = h.textarea;
  textarea.value = "Faces/Portrait, plain";
  assert.equal(h.getTokenAtPosition(5)?.key, "Faces/Portrait");
  assert.equal(h.getTokenAtPosition(13)?.key, "Faces/Portrait");
  assert.equal(h.getTokenAtPosition(15)?.isPlainText, true);
  assert.equal(h.getTokenAtPosition(99), null, "past the end finds nothing");
});

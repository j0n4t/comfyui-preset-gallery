import { test } from 'node:test';
import assert from 'node:assert/strict';

// shouldConfirmOverwrite is a static on PresetEditor, extracted there in
// Phase 1 exactly so it could be tested without a DOM. These tests call the
// real static — an inlined copy would silently diverge from the source.
import PresetEditor from "../../web/PresetEditor.js";

const cache = {
  "Faces/Portrait": { preset: "pro" },
  "Scenery/Landscape": { preset: "nature" },
};

test("new mode: confirms overwrite when key exists in cache", () => {
  assert.equal(PresetEditor.shouldConfirmOverwrite("new", "", "Faces/Portrait", cache), true);
});

test("new mode: no confirmation when key does not exist", () => {
  assert.equal(PresetEditor.shouldConfirmOverwrite("new", "", "New/Preset", cache), false);
});

test("edit mode: no confirmation when saving to same key (no rename)", () => {
  assert.equal(PresetEditor.shouldConfirmOverwrite("edit", "Faces/Portrait", "Faces/Portrait", cache), false);
});

test("edit mode: no confirmation when renamed to a new unique key", () => {
  assert.equal(PresetEditor.shouldConfirmOverwrite("edit", "Faces/Portrait", "Faces/Renamed", cache), false);
});

test("edit mode: confirms overwrite when renamed to an existing different key", () => {
  assert.equal(PresetEditor.shouldConfirmOverwrite("edit", "Faces/Portrait", "Scenery/Landscape", cache), true);
});

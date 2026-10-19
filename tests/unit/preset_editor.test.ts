import { test } from 'node:test';
import assert from 'node:assert/strict';

// Inline the static method to test the logic without DOM dependencies.
// This mirrors PresetEditor.shouldConfirmOverwrite exactly.
function shouldConfirmOverwrite(currentMode: string, editingKey: string, uniqueKey: string, cache: Record<string, unknown>) {
  if (currentMode === "new") {
    return !!cache[uniqueKey];
  }
  if (currentMode === "edit") {
    return uniqueKey !== editingKey && !!cache[uniqueKey];
  }
  return false;
}

const cache = {
  "Faces/Portrait": { preset: "pro" },
  "Scenery/Landscape": { preset: "nature" },
};

test("new mode: confirms overwrite when key exists in cache", () => {
  assert.equal(shouldConfirmOverwrite("new", "", "Faces/Portrait", cache), true);
});

test("new mode: no confirmation when key does not exist", () => {
  assert.equal(shouldConfirmOverwrite("new", "", "New/Preset", cache), false);
});

test("edit mode: no confirmation when saving to same key (no rename)", () => {
  assert.equal(shouldConfirmOverwrite("edit", "Faces/Portrait", "Faces/Portrait", cache), false);
});

test("edit mode: no confirmation when renamed to a new unique key", () => {
  assert.equal(shouldConfirmOverwrite("edit", "Faces/Portrait", "Faces/Renamed", cache), false);
});

test("edit mode: confirms overwrite when renamed to an existing different key", () => {
  assert.equal(shouldConfirmOverwrite("edit", "Faces/Portrait", "Scenery/Landscape", cache), true);
});

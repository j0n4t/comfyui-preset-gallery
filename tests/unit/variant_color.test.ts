import { test } from "node:test";
import assert from "node:assert/strict";
import PresetDisplay from "../../web/PresetDisplay.js";
import RawTextareaManager from "../../web/RawTextareaManager.js";

// Tests for the group-color-on-variants feature in RawTextareaManager.
// The variant token coloring logic extracts the group name from tokens like
// "{groupName:preset}" and uses PresetDisplay.getPresetColor to determine the color.
// extractGroupName is the real static on RawTextareaManager, not an inlined copy.

test("extractGroupName: simple group with preset", () => {
  assert.equal(
    RawTextareaManager.extractGroupName("{Faces:Portrait}"),
    "Faces",
  );
});

test("extractGroupName: nested group path", () => {
  assert.equal(
    RawTextareaManager.extractGroupName("{Faces/Portrait:pro}"),
    "Faces/Portrait",
  );
});

test("extractGroupName: no colon (bare group)", () => {
  assert.equal(RawTextareaManager.extractGroupName("{Faces}"), "Faces");
});

test("extractGroupName: multiple groups uses first", () => {
  assert.equal(
    RawTextareaManager.extractGroupName("{Faces:Portrait,Scenery:Landscape}"),
    "Faces",
  );
});

test("extractGroupName: empty braces", () => {
  assert.equal(RawTextareaManager.extractGroupName("{}"), "");
});

test("getPresetColor: returns custom color when set on folder", () => {
  const cache = {
    Faces: { __color__: "#ff0000", preset: "" },
    "Faces/Portrait": { preset: "pro" },
  };
  assert.equal(
    PresetDisplay.getPresetColor("Faces/Portrait", cache),
    "#ff0000",
  );
});

test("getPresetColor: returns custom color for exact folder match", () => {
  const cache = {
    Faces: { __color__: "#00ff00", preset: "" },
  };
  assert.equal(PresetDisplay.getPresetColor("Faces", cache), "#00ff00");
});

test("getPresetColor: falls back to hash color when no custom color", () => {
  const cache = {
    Faces: { preset: "" },
  };
  const color = PresetDisplay.getPresetColor("Faces", cache);
  assert.ok(color.startsWith("hsl("), `Expected HSL fallback, got: ${color}`);
});

test("getPresetColor: variant token group name gets matching color", () => {
  const cache = {
    Faces: { __color__: "#123456", preset: "" },
    "Faces/Portrait": { preset: "pro" },
  };
  const tokenText = "{Faces:Portrait}";
  const groupName = RawTextareaManager.extractGroupName(tokenText);
  const color = PresetDisplay.getPresetColor(groupName, cache);
  assert.equal(color, "#123456");
});

test("getPresetColor: different groups get different colors", () => {
  const cache = {
    Faces: { __color__: "#aaaaaa", preset: "" },
    Scenery: { __color__: "#bbbbbb", preset: "" },
  };
  const facesColor = PresetDisplay.getPresetColor(
    RawTextareaManager.extractGroupName("{Faces:Portrait}"),
    cache,
  );
  const sceneryColor = PresetDisplay.getPresetColor(
    RawTextareaManager.extractGroupName("{Scenery:Landscape}"),
    cache,
  );
  assert.equal(facesColor, "#aaaaaa");
  assert.equal(sceneryColor, "#bbbbbb");
  assert.notEqual(facesColor, sceneryColor);
});

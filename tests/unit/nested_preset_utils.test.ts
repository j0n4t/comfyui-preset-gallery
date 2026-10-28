import { test } from "node:test";
import assert from "node:assert/strict";
import NestedPresetUtils from "../../web/NestedPresetUtils.js";

// NestedPresetUtils converts between the flat cache map ("Folder/Name" ->
// item) and the nested tree shape used by YAML export and import.

test("flatToNested nests slash-separated keys into folder objects", () => {
  const nested = NestedPresetUtils.flatToNested({
    "Faces/Portrait": { preset: "portrait" },
    "Scenery/Hills": { preset: "hills" },
  });
  assert.deepEqual(Object.keys(nested), ["Faces", "Scenery"]);
  assert.equal(nested.Faces.Portrait, "portrait");
  assert.equal(nested.Scenery.Hills, "hills");
});

test("flatToNested keeps the preset text at the leaf by default (presetOnly)", () => {
  const nested = NestedPresetUtils.flatToNested({
    "Faces/Portrait": { preset: "portrait, solo", filename: "p.png" },
  });
  assert.equal(nested.Faces.Portrait, "portrait, solo");
});

test("flatToNested turns string items into their preset value", () => {
  const nested = NestedPresetUtils.flatToNested({
    Faces: "portrait",
  } as unknown as PresetCache);
  assert.equal(nested.Faces, "portrait");
});

test("flatToNested stores __color__ on folder nodes by default", () => {
  const nested = NestedPresetUtils.flatToNested({
    Faces: { __color__: "#ff0000" },
    "Faces/Portrait": { preset: "portrait" },
  });
  assert.equal(nested.Faces.__color__, "#ff0000");
  assert.equal(nested.Faces.Portrait, "portrait");
});

test("flatToNested drops color-only entries when includeColors is false", () => {
  const nested = NestedPresetUtils.flatToNested(
    {
      Faces: { __color__: "#ff0000" },
      "Faces/Portrait": { preset: "portrait" },
    },
    true,
    false,
  );
  assert.deepEqual(nested, { Faces: { Portrait: "portrait" } });
});

test("flatToNested with presetOnly=false keeps the whole item at the leaf", () => {
  const nested = NestedPresetUtils.flatToNested(
    { "Faces/Portrait": { preset: "portrait", filename: "p.png" } },
    false,
  );
  assert.deepEqual(nested.Faces.Portrait, {
    preset: "portrait",
    filename: "p.png",
  });
});

test("flatToNested with presetOnly=false and includeColors=false strips __color__", () => {
  const nested = NestedPresetUtils.flatToNested(
    { Faces: { __color__: "#ff0000" } },
    false,
    false,
  );
  assert.deepEqual(nested, {});
});

test("flatToNested skips null and undefined items", () => {
  const nested = NestedPresetUtils.flatToNested({
    "Faces/Portrait": null,
    "Faces/Macro": undefined,
    "Scenery/Hills": { preset: "hills" },
  } as unknown as PresetCache);
  assert.deepEqual(Object.keys(nested), ["Scenery"]);
});

test("flatToNested gives an empty string leaf to an item without preset", () => {
  const nested = NestedPresetUtils.flatToNested({ "Faces/Portrait": {} });
  assert.equal(nested.Faces.Portrait, "");
});

test("nestedToFlat rebuilds slash-separated keys from a nested tree", () => {
  const flat = NestedPresetUtils.nestedToFlat({
    Faces: { Portrait: "portrait" },
    Scenery: { Hills: "hills" },
  });
  assert.deepEqual(flat, {
    "Faces/Portrait": { preset: "portrait" },
    "Scenery/Hills": { preset: "hills" },
  });
});

test("nestedToFlat maps string leaves to { preset } items", () => {
  const flat = NestedPresetUtils.nestedToFlat({
    Faces: { Portrait: "portrait" },
  });
  assert.deepEqual(flat["Faces/Portrait"], { preset: "portrait" });
});

test("nestedToFlat preserves filename and __color__ on object leaves", () => {
  const flat = NestedPresetUtils.nestedToFlat({
    Faces: {
      Portrait: { preset: "portrait", filename: "p.png", __color__: "#fff" },
    },
  });
  assert.deepEqual(flat["Faces/Portrait"], {
    preset: "portrait",
    filename: "p.png",
    __color__: "#fff",
  });
});

test("nestedToFlat restores folder colors from __color__ nodes", () => {
  const flat = NestedPresetUtils.nestedToFlat({
    Faces: { __color__: "#ff0000", Portrait: "portrait" },
  });
  assert.equal(flat.Faces.__color__, "#ff0000");
  assert.equal(flat["Faces/Portrait"].preset, "portrait");
});

test("nestedToFlat handles an empty object", () => {
  assert.deepEqual(NestedPresetUtils.nestedToFlat(), {});
  assert.deepEqual(NestedPresetUtils.nestedToFlat({}), {});
});

test("roundtrip flat -> nested -> flat preserves every field", () => {
  // presetOnly=false is the lossless direction: the whole item (including
  // filename) survives, and folder colors survive.
  const library: PresetCache = {
    "Faces/Portrait": { preset: "portrait, solo", filename: "portrait.png" },
    "Faces/Macro": { preset: "macro shot" },
    Scenery: { __color__: "#00ff00" },
  };
  const flat = NestedPresetUtils.nestedToFlat(
    NestedPresetUtils.flatToNested(library, false, true),
  );
  assert.equal(flat["Faces/Portrait"].preset, "portrait, solo");
  assert.equal(flat["Faces/Portrait"].filename, "portrait.png");
  assert.equal(flat["Faces/Macro"].preset, "macro shot");
  assert.equal(flat.Scenery.__color__, "#00ff00");
});

test("roundtrip nested -> flat -> nested preserves colors and item fields", () => {
  const nested = {
    Faces: {
      __color__: "#ff0000",
      Portrait: { preset: "portrait", filename: "p.png" },
    },
    Scenery: { Hills: "hills" },
  };
  const flat = NestedPresetUtils.nestedToFlat(nested);
  assert.equal(flat["Faces/Portrait"].preset, "portrait");
  assert.equal(flat["Faces/Portrait"].filename, "p.png");
  assert.equal(flat["Scenery/Hills"].preset, "hills");
  assert.equal(flat.Faces.__color__, "#ff0000");

  const reNested = NestedPresetUtils.flatToNested(flat, false, true);
  assert.equal(reNested.Faces.__color__, "#ff0000");
  assert.equal(reNested.Faces.Portrait.preset, "portrait");
  assert.equal(reNested.Faces.Portrait.filename, "p.png");
  assert.equal(reNested.Scenery.Hills.preset, "hills");
});

import { test } from "node:test";
import assert from "node:assert/strict";
import {
  STORAGE_KEYS,
  defaultStorage,
  readBool,
  readJson,
  readIdList,
  readString,
  writeBool,
  writeJson,
  writeString,
} from "../../web/GalleryStorage.js";

// GalleryStorage is the only module that knows the storage key names, and the
// only one that decides what a bad value in storage means. Both are contracts:
//
// - the key names are the user's saved state. Renaming one is a data-loss bug,
//   not a refactor, so they are pinned literally rather than derived.
// - a value that is corrupt, or valid JSON of the wrong type, must degrade to
//   the default. `PresetSession` read three keys with no guard, so one bad value
//   threw out of its constructor and the gallery never mounted.

/** In-memory stand-in, the shape the real components inject. */
function fakeStorage(initial: Record<string, string> = {}): Storage {
  const map = new Map<string, string>(Object.entries(initial));
  return {
    getItem: (k: string) => map.get(k) ?? null,
    setItem: (k: string, v: string) => { map.set(k, v); },
    removeItem: (k: string) => { map.delete(k); },
    clear: () => map.clear(),
    key: (i: number) => Array.from(map.keys())[i] ?? null,
    get length() { return map.size; },
  };
}

// --- the key names are the compatibility contract --------------------------

test("the storage keys keep their historical names", () => {
  // Three generations of naming, all still read by the browser storage users
  // already have. `pins` is a function because the key carries the node id.
  assert.equal(STORAGE_KEYS.rawBasket, "comfy_preset_gallery_raw_basket");
  assert.equal(STORAGE_KEYS.basketTabs, "comfy_preset_gallery_basket_tabs");
  assert.equal(STORAGE_KEYS.panelCollapsed, "comfy_preset_gallery_collapsed");
  assert.equal(STORAGE_KEYS.galleryHidden, "comfy_preset_gallery_hidden");
  assert.equal(STORAGE_KEYS.view, "comfy_preset_gallery_view");
  assert.equal(STORAGE_KEYS.grouped, "comfy_preset_gallery_grouped");
  assert.equal(STORAGE_KEYS.showHidden, "comfy_preset_gallery_show_hidden");
  assert.equal(STORAGE_KEYS.settings, "pg_settings");
  assert.equal(STORAGE_KEYS.collapsedFolders, "pg_collapsed_folders_list");
  assert.equal(STORAGE_KEYS.excludedRollFolders, "pg_excluded_roll_folders");
});

test("the per-node pin key carries the node id and falls back to global", () => {
  assert.equal(STORAGE_KEYS.pins("node-7"), "j0n4t-pg-pins-node-7");
  assert.equal(STORAGE_KEYS.pins(7), "j0n4t-pg-pins-7");
  // No node id is the pre-node behaviour: one shared list.
  assert.equal(STORAGE_KEYS.pins(undefined), "j0n4t-pg-pins-global");
  assert.equal(STORAGE_KEYS.pins(""), "j0n4t-pg-pins-global");
});

// --- booleans -------------------------------------------------------------

test("readBool is exactly the string \"true\", nothing else", () => {
  const storage = fakeStorage({
    on: "true",
    off: "false",
    upper: "TRUE",
    one: "1",
    yes: "yes",
  });
  assert.equal(readBool("on", false, storage), true);
  // "TRUE" and "1" are what a future tidy-up might write; reading them as on
  // would silently flip a default-off preference on for existing users.
  assert.equal(readBool("upper", false, storage), false);
  assert.equal(readBool("one", false, storage), false);
  assert.equal(readBool("yes", false, storage), false);
});

test("readBool's fallback covers the default-on keys", () => {
  // `comfy_preset_gallery_grouped` is read as `!== "false"`, so anything but
  // the literal "false" means grouped.
  const storage = fakeStorage({ off: "false" });
  assert.equal(readBool("off", true, storage), true, "an explicit false still falls back");
  assert.equal(readBool("missing", true, storage), true, "an absent key is on");
  assert.equal(readBool("missing", false, storage), false, "an absent key is off when defaulted off");
});

test("writeBool writes the string form the reader expects", () => {
  const storage = fakeStorage();
  writeBool("flag", true, storage);
  writeBool("other", false, storage);
  assert.equal(storage.getItem("flag"), "true");
  assert.equal(storage.getItem("other"), "false");
});

// --- strings --------------------------------------------------------------

test("readString treats an empty value as missing", () => {
  const storage = fakeStorage({ set: "list", empty: "" });
  assert.equal(readString("set", "big", storage), "list");
  assert.equal(readString("empty", "big", storage), "big");
  assert.equal(readString("missing", "big", storage), "big");
  assert.equal(readString("missing", "", storage), "");
});

test("writeString stores the value verbatim", () => {
  const storage = fakeStorage();
  writeString("view", "list", storage);
  assert.equal(storage.getItem("view"), "list");
});

// --- JSON -----------------------------------------------------------------

test("readJson parses a stored value", () => {
  const storage = fakeStorage({ obj: '{"a":1}', arr: "[1,2]", nul: "null" });
  assert.deepEqual(readJson("obj", {}, storage), { a: 1 });
  assert.deepEqual(readJson("arr", [], storage), [1, 2]);
  assert.equal(readJson("nul", "fallback", storage), null, "valid JSON null is not a missing value");
});

test("readJson falls back on a missing or corrupt value", () => {
  // A corrupt value must not throw: the session reads three of these, and the
  // pins one is read in its constructor.
  const storage = fakeStorage({ bad: "{not json", truncated: "[1,2" });
  assert.equal(readJson("missing", "fb", storage), "fb");
  assert.equal(readJson("bad", "fb", storage), "fb");
  assert.equal(readJson("truncated", "fb", storage), "fb");
  assert.deepEqual(readJson("bad", { a: 1 }, storage), { a: 1 });
});

test("writeJson stores parseable JSON", () => {
  const storage = fakeStorage();
  writeJson("tabs", { tabs: [1, 2] }, storage);
  assert.equal(storage.getItem("tabs"), '{"tabs":[1,2]}');
  assert.deepEqual(readJson("tabs", null, storage), { tabs: [1, 2] });
});

// --- id lists -------------------------------------------------------------

test("readIdList returns a stored array of strings", () => {
  const storage = fakeStorage({ list: '["Faces","Scenery"]' });
  assert.deepEqual(readIdList("list", storage), ["Faces", "Scenery"]);
});

test("readIdList drops entries that are not strings", () => {
  // `[1,2]` and `["Faces",2]` are valid JSON. Handing a number to a caller that
  // does `includes` on it is how a folder list stops matching silently.
  const storage = fakeStorage({ mixed: '["Faces",2,null]', numbers: "[1,2]" });
  assert.deepEqual(readIdList("mixed", storage), ["Faces"]);
  assert.deepEqual(readIdList("numbers", storage), []);
});

test("readIdList returns an empty list for anything that is not an array", () => {
  const storage = fakeStorage({
    str: '"a string"',
    num: "42",
    nul: "null",
    bad: "{not json",
    empty: "",
  });
  for (const key of ["str", "num", "nul", "bad", "empty", "missing"]) {
    const list = readIdList(key, storage);
    assert.ok(Array.isArray(list), `${key} gave ${typeof list}, expected an array`);
    assert.deepEqual(list, []);
  }
});

// --- the ambient storage --------------------------------------------------

test("defaultStorage is null when there is no localStorage", () => {
  // Under `node --test` there is none, which is the case this guards.
  assert.equal(defaultStorage(), null);
});

test("defaultStorage returns the ambient storage when there is one", () => {
  const storage = fakeStorage({ probe: "yes" });
  const saved = globalThis.localStorage;
  globalThis.localStorage = storage;
  try {
    assert.equal(defaultStorage(), storage);
    // And the primitives reach it with no storage argument at all.
    assert.equal(readString("probe", "no"), "yes");
    writeString("written", "1");
    assert.equal(storage.getItem("written"), "1");
  } finally {
    globalThis.localStorage = saved;
  }
});

test("defaultStorage survives a storage that throws when read", () => {
  // Some browsers and privacy tools throw on access rather than returning
  // null. Reading a preference must not take the gallery down.
  const saved = globalThis.localStorage;
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    get() { throw new Error("blocked"); },
  });
  try {
    assert.equal(defaultStorage(), null);
    assert.equal(readBool("anything", true), true, "a blocked storage yields the defaults");
    assert.deepEqual(readIdList("anything"), []);
  } finally {
    // Restored by descriptor rather than `delete`: the property is not
    // optional on the Window type, so `delete` does not typecheck.
    Object.defineProperty(globalThis, "localStorage", {
      configurable: true,
      value: saved,
    });
  }
});

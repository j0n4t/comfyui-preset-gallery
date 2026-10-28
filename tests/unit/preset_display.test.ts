import { test } from "node:test";
import assert from "node:assert/strict";
import PresetDisplay from "../../web/PresetDisplay.js";

// PresetDisplay owns how a preset is named, labelled, coloured and searched
// for. It reads a key and the cache and answers what the UI shows; it does not
// parse the token grammar or expand a prompt, which is what it was split out of
// PresetLogic to keep separate.

const MERGED: PresetCache = {
  "wear/sock/ankle": { preset: "socks ankle" },
  "socks#wear/sock/ankle": { preset: "main ankle" },
  "wear/sock/knee": { preset: "main knee" },
};

// --- path helpers and title casing ----------------------------------------

test("getPresetName returns the last path segment", () => {
  assert.equal(PresetDisplay.getPresetName("Faces/Portrait"), "Portrait");
  assert.equal(PresetDisplay.getPresetName("RootPreset"), "RootPreset");
});

test("getPresetFolder returns the parent path", () => {
  assert.equal(PresetDisplay.getPresetFolder("Faces/Portrait"), "Faces");
  assert.equal(PresetDisplay.getPresetFolder("RootPreset"), "");
});

test("toTitleCase converts underscores and hyphens to capitalised words", () => {
  assert.equal(
    PresetDisplay.toTitleCase("portrait_solo-shot"),
    "Portrait Solo Shot",
  );
});

// --- library qualifiers on cache keys -------------------------------------
//
// A merged cache files every entry a library displaced under `libraryId#key`.
// The qualifier is part of the key namespace, but every helper that reads a
// folder, a name or a group must look at the plain path: `socks#wear/sock` is
// `wear/sock` from the socks library.

test("the path helpers read the plain path behind a qualifier", () => {
  assert.equal(PresetDisplay.getPresetFolder("socks#wear/sock"), "wear");
  assert.equal(PresetDisplay.getPresetName("socks#wear/sock"), "sock");
  assert.equal(PresetDisplay.getPresetInitials("socks#wear/sock"), "So");
  assert.equal(PresetDisplay.getUiFolder("socks#wear/sock"), "wear");
  assert.equal(PresetDisplay.getPresetBaseFolder("socks#wear/sock"), "wear");
  assert.equal(
    PresetDisplay.getPresetColor("socks#wear/sock", MERGED),
    PresetDisplay.getHashColor("wear"),
  );
});

test("getSearchBlob includes the library prefix for qualified keys", () => {
  const blob = PresetDisplay.getSearchBlob("socks#wear/sock/ankle", {
    preset: "ankle socks",
  });
  assert.ok(blob.startsWith("socks# "));
  assert.ok(blob.includes("ankle"));
});

test("getPresetInitials caps at six characters", () => {
  // Four two-character words would give eight; the cap keeps a badge short.
  assert.equal(
    PresetDisplay.getPresetInitials("Faces/very_long_preset_name"),
    "VeLoPr",
  );
  assert.equal(PresetDisplay.getPresetInitials("Faces/Portrait"), "Po");
});

test("getAllPresetFolders lists each folder once", () => {
  const cache: PresetCache = {
    "Faces/Portrait": { preset: "p" },
    "Faces/Macro": { preset: "p" },
    Root: { preset: "p" },
  };
  // Root has the empty folder, and the set keeps it - callers filter it.
  assert.deepEqual(PresetDisplay.getAllPresetFolders(cache).sort(), [
    "",
    "Faces",
  ]);
});

// --- the colour helpers ---------------------------------------------------

test("getPresetColor walks up to an assigned folder colour", () => {
  const cache: PresetCache = {
    Faces: { __color__: "#ff0000", preset: "" },
    "Faces/Portrait": { preset: "pro" },
  };
  assert.equal(
    PresetDisplay.getPresetColor("Faces/Portrait", cache),
    "#ff0000",
  );
  assert.equal(PresetDisplay.getPresetColor("Faces", cache), "#ff0000");
});

test("getPresetColor falls back to a hash colour on the top-level folder", () => {
  const color = PresetDisplay.getPresetColor("Faces/Portrait", {
    "Faces/Portrait": { preset: "pro" },
  });
  assert.ok(color.startsWith("hsl("), `expected an HSL fallback, got ${color}`);
  assert.equal(color, PresetDisplay.getHashColor("Faces"));
});

test("getHashColor is a stable literal, not a fresh value per call", () => {
  // Pinned: the colour is part of what the user sees, so a change to the hash
  // is a visible change and must be deliberate.
  assert.equal(PresetDisplay.getHashColor("Faces"), "hsl(107, 65%, 35%)");
  assert.equal(PresetDisplay.getHashColor("wear"), "hsl(207, 65%, 35%)");
});

test("getPresetColor reads the plain path, so a qualifier does not split it", () => {
  // `socks#wear/sock` must hash `wear`, not `socks#wear`.
  assert.equal(
    PresetDisplay.getPresetColor("socks#wear/sock", MERGED),
    PresetDisplay.getHashColor("wear"),
  );
});

// --- getTopMatches: the ranking the autocomplete shows --------------------

test("getTopMatches ranks a leading match ahead of a fuzzy one", () => {
  const cache: PresetCache = {
    "Faces/Portrait": { preset: "pro" },
    "Scenery/Portrait": { preset: "pro" },
  };
  const matches = PresetDisplay.getTopMatches(
    Object.keys(cache),
    "portrait",
    (k) => PresetDisplay.getSearchBlob(k, cache[k]),
    cache,
  );
  assert.deepEqual(
    matches.map((m) => m.item),
    ["Faces/Portrait", "Scenery/Portrait"],
  );
});

test("getTopMatches drops a key that matches no cache entry", () => {
  // A folder query builds a dummy cache entry for the folder itself; the
  // preset-less entry is not a match unless it is a virtual null.
  const cache: PresetCache = { "Faces/Portrait": { preset: "pro" } };
  const matches = PresetDisplay.getTopMatches(
    ["Faces", "Faces/Portrait"],
    "faces",
    (k) => PresetDisplay.getSearchBlob(k, cache[k] || { preset: k }),
    cache,
  );
  assert.deepEqual(
    matches.map((m) => m.item),
    ["Faces/Portrait"],
  );
});

test("getTopMatches keeps a virtual null as a candidate", () => {
  const cache: PresetCache = { "Faces/Portrait": { preset: "pro" } };
  const matches = PresetDisplay.getTopMatches(
    ["none", "Faces/Portrait"],
    "no",
    (k) =>
      PresetDisplay.getPresetName(k) === "none"
        ? k
        : PresetDisplay.getSearchBlob(k, cache[k] || {}),
    cache,
  );
  assert.deepEqual(
    matches.map((m) => m.item),
    ["none"],
  );
});

test("getTopMatches orders fuzzy matches by where the query appears", () => {
  // Both are fuzzy (the name is not the query), so the position decides:
  // the shorter blob finds "pro" sooner.
  const cache: PresetCache = {
    "Faces/X": { preset: "pro" },
    "Scenery/LongName": { preset: "pro" },
  };
  const matches = PresetDisplay.getTopMatches(
    Object.keys(cache),
    "pro",
    (k) => PresetDisplay.getSearchBlob(k, cache[k]),
    cache,
  );
  assert.deepEqual(
    matches.map((m) => m.item),
    ["Faces/X", "Scenery/LongName"],
  );
});

test("getTopMatches returns nothing for an empty query", () => {
  assert.deepEqual(
    PresetDisplay.getTopMatches(["Faces/Portrait"], "  ", (k) => k, {}),
    [],
  );
});

// --- getPresetTitle --------------------------------------------------------

test("getPresetTitle names the preset and its body", () => {
  const title = PresetDisplay.getPresetTitle("Faces/Portrait", {
    "Faces/Portrait": { preset: "pro" },
  });
  assert.equal(title, "Portrait [Faces/Portrait]\npro");
});

test("getPresetTitle prepends the evaluated value when it differs from the body", () => {
  const cache: PresetCache = {
    "look/simple": { preset: "simple look" },
    "look/combo": { preset: "look/simple, extra" },
  };
  const title = PresetDisplay.getPresetTitle("look/combo", cache);
  assert.equal(
    title,
    "simple look, extra\n\nCombo [look/combo]\nlook/simple, extra",
  );
});

test("getPresetTitle names a virtual null instead of expanding it", () => {
  assert.equal(PresetDisplay.getPresetTitle("none", {}), "None [omit variant]");
  assert.equal(PresetDisplay.getPresetTitle("", {}), "");
});

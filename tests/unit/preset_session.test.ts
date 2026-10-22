import { test } from "node:test";
import assert from "node:assert/strict";
import PresetSession from "../../web/PresetSession.js";

// These exercise the logic that used to live on PresetGalleryApp and had no
// test at all: the dice algorithm, seed-change detection, pin pruning and the
// persisted view preferences. storage and rng are injected so everything here
// is deterministic.

/** In-memory stand-in for localStorage. */
function fakeStorage(initial: Record<string, string> = {}): Storage & { _map: Map<string, string> } {
  const map = new Map<string, string>(Object.entries(initial));
  return {
    getItem: (k: string) => map.get(k) ?? null,
    setItem: (k: string, v: string) => { map.set(k, v); },
    removeItem: (k: string) => { map.delete(k); },
    clear: () => map.clear(),
    key: (i: number) => Array.from(map.keys())[i] ?? null,
    get length() { return map.size; },
    _map: map,
  };
}

/** Deterministic replacement for Math.random (numerical recipes LCG). */
function seededRng(seed = 1): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

function makeSession({
  storage = fakeStorage(),
  rng = seededRng(),
  nodeId = "global",
}: { storage?: Storage | null; rng?: () => number; nodeId?: string | number } = {}) {
  return new PresetSession({ storage, rng, nodeId });
}

const CACHE: PresetCache = {
  "Faces/Portrait": { preset: "portrait" },
  "Faces/Macro": { preset: "macro" },
  "Scenery/Hills": { preset: "hills" },
  "Scenery/Sky": { preset: "sky" },
  "Animals/Cat": { preset: "cat" },
  "RootPreset": { preset: "root" },
  "_/combo/_default": { preset: "combo" },
  "_/hidden/Thing": { preset: "hidden" },
  "Faces/Empty": { preset: "" },
};

/** Same cache without the combo default, for tests asserting exact counts. */
const PLAIN_CACHE: PresetCache = {
  "Faces/Portrait": { preset: "portrait" },
  "Faces/Macro": { preset: "macro" },
  "Scenery/Hills": { preset: "hills" },
  "Scenery/Sky": { preset: "sky" },
  "Animals/Cat": { preset: "cat" },
  "RootPreset": { preset: "root" },
  "_/hidden/Thing": { preset: "hidden" },
  "Faces/Empty": { preset: "" },
};

// --- getSelectedArray ---

test("getSelectedArray: empty value yields no selection", () => {
  assert.deepEqual(makeSession().getSelectedArray(""), []);
});

test("getSelectedArray: splits a comma separated widget value", () => {
  assert.deepEqual(
    makeSession().getSelectedArray("Faces/Portrait, Scenery/Hills"),
    ["Faces/Portrait", "Scenery/Hills"]
  );
});

// --- prunePins ---

test("prunePins: keeps a pin whose tokens are still contiguous", () => {
  const session = makeSession();
  session.pinnedChips = new Set(["Faces/Portrait, Scenery/Hills"]);
  const changed = session.prunePins(["Faces/Portrait", "Scenery/Hills", "Animals/Cat"]);
  assert.equal(changed, false);
  assert.deepEqual([...session.pinnedChips], ["Faces/Portrait, Scenery/Hills"]);
});

test("prunePins: drops a multi-token pin when its tokens are interrupted", () => {
  const session = makeSession();
  session.pinnedChips = new Set(["Faces/Portrait, Scenery/Hills"]);
  const changed = session.prunePins(["Faces/Portrait", "Animals/Cat", "Scenery/Hills"]);
  assert.equal(changed, true);
  assert.deepEqual([...session.pinnedChips], []);
});

test("prunePins: drops a pin that is gone and keeps the surviving one", () => {
  const session = makeSession();
  session.pinnedChips = new Set(["Faces/Portrait", "Animals/Cat"]);
  const changed = session.prunePins(["Animals/Cat"]);
  assert.equal(changed, true);
  assert.deepEqual([...session.pinnedChips], ["Animals/Cat"]);
});

test("prunePins: persists the surviving pins", () => {
  const storage = fakeStorage();
  const session = makeSession({ storage, nodeId: 3 });
  session.pinnedChips = new Set(["Faces/Portrait", "Animals/Cat"]);
  session.prunePins(["Animals/Cat"]);
  assert.equal(storage._map.get("j0n4t-pg-pins-3"), JSON.stringify(["Animals/Cat"]));
});

// --- pins persistence ---

test("pins are scoped per node and restored from storage", () => {
  const storage = fakeStorage();
  const first = makeSession({ storage, nodeId: 42 });
  first.pinnedChips = new Set(["Faces/Portrait"]);
  first.savePins();

  const reloaded = makeSession({ storage, nodeId: 42 });
  assert.deepEqual([...reloaded.pinnedChips], ["Faces/Portrait"]);

  const otherNode = makeSession({ storage, nodeId: 43 });
  assert.deepEqual([...otherNode.pinnedChips], []);
});

test("transferPin: moves a pin and persists, ignores unpinned values", () => {
  const storage = fakeStorage();
  const session = makeSession({ storage, nodeId: 5 });
  session.pinnedChips = new Set(["Faces/Portrait"]);
  session.transferPin("Faces/Portrait", "Faces/Renamed");
  assert.deepEqual([...session.pinnedChips], ["Faces/Renamed"]);
  assert.equal(storage._map.get("j0n4t-pg-pins-5"), JSON.stringify(["Faces/Renamed"]));

  session.transferPin("Scenery/Hills", "Scenery/Other");
  assert.deepEqual([...session.pinnedChips], ["Faces/Renamed"]);
});

// --- persisted view preferences ---

test("collapsed folders default to empty and round trip", () => {
  const session = makeSession();
  assert.deepEqual(session.getCollapsedFolders(), []);
  session.setCollapsedFolders(["Faces", "Scenery"]);
  assert.deepEqual(session.getCollapsedFolders(), ["Faces", "Scenery"]);
});

test("excluded roll folders default to empty and round trip", () => {
  const session = makeSession();
  assert.deepEqual(session.getExcludedRollFolders(), []);
  session.setExcludedRollFolders(["Animals"]);
  assert.deepEqual(session.getExcludedRollFolders(), ["Animals"]);
});

test("a session without storage degrades to empty values instead of throwing", () => {
  const session = new PresetSession({ storage: null, rng: seededRng() });
  assert.deepEqual(session.getCollapsedFolders(), []);
  assert.deepEqual(session.getExcludedRollFolders(), []);
  session.setCollapsedFolders(["Faces"]);
  session.savePins();
  assert.deepEqual(session.getCollapsedFolders(), []);
});

// --- buildRollSelection ---

test("buildRollSelection: returns null when no folder qualifies", () => {
  const session = makeSession();
  assert.equal(
    session.buildRollSelection({
      cache: { "RootPreset": { preset: "root" }, "_/combo/_default": { preset: "c" } },
    }),
    null
  );
});

test("buildRollSelection: honours min when min equals max", () => {
  const session = makeSession();
  const result = session.buildRollSelection({ cache: PLAIN_CACHE, min: 3, max: 3 });
  assert.ok(result);
  assert.equal(result.length, 3);
});

test("buildRollSelection: never draws from underscore folders or folderless keys", () => {
  for (let seed = 1; seed <= 25; seed++) {
    const result = makeSession({ rng: seededRng(seed) }).buildRollSelection({
      cache: PLAIN_CACHE,
      min: 3,
      max: 3,
    });
    assert.ok(result);
    for (const key of result) {
      const folder = key.split("/").slice(0, -1).join("/");
      assert.ok(folder && !folder.startsWith("_"), `unexpected key: ${key}`);
      assert.notEqual(key, "RootPreset");
      assert.notEqual(key, "Faces/Empty");
    }
  }
});

test("buildRollSelection: never repeats a preset", () => {
  const session = makeSession();
  const result = session.buildRollSelection({ cache: PLAIN_CACHE, min: 4, max: 4 });
  assert.ok(result);
  assert.equal(new Set(result).size, result.length);
});

test("buildRollSelection: keeps pinned chips that are still selected", () => {
  const session = makeSession();
  session.pinnedChips = new Set(["Faces/Portrait"]);
  const result = session.buildRollSelection({
    cache: PLAIN_CACHE,
    min: 1,
    max: 1,
    selected: ["Faces/Portrait", "Scenery/Sky"],
  });
  assert.ok(result);
  // target is max(1, pins + 1) = 2
  assert.equal(result.length, 2);
  assert.ok(result.includes("Faces/Portrait"));
  // an unpinned selected preset is not carried over
  assert.ok(!result.includes("Scenery/Sky"));
});

test("buildRollSelection: grows past min to fit the pinned selection", () => {
  const session = makeSession();
  session.pinnedChips = new Set(["Faces/Portrait", "Scenery/Sky", "Animals/Cat"]);
  const result = session.buildRollSelection({
    cache: PLAIN_CACHE,
    min: 1,
    max: 1,
    selected: ["Faces/Portrait", "Scenery/Sky", "Animals/Cat"],
  });
  assert.ok(result);
  assert.equal(result.length, 4);
  for (const pin of ["Faces/Portrait", "Scenery/Sky", "Animals/Cat"]) {
    assert.ok(result.includes(pin), `missing pin ${pin}`);
  }
});

test("buildRollSelection: stops at the presets that exist when the target is unreachable", () => {
  const session = makeSession();
  const result = session.buildRollSelection({
    cache: { "Faces/Portrait": { preset: "portrait" } },
    min: 5,
    max: 5,
  });
  assert.deepEqual(result, ["Faces/Portrait"]);
});

test("buildRollSelection: skips excluded folders", () => {
  const session = makeSession();
  const result = session.buildRollSelection({
    cache: PLAIN_CACHE,
    excludedFolders: ["Faces", "Scenery"],
    min: 3,
    max: 3,
  });
  assert.ok(result);
  assert.deepEqual(result, ["Animals/Cat"]);
});

test("buildRollSelection: prepends the combo default and sorts the rest", () => {
  const session = makeSession();
  const result = session.buildRollSelection({ cache: CACHE, min: 4, max: 4 });
  assert.ok(result);
  assert.equal(result[0], "_/combo/_default");
  const rest = result.slice(1);
  assert.deepEqual(rest, [...rest].sort((a, b) => a.localeCompare(b)));
});

test("buildRollSelection: the combo default is added on top of the target count", () => {
  const session = makeSession();
  const withDefault = session.buildRollSelection({ cache: CACHE, min: 3, max: 3 });
  const without = session.buildRollSelection({ cache: PLAIN_CACHE, min: 3, max: 3 });
  assert.ok(withDefault && without);
  assert.equal(withDefault.length, without.length + 1);
  assert.equal(withDefault[0], "_/combo/_default");
});

test("buildRollSelection: does not prepend the combo default when it is absent", () => {
  const session = makeSession();
  const result = session.buildRollSelection({ cache: PLAIN_CACHE, min: 3, max: 3 });
  assert.ok(result);
  assert.ok(!result.includes("_/combo/_default"));
});

// --- detectSeedChange ---

test("detectSeedChange: reports false on the first call, then true only on a change", () => {
  const session = makeSession();
  const nodes = [{ id: 1, widgets: [{ name: "seed", value: 10 }] }];
  assert.equal(session.detectSeedChange(nodes), false);
  assert.equal(session.detectSeedChange(nodes), false);
  nodes[0].widgets[0].value = 11;
  assert.equal(session.detectSeedChange(nodes), true);
  assert.equal(session.detectSeedChange(nodes), false);
});

test("detectSeedChange: watches noise widgets too and ignores unrelated ones", () => {
  const session = makeSession();
  const nodes = [{ id: 1, widgets: [{ name: "steps", value: 20 }, { name: "noise_seed", value: 7 }] }];
  assert.equal(session.detectSeedChange(nodes), false);
  nodes[0].widgets[0].value = 30;
  assert.equal(session.detectSeedChange(nodes), false, "steps is not a seed widget");
  nodes[0].widgets[1].value = 8;
  assert.equal(session.detectSeedChange(nodes), true);
});

test("detectSeedChange: recurses into subgraphs", () => {
  const session = makeSession();
  const nodes = [
    {
      id: 1,
      widgets: [],
      subgraph: { _nodes: [{ id: 2, widgets: [{ name: "seed", value: 5 }] }] },
    },
  ];
  assert.equal(session.detectSeedChange(nodes), false);
  nodes[0].subgraph._nodes[0].widgets[0].value = 6;
  assert.equal(session.detectSeedChange(nodes), true);
});

test("detectSeedChange: a removed seed widget is not reported as a change", () => {
  const session = makeSession();
  assert.equal(session.detectSeedChange([{ id: 1, widgets: [{ name: "seed", value: 1 }] }]), false);
  assert.equal(session.detectSeedChange([{ id: 1, widgets: [] }]), false);
});

// --- setLibraries / rebuildCache ---

const MAIN: PresetCache = {
  "wear/sock/ankle": { preset: "main ankle socks" },
  "wear/sock/knee": { preset: "main knee socks" },
  "Faces/Portrait": { preset: "portrait" },
};

const SOCKS: PresetCache = {
  "wear/sock/ankle": { preset: "socks ankle socks" },
  "wear/sock/crew": { preset: "socks crew socks" },
};

const HAIR: PresetCache = {
  "hair/long": { preset: "long hair" },
};

test("one library merges to its own entries under their plain keys", () => {
  const session = makeSession();
  session.setLibraries([{ id: "main", name: "Main" }], { main: MAIN });

  assert.deepEqual(Object.keys(session.cache), ["wear/sock/ankle", "wear/sock/knee", "Faces/Portrait"]);
  assert.equal(session.cache["wear/sock/ankle"].preset, "main ankle socks");
  assert.deepEqual(session.duplicateKeys, new Set());
});

test("two libraries without a collision merge to the union", () => {
  const session = makeSession();
  session.setLibraries(
    [{ id: "main", name: "Main" }, { id: "hair", name: "Hair" }],
    { main: MAIN, hair: HAIR }
  );

  assert.deepEqual(Object.keys(session.cache).sort(), [
    "Faces/Portrait",
    "hair/long",
    "wear/sock/ankle",
    "wear/sock/knee",
  ]);
});

test("a later library is filed under its qualifier; the first one keeps the plain key", () => {
  const session = makeSession();
  session.setLibraries(
    [{ id: "main", name: "Main" }, { id: "socks", name: "Socks" }],
    { main: MAIN, socks: SOCKS }
  );

  assert.equal(session.cache["wear/sock/ankle"].preset, "main ankle socks", "main is first, so it wins");
  assert.equal(session.cache["socks#wear/sock/ankle"].preset, "socks ankle socks");
  // the key only socks has is untouched
  assert.equal(session.cache["wear/sock/crew"].preset, "socks crew socks");
  assert.equal(session.keyOwners.get("wear/sock/ankle"), "main");
  assert.deepEqual(session.duplicateKeys, new Set(["wear/sock/ankle"]));
});

test("three libraries claiming one key leave every entry reachable", () => {
  const session = makeSession();
  const third: PresetCache = { "wear/sock/ankle": { preset: "third ankle socks" } };
  session.setLibraries(
    [
      { id: "main", name: "Main" },
      { id: "socks", name: "Socks" },
      { id: "third", name: "Third" },
    ],
    { main: MAIN, socks: SOCKS, third }
  );

  assert.equal(session.cache["wear/sock/ankle"].preset, "main ankle socks");
  assert.equal(session.cache["socks#wear/sock/ankle"].preset, "socks ankle socks");
  assert.equal(session.cache["third#wear/sock/ankle"].preset, "third ankle socks");
});

test("reordering the list changes which library wins a shared key", () => {
  const session = makeSession();
  const caches = { main: MAIN, socks: SOCKS };

  session.setLibraries([{ id: "socks", name: "Socks" }, { id: "main", name: "Main" }], caches);
  assert.equal(session.cache["wear/sock/ankle"].preset, "socks ankle socks", "socks is first now");
  assert.equal(session.cache["main#wear/sock/ankle"].preset, "main ankle socks");

  session.setLibraries([{ id: "main", name: "Main" }, { id: "socks", name: "Socks" }], caches);
  assert.equal(session.cache["wear/sock/ankle"].preset, "main ankle socks", "main is first again");
  assert.equal(session.cache["socks#wear/sock/ankle"].preset, "socks ankle socks");
});

test("ownerOfKey reads the qualifier first, then the highest-priority winner", () => {
  const session = makeSession();
  session.setLibraries(
    [{ id: "main", name: "Main" }, { id: "socks", name: "Socks" }],
    { main: MAIN, socks: SOCKS }
  );

  assert.equal(session.ownerOfKey("socks#wear/sock/ankle"), "socks");
  assert.equal(session.ownerOfKey("main#wear/sock/ankle"), "main");
  assert.equal(session.ownerOfKey("wear/sock/ankle"), "main", "the first library owns the plain key");
  assert.equal(session.ownerOfKey("Faces/Portrait"), "main");
  assert.equal(session.ownerOfKey("hair/long"), null, "a key no library has");
  assert.equal(session.ownerOfKey(""), null);
});

test("isDuplicateKey reports the plain key however it is spelled", () => {
  const session = makeSession();
  session.setLibraries(
    [{ id: "main", name: "Main" }, { id: "socks", name: "Socks" }],
    { main: MAIN, socks: SOCKS }
  );

  assert.equal(session.isDuplicateKey("wear/sock/ankle"), true);
  assert.equal(session.isDuplicateKey("main#wear/sock/ankle"), true);
  assert.equal(session.isDuplicateKey("socks#wear/sock/ankle"), true);
  assert.equal(session.isDuplicateKey("Faces/Portrait"), false);
});

test("libraryName falls back to the id for an unknown library", () => {
  const session = makeSession();
  session.setLibraries([{ id: "main", name: "Main" }], { main: MAIN });
  assert.equal(session.libraryName("main"), "Main");
  assert.equal(session.libraryName("ghost"), "ghost");
});

test("a listed library with no entries contributes nothing, and a repeated id is not merged twice", () => {
  const session = makeSession();
  session.setLibraries(
    [{ id: "main", name: "Main" }, { id: "socks", name: "Socks" }, { id: "socks", name: "Socks" }],
    { main: MAIN, socks: SOCKS }
  );

  assert.equal(session.cache["wear/sock/ankle"].preset, "main ankle socks", "main is first");
  assert.equal(session.cache["socks#wear/sock/ankle"].preset, "socks ankle socks");
  // the second `socks` pass must not file the entry twice under another name
  assert.equal(Object.keys(session.cache).filter((k) => k.endsWith("#wear/sock/ankle")).length, 1);
});

test("setLibraries with nothing leaves an empty cache rather than throwing", () => {
  const session = makeSession();
  session.setLibraries([], {});
  assert.deepEqual(session.cache, {});
  assert.deepEqual(session.libraries, []);
  session.setLibraries(undefined, undefined);
  assert.deepEqual(session.cache, {});
});

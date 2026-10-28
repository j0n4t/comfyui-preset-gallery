import { test } from "node:test";
import assert from "node:assert/strict";
import PresetSession from "../../web/PresetSession.js";

// These exercise the logic that used to live on PresetGalleryApp and had no
// test at all: the dice algorithm, seed-change detection, pin pruning and the
// persisted view preferences. storage and rng are injected so everything here
// is deterministic.

/** In-memory stand-in for localStorage. */
function fakeStorage(
  initial: Record<string, string> = {},
): Storage & { _map: Map<string, string> } {
  const map = new Map<string, string>(Object.entries(initial));
  return {
    getItem: (k: string) => map.get(k) ?? null,
    setItem: (k: string, v: string) => {
      map.set(k, v);
    },
    removeItem: (k: string) => {
      map.delete(k);
    },
    clear: () => map.clear(),
    key: (i: number) => Array.from(map.keys())[i] ?? null,
    get length() {
      return map.size;
    },
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
}: {
  storage?: Storage | null;
  rng?: () => number;
  nodeId?: string | number;
} = {}) {
  return new PresetSession({ storage, rng, nodeId });
}

const CACHE: PresetCache = {
  "Faces/Portrait": { preset: "portrait" },
  "Faces/Macro": { preset: "macro" },
  "Scenery/Hills": { preset: "hills" },
  "Scenery/Sky": { preset: "sky" },
  "Animals/Cat": { preset: "cat" },
  RootPreset: { preset: "root" },
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
  RootPreset: { preset: "root" },
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
    ["Faces/Portrait", "Scenery/Hills"],
  );
});

// --- composePrompt ---

// The one entry point the host uses twice: once for the displayed evaluated
// widget and once for the queued prompt. A variant group is the case that can
// drift, because the group choice is rolled once and both paths must reuse it.
const PROMPT_CACHE: PresetCache = {
  "Faces/Portrait": { preset: "portrait, studio lighting" },
  "Faces/Variants": { preset: "{Scenery}" },
  "Scenery/Hills": { preset: "rolling hills" },
  "Scenery/Sky": { preset: "dramatic sky" },
};

function promptSession(): PresetSession {
  const session = makeSession();
  session.setLibraries([{ id: "main", name: "Main" }], { main: PROMPT_CACHE });
  return session;
}

test("composePrompt expands the raw selection through the cache in order", () => {
  assert.equal(
    promptSession().composePrompt("Faces/Portrait, Scenery/Hills"),
    "portrait, studio lighting, rolling hills",
  );
});

test("composePrompt starts the roll counters at zero, so composing twice agrees", () => {
  const session = promptSession();
  const displayed = session.composePrompt("Faces/Variants");
  const serialized = session.composePrompt("Faces/Variants");

  assert.equal(displayed, serialized);
  assert.equal(
    session.rollManager.counts.scenery,
    1,
    "one pick per group per composition",
  );
});

test("composePrompt reuses the rolled choice rather than drawing a new one", () => {
  const session = promptSession();
  session.rollManager.rolls = { scenery_0: "Scenery/Hills" };

  assert.equal(session.composePrompt("Faces/Variants"), "rolling hills");
  assert.equal(session.composePrompt("Faces/Variants"), "rolling hills");
});

test("composePrompt keeps an explicit variant, its weight and None", () => {
  const session = promptSession();
  assert.equal(session.composePrompt("{Scenery:Scenery/Sky}"), "dramatic sky");
  assert.equal(
    session.composePrompt("({Scenery:Scenery/Sky}:1.05)"),
    "(dramatic sky:1.05)",
  );
  assert.equal(session.composePrompt("{Scenery:none}"), "");
});

test("composePrompt of an empty selection is empty", () => {
  assert.equal(promptSession().composePrompt(""), "");
});

// --- tilde-disabled chips ---
test("composePrompt omits tilde-wrapped (disabled) chips", () => {
  const session = promptSession();
  assert.equal(
    session.composePrompt("Faces/Portrait, ~Faces/Macro~"),
    "portrait, studio lighting",
  );
});

test("composePrompt handles mixed enabled and disabled chips in order", () => {
  const session = promptSession();
  assert.equal(
    session.composePrompt("~Faces/Variants~, Scenery/Hills"),
    "rolling hills",
  );
});

test("composePrompt ignores a lone tilde token", () => {
  const session = promptSession();
  assert.equal(session.composePrompt("~Faces/Empty~"), "");
});

// --- prunePins ---

test("prunePins: keeps a pin whose tokens are still contiguous", () => {
  const session = makeSession();
  session.pinnedChips = new Set(["Faces/Portrait, Scenery/Hills"]);
  const changed = session.prunePins([
    "Faces/Portrait",
    "Scenery/Hills",
    "Animals/Cat",
  ]);
  assert.equal(changed, false);
  assert.deepEqual([...session.pinnedChips], ["Faces/Portrait, Scenery/Hills"]);
});

test("prunePins: drops a multi-token pin when its tokens are interrupted", () => {
  const session = makeSession();
  session.pinnedChips = new Set(["Faces/Portrait, Scenery/Hills"]);
  const changed = session.prunePins([
    "Faces/Portrait",
    "Animals/Cat",
    "Scenery/Hills",
  ]);
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
  assert.equal(
    storage._map.get("j0n4t-pg-pins-3"),
    JSON.stringify(["Animals/Cat"]),
  );
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
  assert.equal(
    storage._map.get("j0n4t-pg-pins-5"),
    JSON.stringify(["Faces/Renamed"]),
  );

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
      cache: {
        RootPreset: { preset: "root" },
        "_/combo/_default": { preset: "c" },
      },
    }),
    null,
  );
});

test("buildRollSelection: honours min when min equals max", () => {
  const session = makeSession();
  const result = session.buildRollSelection({
    cache: PLAIN_CACHE,
    min: 3,
    max: 3,
  });
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
  const result = session.buildRollSelection({
    cache: PLAIN_CACHE,
    min: 4,
    max: 4,
  });
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
  session.pinnedChips = new Set([
    "Faces/Portrait",
    "Scenery/Sky",
    "Animals/Cat",
  ]);
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
  assert.deepEqual(
    rest,
    [...rest].sort((a, b) => a.localeCompare(b)),
  );
});

test("buildRollSelection: the combo default is added on top of the target count", () => {
  const session = makeSession();
  const withDefault = session.buildRollSelection({
    cache: CACHE,
    min: 3,
    max: 3,
  });
  const without = session.buildRollSelection({
    cache: PLAIN_CACHE,
    min: 3,
    max: 3,
  });
  assert.ok(withDefault && without);
  assert.equal(withDefault.length, without.length + 1);
  assert.equal(withDefault[0], "_/combo/_default");
});

test("buildRollSelection: does not prepend the combo default when it is absent", () => {
  const session = makeSession();
  const result = session.buildRollSelection({
    cache: PLAIN_CACHE,
    min: 3,
    max: 3,
  });
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
  const nodes = [
    {
      id: 1,
      widgets: [
        { name: "steps", value: 20 },
        { name: "noise_seed", value: 7 },
      ],
    },
  ];
  assert.equal(session.detectSeedChange(nodes), false);
  nodes[0].widgets[0].value = 30;
  assert.equal(
    session.detectSeedChange(nodes),
    false,
    "steps is not a seed widget",
  );
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
  assert.equal(
    session.detectSeedChange([
      { id: 1, widgets: [{ name: "seed", value: 1 }] },
    ]),
    false,
  );
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

  assert.deepEqual(Object.keys(session.cache), [
    "wear/sock/ankle",
    "wear/sock/knee",
    "Faces/Portrait",
  ]);
  assert.equal(session.cache["wear/sock/ankle"].preset, "main ankle socks");
  assert.deepEqual(session.duplicateKeys, new Set());
});

test("two libraries without a collision merge to the union", () => {
  const session = makeSession();
  session.setLibraries(
    [
      { id: "main", name: "Main" },
      { id: "hair", name: "Hair" },
    ],
    { main: MAIN, hair: HAIR },
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
    [
      { id: "main", name: "Main" },
      { id: "socks", name: "Socks" },
    ],
    { main: MAIN, socks: SOCKS },
  );

  assert.equal(
    session.cache["wear/sock/ankle"].preset,
    "main ankle socks",
    "main is first, so it wins",
  );
  assert.equal(
    session.cache["socks#wear/sock/ankle"].preset,
    "socks ankle socks",
  );
  // the key only socks has is untouched
  assert.equal(session.cache["wear/sock/crew"].preset, "socks crew socks");
  assert.equal(session.keyOwners.get("wear/sock/ankle"), "main");
  assert.deepEqual(session.duplicateKeys, new Set(["wear/sock/ankle"]));
});

test("three libraries claiming one key leave every entry reachable", () => {
  const session = makeSession();
  const third: PresetCache = {
    "wear/sock/ankle": { preset: "third ankle socks" },
  };
  session.setLibraries(
    [
      { id: "main", name: "Main" },
      { id: "socks", name: "Socks" },
      { id: "third", name: "Third" },
    ],
    { main: MAIN, socks: SOCKS, third },
  );

  assert.equal(session.cache["wear/sock/ankle"].preset, "main ankle socks");
  assert.equal(
    session.cache["socks#wear/sock/ankle"].preset,
    "socks ankle socks",
  );
  assert.equal(
    session.cache["third#wear/sock/ankle"].preset,
    "third ankle socks",
  );
});

test("reordering the list changes which library wins a shared key", () => {
  const session = makeSession();
  const caches = { main: MAIN, socks: SOCKS };

  session.setLibraries(
    [
      { id: "socks", name: "Socks" },
      { id: "main", name: "Main" },
    ],
    caches,
  );
  assert.equal(
    session.cache["wear/sock/ankle"].preset,
    "socks ankle socks",
    "socks is first now",
  );
  assert.equal(
    session.cache["main#wear/sock/ankle"].preset,
    "main ankle socks",
  );

  session.setLibraries(
    [
      { id: "main", name: "Main" },
      { id: "socks", name: "Socks" },
    ],
    caches,
  );
  assert.equal(
    session.cache["wear/sock/ankle"].preset,
    "main ankle socks",
    "main is first again",
  );
  assert.equal(
    session.cache["socks#wear/sock/ankle"].preset,
    "socks ankle socks",
  );
});

test("ownerOfKey reads the qualifier first, then the highest-priority winner", () => {
  const session = makeSession();
  session.setLibraries(
    [
      { id: "main", name: "Main" },
      { id: "socks", name: "Socks" },
    ],
    { main: MAIN, socks: SOCKS },
  );

  assert.equal(session.ownerOfKey("socks#wear/sock/ankle"), "socks");
  assert.equal(session.ownerOfKey("main#wear/sock/ankle"), "main");
  assert.equal(
    session.ownerOfKey("wear/sock/ankle"),
    "main",
    "the first library owns the plain key",
  );
  assert.equal(session.ownerOfKey("Faces/Portrait"), "main");
  assert.equal(session.ownerOfKey("hair/long"), null, "a key no library has");
  assert.equal(session.ownerOfKey(""), null);
});

test("isDuplicateKey reports the plain key however it is spelled", () => {
  const session = makeSession();
  session.setLibraries(
    [
      { id: "main", name: "Main" },
      { id: "socks", name: "Socks" },
    ],
    { main: MAIN, socks: SOCKS },
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
    [
      { id: "main", name: "Main" },
      { id: "socks", name: "Socks" },
      { id: "socks", name: "Socks" },
    ],
    { main: MAIN, socks: SOCKS },
  );

  assert.equal(
    session.cache["wear/sock/ankle"].preset,
    "main ankle socks",
    "main is first",
  );
  assert.equal(
    session.cache["socks#wear/sock/ankle"].preset,
    "socks ankle socks",
  );
  // the second `socks` pass must not file the entry twice under another name
  assert.equal(
    Object.keys(session.cache).filter((k) => k.endsWith("#wear/sock/ankle"))
      .length,
    1,
  );
});

test("setLibraries with nothing leaves an empty cache rather than throwing", () => {
  const session = makeSession();
  session.setLibraries([], {});
  assert.deepEqual(session.cache, {});
  assert.deepEqual(session.libraries, []);
  session.setLibraries(undefined, undefined);
  assert.deepEqual(session.cache, {});
});

test("rebuildCache registers non-enumerable library-qualified keys for winning entries", () => {
  const session = makeSession();
  session.setLibraries(
    [
      { id: "main", name: "Main" },
      { id: "socks", name: "Socks" },
    ],
    { main: MAIN, socks: SOCKS },
  );

  // 'Faces/Portrait' belongs to main and has no duplicates
  assert.equal(session.cache["main#Faces/Portrait"].preset, "portrait");
  // 'wear/sock/crew' belongs to socks and has no duplicates
  assert.equal(
    session.cache["socks#wear/sock/crew"].preset,
    "socks crew socks",
  );

  // Non-enumerable properties are not present in Object.keys()
  assert.equal(
    Object.keys(session.cache).includes("main#Faces/Portrait"),
    false,
  );
  assert.equal(
    Object.keys(session.cache).includes("socks#wear/sock/crew"),
    false,
  );

  // But they are present in Object.getOwnPropertyNames()
  assert.equal(
    Object.getOwnPropertyNames(session.cache).includes("main#Faces/Portrait"),
    true,
  );
  assert.equal(
    Object.getOwnPropertyNames(session.cache).includes("socks#wear/sock/crew"),
    true,
  );
});

// --- a bad value in storage must not take the gallery down -----------------
//
// Three of the values this session reads are written as JSON arrays. Each used
// to be parsed with no guard, so one corrupt or wrong-typed value threw: the
// pins read is in the constructor, so the gallery never mounted, and the two
// folder lists are read on every render. The settings panel and the tab list
// guarded theirs; these did not.

/** Every shape of bad value the boundary has to survive. */
const BAD_VALUES = ["{bad json", "[1,2", '"a string"', "42", "null", ""];

for (const bad of BAD_VALUES) {
  test(`a corrupt stored pin list (${JSON.stringify(bad)}) starts empty instead of throwing`, () => {
    // The constructor is the one that matters: a throw here means no gallery.
    let session;
    try {
      session = makeSession({
        storage: fakeStorage({ "j0n4t-pg-pins-global": bad }),
      });
    } catch (error) {
      assert.fail(
        `constructing a session over ${JSON.stringify(bad)} threw: ${error}`,
      );
    }
    assert.ok(session);
    assert.equal(
      session.pinnedChips.size,
      0,
      "a bad pin list must not pin anything",
    );
  });
}

for (const bad of BAD_VALUES) {
  test(`a corrupt stored collapsed-folder list (${JSON.stringify(bad)}) reads as empty`, () => {
    const session = makeSession({
      storage: fakeStorage({ pg_collapsed_folders_list: bad }),
    });
    assert.deepEqual(session.getCollapsedFolders(), []);
  });
}

for (const bad of BAD_VALUES) {
  test(`a corrupt stored excluded-roll list (${JSON.stringify(bad)}) reads as empty`, () => {
    const session = makeSession({
      storage: fakeStorage({ pg_excluded_roll_folders: bad }),
    });
    assert.deepEqual(session.getExcludedRollFolders(), []);
  });
}

test("a wrong-typed folder list does not leak a non-array to its callers", () => {
  // `"a string"` and 42 are valid JSON. Both used to come back as-is, and the
  // grid calls `.includes` on the result.
  const session = makeSession({
    storage: fakeStorage({ pg_collapsed_folders_list: '"a string"' }),
  });
  const folders = session.getCollapsedFolders();
  assert.ok(Array.isArray(folders), `expected an array, got ${typeof folders}`);
  assert.deepEqual(folders, []);
});

test("a good folder list round-trips through the session", () => {
  // The guard must not cost the working path anything.
  const storage = fakeStorage();
  const session = makeSession({ storage });
  session.setCollapsedFolders(["Faces", "Scenery"]);
  session.setExcludedRollFolders(["Faces"]);
  assert.deepEqual(session.getCollapsedFolders(), ["Faces", "Scenery"]);
  assert.deepEqual(session.getExcludedRollFolders(), ["Faces"]);
  assert.equal(
    storage.getItem("pg_collapsed_folders_list"),
    '["Faces","Scenery"]',
  );
  assert.equal(storage.getItem("pg_excluded_roll_folders"), '["Faces"]');
});

// --- the default storage is the ambient localStorage ------------------------
//
// PresetGalleryApp constructs the session with no `storage` at all
// (`new PresetSession({ nodeId })`), so the default is the whole persistence
// path. Every other test here injects a fake, which is why a regression that
// made `storage` default to undefined - silently stopping every write - passed
// the whole suite. This pins the default instead.

test("a session constructed with no storage uses the ambient localStorage", () => {
  const map = new Map<string, string>();
  globalThis.localStorage = {
    getItem: (k: string) => map.get(k) ?? null,
    setItem: (k: string, v: string) => {
      map.set(k, v);
    },
    removeItem: (k: string) => {
      map.delete(k);
    },
    clear: () => map.clear(),
  } as unknown as Storage;

  const session = new PresetSession({ nodeId: "defaulted" });
  assert.ok(
    session.storage,
    "the session must resolve a storage, not undefined",
  );

  session.savePins();
  session.setCollapsedFolders(["Faces"]);
  assert.equal(map.get("j0n4t-pg-pins-defaulted"), "[]");
  assert.equal(map.get("pg_collapsed_folders_list"), '["Faces"]');
});

test("a session with no storage and no localStorage still constructs", () => {
  // A browser that blocks storage must not stop the gallery mounting.
  const saved = globalThis.localStorage;
  // @ts-expect-error deliberately absent
  delete globalThis.localStorage;
  try {
    const session = new PresetSession({ nodeId: "nostorage" });
    assert.equal(session.storage, null);
    assert.doesNotThrow(() => session.savePins());
    assert.deepEqual(session.getCollapsedFolders(), []);
  } finally {
    globalThis.localStorage = saved;
  }
});

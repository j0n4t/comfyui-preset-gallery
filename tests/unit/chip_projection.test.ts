import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import ChipProjection from "../../web/ChipProjection.js";
import PresetLogic from "../../web/PresetLogic.js";
import { derivedFor } from "../../web/CacheDerived.js";

// ChipProjection owns the chip grouping: which consecutive runs of the ordered
// selection are one chip, and which cache entry each names. It is presentation
// - no token grammar, no expansion - so these tests assert the shape of the
// grouping and the key it resolves to, not the prompt text.
//
// It shares the cache-derived match lookup with PresetLogic through
// `derivedFor`. The lookup build is the expensive part (docs/chips-parsing-
// bottlenecks.md), so the last two tests pin that the two modules really do
// share one map rather than each building their own.

const MERGED: PresetCache = {
  "wear/sock/ankle": { preset: "socks ankle" },
  "socks#wear/sock/ankle": { preset: "main ankle" },
  "wear/sock/knee": { preset: "main knee" },
};

const CACHE: PresetCache = {
  "Faces/Portrait": { preset: "portrait, solo" },
  "Faces/Macro": { preset: "macro shot" },
  "Scenery/Hills": { preset: "rolling hills" },
  RootPreset: { preset: "root text" },
  "Faces/Child": { preset: "{Scenery}", filename: "child.png" },
  "A/Short": { preset: "red" },
  "A/Long": { preset: "red, blue" },
  "A/Longer": { preset: "red, blue, green" },
  "A/Weighted": { preset: "weighted preset" },
  "_/config/prepend/Faces": { preset: "cinematic" },
  "_/config/append/Faces": { preset: "8k" },
};

/** The fixture behind the perf budgets, so these run against a real shape. */
const FIXTURE = fileURLToPath(
  new URL("../fixtures/presets.synthetic.json", import.meta.url),
);
const BIG: PresetCache = JSON.parse(readFileSync(FIXTURE, "utf8"));

// --- the grouping itself ---------------------------------------------------

test("one token is one chip, keyed as it was given", () => {
  const chips = ChipProjection.getGroupedChips(["Faces/Portrait"], CACHE);

  assert.equal(chips.length, 1);
  assert.equal(chips[0].styleKey, "Faces/Portrait");
  assert.equal(chips[0].startIndex, 0);
  assert.equal(chips[0].endIndex, 1);
  assert.deepEqual(chips[0].subArray, ["Faces/Portrait"]);
});

test("a run of tokens never merges into one chip", () => {
  // The collapse to a preset is guarded to a single token, so consecutive
  // tokens that happen to spell a preset body stay separate chips. Without the
  // guard, dragging a spread preset onto the tab list and re-rendering would
  // re-join it into the original preset chip.
  const chips = ChipProjection.getGroupedChips(["red", "blue"], CACHE);

  assert.equal(chips.length, 2);
  assert.deepEqual(
    chips.map((c) => c.styleKey),
    ["A/Short", "blue"],
  );
  assert.deepEqual(
    chips.map((c) => c.startIndex),
    [0, 1],
  );
  assert.deepEqual(
    chips.map((c) => c.endIndex),
    [1, 2],
  );
});

test("a token matching nothing keeps its own text and has no cache item", () => {
  const chips = ChipProjection.getGroupedChips(
    ["unknown one", "unknown two"],
    CACHE,
  );

  assert.equal(chips.length, 2);
  assert.deepEqual(
    chips.map((c) => c.styleKey),
    ["unknown one", "unknown two"],
  );
  assert.equal(
    chips[0].item,
    undefined,
    "an unmatched token has no cache entry",
  );
});

test("a token matching a preset body resolves to that preset's key", () => {
  const chips = ChipProjection.getGroupedChips(["macro shot"], CACHE);

  assert.equal(chips.length, 1);
  assert.equal(chips[0].styleKey, "Faces/Macro");
  assert.equal(chips[0].item, CACHE["Faces/Macro"]);
});

test("a token matching a wrapped preset resolves through the wrapping", () => {
  // Faces has a prepend and an append, so the wrapped form is what the lookup
  // indexes; the raw preset text is a separate entry.
  const wrapped = PresetLogic.getWrappedPreset(
    "Faces/Portrait",
    "portrait, solo",
    CACHE,
  );
  assert.notEqual(wrapped, "portrait, solo");

  const chips = ChipProjection.getGroupedChips([wrapped], CACHE);

  assert.equal(chips.length, 1);
  assert.equal(chips[0].styleKey, "Faces/Portrait");
});

test("a weighted token resolves to the preset underneath the weight", () => {
  // The core of "(Faces/Portrait:1.5)" is the key, so the chip carries the
  // key - not the weighted text - and keeps the weight for the render.
  const chips = ChipProjection.getGroupedChips(["(Faces/Portrait:1.5)"], CACHE);

  assert.equal(chips.length, 1);
  assert.equal(chips[0].styleKey, "Faces/Portrait");
  assert.deepEqual(chips[0].subArray, ["(Faces/Portrait:1.5)"]);
});

test("a bare {group:value} token is keyed on its own text", () => {
  // Grouping does not resolve a variant: the chip carries the token as written
  // and `parseBasketChip` is what rolls it.
  const chips = ChipProjection.getGroupedChips(["{Faces:portrait}"], CACHE);

  assert.equal(chips.length, 1);
  assert.equal(chips[0].styleKey, "{Faces:portrait}");
  assert.deepEqual(chips[0].subArray, ["{Faces:portrait}"]);
});

test("a tag is one chip even when its text matches nothing", () => {
  const chips = ChipProjection.getGroupedChips(["<lora:abc:0.8>"], CACHE);

  assert.equal(chips.length, 1);
  assert.equal(chips[0].styleKey, "<lora:abc:0.8>");
  assert.equal(chips[0].item, undefined);
});

test("a preset reference inside a chip body is not re-grouped", () => {
  // "Faces/Child" expands to "{Scenery}", but grouping is lexical: the chip is
  // keyed on the key the user selected, not on what it expands to.
  const chips = ChipProjection.getGroupedChips(["Faces/Child"], CACHE);

  assert.equal(chips.length, 1);
  assert.equal(chips[0].styleKey, "Faces/Child");
  assert.equal(chips[0].item?.filename, "child.png");
});

test("an empty or missing selection groups to no chips", () => {
  assert.deepEqual(ChipProjection.getGroupedChips([], CACHE), []);
  assert.deepEqual(
    ChipProjection.getGroupedChips(null as unknown as string[], CACHE),
    [],
  );
});

// --- qualified keys: one entry per library ---------------------------------

test("a qualified token keeps its qualifier as the styleKey", () => {
  const chips = ChipProjection.getGroupedChips(
    ["socks#wear/sock/knee"],
    MERGED,
  );

  assert.equal(chips.length, 1);
  assert.equal(chips[0].styleKey, "socks#wear/sock/knee");
  assert.equal(chips[0].item?.preset, "main knee");
});

test("a qualified token resolves its own library's entry, not the main one", () => {
  // The plain key and the qualified one share a folder and a preset body; the
  // qualifier is what decides which entry the chip points at.
  const chips = ChipProjection.getGroupedChips(
    ["socks#wear/sock/ankle", "wear/sock/ankle"],
    MERGED,
  );

  assert.deepEqual(
    chips.map((c) => c.styleKey),
    ["socks#wear/sock/ankle", "wear/sock/ankle"],
  );
  assert.deepEqual(
    chips.map((c) => c.item?.preset),
    ["main ankle", "socks ankle"],
  );
});

test("a qualified token without a library keeps the plain key", () => {
  const chips = ChipProjection.getGroupedChips(["wear/sock/knee"], MERGED);

  assert.equal(chips[0].styleKey, "wear/sock/knee");
  assert.equal(chips[0].item?.preset, "main knee");
});

test("a weighted qualified token resolves to the qualified key", () => {
  const chips = ChipProjection.getGroupedChips(
    ["(socks#wear/sock/knee:1.2)"],
    MERGED,
  );

  assert.equal(chips.length, 1);
  assert.equal(chips[0].styleKey, "socks#wear/sock/knee");
});

// --- the shared lookup -----------------------------------------------------

test("the chip lookup is built once per cache and then reused", () => {
  // The build is the expensive part (docs/chips-parsing-bottlenecks.md): it
  // indexes every key, its preset text and its wrapped form. A second render
  // must find the map already in the shared record, not build it again.
  const cache: PresetCache = { "Faces/Portrait": { preset: "portrait, solo" } };
  assert.equal(
    derivedFor(cache).lookupMap,
    undefined,
    "a fresh cache starts unindexed",
  );

  ChipProjection.getGroupedChips(["Faces/Portrait"], cache);
  const built = derivedFor(cache).lookupMap;
  assert.ok(
    built,
    "grouping must record the lookup in the shared cache record",
  );

  ChipProjection.getGroupedChips(["portrait, solo"], cache);
  assert.equal(
    derivedFor(cache).lookupMap,
    built,
    "the second call must reuse the lookup",
  );
});

test("the shared record is keyed by the cache object, not by its contents", () => {
  // A library load replaces the cache object, which is what makes dropping the
  // record on load free. Two equal-looking caches are still two caches.
  const first: PresetCache = { "A/One": { preset: "one" } };
  const second: PresetCache = { "A/One": { preset: "one" } };

  ChipProjection.getGroupedChips(["A/One"], first);
  assert.ok(derivedFor(first).lookupMap);
  assert.equal(
    derivedFor(second).lookupMap,
    undefined,
    "an equal but distinct cache must start clean",
  );
});

test("the grouping is unchanged on the real library shape", () => {
  // The fixture the perf budgets measure: every key must resolve to its own
  // entry, in order, or the basket renders a different set of chips than the
  // selection holds.
  const keys = Object.keys(BIG)
    .filter((k) => BIG[k]?.preset?.trim())
    .slice(0, 30);
  const chips = ChipProjection.getGroupedChips(keys, BIG);

  assert.equal(chips.length, keys.length);
  chips.forEach((chip, index) => {
    assert.equal(chip.styleKey, keys[index]);
    assert.equal(chip.item, BIG[keys[index]]);
  });
});

import { test } from "node:test";
import assert from "node:assert/strict";
import PresetLogic from "../../web/PresetLogic.js";
import RollManager from "../../web/RollManager.js";

// PresetLogic is the prompt-expansion engine: comma splitting that respects
// nested syntax, weight parsing, variant resolution and group rolls. Everything
// here is pure string-in/string-out logic with an injected cache.

const CACHE: PresetCache = {
  "Faces/Portrait": { preset: "portrait, solo" },
  "Faces/Macro": { preset: "macro shot" },
  "Scenery/Hills": { preset: "rolling hills" },
  "Scenery/Sky": { preset: "blue sky" },
  RootPreset: { preset: "root text" },
  "_/config/prepend/Faces": { preset: "cinematic" },
  "_/config/append/Faces": { preset: "8k" },
};

// --- splitPresets: comma splitting that respects (), <> and {} ---

test("splitPresets returns an empty array for an empty string", () => {
  assert.deepEqual(PresetLogic.splitPresets(""), []);
  assert.deepEqual(PresetLogic.splitPresets(null as unknown as string), []);
});

test("splitPresets splits on plain commas and trims whitespace", () => {
  assert.deepEqual(PresetLogic.splitPresets("a, b ,c"), ["a", "b", "c"]);
});

test("splitPresets does not split on a comma inside parentheses", () => {
  assert.deepEqual(
    PresetLogic.splitPresets("a, (detail:1.2), b"),
    ["a", "(detail:1.2)", "b"]
  );
});

test("splitPresets does not split on a comma inside angle brackets", () => {
  assert.deepEqual(
    PresetLogic.splitPresets("<lora:abc:0.8>, text"),
    ["<lora:abc:0.8>", "text"]
  );
});

test("splitPresets does not split on a comma inside braces", () => {
  assert.deepEqual(
    PresetLogic.splitPresets("{group:alpha, beta}, c"),
    ["{group:alpha, beta}", "c"]
  );
});

test("splitPresets handles nested brackets at any depth", () => {
  assert.deepEqual(
    PresetLogic.splitPresets("((a, b), c), {d: (e, f)}"),
    ["((a, b), c)", "{d: (e, f)}"]
  );
});

test("splitPresets clamps unbalanced closers without throwing", () => {
  assert.deepEqual(PresetLogic.splitPresets("a, b)"), ["a", "b)"]);
});

// --- parseWeight ---

test("parseWeight extracts the core and weight from a (core:w) string", () => {
  assert.deepEqual(PresetLogic.parseWeight("(text:1.2)"), {
    isWeighted: true,
    core: "text",
    weight: 1.2,
    weightStr: "1.2",
  });
});

test("parseWeight accepts negative, zero and integer weights", () => {
  assert.equal(PresetLogic.parseWeight("(text:-0.5)").weight, -0.5);
  assert.equal(PresetLogic.parseWeight("(text:0)").weight, 0);
  assert.equal(PresetLogic.parseWeight("(text:2)").weight, 2);
});

test("parseWeight keeps colons inside the core", () => {
  const parsed = PresetLogic.parseWeight("(a:b:1.5)");
  assert.equal(parsed.isWeighted, true);
  assert.equal(parsed.core, "a:b");
  assert.equal(parsed.weight, 1.5);
});

test("parseWeight treats an unweighted string as weight 1", () => {
  assert.deepEqual(PresetLogic.parseWeight("plain"), {
    isWeighted: false,
    core: "plain",
    weight: 1.0,
    weightStr: null,
  });
});

test("parseWeight handles an empty string", () => {
  assert.deepEqual(PresetLogic.parseWeight(""), {
    isWeighted: false,
    core: "",
    weight: 1.0,
    weightStr: null,
  });
});

// --- splitVariantValue: base value vs {child overrides} ---

test("splitVariantValue separates the base value from the child override block", () => {
  assert.deepEqual(PresetLogic.splitVariantValue("portrait {Scenery:hills}"), {
    baseVal: "portrait",
    childVarsStr: "{Scenery:hills}",
  });
});

test("splitVariantValue treats a leading brace as an empty base value", () => {
  assert.deepEqual(PresetLogic.splitVariantValue("{Scenery:hills}"), {
    baseVal: "",
    childVarsStr: "{Scenery:hills}",
  });
});

test("splitVariantValue leaves childVarsStr empty for plain text", () => {
  assert.deepEqual(PresetLogic.splitVariantValue("portrait"), {
    baseVal: "portrait",
    childVarsStr: "",
  });
});

test("splitVariantValue handles an empty string", () => {
  assert.deepEqual(PresetLogic.splitVariantValue(""), { baseVal: "", childVarsStr: "" });
});

// --- isVirtualNull ---

test("isVirtualNull matches none and null case-insensitively", () => {
  assert.equal(PresetLogic.isVirtualNull("none"), true);
  assert.equal(PresetLogic.isVirtualNull("NULL"), true);
  assert.equal(PresetLogic.isVirtualNull(" None "), true);
});

test("isVirtualNull rejects real values and empty strings", () => {
  assert.equal(PresetLogic.isVirtualNull("portrait"), false);
  assert.equal(PresetLogic.isVirtualNull(""), false);
  assert.equal(PresetLogic.isVirtualNull(null as unknown as string), false);
});

// --- resolveVariantKey ---

test("resolveVariantKey matches the exact cache key", () => {
  assert.equal(PresetLogic.resolveVariantKey("Faces", "Faces/Portrait", CACHE), "Faces/Portrait");
});

test("resolveVariantKey matches keys case-insensitively", () => {
  assert.equal(PresetLogic.resolveVariantKey("Faces", "faces/portrait", CACHE), "Faces/Portrait");
});

test("resolveVariantKey matches a preset name alone", () => {
  assert.equal(PresetLogic.resolveVariantKey("Faces", "portrait", CACHE), "Faces/Portrait");
});

test("resolveVariantKey matches a name when the key carries the group prefix", () => {
  assert.equal(PresetLogic.resolveVariantKey("", "portrait", CACHE), "Faces/Portrait");
});

test("resolveVariantKey returns null for an unknown value or empty input", () => {
  assert.equal(PresetLogic.resolveVariantKey("Faces", "nope", CACHE), null);
  assert.equal(PresetLogic.resolveVariantKey("Faces", "", CACHE), null);
});

// --- escapeRegExp ---

test("escapeRegExp produces a pattern that matches the literal string", () => {
  const pattern = new RegExp(PresetLogic.escapeRegExp("a.b*c+d(x)"));
  assert.equal(pattern.test("a.b*c+d(x)"), true);
  assert.equal(pattern.test("axbc+dx"), false);
});

// --- getWrappedPreset: prepend/append config per folder ---

test("getWrappedPreset applies the folder prepend and append", () => {
  assert.equal(
    PresetLogic.getWrappedPreset("Faces/Portrait", "portrait, solo", CACHE),
    "cinematic portrait, solo 8k"
  );
});

test("getWrappedPreset trims and returns the base when no config exists", () => {
  assert.equal(PresetLogic.getWrappedPreset("RootPreset", "  root text  ", CACHE), "root text");
  assert.equal(PresetLogic.getWrappedPreset("RootPreset", "", CACHE), "");
});

// --- getUnrolledTemplate: expand preset refs, keep group tokens ---

test("getUnrolledTemplate expands preset references", () => {
  assert.equal(
    PresetLogic.getUnrolledTemplate("RootPreset, extra", CACHE),
    "root text, extra"
  );
});

test("getUnrolledTemplate keeps {group} tokens intact", () => {
  assert.equal(
    PresetLogic.getUnrolledTemplate("{Scenery:hills}, plain", CACHE),
    "{Scenery:hills}, plain"
  );
});

test("getUnrolledTemplate expands presets and keeps group tokens in one pass", () => {
  assert.equal(
    PresetLogic.getUnrolledTemplate("Faces/Portrait, {Scenery}", CACHE),
    "cinematic portrait, solo 8k, {Scenery}"
  );
});

test("getUnrolledTemplate terminates on circular preset references", () => {
  const circular: PresetCache = {
    "A/One": { preset: "B/Two" },
    "B/Two": { preset: "A/One" },
  };
  assert.equal(PresetLogic.getUnrolledTemplate("A/One", circular), "A/One");
});

test("getUnrolledTemplate returns an empty string for empty input", () => {
  assert.equal(PresetLogic.getUnrolledTemplate("", CACHE), "");
});

// --- expandRecursively: variant resolution, virtual nulls and rolls ---

test("expandRecursively resolves a variant to its preset text", () => {
  assert.equal(
    PresetLogic.expandRecursively("{Faces:portrait}", CACHE),
    "cinematic portrait, solo 8k"
  );
});

test("expandRecursively omits virtual null selections", () => {
  assert.equal(PresetLogic.expandRecursively("{Faces:none}", CACHE), "");
});

test("expandRecursively expands variants nested inside a preset", () => {
  const cache: PresetCache = {
    "Faces/Portrait": { preset: "{Scenery:hills} look" },
    "Scenery/Hills": { preset: "rolling hills" },
  };
  assert.equal(PresetLogic.expandRecursively("{Faces:portrait}", cache), "rolling hills look");
});

test("expandRecursively expands plain preset references", () => {
  assert.equal(
    PresetLogic.expandRecursively("RootPreset, done", CACHE),
    "root text, done"
  );
});

test("expandRecursively rolls a group using the injected RollManager", () => {
  const rollManager = new RollManager({ faces_0: "Faces/Portrait" });
  assert.equal(PresetLogic.expandRecursively("{Faces}", CACHE, new Set(), rollManager), "cinematic portrait, solo 8k");
  assert.equal(rollManager.getCount("faces"), 1);
});

test("expandRecursively resolves a roll when the stored slot is empty", () => {
  const cache: PresetCache = { "Faces/Portrait": { preset: "portrait" } };
  const rollManager = new RollManager();
  // single match: the roll is deterministic regardless of Math.random
  assert.equal(PresetLogic.expandRecursively("{Faces}", cache, new Set(), rollManager), "portrait");
  assert.equal(rollManager.getCount("faces"), 1);
});

test("expandRecursively terminates on circular preset references", () => {
  const circular: PresetCache = {
    "A/One": { preset: "{B}" },
    "B": { preset: "{A/One}" },
  };
  const result = PresetLogic.expandRecursively("A/One", circular);
  assert.ok(typeof result === "string");
  assert.ok(result.length < 200, "expansion should terminate quickly, not grow unboundedly");
});

// --- getGroupMatches ---

test("getGroupMatches matches the folder exactly, as a subfolder and as a suffix", () => {
  const cache: PresetCache = {
    "Faces/Portrait": { preset: "p" },
    "FacesX/Y": { preset: "p" },
    "Other/Faces/Z": { preset: "p" },
  };
  assert.deepEqual(PresetLogic.getGroupMatches("faces", cache).sort(), [
    "Faces/Portrait",
    "Other/Faces/Z",
  ]);
});

test("getGroupMatches ignores config keys, keys without presets and folderless keys", () => {
  const cache: PresetCache = {
    "_/config/prepend/Faces": { preset: "x" },
    "Empty/Blank": { preset: "" },
    Faces: { preset: "p" },
    "FacesX/Y": { preset: "p" },
    "Faces/Portrait": { preset: "p" },
  };
  assert.deepEqual(PresetLogic.getGroupMatches("faces", cache), ["Faces/Portrait"]);
});

test("getGroupMatches is case-insensitive on the group name", () => {
  assert.deepEqual(PresetLogic.getGroupMatches("FACES", CACHE), ["Faces/Portrait", "Faces/Macro"]);
});

test("getGroupMatches returns an empty list for an unknown group", () => {
  assert.deepEqual(PresetLogic.getGroupMatches("Nobody", CACHE), []);
});

// The group index is precomputed, so these pin the properties the enumeration
// relies on: which names a folder answers to, that a key appears once, and that
// the cached array survives a caller mutating what it was handed.

test("getGroupMatches matches a middle segment of a deeper folder", () => {
  const cache: PresetCache = {
    "A/B/C/One": { preset: "p" },
    "A/B/C/Two": { preset: "p" },
  };
  // The folder is "a/b/c", so "b" is a middle segment: neither a prefix nor a
  // suffix, and the predicate does not match it.
  assert.deepEqual(PresetLogic.getGroupMatches("b", cache), []);
  assert.deepEqual(PresetLogic.getGroupMatches("a/b", cache), ["A/B/C/One", "A/B/C/Two"]);
  assert.deepEqual(PresetLogic.getGroupMatches("b/c", cache), ["A/B/C/One", "A/B/C/Two"]);
  assert.deepEqual(PresetLogic.getGroupMatches("c", cache), ["A/B/C/One", "A/B/C/Two"]);
});

test("getGroupMatches lists each key once when a folder repeats a segment", () => {
  // "a/a" answers to the group "a" as both a prefix and a suffix.
  const cache: PresetCache = {
    "A/A/One": { preset: "p" },
    "A/Two": { preset: "p" },
  };
  assert.deepEqual(PresetLogic.getGroupMatches("a", cache), ["A/A/One", "A/Two"]);
});

test("getGroupMatches keeps cache order", () => {
  const cache: PresetCache = {
    "Z/Faces/One": { preset: "p" },
    "A/Faces/One": { preset: "p" },
    "M/Faces/One": { preset: "p" },
  };
  assert.deepEqual(
    PresetLogic.getGroupMatches("faces", cache),
    ["Z/Faces/One", "A/Faces/One", "M/Faces/One"],
    "rolls pick by index, so the order must not be sorted"
  );
});

test("mutating a getGroupMatches result does not corrupt later calls", () => {
  const cache: PresetCache = {
    "Faces/Portrait": { preset: "p" },
    "Faces/Macro": { preset: "p" },
  };
  const first = PresetLogic.getGroupMatches("faces", cache);
  first.sort();
  first.length = 0;

  assert.deepEqual(
    PresetLogic.getGroupMatches("faces", cache),
    ["Faces/Portrait", "Faces/Macro"],
    "the result must be a copy; the index is shared between calls"
  );
});

// --- getAllVariants ---

test("getAllVariants extracts group, name and value from a variant token", () => {
  const results = PresetLogic.getAllVariants("{Faces:portrait}", CACHE);
  assert.deepEqual(results, [
    {
      groupRaw: "Faces",
      groupName: "faces",
      val: "portrait",
      childVarsStr: "",
      rootGroup: "faces",
      isSub: false,
    },
  ]);
});

test("getAllVariants splits the base value from the child override block", () => {
  const results = PresetLogic.getAllVariants("{Faces:{Scenery:hills}}", CACHE);
  assert.deepEqual(results, [
    {
      groupRaw: "Faces",
      groupName: "faces",
      val: "",
      childVarsStr: "{Scenery:hills}",
      rootGroup: "faces",
      isSub: false,
    },
  ]);
});

test("getAllVariants recurses into the resolved preset's own variants", () => {
  const cache: PresetCache = {
    "Faces/Portrait": { preset: "portrait {Scenery:hills}" },
    "Scenery/Hills": { preset: "hills" },
  };
  const results = PresetLogic.getAllVariants("{Faces:portrait}", cache);
  assert.equal(results.length, 2);
  assert.equal(results[0].groupName, "faces");
  assert.equal(results[1].groupName, "scenery");
  assert.equal(results[1].isSub, true);
  assert.equal(results[1].rootGroup, "faces");
});

test("getAllVariants does not recurse into a virtual null value", () => {
  const results = PresetLogic.getAllVariants("{Faces:none}", CACHE);
  assert.deepEqual(results, [
    {
      groupRaw: "Faces",
      groupName: "faces",
      val: "none",
      childVarsStr: "",
      rootGroup: "faces",
      isSub: false,
    },
  ]);
});

// --- parseChipDetails ---

test("parseChipDetails extracts variants from a token", () => {
  const parsed = PresetLogic.parseChipDetails("{Faces:portrait}", CACHE);
  assert.equal(parsed.tag, null);
  assert.equal(parsed.variants.length, 1);
  assert.equal(parsed.variants[0].groupName, "faces");
  assert.equal(parsed.variants[0].val, "portrait");
});

test("parseChipDetails parses a boolean tag", () => {
  const parsed = PresetLogic.parseChipDetails("<skip:true>", CACHE);
  assert.ok(parsed.tag);
  assert.deepEqual(parsed.tag, {
    label: "skip",
    val: "true",
    isBoolean: true,
    isNumeric: false,
  });
});

test("parseChipDetails parses a numeric tag", () => {
  const parsed = PresetLogic.parseChipDetails("<width:1024>", CACHE);
  assert.ok(parsed.tag);
  assert.equal(parsed.tag.isNumeric, true);
  assert.equal(parsed.tag.val, "1024");
});

test("parseChipDetails splits lora-style tags into label and weight", () => {
  const parsed = PresetLogic.parseChipDetails("<lora:test:0.5>", CACHE);
  assert.ok(parsed.tag);
  assert.deepEqual(parsed.tag, {
    label: "test",
    val: "0.5",
    isBoolean: false,
    isNumeric: true,
  });
});

test("parseChipDetails matches a preset key", () => {
  const parsed = PresetLogic.parseChipDetails("Faces/Portrait", CACHE);
  assert.ok(parsed.presetMatch);
  assert.equal(parsed.presetMatch.key, "Faces/Portrait");
  assert.equal(parsed.presetMatch.item.preset, "portrait, solo");
});

test("parseChipDetails returns empty metadata for empty input", () => {
  assert.deepEqual(PresetLogic.parseChipDetails("", CACHE), {
    variants: [],
    tag: null,
    presetMatch: null,
    trimmed: "",
  });
});

// --- findPresetMatch ---

test("findPresetMatch matches an exact key, the preset text and the wrapped text", () => {
  assert.equal(PresetLogic.findPresetMatch("Faces/Portrait", CACHE)?.key, "Faces/Portrait");
  assert.equal(PresetLogic.findPresetMatch("portrait, solo", CACHE)?.key, "Faces/Portrait");
  assert.equal(
    PresetLogic.findPresetMatch("cinematic portrait, solo 8k", CACHE)?.key,
    "Faces/Portrait"
  );
});

test("findPresetMatch returns null for an unknown or empty string", () => {
  assert.equal(PresetLogic.findPresetMatch("missing", CACHE), null);
  assert.equal(PresetLogic.findPresetMatch("", CACHE), null);
});

// --- path helpers and title casing ---

test("getPresetName returns the last path segment", () => {
  assert.equal(PresetLogic.getPresetName("Faces/Portrait"), "Portrait");
  assert.equal(PresetLogic.getPresetName("RootPreset"), "RootPreset");
});

test("getPresetFolder returns the parent path", () => {
  assert.equal(PresetLogic.getPresetFolder("Faces/Portrait"), "Faces");
  assert.equal(PresetLogic.getPresetFolder("RootPreset"), "");
});

test("toTitleCase converts underscores and hyphens to capitalised words", () => {
  assert.equal(PresetLogic.toTitleCase("portrait_solo-shot"), "Portrait Solo Shot");
});

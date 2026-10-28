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
  assert.deepEqual(PresetLogic.splitPresets("a, (detail:1.2), b"), [
    "a",
    "(detail:1.2)",
    "b",
  ]);
});

test("splitPresets does not split on a comma inside angle brackets", () => {
  assert.deepEqual(PresetLogic.splitPresets("<lora:abc:0.8>, text"), [
    "<lora:abc:0.8>",
    "text",
  ]);
});

test("splitPresets does not split on a comma inside braces", () => {
  assert.deepEqual(PresetLogic.splitPresets("{group:alpha, beta}, c"), [
    "{group:alpha, beta}",
    "c",
  ]);
});

test("splitPresets handles nested brackets at any depth", () => {
  assert.deepEqual(PresetLogic.splitPresets("((a, b), c), {d: (e, f)}"), [
    "((a, b), c)",
    "{d: (e, f)}",
  ]);
});

test("splitPresets clamps unbalanced closers without throwing", () => {
  assert.deepEqual(PresetLogic.splitPresets("a, b)"), ["a", "b)"]);
});

// --- tilde-disabled: chips wrapped in tildes stay in the selection but are
// ignored on final output ---
test("isTildeDisabled detects a tilde-wrapped token", () => {
  assert.equal(PresetLogic.isTildeDisabled("~Faces/Portrait~"), true);
  assert.equal(PresetLogic.isTildeDisabled("Faces/Portrait"), false);
  assert.equal(PresetLogic.isTildeDisabled("~Faces/Portrait"), false);
  assert.equal(PresetLogic.isTildeDisabled("Faces/Portrait~"), false);
  assert.equal(PresetLogic.isTildeDisabled(""), false);
});

test("unwrapTilde strips surrounding tildes", () => {
  assert.equal(PresetLogic.unwrapTilde("~Faces/Portrait~"), "Faces/Portrait");
  assert.equal(PresetLogic.unwrapTilde("Faces/Portrait"), "Faces/Portrait");
});

// --- chip display text: tilde-disabled chips must show the same text as
// enabled chips (never the raw tilde-wrapped selection value) ---
test("parseBasketChip: tilde-disabled chip shows the preset's display name", () => {
  const result = PresetLogic.parseBasketChip(
    {
      styleKey: "~Scenery/Hills~",
      item: null,
      subArray: ["~Scenery/Hills~"],
      startIndex: 0,
      endIndex: 1,
    },
    CACHE,
    new RollManager(),
  );
  // The disabled chip must display the preset's display text, not the raw
  // tilde-wrapped selection token.
  assert.equal(result.cleanLabel, "Hills");
  assert.equal(result.tooltipTitle, "Hills [Scenery/Hills]\nrolling hills");
});

test("parseBasketChip: enabled and tilde-disabled chips share the same display text", () => {
  const enabled = PresetLogic.parseBasketChip(
    {
      styleKey: "Scenery/Hills",
      item: CACHE["Scenery/Hills"],
      subArray: ["Scenery/Hills"],
      startIndex: 0,
      endIndex: 1,
    },
    CACHE,
    new RollManager(),
  );
  const disabled = PresetLogic.parseBasketChip(
    {
      styleKey: "~Scenery/Hills~",
      item: null,
      subArray: ["~Scenery/Hills~"],
      startIndex: 0,
      endIndex: 1,
    },
    CACHE,
    new RollManager(),
  );
  // Both classes of chip render the same display text.
  assert.equal(enabled.cleanLabel, disabled.cleanLabel);
});

test("parseBasketChip: tilde-disabled chips with variants, tags and weights render the same text as enabled", () => {
  const cases = [
    {
      label: "plain",
      disabled: "~Scenery/Hills~",
      enabled: "Scenery/Hills",
      item: CACHE["Scenery/Hills"],
    },
    {
      label: "variant",
      disabled: "~{Scenery:Scenery/Sky}~",
      enabled: "{Scenery:Scenery/Sky}",
      item: null,
    },
    {
      label: "tag",
      disabled: "~<lora:test:0.5>~",
      enabled: "<lora:test:0.5>",
      item: null,
    },
    {
      label: "weighted",
      disabled: "~(Faces/Portrait:1.2)~",
      enabled: "(Faces/Portrait:1.2)",
      item: CACHE["Faces/Portrait"],
    },
  ];

  for (const { label, disabled, enabled, item } of cases) {
    const disabledChip = PresetLogic.parseBasketChip(
      {
        styleKey: disabled,
        item: null,
        subArray: [disabled],
        startIndex: 0,
        endIndex: 1,
      },
      CACHE,
      new RollManager(),
    );
    const enabledChip = PresetLogic.parseBasketChip(
      {
        styleKey: enabled,
        item,
        subArray: [enabled],
        startIndex: 0,
        endIndex: 1,
      },
      CACHE,
      new RollManager(),
    );

    // The bare chip text must match the preset's display name, never the tilde-wrapped token.
    assert.equal(
      disabledChip.cleanLabel,
      enabledChip.cleanLabel,
      `${label} display name`,
    );
    assert.equal(
      disabledChip.tooltipTitle,
      enabledChip.tooltipTitle,
      `${label} tooltip body`,
    );
  }
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
  assert.deepEqual(PresetLogic.splitVariantValue(""), {
    baseVal: "",
    childVarsStr: "",
  });
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
  assert.equal(
    PresetLogic.resolveVariantKey("Faces", "Faces/Portrait", CACHE),
    "Faces/Portrait",
  );
});

test("resolveVariantKey matches keys case-insensitively", () => {
  assert.equal(
    PresetLogic.resolveVariantKey("Faces", "faces/portrait", CACHE),
    "Faces/Portrait",
  );
});

test("resolveVariantKey matches a preset name alone", () => {
  assert.equal(
    PresetLogic.resolveVariantKey("Faces", "portrait", CACHE),
    "Faces/Portrait",
  );
});

test("resolveVariantKey matches a name when the key carries the group prefix", () => {
  assert.equal(
    PresetLogic.resolveVariantKey("", "portrait", CACHE),
    "Faces/Portrait",
  );
});

test("resolveVariantKey returns null for an unknown value or empty input", () => {
  assert.equal(PresetLogic.resolveVariantKey("Faces", "nope", CACHE), null);
  assert.equal(PresetLogic.resolveVariantKey("Faces", "", CACHE), null);
});

// The variant index is precomputed, so these pin the two rules the linear scan
// it replaced had and a plain map does not: the FIRST key claiming a name wins,
// and the group argument never decided anything.

test("resolveVariantKey returns the first key claiming a name, not the last", () => {
  const cache: PresetCache = {
    "Action/Smile": { preset: "smile" },
    "Pose/Smile": { preset: "smile" },
  };
  // Both entries claim "smile"; the scan returned whichever came first, and in a
  // real library 32 lowercased names are claimed by more than one key.
  assert.equal(
    PresetLogic.resolveVariantKey("pose", "smile", cache),
    "Action/Smile",
  );
});

test("resolveVariantKey returns the first key claiming a full key, not the last", () => {
  // The same rule, reached through the whole-key form rather than the preset
  // name. Two keys can differ only in case, and the lookup is case-insensitive.
  const cache: PresetCache = {
    "Pose/Smile": { preset: "a" },
    "pose/smile": { preset: "b" },
  };
  assert.equal(
    PresetLogic.resolveVariantKey("pose", "POSE/SMILE", cache),
    "Pose/Smile",
  );
});

test("resolveVariantKey's group argument does not change the result", () => {
  const cache: PresetCache = {
    "Action/Smile": { preset: "smile" },
    "Pose/Smile": { preset: "smile" },
  };
  // The scan's group clause also required `presetName === val`, which the clause
  // before it already covered - so it could never decide anything, and a group
  // match must not be preferred over cache order.
  for (const group of ["", "action", "pose", "zzz"]) {
    assert.equal(
      PresetLogic.resolveVariantKey(group, "smile", cache),
      "Action/Smile",
    );
  }
});

test("resolveVariantKey still resolves a key that carries no preset", () => {
  // The scan never checked for a preset, so the index must not either.
  const cache: PresetCache = { "Color/Red": { __color__: "#ff0000" } };
  assert.equal(
    PresetLogic.resolveVariantKey("color", "red", cache),
    "Color/Red",
  );
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
    "cinematic portrait, solo 8k",
  );
});

test("getWrappedPreset trims and returns the base when no config exists", () => {
  assert.equal(
    PresetLogic.getWrappedPreset("RootPreset", "  root text  ", CACHE),
    "root text",
  );
  assert.equal(PresetLogic.getWrappedPreset("RootPreset", "", CACHE), "");
});

// --- getUnrolledTemplate: expand preset refs, keep group tokens ---

test("getUnrolledTemplate expands preset references", () => {
  assert.equal(
    PresetLogic.getUnrolledTemplate("RootPreset, extra", CACHE),
    "root text, extra",
  );
});

test("getUnrolledTemplate keeps {group} tokens intact", () => {
  assert.equal(
    PresetLogic.getUnrolledTemplate("{Scenery:hills}, plain", CACHE),
    "{Scenery:hills}, plain",
  );
});

test("getUnrolledTemplate expands presets and keeps group tokens in one pass", () => {
  assert.equal(
    PresetLogic.getUnrolledTemplate("Faces/Portrait, {Scenery}", CACHE),
    "cinematic portrait, solo 8k, {Scenery}",
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
    "cinematic portrait, solo 8k",
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
  assert.equal(
    PresetLogic.expandRecursively("{Faces:portrait}", cache),
    "rolling hills look",
  );
});

test("expandRecursively expands plain preset references", () => {
  assert.equal(
    PresetLogic.expandRecursively("RootPreset, done", CACHE),
    "root text, done",
  );
});

test("expandRecursively rolls a group using the injected RollManager", () => {
  const rollManager = new RollManager({ faces_0: "Faces/Portrait" });
  assert.equal(
    PresetLogic.expandRecursively("{Faces}", CACHE, new Set(), rollManager),
    "cinematic portrait, solo 8k",
  );
  assert.equal(rollManager.getCount("faces"), 1);
});

test("expandRecursively resolves a roll when the stored slot is empty", () => {
  const cache: PresetCache = { "Faces/Portrait": { preset: "portrait" } };
  const rollManager = new RollManager();
  // single match: the roll is deterministic regardless of Math.random
  assert.equal(
    PresetLogic.expandRecursively("{Faces}", cache, new Set(), rollManager),
    "portrait",
  );
  assert.equal(rollManager.getCount("faces"), 1);
});

test("expandRecursively terminates on circular preset references", () => {
  const circular: PresetCache = {
    "A/One": { preset: "{B}" },
    B: { preset: "{A/One}" },
  };
  const result = PresetLogic.expandRecursively("A/One", circular);
  assert.ok(typeof result === "string");
  assert.ok(
    result.length < 200,
    "expansion should terminate quickly, not grow unboundedly",
  );
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
  assert.deepEqual(PresetLogic.getGroupMatches("faces", cache), [
    "Faces/Portrait",
  ]);
});

test("getGroupMatches is case-insensitive on the group name", () => {
  assert.deepEqual(PresetLogic.getGroupMatches("FACES", CACHE), [
    "Faces/Portrait",
    "Faces/Macro",
  ]);
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
  assert.deepEqual(PresetLogic.getGroupMatches("a/b", cache), [
    "A/B/C/One",
    "A/B/C/Two",
  ]);
  assert.deepEqual(PresetLogic.getGroupMatches("b/c", cache), [
    "A/B/C/One",
    "A/B/C/Two",
  ]);
  assert.deepEqual(PresetLogic.getGroupMatches("c", cache), [
    "A/B/C/One",
    "A/B/C/Two",
  ]);
});

test("getGroupMatches lists each key once when a folder repeats a segment", () => {
  // "a/a" answers to the group "a" as both a prefix and a suffix.
  const cache: PresetCache = {
    "A/A/One": { preset: "p" },
    "A/Two": { preset: "p" },
  };
  assert.deepEqual(PresetLogic.getGroupMatches("a", cache), [
    "A/A/One",
    "A/Two",
  ]);
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
    "rolls pick by index, so the order must not be sorted",
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
    "the result must be a copy; the index is shared between calls",
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
  assert.equal(
    PresetLogic.findPresetMatch("Faces/Portrait", CACHE)?.key,
    "Faces/Portrait",
  );
  assert.equal(
    PresetLogic.findPresetMatch("portrait, solo", CACHE)?.key,
    "Faces/Portrait",
  );
  assert.equal(
    PresetLogic.findPresetMatch("cinematic portrait, solo 8k", CACHE)?.key,
    "Faces/Portrait",
  );
});

test("findPresetMatch returns null for an unknown or empty string", () => {
  assert.equal(PresetLogic.findPresetMatch("missing", CACHE), null);
  assert.equal(PresetLogic.findPresetMatch("", CACHE), null);
});

// The match index is precomputed, so these pin the two rules the linear scan it
// replaced had and a naive map does not: the FIRST claimant wins, and entries
// without a preset are not candidates.

test("findPresetMatch returns the first entry claiming a string, not the last", () => {
  const cache: PresetCache = {
    "Action/Smile": { preset: "smile" },
    "Pose/Smile": { preset: "smile" },
  };
  // Both entries claim "smile"; the scan returned whichever came first.
  assert.equal(
    PresetLogic.findPresetMatch("smile", cache)?.key,
    "Action/Smile",
  );
});

test("findPresetMatch ignores entries without a preset", () => {
  const cache: PresetCache = {
    Smile: { __color__: "#972140" },
    "Pose/Smile": { preset: "smile" },
  };
  // "Smile" is a colour-only entry and is not a candidate by text...
  assert.equal(PresetLogic.findPresetMatch("smile", cache)?.key, "Pose/Smile");
  // ...but an exact key still resolves through the fast path, as it always did.
  assert.equal(PresetLogic.findPresetMatch("Smile", cache)?.key, "Smile");
});

test("findPresetMatch prefers an exact key over a later entry's text", () => {
  const cache: PresetCache = {
    "Pose/Smile": { preset: "smile" },
    Smile: { preset: "something else" },
  };
  assert.equal(PresetLogic.findPresetMatch("Smile", cache)?.key, "Smile");
});

// --- library qualifiers on cache keys ---
//
// A merged cache files every entry a library displaced under `libraryId#key`.
// The qualifier is part of the key namespace, but every helper that reads a
// folder, a name or a group must look at the plain path: `socks#wear/sock` is
// `wear/sock` from the socks library, and `{wear}` has to roll over both.

/** A merged cache: socks won `wear/sock/ankle`, main's copy is filed aside. */
const MERGED: PresetCache = {
  "wear/sock/ankle": { preset: "socks ankle" },
  "socks#wear/sock/ankle": { preset: "main ankle" },
  "wear/sock/knee": { preset: "main knee" },
};

test("splitQualifiedKey separates the library from the path", () => {
  assert.deepEqual(PresetLogic.splitQualifiedKey("socks#wear/sock"), {
    libraryId: "socks",
    key: "wear/sock",
  });
  assert.deepEqual(PresetLogic.splitQualifiedKey("wear/sock"), {
    libraryId: null,
    key: "wear/sock",
  });
  // a leading `#` names no library, so the whole string is the path
  assert.deepEqual(PresetLogic.splitQualifiedKey("#wear/sock"), {
    libraryId: null,
    key: "#wear/sock",
  });
  assert.deepEqual(PresetLogic.splitQualifiedKey(""), {
    libraryId: null,
    key: "",
  });
});

test("a qualified chip expands to its own library's text, a plain one to the winner's", () => {
  assert.equal(
    PresetLogic.expandRecursively("socks#wear/sock/ankle", MERGED),
    "main ankle",
  );
  assert.equal(
    PresetLogic.expandRecursively("wear/sock/ankle", MERGED),
    "socks ankle",
  );
  // the qualifier never reaches the expanded prompt
  assert.ok(
    !PresetLogic.expandRecursively("socks#wear/sock/ankle", MERGED).includes(
      "#",
    ),
  );
});

test("a group roll sees both libraries' entries under the plain folder", () => {
  assert.deepEqual(PresetLogic.getGroupMatches("wear", MERGED).sort(), [
    "socks#wear/sock/ankle",
    "wear/sock/ankle",
    "wear/sock/knee",
  ]);
});

test("findPresetMatch resolves a qualified key", () => {
  const hit = PresetLogic.findPresetMatch("socks#wear/sock/ankle", MERGED);
  assert.equal(hit?.key, "socks#wear/sock/ankle");
  assert.equal(hit?.item.preset, "main ankle");
});

test("parseTokens matches a qualified chip as one token", () => {
  const tokens = PresetLogic.parseTokens(
    "socks#wear/sock/ankle, plain",
    MERGED,
  );
  const first = tokens.find((t) => t.key);
  assert.equal(first?.key, "socks#wear/sock/ankle");
  assert.equal(first?.text, "socks#wear/sock/ankle");
});

test("findPresetMatch and expandRecursively fall back to the plain key for winning/un-duplicated qualified keys", () => {
  // MERGED has 'wear/sock/knee' without a 'main#wear/sock/knee' duplicate key
  const hit = PresetLogic.findPresetMatch("main#wear/sock/knee", MERGED);
  assert.ok(hit);
  assert.equal(hit.item.preset, "main knee");

  const expanded = PresetLogic.expandRecursively("main#wear/sock/knee", MERGED);
  assert.equal(expanded, "main knee");
});

test("parseBasketChip tooltipTitle does not duplicate preset text when unexpanded", () => {
  const chipData = {
    styleKey: "wear/sock/knee",
    item: MERGED["wear/sock/knee"],
    subArray: ["wear/sock/knee"],
    startIndex: 0,
    endIndex: 1,
  };
  const parsed = PresetLogic.parseBasketChip(chipData, MERGED);
  // Header + preset body only, not repeated twice
  assert.equal(parsed.tooltipTitle, "Knee [wear/sock/knee]\nmain knee");
});

test("parseBasketChip tooltipTitle includes expanded text when preset expands to something different", () => {
  const cacheWithMacro: PresetCache = {
    "look/simple": { preset: "simple look" },
    "look/combo": { preset: "look/simple, extra" },
  };
  const chipData = {
    styleKey: "look/combo",
    item: cacheWithMacro["look/combo"],
    subArray: ["look/combo"],
    startIndex: 0,
    endIndex: 1,
  };
  const parsed = PresetLogic.parseBasketChip(chipData, cacheWithMacro);
  assert.equal(
    parsed.tooltipTitle,
    "simple look, extra\n\nCombo [look/combo]\nlook/simple, extra",
  );
});

// --- tooltipTitle: the final evaluated value ---

test("parseBasketChip tooltipTitle shows the evaluated value of a rolled variant", () => {
  // A bare `{group}` rolls: the header names the rolled preset while the
  // evaluated value is the only place the roll itself shows up. One variant
  // keeps the roll deterministic.
  const cache: PresetCache = {
    "faces/portrait": { preset: "portrait, solo" },
  };
  const chipData = {
    styleKey: "{faces}",
    item: null,
    subArray: ["{faces}"],
    startIndex: 0,
    endIndex: 1,
  };
  const parsed = PresetLogic.parseBasketChip(chipData, cache);
  assert.equal(
    parsed.tooltipTitle,
    "portrait, solo\n\nPortrait [faces/portrait]\nportrait, solo\n\nRolled Variants:\n🎲 Faces: portrait",
  );
});

test("parseBasketChip tooltipTitle shows the evaluated value of a plain tag", () => {
  const cache: PresetCache = { "faces/portrait": { preset: "portrait, solo" } };
  const parsed = PresetLogic.parseBasketChip(
    {
      styleKey: "<lora:my lora:1.2>",
      item: null,
      subArray: ["<lora:my lora:1.2>"],
      startIndex: 0,
      endIndex: 1,
    },
    cache,
  );
  // No cache item behind the chip, so the evaluated value is all there is -
  // and the header, which names a preset, is absent.
  assert.equal(parsed.tooltipTitle, "<lora:my lora:1.2>");
  assert.ok(
    !parsed.tooltipTitle.includes("["),
    "a tag carries no preset header",
  );
});

test("parseBasketChip tooltipTitle shows the evaluated value of a weighted tag", () => {
  // A weight is applied to the evaluated text, so the tooltip has to show the
  // weighted form rather than the bare tag.
  const parsed = PresetLogic.parseBasketChip(
    {
      styleKey: "(<lora:my lora:1.2>:1.5)",
      item: null,
      subArray: ["(<lora:my lora:1.2>:1.5)"],
      startIndex: 0,
      endIndex: 1,
    },
    {},
  );
  assert.equal(parsed.tooltipTitle, "(<lora:my lora:1.2>:1.5)");
});

test("parseBasketChip tooltipTitle shows the evaluated value of a weighted preset", () => {
  const cache: PresetCache = { "faces/portrait": { preset: "portrait, solo" } };
  const parsed = PresetLogic.parseBasketChip(
    {
      styleKey: "(faces/portrait:1.5)",
      item: cache["faces/portrait"],
      subArray: ["(faces/portrait:1.5)"],
      startIndex: 0,
      endIndex: 1,
    },
    cache,
  );
  assert.equal(
    parsed.tooltipTitle,
    "(portrait, solo:1.5)\n\nPortrait [faces/portrait]\nportrait, solo",
  );
});

test("parseBasketChip tooltipTitle keeps a single header when the chip equals its preset", () => {
  const parsed = PresetLogic.parseBasketChip(
    {
      styleKey: "wear/sock/knee",
      item: { preset: "main knee" },
      subArray: ["wear/sock/knee"],
      startIndex: 0,
      endIndex: 1,
    },
    { "wear/sock/knee": { preset: "main knee" } },
  );
  assert.equal(parsed.tooltipTitle, "Knee [wear/sock/knee]\nmain knee");
});

test("parseBasketChip resolves a preset key embedded in a weighted chip", () => {
  // `(text:weight)` is one attention token. Only the braces are substituted
  // here; the bare key after them must still resolve.
  const cache: PresetCache = {
    "pose/stand": { preset: "standing pose" },
    "prop/furn/sofa": { preset: "sofa furniture" },
  };
  const raw = "({pose} prop/furn/sofa:1.15)";
  const parsed = PresetLogic.parseBasketChip(
    { styleKey: raw, item: null, subArray: [raw], startIndex: 0, endIndex: 1 },
    cache,
  );
  assert.equal(parsed.chipExpanded, "(standing pose sofa furniture:1.15)");
});

test("parseBasketChip tooltip shows the evaluated value and the raw chip once", () => {
  const cache: PresetCache = {
    "pose/stand": { preset: "standing pose" },
    "char/hero": { preset: "hero character" },
    "prop/furn/sofa": { preset: "sofa furniture" },
  };
  const raw = "({pose} {char} prop/furn/sofa:1.15)";
  const parsed = PresetLogic.parseBasketChip(
    { styleKey: raw, item: null, subArray: [raw], startIndex: 0, endIndex: 1 },
    cache,
  );
  // evaluated value, raw chip text, roll record - no repeated expansion
  assert.equal(
    parsed.tooltipTitle,
    "(standing pose hero character sofa furniture:1.15)\n" +
      "\n" +
      "({pose} {char} prop/furn/sofa:1.15)\n" +
      "\n" +
      "Rolled Variants:\n" +
      "🎲 Pose: stand\n" +
      "🎲 Char: hero",
  );
});

test("parseBasketChip tooltipTitle shows the raw chip for a virtual null", () => {
  const cache: PresetCache = { "hair/blonde": { preset: "blonde hair" } };
  const parsed = PresetLogic.parseBasketChip(
    {
      styleKey: "{hair:none}",
      item: null,
      subArray: ["{hair:none}"],
      startIndex: 0,
      endIndex: 1,
    },
    cache,
  );
  // The chip evaluates to nothing, so the tooltip must not be blank.
  assert.equal(parsed.tooltipTitle, "{hair:none}");
});

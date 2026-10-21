# Plan: Chips parsing/rendering bottleneck improvements

Status: diagnosis measured (2026-10-20), refactor not started.
Probes: `C:\Users\Jonathan\AppData\Local\hermes\cache\scratch\chips-probe\probe1-10.mjs`

## Measured baseline

Real library: 621 cache entries, 607 with a `preset`. Basket of 120 preset keys.

Browser, `PresetBasket.render(activeList)` against the dev harness (620 entries):

| chips | render() ms |
|---|---|
| 0 | 88–110 |
| 1 | 263–267 |
| 5 | 300–313 |
| 20 | 269–293 |
| 60 | 284–298 |
| 120 | 366–395 |

**The cost does not scale with the basket.** An empty render already costs ~100 ms and
120 chips add only ~120 ms on top. This is a fixed tax on every render, not per-item work —
which is why every chip interaction (delete, pin, reroll, drag) feels laggy. It also rules
out "batch the items" as a fix.

Node-side, same library, per call:

| call | ms |
|---|---|
| `getGroupedChips(120)` | 152 |
| `parseTokens(120 joined)` | 147 |
| lookupMap build alone | 150 |
| parseTokens candidate build alone | 143 |
| one pass over all 607 entries | 144–165 |

Line numbers below are the file's own 1-based lines. The CDP profiler reports 0-based, so
its output reads one lower (e.g. `PresetLogic.js:137` in a profile = line 138 in the editor).

## Hotspots (browser profiler, 413 ms total, one `render(120)`)

| self-time | function | file:line |
|---|---|---|
| 55.6% | `getGroupMatches` | PresetLogic.js:138 |
| 14.4% | `resolveVariantKey` | PresetLogic.js:166 |
| 9.1% | `findPresetMatch` | PresetLogic.js:655 |
| 4.0% | anonymous (the `expandRecursively` callback) | PresetLogic.js:243 |
| 2.5% | `expandRecursively` | PresetLogic.js |
| 1.2% | `parseTokens` | PresetLogic.js |
| 0.9% | `getWrappedPreset` | PresetLogic.js |

Call counts inside ONE `render(120)`:

| function | calls |
|---|---|
| `getWrappedPreset` | 47508 |
| `expandRecursively` | 5773 |
| `getGroupMatches` | 806 |
| `resolveVariantKey` | 553 |
| `findPresetMatch` | 145 |
| `getGroupedChips` | 2 |
| `parseTokens` | 1 |

## Corrections to the earlier draft

The previous version of this file named the wrong hotspot and mis-stated the cost split.

1. **"lookupMap stores expanded + wrapped + trimmed per key, tripling cache work" is wrong.**
   Measured split of the 150 ms build: expanded **149 ms**, wrapped+trimmed **0.8 ms**.
   The expansion is ~187x the wrap/trim cost — 99.5% of the build, not a third of it. The fix
   is to stop running the expansion, not to stop storing three forms.

2. **The dominant hotspot is `getGroupMatches`, not `expandRecursively`.** The draft named
   the expansion; the profile puts the whole-cache scan first at 55.6%. `expandRecursively`
   shows 2.5% self-time because its cost is attributed to the `getGroupMatches` and
   `resolveVariantKey` it calls.

3. **`findPresetMatch` was not in the draft at all.** It is 9.1% and is the only hotspot that
   genuinely scales with chip count — `renderBasketChip` calls it once per chip, and each call
   loops the whole cache.

## Why the expanded lookup entries are dead weight

The 149 ms builds `lookupMap` entries keyed on `expandRecursively(key, cache)` — called with
no `rollManager`, so group picks come from `Math.random()`. Two measured consequences:

- **Non-deterministic.** `expandRecursively('action/hold', cache)` returned 6 distinct strings
  in 6 calls.
- **Almost never matches.** Recorded which *source* each map entry came from, then ran the real
  walk: a key basket resolved **0 of 120** chips through the expanded entry; a basket of
  expanded text resolved **2 of 60**. The `key` / `trimmed` / `wrapped` entries carry the rest.

So ~149 ms buys roughly 2% of resolutions, and its keys are unstable by construction.

## Constraint: do NOT memoize `expandRecursively` on the cache alone

The draft proposed `WeakMap<cache, Map<val, result>>`. Tested exactly that: **152 → 1.9 ms
(80x)**, but **88 of 607 entries returned the wrong string**, because the memoized call is the
`Math.random()` path. A cache-keyed memo makes the next render reuse the previous roll's text —
a silent correctness defect, not a speedup.

Any memo must key on the render generation (or on the `rollManager` identity), not on the cache
object. Prefer the steps below, which avoid memoizing a nondeterministic function at all.

## Actionable steps

Ordered by leverage. Each step is independently shippable and testable; steps 1–2 are the
whole win, 3–4 are the remaining 30%.

### 1. Build the lookup and candidate lists once per render generation, not per call

- **Where:** `PresetLogic.getGroupedChips` (PresetLogic.js:580) and `PresetLogic.parseTokens`
  (PresetLogic.js:695). Both rebuild their structure from scratch on every invocation.
- **Change:** build once per cache load and cache the result. Key the memo on the cache
  reference **and** the current render generation, so a roll invalidates it. `getGroupedChips`
  is called twice per render (render + `updateBasketActionButtons`); `parseTokens` once.
- **Expected:** `getGroupedChips` 152 → ~2 ms, `parseTokens` 147 → ~5 ms.
- **Verify:** existing `preset_logic.test.ts` and `preset_basket.test.ts` stay green; add a test
  that the cached value is *recomputed* after the roll generation advances (guards the
  nondeterminism trap above).

### 2. Drop the expanded lookup/candidate entries

- **Where:** PresetLogic.js:590-591 (`getGroupedChips`) and PresetLogic.js:705-708
  (`parseTokens`) — the `expandRecursively(key, cache)` calls that feed the map.
- **Change:** remove them. Keep `key`, `key.trim()`, `wrappedPreset`, `trimmedPreset`.
- **Expected:** 149 → ~1 ms. Step 1 alone gets most of this; doing both means step 1's memo is
  cheap to build in the first place.
- **Verify:** re-run `probe9.mjs` / `probe10.mjs` (the reachability probes) and confirm the
  surviving entries still resolve the same chips — the expanded entry was winning ~2% of them.
  This is the step most likely to break an existing test; check `preset_logic.test.ts` for
  assertions on expanded-form matching and update them deliberately, not by loosening them.

### 3. Index the whole-cache scans

- **Where:** `getGroupMatches` (PresetLogic.js:138) and `resolveVariantKey` (PresetLogic.js:166).
- **Change:** precompute, once per cache load, a folder→keys index and a name→key index. Both
  currently rescan all 621 keys; `resolveVariantKey`'s miss path is 0.37 ms vs 0.000 ms for a
  cache hit, and it runs 553 times per render.
- **Expected:** recovers the 70% those two functions hold.
- **Verify:** the existing variant-resolution tests; add a case for a `{group:value}` whose value
  is a *name* (not a full key), since that is the branch the name index serves.

### 4. Replace `findPresetMatch`'s per-call scan

- **Where:** `findPresetMatch` (PresetLogic.js:655), called per chip from `renderBasketChip`.
- **Change:** build the same text→key map once per cache load (it is exactly the `wrapped` +
  `trimmed` + `key` entries step 2 already keeps) and look up in it.
- **Expected:** recovers 9.1%; makes chip-count scaling linear instead of quadratic.
- **Verify:** existing preset-match tests; add one asserting a *name* match and a *wrapped* match.

### 5. Tighten the perf budget as each step lands

- **Where:** `BUDGET_MS` in `tests/unit/preset_logic.perf.test.ts`.
- **Change:** the guards already exist (see below). What remains is lowering the budget as
  steps 1-4 land. A budget left at the pre-refactor number stops protecting anything.
- **Expected:** once steps 1-2 land, both measurements should fall to well under 20 ms and the
  budget can drop from 800 ms to ~50 ms.
- **Verify:** `python tools/mutation_check.py` must still report every mutation caught — it
  includes a multi-fold slowdown that the budget has to trip.

## Guards that already landed

These are committed and green; they exist so the refactor can be checked between steps.

| Artifact | What it does |
|---|---|
| `tests/fixtures/presets.synthetic.json` | 621-entry synthetic library, committed |
| `tools/make_synthetic_library.py` | regenerates the fixture from a real library's skeleton |
| `tests/unit/preset_logic.perf.test.ts` | 8 tests: 2 perf budgets, 3 resolution guards, the memo trap |
| `tools/mutation_check.py` | 5 new entries proving those guards bite |

**The fixture mirrors shape, not size alone.** It was generated from the real library's
skeleton and reproduces, per entry: the folder taxonomy (55 folders), the value-shape mix
(526 preset-only / 81 with a thumbnail / 14 colour-only), the preset-length distribution
(p50 10 chars, p90 69, max 473) and - the part that actually drives cost - the same counts of
bare `{group}` refs (179), `{group:value}` refs (180) and `<tag>`s (86). A fixture that is
merely large measures the wrong thing: the first attempt here had the same entry count but a
third of the cost, because it emitted one var per preset instead of chaining them the way the
tab entries do.

Regenerate it with `python tools/make_synthetic_library.py` (reads the local, gitignored
`presets.json`; writes the committed fixture).

**Budgets are regression guards, not goals.** `node --test` runs test *files* in parallel, so
the same call measures ~190-270 ms loaded versus ~170 ms solo. The tests take the *fastest* of
5 runs - the minimum is the closest reading of the call's own cost, and a genuine regression
raises that floor too - and the budget absorbs the rest of the contention. Consequence worth
knowing: the budget currently catches only multi-fold regressions. It becomes a tight guard
once step 5 lowers it.

**The resolution guards pin what step 2 must not break.** Measured on the real library, the
`key` / raw-text / wrapped lookup entries carry 100% of a key-based basket's chips, while the
expanded entry carried 0 of 120. The guards assert those three paths keep resolving, and the
mutation entries prove each assertion is load-bearing (dropping any one of them fails its own
test). Note the `key` entry only matters for *weighted* tokens - `(key:1.5)` - because an
unweighted token falls back to `subArray[0]` anyway; that is why the guard uses a weighted
token.

**The memo-trap guard** asserts that expanding a group reference varies with the roll. It is
the executable form of the constraint above: it fails if anyone makes the expansion
deterministic without addressing why it was random.

## Verification checklist

- `npm test` — 372 tests, all green before starting.
- `npm run lint` — eslint + tsc clean.
- `python tools/mutation_check.py` — every mutation caught, no restore warnings.
- Re-run the perf tests after each step and record the number it recovered; lower `BUDGET_MS`
  to match.
- Confirm in the real browser (dev harness on :8878) that `render([])` drops from ~100 ms —
  that is the floor the user actually feels.

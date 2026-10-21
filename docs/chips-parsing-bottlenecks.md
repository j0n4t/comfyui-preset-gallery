# Plan: Chips parsing/rendering bottleneck improvements

Status: steps 1-4 landed (2026-10-20); the plan is complete.
Probes: `C:\Users\Jonathan\AppData\Local\hermes\cache\scratch\chips-probe\probe1-10.mjs`

## Step 1+2 landed: what changed and what it bought

Both steps were done as one change, because they are not independent — see
"Step 1 does not need a render generation" below.

`getGroupedChips` and `parseTokens` no longer rebuild a cache-wide structure on
every call. The structure is built once per cache object and reused, and the
per-entry `expandRecursively` that dominated the build is gone.

| | before | after |
|---|---|---|
| `getGroupedChips` (120 chips) | 152 ms | 0.36 ms |
| `parseTokens` (120 joined) | 147 ms | 2.8 ms |
| lookup build, cold | ~150 ms | 1.6 ms |
| candidate build, cold | ~150 ms | 4.4 ms |

Browser, `PresetBasket.render(activeList)` on the dev harness (620 entries):

| chips | before | after |
|---|---|---|
| 20 | 269–293 ms | 11 ms |
| 60 | 284–298 ms | 29–32 ms |
| 120 | 366–395 ms | 60–76 ms |

**The cost now scales with the basket, which is the point.** Before, a render
cost about the same at 1 chip as at 120 — a fixed ~300 ms tax on every
interaction. It is now per-chip work: 11 / 30 / 68 ms at 20 / 60 / 120.

### Attribution: step 2 is the win, step 1 is a 4x on top

Measured separately, because the two are easy to credit wrongly:

- **Dropping the per-entry expansion (step 2): ~150 ms → ~1.5 ms.** That is
  essentially the whole result. The expansion was 99.5% of the build.
- **Memoising the structure (step 1): ~1.5 ms → ~0.36 ms**, i.e. a further 4x,
  saving ~1.1 ms per call. Worth keeping — `getGroupedChips` runs 13 times per
  render and `parseTokens` runs on every keystroke — but it is a modest
  multiplier, not the fix.

### Step 1 does not need a render generation

The plan called for keying the memo on "the cache reference **and** the current
render generation, so a roll invalidates it". That is not needed, and building
it would have added machinery for nothing.

The `expanded` entry was the *only* nondeterministic input to either structure:
it was built from `expandRecursively(key, cache)` with no roll manager, so its
group picks came from `Math.random()`. Measured: two consecutive builds of the
lookup map produced different keys. Every other entry — `key`, `key.trim()`,
`wrappedPreset`, `trimmedPreset` — is a pure function of the cache.

So dropping the expanded entries (step 2) is what makes the memo (step 1) safe
on the cache reference alone. Doing step 1 first would have required the
generation key; doing them together removes the need for it.

The cache itself needs no invalidation hook either: it is never mutated in
place. Every load and every save replaces the object
(`PresetGalleryApp.loadGallery`), so a `WeakMap` keyed on it drops the entry
along with the old cache.

## Step 4 landed: findPresetMatch no longer scans the cache

`findPresetMatch` walked every cache entry, calling `getWrappedPreset` on each
until something matched — 145 calls per render, each walking ~290 entries. It
now reads a precomputed index.

**The obvious implementation was wrong, and measuring caught it.** The plan said
to reuse `buildLookupMap`, which already maps every match string to an entry. It
does not work: `lookupMap` keeps the **last** entry that claims a string, while
the scan returns the **first**. In a real library **1133 strings are claimed more
than once** — two entries routinely share a preset text (`action/smile` and
`pose/smile` are both `"smile"`) — so the tie-break decides which preset a chip
resolves to. Reusing `lookupMap` changed the answer for **106 of 2439 queries**.
`lookupMap` also includes keys whose entry has no preset, which the scan skips.

So step 4 got its own index (`buildPresetMatchIndex`), keeping first-wins and
preset-only. Verified against the replaced scan over 3684 queries across both
libraries: **0 mismatches**.

| | before | after |
|---|---|---|
| `getPresetFolder` calls / render | 66,136 | **1,604** |
| `getWrappedPreset` calls / render | 42,256 | **1,007** |
| render(120), load-normalised ratio | 1.63 | **0.53** |

Both call counts are 41x down from the original, and the render is ~3x faster
measured as a ratio against a calibration loop (calibration 214.9 vs 207.3 ms, so
the comparison is fair — see the note on load below).

## Where the time went, end to end

Every number below is load-independent: call counts, or a Node measurement of the
operation itself. Browser wall-clock was abandoned as evidence partway through —
see the note at the end.

| step | what it removed | effect |
|---|---|---|
| 1+2 | per-entry `expandRecursively` in the cache-wide build | `getGroupedChips` 152 → 0.36 ms |
| 3 | `getGroupMatches` scanning 620 keys per call | 31 group lookups 11.50 → 0.007 ms |
| 4 | `findPresetMatch` walking the cache per chip | `getPresetFolder` 66,136 → 1,604 calls |

## A note on measuring this machine

Mid-refactor the host's load made absolute timings unusable: the same render
measured **60 ms and 350 ms** within the hour, and a fixed calibration loop went
from 15.8 ms to **214.9 ms** — a 13.6x swing with no code change. Two consequences
that shaped this work:

- Perf guards in the test suite are **ratios against a calibration workload**, not
  milliseconds. The ratios vary ~1.3x across runs where the raw milliseconds vary
  ~4x.
- Findings are stated as **call counts and Node measurements** wherever possible.
  One browser profile in this session read 965 ms total against 538 ms earlier
  purely from load; its percentages were not used.


## Step 3 landed: the plan's premise was wrong, the fix was elsewhere

The plan said to index `getGroupMatches` and `resolveVariantKey` because they
held 70% of the render. By the time steps 1+2 landed that was no longer true,
and re-measuring first is what caught it:

| | pre-refactor | after steps 1+2 |
|---|---|---|
| `getGroupMatches` calls / render | 806 | **40** |
| `resolveVariantKey` calls / render | 553 | **10** |
| `getGroupMatches` share of profile | 55.6% | **3.5%** |

Indexing those two would have recovered ~4%, and `resolveVariantKey` at 10 calls
per render is not worth indexing at all. **It was not done, deliberately.**

What the re-profile *did* find was a hotspot no earlier measurement could see,
because steps 1+2 had just removed the callers that were hiding it:

| | share of profile | calls / render |
|---|---|---|
| `getPresetFolder` | **20.7%** (top frame) | **66,136** |
| `getWrappedPreset` | 4.8% | 42,256 |
| `parseTokens` (the walk) | 15.8% | 1 |
| `findPresetMatch` | 10.8% | 145 |

`getPresetFolder` is `key.split("/").slice(0, -1).join("/")` — trivial, and
called 66,136 times. Tracing its callers: 62% via `getWrappedPreset` (which
`findPresetMatch` calls once per cache entry, per chip) and **38% via
`getGroupMatches`' per-key filter** — the function the plan had told us to index,
for a different reason than the plan gave. `getGroupMatches` ran only 40 times,
but each scanned all 620 keys and recomputed every key's folder.

So step 3 was right that `getGroupMatches` needed an index, and wrong about why.
The index is over *group names* rather than keys, which is what makes it exact:

- `getGroupMatches`' predicate is `folder === group`, `folder` starts with
  `group + "/"`, or `folder` ends with `"/" + group`. The names that can match a
  folder are therefore its path **prefixes and suffixes** — enumerated once per
  key, the lookup becomes a map hit.
- Order is preserved exactly (keys appended in `Object.keys` order). That is not
  cosmetic: `RollManager.getRoll` picks `matches[Math.floor(Math.random() * n)]`,
  so reordering changes which preset a roll selects, and
  `preset_logic.test.ts` pins the order.
- The result is returned as a copy. Callers sort it in place
  (`getGroupMatches(...).sort()` appears in the tests), which would otherwise
  corrupt the shared index.

| | old | new |
|---|---|---|
| 31 group lookups (a render asks ~40) | 11.50 ms | 0.007 ms |
| cost model | 620-key scan each | map hit |
| index build | — | 1.3 ms, once per library load |

**1692x** on that operation, and `getPresetFolder` calls fell 66,136 → 42,853 —
exactly the 23,283 the group filter was making. Verified by a differential probe:
1444 group names across both libraries, 0 mismatches against the old predicate.



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

Ordered by leverage. Steps 1–2 have landed and removed the cache-wide work from every
render; steps 3–4 are what remains — with the cache-wide cost gone, the per-chip
`renderBasketChip` path is now ~60 ms of a 120-chip render's ~68 ms.

### 1. Build the lookup and candidate lists once per cache, not per call — DONE

Landed with step 2, as one change.

- **Where:** `PresetLogic.getGroupedChips` and `PresetLogic.parseTokens`, plus the
  module-level `derivedByCache` WeakMap and the `buildLookupMap` / `buildCandidates`
  helpers.
- **What shipped:** both structures are built lazily on first use and keyed on the cache
  object. No render generation is involved (see the section above for why it is unnecessary).
- **Result:** `getGroupedChips` 152 → 0.36 ms, `parseTokens` 147 → 2.8 ms.

### 2. Drop the expanded lookup/candidate entries — DONE

Landed with step 1, as one change. This is the step that carried the result.

- **Where:** the `expandRecursively(key, cache)` calls that fed the lookup map and the
  candidate list, now removed from `buildLookupMap` / `buildCandidates`.
- **Result:** the build went from ~150 ms to ~1.5 ms — the expansion was 99.5% of it.
- **Behaviour change, deliberate:** a token equal to a *rolled expansion* of a preset no
  longer resolves to that preset through the expanded entry. Measured on the real library,
  that path carried 0 of 120 chips in a key basket and 2 of 60 in an expanded basket, and
  its keys were unstable across builds, so it could not have been relied on. The `key`,
  raw-text and wrapped entries carry the rest and are pinned by tests.
- A latent duplicate `candidates.push` of the wrapped preset was removed with it; the
  dedupe map had been absorbing it.

### 3. Index the whole-cache scans — DONE, with the target changed

The plan named `getGroupMatches` and `resolveVariantKey`. `resolveVariantKey` turned out to be
10 calls per render and was left alone; `getGroupMatches` needed the index, but because of the
`getPresetFolder` calls it made per key, not because of its own scan cost. See "Step 3 landed"
above for the numbers.

- **Where:** `buildGroupIndex` + `getGroupMatches` in `PresetLogic.js`.
- **Result:** 31 group lookups 11.50 → 0.007 ms; `getPresetFolder` calls 66,136 → 42,853.

### 4. Replace `findPresetMatch`'s per-call scan — DONE, with the reuse ruled out

- **Where:** `buildPresetMatchIndex` + `findPresetMatch` in `PresetLogic.js`.
- **What the plan got wrong:** it said to reuse `buildLookupMap`. That changes the answer for
  106 of 2439 queries, because `lookupMap` keeps the last claimant where the scan kept the
  first, and 1133 strings in a real library are claimed more than once. It also includes keys
  whose entry has no preset, which the scan skipped. A separate index was needed.
- **Result:** `getPresetFolder` calls 66,136 → 1,604; `getWrappedPreset` 42,256 → 1,007; the
  load-normalised render ratio 1.63 → 0.53.

### 5. Tighten the perf budget — DONE, with two corrections

- **Where:** `RATIO_BUDGET` in `tests/unit/preset_logic.perf.test.ts`.
- **What shipped:** budgets are now expressed as a multiple of a calibration workload, not in
  milliseconds — see below. Current readings are 6–12x (lookup build), 21–23x (candidate
  build), 1.7–2.4x (getGroupedChips/call) and 13–17x (parseTokens/call), against budgets of
  70x and 60x.
- **Correction 1 — a per-call budget cannot be a tight guard.** The memo saves ~0.7 ms, below
  what a timing assertion can separate from noise, and it *absorbs* a build regression into a
  once-per-load cost, so a per-call measurement never sees it. The guard therefore measures
  the **cold build** on a cache nothing has derived from, which is where the catastrophic
  regression lives. That budget bites, and the mutation harness proves it.
- **Correction 2 — an absolute budget cannot work here at all.** `node --test` runs every test
  file at once and the host's other load is not ours to control: the same cold build measured
  1.6 ms solo and between 7 ms and 39 ms across runs of the full suite. No absolute budget is
  both tight enough to catch a regression and loose enough never to flake — a budget loose
  enough to survive the worst run would sit above the regression itself. Dividing by a fixed
  calibration workload that slows down with the machine cancels the load: the ratios above
  vary by ~1.3x across runs where the raw milliseconds vary by ~4x.

## Guards that already landed

**Re-run this any time with `npm run profile`** — it drives the same scenarios in a browser and
reports ranked frames, call counts and a load-normalised ratio. See `TESTING.md`.

Steps 1-4 have landed and step 5's budgets are tightened; nothing in this plan is outstanding.
If more is wanted, the next thing worth measuring is `parseTokens`' walk — one call per render,
but ~16% of the profile, and it is the per-keystroke cost in the raw textarea. It was not part
of this plan and has no measurement beyond that profile share.

These are committed and green; they exist so the refactor can be checked between steps.

| Artifact | What it does |
|---|---|
| `tests/fixtures/presets.synthetic.json` | 621-entry synthetic library, committed |
| `tools/make_synthetic_library.py` | regenerates the fixture from a real library's skeleton |
| `tests/unit/preset_logic.perf.test.ts` | 9 tests: 3 perf budgets, 4 resolution guards, the memo trap |
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

**Budgets are ratios, not milliseconds.** `node --test` runs test *files* in parallel and the
host's other load is not ours to control, so an absolute budget is unusable: the same cold
build measured 1.6 ms solo and 7–39 ms across full-suite runs. No absolute budget is both
tight enough to catch a regression and loose enough never to flake — one loose enough to
survive the worst run would sit above the regression itself. Each measurement is divided by a
fixed calibration workload that slows down with the machine, which cancels the load out: the
ratios vary ~1.3x across runs where the raw milliseconds vary ~4x. The absolute milliseconds
are still printed, for tracking between steps.

**The `build` budget is the one that bites; `perCall` is a smoke guard.** The memo saves
~0.7 ms, below what a timing assertion can separate from noise, and it *absorbs* a build
regression into a once-per-load cost — so the guard measures the cold build, which is where
the regression lives. Re-adding the expansion takes the ratio to ~850x against a 70x budget,
and the mutation harness proves it.

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

- `npm test` — 373 tests, all green before starting.
- `npm run lint` — eslint + tsc clean.
- `python tools/mutation_check.py` — every mutation caught, no restore warnings.
- Re-run the perf tests after each step and record the number it recovered; lower `BUDGET_MS`
  to match.
- Check the dev harness (on :8878) still reports 15/15, and that a render scales with the
  basket rather than costing the same at every size.

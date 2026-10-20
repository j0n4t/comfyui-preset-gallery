# Plan: Chips parsing/rendering bottleneck improvements

## Hotspots (measured candidates)
1. `getGroupedChips` (PresetLogic.js ~580) rebuilds `lookupMap` from the whole
   cache every call, running `expandRecursively` per key. Called on every render
   and chip interaction (delete, pin, reroll, re-roll group).
2. `parseTokens` (PresetLogic.js ~693) rebuilds the full candidate list (with
   `expandRecursively` per cache entry) on every invocation — used by
   autocomplete and the raw textarea.
3. `lookupMap` stores expanded + wrapped + trimmed presets per key, tripling
   cache work.

## Proposed improvements
- Memoize `expandRecursively` per cache object via WeakMap<cache, Map<val,result>>.
- Memoize the `getGroupedChips` lookupMap and the `parseTokens` candidate list,
  keyed on cache reference (invalidate on library reload).
- Avoid re-running `getWrappedPreset`/trim when the expanded value already
  equals the trimmed preset.

## Verification
- Add timing probes in dev harness around render + parseTokens on the real
  library; report before/after ms.
- Keep existing 364 tests green; add a perf smoke that fails if render exceeds
  a threshold on the sample library.

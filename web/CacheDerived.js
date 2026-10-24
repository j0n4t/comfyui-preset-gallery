/**
 * The cache-derived index record: structures built from one whole cache object,
 * shared by every module that needs them.
 *
 * A cache is indexed once, not once per consumer. `PresetLogic` builds the
 * candidate buckets, group index, preset-match index and variant index for
 * token parsing; `ChipProjection` builds the chip lookup for grouping. They
 * live in the same record keyed on the same cache, so a module that arrives
 * second finds whatever the first one already built instead of paying for it
 * again. Each entry is still built lazily on first use - `parseTokens` runs on
 * every keystroke while chip grouping does not, and neither should pay for the
 * other.
 *
 * Keyed by the cache object itself. A library load or save replaces that object
 * (it is never mutated in place), so the entry is dropped along with the cache
 * and nothing has to invalidate it by hand.
 *
 * Every builder is a pure function of `cache` - no rolls, no clock. That is
 * load-bearing: building the lookup from `expandRecursively(key, cache)` made
 * the keys depend on Math.random(), so they differed from one build to the next
 * and could not be memoized at all.
 *
 * @type {WeakMap<PresetCache, CacheDerived>}
 */
const derivedByCache = new WeakMap();

/**
 * The derived structures for a cache, creating the record on first use. Callers
 * fill in the fields they own; nothing here builds anything.
 * @param {PresetCache} cache
 * @returns {CacheDerived}
 */
function derivedFor(cache) {
  let derived = derivedByCache.get(cache);
  if (!derived) {
    derived = {};
    derivedByCache.set(cache, derived);
  }
  return derived;
}

export { derivedFor };

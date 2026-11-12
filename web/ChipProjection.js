/**
 * Chip grouping: turning an ordered selection into the chip entries the
 * basket renders.
 *
 * This is presentation, not prompt semantics. It reads the selection and the
 * cache and answers one question - which consecutive runs of the selection are
 * one chip, and which preset entry each names. It does not parse the token
 * grammar, expand a preset, or evaluate what a chip runs: those stay in
 * `PresetLogic`.
 *
 * Its one cache-derived structure is the match lookup, stored in the record
 * `CacheDerived` keeps per cache so a second consumer of the same cache reuses
 * it instead of rebuilding it.
 */
import PresetLogic from "./PresetLogic.js";
import { derivedFor } from "./CacheDerived.js";

/**
 * Maps every string a chip can be matched by to the cache entry it names.
 * Pure function of `cache`.
 *
 * Returns the exact map plus the same strings lowercased: the exact one is
 * tried first, so nothing that resolves today changes, and the lowercased one
 * lets a chip typed in another case still resolve.
 * @param {PresetCache} cache
 * @returns {{ exact: Map<string, ChipLookupEntry>, lower: Map<string, ChipLookupEntry> }}
 */
function buildLookupMap(cache) {
  /** @type {Map<string, ChipLookupEntry>} */
  const exact = new Map();
  /** @type {Map<string, ChipLookupEntry>} */
  const lower = new Map();

  const keys = Object.getOwnPropertyNames(cache);
  for (const key of keys) {
    const item = cache[key];
    if (!item) continue;
    if (item.preset?.trim()) {
      const wrappedPreset = PresetLogic.getWrappedPreset(
        key,
        item.preset,
        cache,
      );
      if (wrappedPreset) {
        const entry = { foundKey: key, foundItem: item };
        exact.set(wrappedPreset, entry);
        lower.set(wrappedPreset.toLowerCase(), entry);
      }

      const trimmedPreset = item.preset.trim();
      if (trimmedPreset) {
        const entry = { foundKey: key, foundItem: item };
        exact.set(trimmedPreset, entry);
        lower.set(trimmedPreset.toLowerCase(), entry);
      }
    }
    if (key) {
      const entry = { foundKey: key, foundItem: item };
      exact.set(key, entry);
      exact.set(key.trim(), entry);
      lower.set(key.toLowerCase(), entry);
      lower.set(key.trim().toLowerCase(), entry);
      const split = PresetLogic.splitQualifiedKey(key);
      if (split.libraryId && !exact.has(split.key)) {
        exact.set(split.key, entry);
      }
      if (split.libraryId && !lower.has(split.key.toLowerCase())) {
        lower.set(split.key.toLowerCase(), entry);
      }
    }
  }
  return { exact, lower };
}

/**
 * Groups raw token elements from list sequence into aggregated chip entries.
 * @param {string[]} activeList - Sequential token inputs.
 * @param {PresetCache} cache - Preset cache map.
 * @returns {ChipGroupInput[]} Grouped chip item definitions.
 */
function getGroupedChips(activeList, cache) {
  /** @type {ChipGroupInput[]} */
  const chips = [];
  if (!activeList || activeList.length === 0) return chips;

  /** @type {Map<string, ChipLookupEntry>} */
  let lookupMap = new Map();
  /** @type {Map<string, ChipLookupEntry>} */
  let lookupMapLower = new Map();
  if (cache) {
    const derived = derivedFor(cache);
    if (!derived.lookupMap || !derived.lookupMapLower) {
      const maps = buildLookupMap(cache);
      derived.lookupMap = maps.exact;
      derived.lookupMapLower = maps.lower;
    }
    lookupMap = derived.lookupMap;
    lookupMapLower = derived.lookupMapLower ?? new Map();
  }

  let i = 0;
  while (i < activeList.length) {
    let matched = null;
    let matchedLen = 0;

    for (let len = Math.min(activeList.length - i, 10); len >= 1; len--) {
      const subArray = activeList.slice(i, i + len);
      const joined = subArray.join(", ");
      const { core: coreJoined } = PresetLogic.parseWeight(joined);
      /** @param {Map<string, ChipLookupEntry>} map */
      const lookupIn = (map, /** @type {string} */ k) => {
        const hit = map.get(k);
        if (hit) return hit;
        const split = PresetLogic.splitQualifiedKey(k);
        return split.libraryId ? map.get(split.key) ?? null : null;
      };
      const lookup = (/** @type {string} */ k) =>
        lookupIn(lookupMap, k) || lookupIn(lookupMapLower, k.toLowerCase());
      const cached =
        len === 1
          ? lookup(coreJoined) ||
            lookup(
              coreJoined.replace(
                /\{([^{}:]+):(?:[^{}]|\{(?:[^{}]|\{[^{}]*\})*\})*\}/g,
                "{$1}",
              ),
            )
          : null;

      if (
        cached ||
        len === 1 ||
        coreJoined.match(/^<[^<>]+>$/) ||
        coreJoined.match(
          /^\{[^{}]+(?::(?:[^{}]|\{(?:[^{}]|\{[^{}]*\})*\})*)?\}$/,
        )
      ) {
        const qualifiedInput =
          len === 1 && PresetLogic.splitQualifiedKey(coreJoined).libraryId;
        const resolvedStyleKey = qualifiedInput
          ? coreJoined
          : cached?.foundKey || subArray[0];
        matched = {
          styleKey: resolvedStyleKey,
          item:
            cached?.foundItem ||
            (cached?.foundKey
              ? cache[cached.foundKey]
              : cache[resolvedStyleKey]),
          startIndex: i,
          endIndex: i + len,
          subArray,
        };
        matchedLen = len;
        break;
      }
    }

    if (matched) {
      chips.push(matched);
      i += matchedLen;
    } else {
      chips.push({
        styleKey: activeList[i],
        item: cache[activeList[i]] || null,
        startIndex: i,
        endIndex: i + 1,
        subArray: [activeList[i]],
      });
      i += 1;
    }
  }
  return chips;
}

const ChipProjection = {
  getGroupedChips,
};

export default ChipProjection;

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
 * @param {PresetCache} cache
 * @returns {Map<string, ChipLookupEntry>}
 */
function buildLookupMap(cache) {
  /** @type {Map<string, ChipLookupEntry>} */
  const lookupMap = new Map();

  const keys = Object.getOwnPropertyNames(cache);
  for (const key of keys) {
    const item = cache[key];
    if (!item) continue;
    if (item.preset?.trim()) {
      const wrappedPreset = PresetLogic.getWrappedPreset(key, item.preset, cache);
      if (wrappedPreset) {
        lookupMap.set(wrappedPreset, { foundKey: key, foundItem: item });
      }

      const trimmedPreset = item.preset.trim();
      if (trimmedPreset) {
        lookupMap.set(trimmedPreset, { foundKey: key, foundItem: item });
      }
    }
    if (key) {
      lookupMap.set(key, { foundKey: key, foundItem: item });
      lookupMap.set(key.trim(), { foundKey: key, foundItem: item });
      const split = PresetLogic.splitQualifiedKey(key);
      if (split.libraryId && !lookupMap.has(split.key)) {
        lookupMap.set(split.key, { foundKey: key, foundItem: item });
      }
    }
  }
  return lookupMap;
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
  if (cache) {
    const derived = derivedFor(cache);
    if (!derived.lookupMap) derived.lookupMap = buildLookupMap(cache);
    lookupMap = derived.lookupMap;
  }

  let i = 0;
  while (i < activeList.length) {
    let matched = null;
    let matchedLen = 0;

    for (let len = Math.min(activeList.length - i, 10); len >= 1; len--) {
      const subArray = activeList.slice(i, i + len);
      const joined = subArray.join(", ");
      const { core: coreJoined } = PresetLogic.parseWeight(joined);
      const lookup = (/** @type {string} */ k) => lookupMap.get(k) || (
        PresetLogic.splitQualifiedKey(k).libraryId
          ? lookupMap.get(PresetLogic.splitQualifiedKey(k).key)
          : null
      );
      const cached = (len === 1)
        ? (lookup(coreJoined) || lookup(coreJoined.replace(/\{([^{}:]+):(?:[^{}]|\{(?:[^{}]|\{[^{}]*\})*\})*\}/g, '{$1}')))
        : null;

      if (cached || len === 1 || coreJoined.match(/^<[^<>]+>$/) || coreJoined.match(/^\{[^{}]+(?::(?:[^{}]|\{(?:[^{}]|\{[^{}]*\})*\})*)?\}$/)) {
        const qualifiedInput = len === 1 && PresetLogic.splitQualifiedKey(coreJoined).libraryId;
        const resolvedStyleKey = qualifiedInput ? coreJoined : (cached?.foundKey || subArray[0]);
        matched = {
          styleKey: resolvedStyleKey,
          item: cached?.foundItem || (cached?.foundKey ? cache[cached.foundKey] : cache[resolvedStyleKey]),
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

/**
 * Display metadata: how a preset is named, labelled, coloured and searched for.
 *
 * These helpers read a cache key and the cache and answer what the UI shows. None
 * of them parse the token grammar or expand a preset: they turn a key into a
 * label, a tooltip, a colour or a search blob. `ChipProjection` builds the chip
 * list and `PresetLogic` evaluates a chip and expands a prompt, so neither has to
 * carry them.
 *
 * One direction only: this module imports the grammar it reads keys through, and
 * `PresetLogic` imports the two path helpers its index builders call. There is
 * deliberately no facade back the other way - re-exporting from `PresetLogic`
 * would put a cycle between the two, which is what `CacheDerived` exists to
 * avoid. Call sites import the module that owns the helper.
 */
import PresetLogic from "./PresetLogic.js";
import RollManager from "./RollManager.js";

/**
 * Formats underscore/hyphen delimited strings into Title Case.
 * @param {string} str - Raw input text.
 * @returns {string} Formatted string.
 */
function toTitleCase(str) {
  return str
    .replace(/_/g, " ")
    .replace(/-/g, " ")
    .replace(/\b\w/g, (/** @type {string} */ l) => l.toUpperCase());
}

/**
 * Generates a deterministic HSL color value from a string hash.
 * @param {string} str - Identifier string.
 * @returns {string} Valid HSL color string.
 */
function getHashColor(str) {
  let hash = 0;
  for (let i = 0; i < 6; i++)
    hash = Math.imul(hash ^ str.charCodeAt(i), 15485863);
  hash = (hash ^ (hash >>> 16)) * 0x85ebca6b;
  hash = (hash ^ (hash >>> 13)) * 0xc2b2ae35;
  const hue = Math.abs((hash ^ (hash >>> 15)) % 360);
  return `hsl(${hue}, 65%, 35%)`;
}

/**
 * Returns unique folder paths extracted from the entire cache dictionary.
 * @param {PresetCache} cache - Preset cache map.
 * @returns {string[]} List of unique folder path strings.
 */
function getAllPresetFolders(cache) {
  return Array.from(
    new Set(Object.keys(cache).map((key) => getPresetFolder(key))),
  );
}

/**
 * Computes the assigned or computed HSL color for a given preset key.
 * @param {string} [presetKey=""] - Preset identifier path key.
 * @param {PresetCache|null} [cache=null] - Optional lookup cache.
 * @returns {string} CSS Color string.
 */
function getPresetColor(presetKey = "", cache = null) {
  const parts = PresetLogic.splitQualifiedKey(presetKey).key.split("/");
  for (let i = parts.length; i > 0; i--) {
    const parentPath = parts.slice(0, i).join("/");
    if (cache && cache[parentPath] && cache[parentPath].__color__) {
      return cache[parentPath].__color__;
    }
  }
  const topLevel = parts[0];
  return getHashColor(topLevel);
}

/**
 * Gets root folder prefix of a key.
 * @param {string} key - Cache key.
 * @returns {string} Root folder path.
 */
function getPresetBaseFolder(key) {
  const path = PresetLogic.splitQualifiedKey(key).key;
  return path.includes("/") ? path.split("/")[0] : path;
}

/**
 * Extracts name portion of path key.
 * @param {string} key - Cache key.
 * @returns {string} File or preset name.
 */
function getPresetName(key) {
  return PresetLogic.splitQualifiedKey(key).key.split("/").pop() || "";
}

/**
 * Returns full formatted title and description body for tooltips.
 * @param {string} key - Cache key.
 * @param {PresetCache} cache - Cache object.
 * @param {RollManager} [rollManager] - Dynamic roll tracker state.
 * @returns {string} Formatted multiline title text.
 */
function getPresetTitle(key, cache, rollManager = new RollManager()) {
  if (!key) return "";
  if (PresetLogic.isVirtualNull(key)) return "None [omit variant]";
  const name = toTitleCase(getPresetName(key));
  const preset = cache[key]?.preset || key;
  const title = `${name} [${key}]\n${preset}`;
  const expanded = PresetLogic.expandRecursively(
    key,
    cache,
    new Set(),
    rollManager,
  );
  if (expanded !== preset) return `${expanded}\n\n${title}`;
  return title;
}

/**
 * Creates initialized standard 2-character initials string for items.
 * @param {string} key - Target key.
 * @returns {string} Up to 6 character initials.
 */
function getPresetInitials(key) {
  const path = PresetLogic.splitQualifiedKey(key).key;
  const raw = path.includes("/") ? getPresetName(path) : path;
  return toTitleCase(raw)
    .split(/\s+/)
    .map((/** @type {string} */ w) => w.slice(0, 2))
    .join("")
    .substring(0, 6);
}

/**
 * Extracts parent folder path string of key.
 * @param {string} key - Preset key path.
 * @returns {string} Folder path string.
 */
function getPresetFolder(key) {
  return PresetLogic.splitQualifiedKey(key)
    .key.split("/")
    .slice(0, -1)
    .join("/");
}

/**
 * Gets formatted human readable path (using breadcrumb chevron format).
 * @param {string} key - Key path.
 * @returns {string} Breadcrumb UI folder representation.
 */
function getUiFolder(key) {
  return getPresetFolder(key).split("/").join(" › ");
}

/**
 * Constructs searchable lowercase blob text for indexing.
 * @param {string} key - Preset key path.
 * @param {PresetCacheItem} item - Cache item object.
 * @returns {string} Searchable text query blob.
 */
function getSearchBlob(key, item) {
  const split = PresetLogic.splitQualifiedKey(key);
  const libPrefix = split.libraryId ? `${split.libraryId}# ` : "";
  return `${libPrefix}${getPresetName(key)} ${key} ${getPresetInitials(key)} ${item?.preset || ""}`.toLowerCase();
}

/**
 * Filters list items matching a search query string.
 * @param {string[]} list - Key list array.
 * @param {string} query - Query filter string.
 * @param {(item: string) => string} [blobFn] - Custom search blob mapper callback.
 * @param {PresetCache|null} [cache=null] - Cache reference.
 * @param {string|null} [ignorePreset=null] - Preset key to exclude.
 * @returns {SearchResult[]} Top matched items.
 */
function getTopMatches(
  /** @type {string[]} */ list,
  /** @type {string} */ query,
  /** @type {(item: string) => string} */ blobFn,
  /** @type {PresetCache|null} */ cache = null,
  /** @type {string|null} */ ignorePreset = null,
) {
  const resolveBlob =
    blobFn || ((/** @type {string} */ i) => getSearchBlob(i, cache?.[i] || {}));
  const queryWords = query.toLowerCase().trim().split(/\s+/).filter(Boolean);
  if (!queryWords.length) return [];
  const buckets = list.reduce(
    (
      /** @type {{startsWith: SearchResult[], fuzzy: SearchResult[]}} */ acc,
      item,
    ) => {
      if (
        (cache && !cache[item]?.preset && !PresetLogic.isVirtualNull(item)) ||
        item === ignorePreset
      )
        return acc;
      const blob = resolveBlob(item).toLowerCase();
      if (!queryWords.every((word) => blob.includes(word))) return acc;
      const title = cache ? getPresetTitle(item, cache) : "";
      let idx = blob.indexOf(queryWords.join(" "));
      if (idx === -1) idx = blob.indexOf(queryWords[0]);
      if (idx === 0) {
        if (acc.startsWith.length < 3)
          acc.startsWith.push({ item, idx, title });
      } else {
        if (acc.fuzzy.length < 3) acc.fuzzy.push({ item, idx, title });
      }
      return acc;
    },
    { startsWith: [], fuzzy: [] },
  );
  const sortBucket = (/** @type {SearchResult[]} */ arr) =>
    arr.sort((a, b) =>
      a.idx !== b.idx ? a.idx - b.idx : a.item.localeCompare(b.item),
    );
  return Array.from(
    new Set([...sortBucket(buckets.startsWith), ...sortBucket(buckets.fuzzy)]),
  );
}

const PresetDisplay = {
  toTitleCase,
  getHashColor,
  getAllPresetFolders,
  getPresetColor,
  getPresetBaseFolder,
  getPresetName,
  getPresetTitle,
  getPresetInitials,
  getPresetFolder,
  getUiFolder,
  getSearchBlob,
  getTopMatches,
};

export default PresetDisplay;

export {
  toTitleCase,
  getHashColor,
  getAllPresetFolders,
  getPresetColor,
  getPresetBaseFolder,
  getPresetName,
  getPresetTitle,
  getPresetInitials,
  getPresetFolder,
  getUiFolder,
  getSearchBlob,
  getTopMatches,
};

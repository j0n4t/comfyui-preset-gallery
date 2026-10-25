/**
 * The browser-storage boundary: the one place that knows the key names, the
 * shape each holds, and how to read a stored value back without trusting it.
 * Every other module asks here, which buys three things:
 *
 * - **A key name is written once.** A typo in a literal reads back the default
 *   forever, silently, with no error - the kind of bug that is only found by
 *   noticing a preference never sticks.
 * - **A bad value degrades instead of throwing.** `PresetSession` used to read
 *   its pins and folder lists with no parse guard, so one corrupt value in
 *   storage threw out of the constructor and the gallery never mounted. The
 *   settings panel and the tab list already guarded theirs; this is the rest.
 * - **A value of the wrong JSON type is dropped.** `"a string"` and `42` are
 *   valid JSON, and both used to be handed back to callers expecting an array.
 *
 * The key names are historical and deliberately NOT unified: `comfy_preset_gallery_*`
 * is the original set, `pg_*` the shorter one the settings panel added, and
 * `j0n4t-pg-pins-<nodeId>` is per node. Renaming any of them loses the user's
 * saved state, so they are constants here rather than a tidy prefix.
 *
 * Every primitive takes the storage as its LAST argument, defaulting to the
 * ambient one: `readBool(KEY, true)` reads the browser's storage, and a test
 * injects its own with `readBool(KEY, true, fakeStorage)`. The session and the
 * tab list do the same with the storage they were constructed with.
 */

/**
 * The key of every value the gallery reads or writes. `pins` is a function
 * because the key carries the node id.
 */
const STORAGE_KEYS = {
  rawBasket: "comfy_preset_gallery_raw_basket",
  basketTabs: "comfy_preset_gallery_basket_tabs",
  panelCollapsed: "comfy_preset_gallery_collapsed",
  galleryHidden: "comfy_preset_gallery_hidden",
  view: "comfy_preset_gallery_view",
  grouped: "comfy_preset_gallery_grouped",
  showHidden: "comfy_preset_gallery_show_hidden",
  settings: "pg_settings",
  collapsedFolders: "pg_collapsed_folders_list",
  excludedRollFolders: "pg_excluded_roll_folders",
  pins: (/** @type {string | number | undefined} */ nodeId) =>
    `j0n4t-pg-pins-${nodeId || "global"}`,
};

/**
 * The browser localStorage, or null when there is none (under `node --test`) or
 * when reading it throws - a browser that blocks storage. Callers must tolerate
 * null: the gallery runs on its defaults rather than failing to mount.
 * @returns {Storage | null}
 */
function defaultStorage() {
  try {
    return typeof localStorage !== "undefined" ? localStorage : null;
  } catch {
    return null;
  }
}

/**
 * A stored string. An empty value counts as missing, which is how the view key
 * already behaved (`getItem(...) || "big"`).
 * @param {string} key
 * @param {string} [fallback]
 * @param {Storage | null} [storage] defaults to the ambient storage
 * @returns {string}
 */
function readString(key, fallback = "", storage = defaultStorage()) {
  const raw = storage?.getItem(key);
  return raw ? raw : fallback;
}

/**
 * @param {string} key
 * @param {string} value
 * @param {Storage | null} [storage]
 */
function writeString(key, value, storage = defaultStorage()) {
  storage?.setItem(key, value);
}

/**
 * A stored boolean, written as the string `"true"`/`"false"` - the format every
 * boolean key already uses.
 *
 * `fallback` is returned for anything that is not exactly `"true"`, so
 * `readBool(s, k, true)` reproduces the `!== "false"` keys (default on) and
 * `readBool(s, k, false)` the `=== "true"` ones (default off).
 * @param {string} key
 * @param {boolean} [fallback]
 * @param {Storage | null} [storage]
 * @returns {boolean}
 */
function readBool(key, fallback = false, storage = defaultStorage()) {
  return storage?.getItem(key) === "true" ? true : fallback;
}

/**
 * @param {string} key
 * @param {boolean} value
 * @param {Storage | null} [storage]
 */
function writeBool(key, value, storage = defaultStorage()) {
  storage?.setItem(key, String(value));
}

/**
 * A stored JSON value. A missing or unparseable value yields `fallback`; a
 * value of the wrong shape is left to the caller, which knows what it needs.
 * @param {string} key
 * @param {*} [fallback]
 * @param {Storage | null} [storage]
 * @returns {*}
 */
function readJson(key, fallback = null, storage = defaultStorage()) {
  const raw = storage?.getItem(key);
  if (!raw) return fallback;
  try {
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

/**
 * @param {string} key
 * @param {*} value
 * @param {Storage | null} [storage]
 */
function writeJson(key, value, storage = defaultStorage()) {
  storage?.setItem(key, JSON.stringify(value));
}

/**
 * A stored JSON array of strings - the folder and pin lists. Anything that is
 * not an array of strings yields the empty list, so a wrong-typed value can
 * never reach a caller that would call `includes` on it.
 * @param {string} key
 * @param {Storage | null} [storage]
 * @returns {string[]}
 */
function readIdList(key, storage = defaultStorage()) {
  const parsed = readJson(key, null, storage);
  if (!Array.isArray(parsed)) return [];
  return parsed.filter((/** @type {*} */ item) => typeof item === "string");
}

const GalleryStorage = {
  STORAGE_KEYS,
  defaultStorage,
  readString,
  writeString,
  readBool,
  writeBool,
  readJson,
  writeJson,
  readIdList,
};

export {
  STORAGE_KEYS,
  defaultStorage,
  readString,
  writeString,
  readBool,
  writeBool,
  readJson,
  writeJson,
  readIdList,
};

export default GalleryStorage;

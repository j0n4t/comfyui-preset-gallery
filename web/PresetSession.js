import RollManager from "./RollManager.js";
import PresetLogic from "./PresetLogic.js";

/**
 * Returns the browser localStorage, or null when there is none (e.g. under
 * `node --test`). Callers must tolerate a null storage.
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
 * Owns the pure, stateful part of a preset gallery session: the preset cache,
 * pinned chips, roll state, persisted view preferences, and the selection
 * algorithms that used to live on PresetGalleryApp.
 *
 * Deliberately free of DOM and ComfyUI dependencies so it can be constructed in
 * a plain Node test. `storage` and `rng` are injectable for determinism.
 */
export default class PresetSession {
  /**
   * @param {{ storage?: Storage | null, rng?: () => number, nodeId?: string | number | undefined }} [options]
   */
  constructor({ storage = defaultStorage(), rng = Math.random, nodeId = "global" } = {}) {
    /** @type {Storage | null} */
    this.storage = storage;
    /** @type {() => number} */
    this.rng = rng;
    /** @type {PresetCache} */
    this.cache = {};
    this.pinKey = `j0n4t-pg-pins-${nodeId || "global"}`;
    const savedPins = this.storage?.getItem(this.pinKey);
    /** @type {Set<string>} */
    this.pinnedChips = new Set(savedPins ? JSON.parse(savedPins) : []);
    this.rollManager = new RollManager();
    /** @type {Record<string, any> | null} */
    this.lastSeeds = null;
  }

  /**
   * Splits a raw widget value into its preset keys.
   * @param {string} rawValue
   * @returns {string[]}
   */
  getSelectedArray(rawValue) {
    return rawValue ? PresetLogic.splitPresets(rawValue) : [];
  }

  savePins() {
    try {
      this.storage?.setItem(this.pinKey, JSON.stringify(Array.from(this.pinnedChips)));
    } catch (e) {
      console.warn("Could not save pinned chips", e);
    }
  }

  /**
   * Moves a pin from one value to another, if it was pinned.
   * @param {string} oldVal
   * @param {string} newVal
   */
  transferPin(oldVal, newVal) {
    if (this.pinnedChips.has(oldVal)) {
      this.pinnedChips.delete(oldVal);
      this.pinnedChips.add(newVal);
      this.savePins();
    }
  }

  /**
   * Drops any pin that is no longer present as a contiguous run inside `arr`.
   * A pin can expand to several tokens, so it only survives when its tokens
   * appear in order without interruption.
   * @param {string[]} arr
   * @returns {boolean} true when at least one pin was dropped
   */
  prunePins(arr) {
    let pinsChanged = false;
    for (const val of this.pinnedChips) {
      const pinnedItems = PresetLogic.splitPresets(val);
      const isStillSelected =
        pinnedItems.length > 0 &&
        arr.some((_, start) => pinnedItems.every((item, offset) => arr[start + offset] === item));
      if (!isStillSelected) {
        this.pinnedChips.delete(val);
        pinsChanged = true;
      }
    }
    if (pinsChanged) this.savePins();
    return pinsChanged;
  }

  /** @returns {string[]} */
  getCollapsedFolders() {
    return JSON.parse(this.storage?.getItem("pg_collapsed_folders_list") || "[]");
  }

  /** @param {string[]} list */
  setCollapsedFolders(list) {
    this.storage?.setItem("pg_collapsed_folders_list", JSON.stringify(list));
  }

  /** @returns {string[]} */
  getExcludedRollFolders() {
    return JSON.parse(this.storage?.getItem("pg_excluded_roll_folders") || "[]");
  }

  /** @param {string[]} list */
  setExcludedRollFolders(list) {
    this.storage?.setItem("pg_excluded_roll_folders", JSON.stringify(list));
  }

  /**
   * The dice algorithm. Picks a random total between `min` and `max`, keeps the
   * caller's pinned selection, then fills up by drawing one or two presets per
   * shuffled group until the total is reached or every preset is used.
   *
   * @param {{
   *   cache: PresetCache,
   *   excludedFolders?: string[],
   *   min?: number,
   *   max?: number,
   *   selected?: string[],
   * }} options
   * @returns {string[] | null} the new selection, or null when no group is eligible
   */
  buildRollSelection({ cache, excludedFolders = [], min = 10, max = 20, selected = [] }) {
    const groupsMap = new Map();
    for (const [key, item] of Object.entries(cache)) {
      if (item?.preset) {
        const folder = PresetLogic.getPresetFolder(key);
        if (folder) {
          if (!groupsMap.has(folder)) groupsMap.set(folder, []);
          groupsMap.get(folder).push(key);
        }
      }
    }

    const availableGroups = Array.from(groupsMap.keys()).filter(
      (key) => !key.startsWith("_") && !excludedFolders.includes(key)
    );
    if (availableGroups.length === 0) return null;

    const newSelections = selected.filter((item) => this.pinnedChips.has(item));
    const addedSet = new Set(newSelections);
    const targetTotal = Math.max(
      Math.floor(this.rng() * (max - min + 1)) + min,
      newSelections.length + 1
    );

    while (newSelections.length < targetTotal) {
      const shuffledGroups = [...availableGroups].sort(() => 0.5 - this.rng());
      let addedInIteration = false;
      for (const group of shuffledGroups) {
        const groupPresets = groupsMap.get(group) || [];
        if (groupPresets.length === 0) continue;

        const numChips = Math.floor(this.rng() * 2) + 1;
        for (let i = 0; i < numChips; i++) {
          const randomPreset = groupPresets[Math.floor(this.rng() * groupPresets.length)];
          if (!addedSet.has(randomPreset)) {
            addedSet.add(randomPreset);
            newSelections.push(randomPreset);
            addedInIteration = true;
            if (newSelections.length >= targetTotal) break;
          }
        }
        if (newSelections.length >= targetTotal) break;
      }

      const totalAvailablePresets = availableGroups.reduce(
        (acc, g) => acc + (groupsMap.get(g)?.length || 0),
        0
      );
      if (!addedInIteration || addedSet.size >= totalAvailablePresets) break;
    }

    newSelections.sort((a, b) => a.localeCompare(b));
    if (cache["_/combo/_default"]) newSelections.unshift("_/combo/_default");
    return newSelections;
  }

  /**
   * Walks a ComfyUI node list (recursing into subgraphs) collecting every
   * seed/noise widget value, and reports whether any changed since the previous
   * call. The walk is pure; the caller supplies the nodes.
   * @param {any[]} nodes
   * @returns {boolean} true when at least one seed/noise value changed
   */
  detectSeedChange(nodes) {
    let seedChanged = false;
    /** @type {Record<string, any>} */
    const currentSeeds = {};

    /** @param {any[]} list */
    const checkNodes = (list) => {
      for (const node of list || []) {
        if (node.widgets) {
          for (const w of node.widgets) {
            if (w.name && (w.name.toLowerCase().includes("seed") || w.name.toLowerCase().includes("noise"))) {
              const key = `${node.id}-${w.name}`;
              currentSeeds[key] = w.value;
              if (this.lastSeeds && this.lastSeeds[key] !== undefined && this.lastSeeds[key] !== w.value) {
                seedChanged = true;
              }
            }
          }
        }
        // Recursively check sub-graphs
        if (node.subgraph && node.subgraph._nodes) {
          checkNodes(node.subgraph._nodes);
        }
      }
    };

    checkNodes(nodes);
    this.lastSeeds = currentSeeds;
    return seedChanged;
  }
}

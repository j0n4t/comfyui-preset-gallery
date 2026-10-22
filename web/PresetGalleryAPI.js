import PresetDOM from "./PresetDOM.js";
import PresetLogic from "./PresetLogic.js";

export default class PresetGalleryAPI {
  static API_ENDPOINT = "/preset_gallery/presets";

  /**
   * The bundled library's id. It is always enabled and always first in the
   * merge order, so a node with nothing else enabled reads `main`.
   */
  static DEFAULT_LIBRARY_ID = "main";

  /**
   * Which library every read and write targets when the caller does not name
   * one. The bundled library by default; the app moves it to the library a
   * node is editing. Null means the bundled library too - the route serves it
   * when no `?library=` is present.
   * @type {string | null}
   */
  static activeLibraryId = null;

  /** @param {string | null} id */
  static setActiveLibrary(id) {
    PresetGalleryAPI.activeLibraryId = id;
  }

  /**
   * The preset routes for one library, or the default's when no id is given.
   * @param {string | null} [libraryId]
   * @returns {string}
   */
  static libraryUrl(libraryId = PresetGalleryAPI.activeLibraryId) {
    const id = libraryId || "";
    return id
      ? `${PresetGalleryAPI.API_ENDPOINT}?library=${encodeURIComponent(id)}`
      : PresetGalleryAPI.API_ENDPOINT;
  }

  /**
   * The library list this endpoint returns: one entry per file the server can
   * serve. The shape comes from preset_store.list_libraries().
   * @typedef {Object} PresetLibrary
   * @property {string} id
   * @property {string} name
   * @property {boolean} default
   */

  /**
   * The libraries the server can serve: the bundled default plus everything
   * dropped into the presets folder.
   * @returns {Promise<PresetLibrary[]>}
   */
  static async fetchLibraries() {
    try {
      const res = await fetch("/preset_gallery/libraries");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    } catch (error) {
      console.error("[PresetGalleryAPI] Error fetching libraries:", error);
      return [];
    }
  }

  /**
   * @param {string | null} libraryId
   * @returns {Promise<PresetCache>}
   */
  static async fetchGallery(libraryId = PresetGalleryAPI.activeLibraryId) {
    try {
      const res = await fetch(PresetGalleryAPI.libraryUrl(libraryId));
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const serverPresets = await res.json();
      return serverPresets;
    } catch (error) {
      console.error("[PresetGalleryAPI] Error fetching gallery:", error);
      return {};
    }
  }

  /**
   * Fetch several libraries at once, keyed by id.
   *
   * A node merges every library it has enabled into one cache, so the app needs
   * each library's own entries rather than one merged read. A library that
   * fails to load contributes an empty cache instead of rejecting the batch -
   * one unreachable file must not blank the grid.
   *
   * @param {string[]} ids
   * @returns {Promise<Record<string, PresetCache>>}
   */
  static async fetchLibraryCaches(ids) {
    const entries = await Promise.all(
      (ids || []).map(async (id) => [id, await PresetGalleryAPI.fetchGallery(id)])
    );
    return Object.fromEntries(entries);
  }

  /**
   * One library's own entries - the merged cache's shadowed entries live under
   * a qualifier, so an edit has to read the library the key belongs to.
   * @param {string | null} [libraryId]
   * @returns {Promise<PresetCache>}
   */
  static async getPresets(libraryId = PresetGalleryAPI.activeLibraryId) {
    return await PresetGalleryAPI.fetchGallery(libraryId);
  }

  /**
   * @param {PresetCache} presets
   * @param {string | null} [libraryId]
   */
  static async savePresets(presets, libraryId = PresetGalleryAPI.activeLibraryId) {
    const activeFolders = new Set();
    for (const [key, item] of Object.entries(presets)) {
      if (!item) continue;
      const hasContent = (typeof item.preset === "string" && item.preset.trim().length > 0) || item.filename;
      if (hasContent) {
        const parts = key.split("/");
        while (parts.length > 1) {
          parts.pop();
          activeFolders.add(parts.join("/"));
        }
      }
    }

    /** @type {PresetCache} */
    const cleanedPresets = {};
    for (const [key, item] of Object.entries(presets)) {
      if (!item) continue;
      const hasContent = (typeof item.preset === "string" && item.preset.trim().length > 0) || item.filename;
      const hasColor = typeof item.__color__ === "string" && item.__color__.length > 0;

      if (hasContent) {
        cleanedPresets[key] = { ...item };
      } else if (hasColor && activeFolders.has(key)) {
        cleanedPresets[key] = { __color__: item.__color__ };
      }
    }

    const sortedPresets = Object.entries(cleanedPresets)
      .sort((a, b) => {
        const isAHidden = a[0].startsWith("_");
        const isBHidden = b[0].startsWith("_");
        if (isAHidden !== isBHidden) {
          return isAHidden ? 1 : -1;
        }
        return a[0].localeCompare(b[0]);
      })
      .reduce((acc, [key, value]) => ({ ...acc, [key]: value }), {});

    try {
      const res = await fetch(PresetGalleryAPI.libraryUrl(libraryId), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(sortedPresets),
      });
      return await res.json();
    } catch (error) {
      console.error("[PresetGalleryAPI] Error saving presets:", error);
      return { success: false, error };
    }
  }

  /**
   * @param {string} groupRaw
   * @param {string} color
   * @param {string | null} [libraryId] the library the group lives in
   */
  static async setGroupColor(groupRaw, color, libraryId = PresetGalleryAPI.activeLibraryId) {
    const presets = await PresetGalleryAPI.getPresets(libraryId);
    if (color) {
      presets[groupRaw] = { ...(presets[groupRaw] || {}), __color__: color };
    } else if (presets[groupRaw]) {
      delete presets[groupRaw].__color__;
    }
    await PresetGalleryAPI.savePresets(presets, libraryId);
    return { success: true };
  }

  /**
   * @typedef {Object} SavePresetData
   * @property {string} name
   * @property {string} folder
   * @property {string} presetText
   * @property {string} imageData
   * @property {boolean} clearImage
   * @property {string} editingKey
   * @property {string} mode
   * @property {string | null} [libraryId] the library to write to
   */

  /** @param {SavePresetData} data */
  static async savePreset({ name, folder, presetText, imageData, clearImage, editingKey, mode, libraryId }) {
    const target = libraryId ?? PresetGalleryAPI.activeLibraryId;
    const presets = await PresetGalleryAPI.getPresets(target);

    let cleanFolder = folder ? folder.trim().toLowerCase().replace(/ /g, "_").replace(/^\/+|\/+$/g, "") : "";
    if (["root", "root_presets", "none", "root presets"].includes(cleanFolder)) {
      cleanFolder = "";
    }

    const cleanName = name ? name.trim().toLowerCase().replace(/ /g, "_").replace(/^\/+|\/+$/g, "") : "";
    if (!cleanName) {
      console.error("[PresetGalleryAPI] Cannot save preset with an empty name.");
      return { success: false, error: "Preset name cannot be empty." };
    }

    const trimmedText = presetText ? presetText.trim() : "";

    // A merged cache may name the entry being edited through its library
    // qualifier; the library's own file only knows the plain key.
    const existingKey = PresetLogic.splitQualifiedKey(editingKey).key;

    let finalImage = presets[existingKey]?.filename || undefined;
    if (clearImage) {
      finalImage = undefined;
    } else if (imageData) {
      finalImage = await PresetDOM.createThumbnail(imageData);
    }

    if (!trimmedText && !finalImage) {
      console.error("[PresetGalleryAPI] Cannot save preset with empty content.");
      return { success: false, error: "Preset content or image cannot be empty." };
    }

    const newKey = cleanFolder ? `${cleanFolder}/${cleanName}` : cleanName;

    if (mode === "edit" && existingKey && existingKey !== newKey) {
      delete presets[existingKey];
    }

    presets[newKey] = {
      ...(presets[newKey] || {}),
      preset: trimmedText,
      filename: finalImage,
    };
    await PresetGalleryAPI.savePresets(presets, target);
    return { success: true, key: newKey };
  }

  /**
   * @param {string} uniqueKey a cache key, optionally library-qualified
   * @param {string | null} [libraryId] the library to delete from
   */
  static async deletePreset(uniqueKey, libraryId = PresetGalleryAPI.activeLibraryId) {
    const presets = await PresetGalleryAPI.getPresets(libraryId);
    delete presets[PresetLogic.splitQualifiedKey(uniqueKey).key];
    await PresetGalleryAPI.savePresets(presets, libraryId);
    return { success: true };
  }

  /**
   * @param {string} oldFolder
   * @param {string} newFolder
   * @param {string | null} [libraryId] the library the folder lives in
   */
  static async renameFolder(oldFolder, newFolder, libraryId = PresetGalleryAPI.activeLibraryId) {
    const presets = await PresetGalleryAPI.getPresets(libraryId);
    /** @type {PresetCache} */
    const newPresets = {};
    const prefix = `${oldFolder}/`;

    for (const key in presets) {
      if (key.startsWith(prefix) || key === oldFolder) {
        const suffix = key.startsWith(prefix) ? key.slice(prefix.length) : "";
        const newKey = suffix ? `${newFolder}/${suffix}` : newFolder;
        const item = presets[key];
        newPresets[newKey] = item;
      } else {
        newPresets[key] = presets[key];
      }
    }
    await PresetGalleryAPI.savePresets(newPresets, libraryId);
    return { success: true };
  }
}
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
   * The preset routes for one library.
   *
   * The id is always named: the route treats `?library=main` and no query the
   * same, so there is no reason for a call to depend on which form it gets, and
   * an explicit id is what a reader can follow.
   * @param {string} [libraryId] the bundled library when omitted
   * @returns {string}
   */
  static libraryUrl(libraryId = PresetGalleryAPI.DEFAULT_LIBRARY_ID) {
    return `${PresetGalleryAPI.API_ENDPOINT}?library=${encodeURIComponent(libraryId)}`;
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
   * @param {string} libraryId
   * @returns {Promise<PresetCache>}
   */
  static async fetchGallery(libraryId = PresetGalleryAPI.DEFAULT_LIBRARY_ID) {
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
   * @param {string} [libraryId]
   * @returns {Promise<PresetCache>}
   */
  static async getPresets(libraryId = PresetGalleryAPI.DEFAULT_LIBRARY_ID) {
    return await PresetGalleryAPI.fetchGallery(libraryId);
  }

  /**
   * @param {PresetCache} presets
   * @param {string} [libraryId]
   */
  static async savePresets(presets, libraryId = PresetGalleryAPI.DEFAULT_LIBRARY_ID) {
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
   * @param {string} [libraryId] the library the group lives in
   */
  static async setGroupColor(groupRaw, color, libraryId = PresetGalleryAPI.DEFAULT_LIBRARY_ID) {
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
   * Remove a whole library from disk. The route only accepts an empty one, so
   * this is safe to call on a library that just had its last preset moved out.
   * @param {string} [libraryId] the bundled library when omitted
   */
  static async removeLibrary(libraryId = PresetGalleryAPI.DEFAULT_LIBRARY_ID) {
    if (!libraryId || libraryId === PresetGalleryAPI.DEFAULT_LIBRARY_ID) return false;
    try {
      const res = await fetch(PresetGalleryAPI.libraryUrl(libraryId), { method: "DELETE" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return true;
    } catch (error) {
      console.error("[PresetGalleryAPI] Error removing library:", error);
      return false;
    }
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
   * @property {string} [libraryId] the library to write to
   * @property {string} [sourceLibraryId] the library the entry is being
   *   moved from, when that is not the target
   */

  /** @param {SavePresetData} data */
  static async savePreset({ name, folder, presetText, imageData, clearImage, editingKey, mode, libraryId, sourceLibraryId }) {
    const presets = await PresetGalleryAPI.getPresets(libraryId);

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
    await PresetGalleryAPI.savePresets(presets, libraryId);

    // a move: the entry is leaving the library it was edited from
    if (mode === "edit" && sourceLibraryId && sourceLibraryId !== libraryId) {
      const source = await PresetGalleryAPI.getPresets(sourceLibraryId);
      delete source[existingKey];
      await PresetGalleryAPI.savePresets(source, sourceLibraryId);
    }

    return { success: true, key: newKey };
  }

  /**
   * @param {string} uniqueKey a cache key, optionally library-qualified
   * @param {string} [libraryId] the library to delete from
   */
  static async deletePreset(uniqueKey, libraryId = PresetGalleryAPI.DEFAULT_LIBRARY_ID) {
    const presets = await PresetGalleryAPI.getPresets(libraryId);
    delete presets[PresetLogic.splitQualifiedKey(uniqueKey).key];
    await PresetGalleryAPI.savePresets(presets, libraryId);
    return { success: true };
  }

  /**
   * Move a whole folder into another library.
   *
   * The editor's folder field and the rename prompt both accept `library#path`;
   * naming a library there moves the folder into it instead of renaming it in
   * place. The source library is left without the folder, and the target keeps
   * whatever it already had under the new name.
   *
   * @param {string} oldFolder
   * @param {string} newFolder
   * @param {string} [targetLibraryId]
   * @param {string} [sourceLibraryId]
   */
  static async moveFolder(oldFolder, newFolder, targetLibraryId, sourceLibraryId) {
    const target = targetLibraryId ?? PresetGalleryAPI.DEFAULT_LIBRARY_ID;
    const sourceId = sourceLibraryId ?? target;
    const source = await PresetGalleryAPI.getPresets(sourceId);

    /** @type {PresetCache} */
    const moved = {};
    /** @type {PresetCache} */
    const kept = {};
    const prefix = `${oldFolder}/`;

    for (const [key, item] of Object.entries(source)) {
      if (key === oldFolder) moved[newFolder] = item;
      else if (key.startsWith(prefix)) {
        moved[`${newFolder}/${key.slice(prefix.length)}`] = item;
      } else {
        kept[key] = item;
      }
    }

    if (Object.keys(moved).length === 0) {
      return { success: false, error: "No such folder" };
    }

    const targetPresets = await PresetGalleryAPI.getPresets(target);
    // renaming in place has to drop the old keys; moving only adds to the target
    await PresetGalleryAPI.savePresets(
      sourceId === target ? { ...kept, ...moved } : { ...targetPresets, ...moved },
      target
    );
    if (sourceId !== target) {
      await PresetGalleryAPI.savePresets(kept, sourceId);
    }
    return { success: true };
  }

  /**
   * @param {string} oldFolder
   * @param {string} newFolder
   * @param {string} [libraryId] the library the folder lives in
   */
  static async renameFolder(oldFolder, newFolder, libraryId = PresetGalleryAPI.DEFAULT_LIBRARY_ID) {
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
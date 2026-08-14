import PresetDOM from "./PresetDOM.js";

export default class PresetGalleryAPI {
  static API_ENDPOINT = "/preset_gallery/presets";

  static async fetchGallery() {
    try {
      const res = await fetch(PresetGalleryAPI.API_ENDPOINT);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const serverPresets = await res.json();
      return serverPresets;
    } catch (error) {
      console.error("[PresetGalleryAPI] Error fetching gallery:", error);
      return {};
    }
  }

  static async getPresets() {
    return await PresetGalleryAPI.fetchGallery();
  }

  static async savePresets(presets) {
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
      const res = await fetch(PresetGalleryAPI.API_ENDPOINT, {
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

  static async setGroupColor(groupRaw, color) {
    const presets = await PresetGalleryAPI.getPresets();
    if (color) {
      presets[groupRaw] = { ...(presets[groupRaw] || {}), __color__: color };
    } else if (presets[groupRaw]) {
      delete presets[groupRaw].__color__;
    }
    await PresetGalleryAPI.savePresets(presets);
    return { success: true };
  }

  static async savePreset({ name, folder, presetText, imageData, clearImage, editingKey, mode }) {
    const presets = await PresetGalleryAPI.getPresets();

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

    let finalImage = presets[editingKey]?.filename || undefined;
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

    if (mode === "edit" && editingKey && editingKey !== newKey) {
      delete presets[editingKey];
    }

    presets[newKey] = {
      ...(presets[newKey] || {}),
      preset: trimmedText,
      filename: finalImage,
    };
    await PresetGalleryAPI.savePresets(presets);
    return { success: true, key: newKey };
  }

  static async deletePreset(uniqueKey) {
    const presets = await PresetGalleryAPI.getPresets();
    delete presets[uniqueKey];
    await PresetGalleryAPI.savePresets(presets);
    return { success: true };
  }

  static async renameFolder(oldFolder, newFolder) {
    const presets = await PresetGalleryAPI.getPresets();
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
    await PresetGalleryAPI.savePresets(newPresets);
    return { success: true };
  }
}
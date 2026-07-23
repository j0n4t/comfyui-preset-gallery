import { app } from "../../../scripts/app.js";

const MIN_NODE_HEIGHT = 640;
const MIN_NODE_WIDTH = 400;

const loadJSZip = async () => {
  if (window.JSZip) return window.JSZip;
  if (globalThis.JSZip) return globalThis.JSZip;
  return new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = "https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js";
    script.onload = () => resolve(window.JSZip || globalThis.JSZip);
    script.onerror = () => reject(new Error("Failed to load JSZip library"));
    document.head.appendChild(script);
  });
};

const parseDataURL = (dataUrl) => {
  if (!dataUrl || !dataUrl.startsWith("data:")) return null;
  const matches = dataUrl.match(/^data:image\/(png|jpeg|jpg|webp|gif);base64,(.+)$/i);
  if (!matches) return null;
  let ext = matches[1].toLowerCase();
  if (ext === "jpeg") ext = "jpg";
  return { ext, base64: matches[2] };
};

const getMimeType = (ext) => {
  const e = ext.toLowerCase();
  if (e === "jpg" || e === "jpeg") return "image/jpeg";
  if (e === "png") return "image/png";
  if (e === "webp") return "image/webp";
  if (e === "gif") return "image/gif";
  return "image/png";
};

const fileToDataURL = (file) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });

/**
 * Creates a thumbnail version of an image to save localStorage space
 * @param {string} dataUrl - The original image as a data URL
 * @returns {Promise<string>} - Thumbnail image as a data URL
 */
const createThumbnail = async (dataUrl) => {
  if (!dataUrl || !dataUrl.startsWith("data:image/")) return dataUrl;

  try {
    const img = new Image();
    img.src = dataUrl;

    // Wait for image to load
    await new Promise((resolve, reject) => {
      img.onload = resolve;
      img.onerror = reject;
    });

    // Create canvas for thumbnail
    const canvas = document.createElement("canvas");
    const MAX_DIMENSION = 200; // Max width or height for thumbnail

    // Calculate dimensions maintaining aspect ratio
    let width = img.width;
    let height = img.height;

    if (width > height) {
      if (width > MAX_DIMENSION) {
        height = Math.round((height * MAX_DIMENSION) / width);
        width = MAX_DIMENSION;
      }
    } else {
      if (height > MAX_DIMENSION) {
        width = Math.round((width * MAX_DIMENSION) / height);
        height = MAX_DIMENSION;
      }
    }

    canvas.width = width;
    canvas.height = height;

    // Draw image onto canvas
    const ctx = canvas.getContext("2d");
    ctx.drawImage(img, 0, 0, width, height);

    // Convert to JPEG with reasonable quality to save space
    // Try to preserve original format if it was JPEG/PNG, but use JPEG for smaller size
    let mimeType = "image/jpeg";
    let quality = 0.7; // Good balance of quality and size

    // If original was PNG and has transparency, we might want to preserve it
    // But for simplicity and space savings, we'll convert to JPEG
    // In future, we could check if PNG with alpha is needed

    return canvas.toDataURL(mimeType, quality);
  } catch (error) {
    console.error("Error creating thumbnail:", error);
    // Return original if thumbnail creation fails
    return dataUrl;
  }
};

const YAMLUtils = {
  stringify(obj, indent = 0) {
    let yaml = "";
    const spaces = " ".repeat(indent);
    for (const [key, value] of Object.entries(obj)) {
      if (value !== null && typeof value === "object" && !Array.isArray(value)) {
        yaml += `${spaces}${key}:\n${YAMLUtils.stringify(value, indent + 2)}`;
      } else {
        const strVal = String(value ?? "");
        if (strVal.includes("\n") || strVal.includes(":") || strVal.includes("#") || strVal.startsWith(" ") || strVal === "") {
          yaml += `${spaces}${key}: "${strVal.replace(/"/g, '\\"')}"\n`;
        } else {
          yaml += `${spaces}${key}: ${strVal}\n`;
        }
      }
    }
    return yaml;
  },
  parse(yamlStr) {
    const lines = yamlStr.split(/\r?\n/);
    const result = {};
    const stack = [{ indent: -1, obj: result }];

    for (let line of lines) {
      const commentIdx = line.indexOf(" #");
      if (commentIdx !== -1) line = line.slice(0, commentIdx);
      if (!line.trim()) continue;

      const indent = line.search(/\S/);
      const trimmed = line.trim();
      const colonIdx = trimmed.indexOf(":");
      if (colonIdx === -1) continue;

      const key = trimmed.slice(0, colonIdx).trim().replace(/^['"]|['"]$/g, "");
      const valStr = trimmed.slice(colonIdx + 1).trim();

      while (stack.length > 1 && stack[stack.length - 1].indent >= indent) {
        stack.pop();
      }

      const currentParent = stack[stack.length - 1].obj;

      if (valStr === "" || valStr === "null") {
        const newObj = {};
        currentParent[key] = newObj;
        stack.push({ indent, obj: newObj });
      } else {
        let cleanVal = valStr;
        if ((cleanVal.startsWith('"') && cleanVal.endsWith('"')) || (cleanVal.startsWith("'") && cleanVal.endsWith("'"))) {
          cleanVal = cleanVal.slice(1, -1).replace(/\\"/g, '"');
        }
        currentParent[key] = cleanVal;
      }
    }
    return result;
  },
};

const NestedPoolUtils = {
  flatToNested(pool, presetOnly = true) {
    const root = {};
    for (const [key, item] of Object.entries(pool)) {
      const parts = key.split("/");
      let curr = root;
      for (let i = 0; i < parts.length - 1; i++) {
        const part = parts[i];
        if (!curr[part] || typeof curr[part] !== "object") {
          curr[part] = {};
        }
        curr = curr[part];
      }
      const lastPart = parts[parts.length - 1];
      if (presetOnly) {
        curr[lastPart] = typeof item === "string" ? item : item.preset || "";
      } else {
        curr[lastPart] = item;
      }
    }
    return root;
  },
  nestedToFlat(obj, prefix = "") {
    let flat = {};
    for (const [key, val] of Object.entries(obj)) {
      const fullKey = prefix ? `${prefix}/${key}` : key;
      if (val !== null && typeof val === "object" && !("preset" in val)) {
        Object.assign(flat, NestedPoolUtils.nestedToFlat(val, fullKey));
      } else {
        const tags = fullKey.includes("/") ? fullKey.split("/").slice(0, -1) : [];
        if (typeof val === "string") {
          flat[fullKey] = {
            preset: val,
            tags: tags,
            filename: null,
          };
        } else if (typeof val === "object" && val !== null) {
          flat[fullKey] = {
            preset: val.preset || "",
            tags: val.tags || tags,
            filename: val.filename || null,
          };
        }
      }
    }
    return flat;
  },
};

const PresetUtils = {
  escapeHTML: (str) => {
    if (str == null) return "";
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  },
  toTitleCase: (str) =>
    str
      .replace(/_/g, " ")
      .replace(/-/g, " ")
      .replace(/\b\w/g, (l) => l.toUpperCase()),
  getHashColor: (str) => {
    let hash = 0;
    for (let i = 0; i < 6; i++) hash = Math.imul(hash ^ str.charCodeAt(i), 15485863);
    hash = (hash ^ (hash >>> 16)) * 0x85ebca6b;
    hash = (hash ^ (hash >>> 13)) * 0xc2b2ae35;
    const hue = Math.abs((hash ^ (hash >>> 15)) % 360);
    return `hsl(${hue}, 65%, 35%)`;
  },
  hslToHex: (h, s, l) => {
    l /= 100;
    const a = (s * Math.min(l, 1 - l)) / 100;
    const f = (n) => {
      const k = (n + h / 30) % 12;
      const color = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
      return Math.round(255 * color).toString(16).padStart(2, "0");
    };
    return `#${f(0)}${f(8)}${f(4)}`;
  },
  getGroupColor: (groupRaw) => {
    try {
      const customColors = JSON.parse(localStorage.getItem("pg_group_colors") || "{}");
      if (customColors[groupRaw]) return customColors[groupRaw];
    } catch (e) { }
    return PresetUtils.getHashColor(groupRaw);
  },
  getGroupHexColor: (groupRaw) => {
    const color = PresetUtils.getGroupColor(groupRaw);
    if (color.startsWith("#")) return color;
    const hslMatch = color.match(/hsl\(\s*(\d+(?:\.\d+)?)\s*,\s*(\d+(?:\.\d+)?)%\s*,\s*(\d+(?:\.\d+)?)%\s*\)/i);
    if (hslMatch) {
      return PresetUtils.hslToHex(parseFloat(hslMatch[1]), parseFloat(hslMatch[2]), parseFloat(hslMatch[3]));
    }
    return "#007acc";
  },
  setGroupColor: (groupRaw, color) => {
    try {
      const customColors = JSON.parse(localStorage.getItem("pg_group_colors") || "{}");
      if (color) customColors[groupRaw] = color;
      else delete customColors[groupRaw];
      localStorage.setItem("pg_group_colors", JSON.stringify(customColors));
    } catch (e) { }
  },
  getPresetBaseFolder: (key) => (key.includes("/") ? key.split("/")[0] : key),
  getPresetColor: (key) => PresetUtils.getGroupColor(PresetUtils.getPresetBaseFolder(key)),
  getPresetName: (key) => key.split("/").pop(),
  getPresetTitle: (key, cache) =>
    PresetUtils.escapeHTML(
      `${PresetUtils.toTitleCase(PresetUtils.getPresetName(key))} [${key}]\n${cache[key]?.preset || ""}`
    ),
  getPresetInitials: (key) => {
    const raw = key.includes("/") ? PresetUtils.getPresetName(key) : key;
    return PresetUtils.toTitleCase(raw)
      .split(/\s+/)
      .map((w) => w.slice(0, 2))
      .join("")
      .substring(0, 6);
  },
  getSearchBlob: (key, item) =>
    `${PresetUtils.getPresetName(key)} ${key} ${PresetUtils.getPresetInitials(key)} ${item.preset || ""} ${(item.tags || []).join(" ")}`.toLowerCase(),
  getTopMatches: (list, query, getSearchBlob = (i) => i) => {
    const queryWords = query.toLowerCase().trim().split(/\s+/).filter(Boolean);
    if (!queryWords.length) return [];
    const buckets = list.reduce(
      (acc, item) => {
        const blob = getSearchBlob(item).toLowerCase();
        if (!queryWords.every((word) => blob.includes(word))) return acc;
        let idx = blob.indexOf(queryWords.join(" "));
        if (idx === -1) idx = blob.indexOf(queryWords[0]);
        if (idx === 0) {
          if (acc.startsWith.length < 3) acc.startsWith.push({ item, idx });
        } else {
          if (acc.fuzzy.length < 3) acc.fuzzy.push({ item, idx });
        }
        return acc;
      },
      { startsWith: [], fuzzy: [] }
    );

    const sortBucket = (arr) =>
      arr
        .sort((a, b) => (a.idx !== b.idx ? a.idx - b.idx : a.item.localeCompare(b.item)))
        .map((entry) => entry.item);

    return Array.from(new Set([...sortBucket(buckets.startsWith), ...sortBucket(buckets.fuzzy)]));
  },
  icons: {
    add: `<svg viewBox="0 0 24 24"><path fill="currentColor" d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/></svg>`,
    close: `<svg viewBox="0 0 24 24"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg>`,
    edit: `<svg viewBox="0 0 24 24"><path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/></svg>`,
    file: `<svg class="j0n4t-pg-icon" viewBox="0 0 24 24" style="opacity: 0.25; color: #fff; width: 32px; height: 32px;"><path fill="currentColor" d="M14 2H6c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 1.99 2H18c1.1 0 2-.9 2-2V8l-6-6zm2 16H8v-2h8v2zm0-4H8v-2h8v2zm-3-5V3.5L18.5 9H13z"/></svg>`,
    list: `<svg viewBox="0 0 16 16"><rect x="1" y="2" width="3" height="2"/><rect x="6" y="2" width="9" height="2"/><rect x="1" y="7" width="3" height="2"/><rect x="6" y="7" width="9" height="2"/><rect x="1" y="12" width="3" height="2"/><rect x="6" y="12" width="9" height="2"/></svg>`,
    small: `<svg viewBox="0 0 16 16"><rect x="1" y="1" width="3" height="3"/><rect x="6" y="1" width="3" height="3"/><rect x="11" y="1" width="3" height="3"/><rect x="1" y="6" width="3" height="3"/><rect x="6" y="6" width="3" height="3"/><rect x="11" y="6" width="3" height="3"/><rect x="1" y="11" width="3" height="3"/><rect x="6" y="11" width="3" height="3"/><rect x="11" y="11" width="3" height="3"/></svg>`,
    big: `<svg viewBox="0 0 16 16"><rect x="1" y="1" width="6" height="6"/><rect x="9" y="1" width="6" height="6"/><rect x="1" y="9" width="6" height="6"/><rect x="9" y="9" width="6" height="6"/></svg>`,
    eye: `<svg viewBox="0 0 24 24"><path d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z"/></svg>`,
    export: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path fill="currentColor" d="M6 20q-.825 0-1.412-.587T4 18v-2q0-.425.288-.712T5 15t.713.288T6 16v2h12v-2q0-.425.288-.712T19 15t.713.288T20 16v2q0 .825-.587 1.413T18 20zm5-12.15L9.125 9.725q-.3.3-.712.288T7.7 9.7q-.275-.3-.288-.7t.288-.7l3.6-3.6q.15-.15.325-.212T12 4.425t.375.063t.325.212l3.6 3.6q.3.3.288.7t-.288.7q-.3.3-.712.313t-.713-.288L13 7.85V15q0 .425-.288.713T12 16t-.712-.288T11 15z" /></svg>`,
    import: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path fill="currentColor" d="M11.625 15.513q-.175-.063-.325-.213l-3.6-3.6q-.3-.3-.288-.7t.288-.7q.3-.3.713-.312t.712.287L11 12.15V5q0-.425.288-.712T12 4t.713.288T13 5v7.15l1.875-1.875q.3-.3.713-.288t.712.313q.275.3.288.7t-.288.7l-3.6 3.6q-.15.15-.325.213t-.375.062t-.375-.062M6 20q-.825 0-1.412-.587T4 18v-2q0-.425.288-.712T5 15t.713.288T6 16v2h12v-2q0-.425.288-.712T19 15t.713.288T20 16v2q0 .825-.587 1.413T18 20z" /></svg>`,
  },
};

/**
 * LocalStorage Persistence Manager
 */
class PresetGalleryAPI {
  static STORAGE_KEY = "comfy_preset_gallery_pool";

  static getPool() {
    try {
      return JSON.parse(localStorage.getItem(PresetGalleryAPI.STORAGE_KEY) || "{}");
    } catch (e) {
      return {};
    }
  }

  static savePool(pool) {
    localStorage.setItem(PresetGalleryAPI.STORAGE_KEY, JSON.stringify(pool));
  }

  static async fetchGallery() {
    return PresetGalleryAPI.getPool();
  }

  static async savePreset({ name, folder, presetText, imageData, clearImage, editingKey, mode }) {
    const pool = PresetGalleryAPI.getPool();
    const cleanFolder = folder ? folder.trim().toLowerCase().replace(/ /g, "_") : "";
    const cleanName = name.trim().toLowerCase().replace(/ /g, "_");
    const newKey = cleanFolder ? `${cleanFolder}/${cleanName}` : cleanName;
    const tags = cleanFolder ? cleanFolder.split("/") : [];

    if (mode === "edit" && editingKey && editingKey !== newKey) {
      delete pool[editingKey];
    }

    let finalImage = pool[newKey]?.filename || null;
    if (clearImage) {
      finalImage = null;
    } else if (imageData) {
      // Create a thumbnail to save localStorage space
      finalImage = await createThumbnail(imageData);
    }

    pool[newKey] = {
      preset: presetText,
      tags: tags,
      filename: finalImage,
    };

    PresetGalleryAPI.savePool(pool);
    return { success: true, key: newKey };
  }

  static async deletePreset(uniqueKey) {
    const pool = PresetGalleryAPI.getPool();
    delete pool[uniqueKey];
    PresetGalleryAPI.savePool(pool);
    return { success: true };
  }

  static async renameFolder(oldFolder, newFolder) {
    const pool = PresetGalleryAPI.getPool();
    const newPool = {};
    const prefix = `${oldFolder}/`;

    for (const key in pool) {
      if (key.startsWith(prefix) || key === oldFolder) {
        const suffix = key.startsWith(prefix) ? key.slice(prefix.length) : "";
        const newKey = suffix ? `${newFolder}/${suffix}` : newFolder;
        const item = pool[key];
        item.tags = newKey.includes("/") ? newKey.split("/").slice(0, -1) : [];
        newPool[newKey] = item;
      } else {
        newPool[key] = pool[key];
      }
    }

    PresetGalleryAPI.savePool(newPool);
    return { success: true };
  }

  static showExportModal(onExport) {
    const overlay = document.createElement("div");
    overlay.className = "j0n4t-pg-modal-overlay";
    overlay.innerHTML = `
      <div class="j0n4t-pg-modal">
        <h3>📦 Export Presets</h3>
        <div class="j0n4t-pg-modal-field">
          <label>File Format</label>
          <select id="j0n4t-pg-exp-format">
          <option value="yaml">YAML (.yaml)</option>
          <option value="json">JSON (.json)</option>
          <option value="zip">ZIP Archive (.zip)</option>
          </select>
        </div>
        <div class="j0n4t-pg-modal-field">
          <label>Data Content</label>
          <select id="j0n4t-pg-exp-mode">
            <option value="preset-only">Nested Presets Only (Clean)</option>
            <option value="full">Full Pool Data (With Images)</option>
          </select>
        </div>
        <div class="j0n4t-pg-modal-actions">
          <button type="button" class="j0n4t-pg-btn" id="j0n4t-pg-exp-cancel" style="background:#444;">Cancel</button>
          <button type="button" class="j0n4t-pg-btn" id="j0n4t-pg-exp-confirm" style="background:#007acc;">Export File</button>
        </div>
      </div>
    `;

    const close = () => overlay.remove();
    overlay.querySelector("#j0n4t-pg-exp-cancel").addEventListener("click", close);
    overlay.addEventListener("click", (e) => {
      if (e.target === overlay) close();
    });

    overlay.querySelector("#j0n4t-pg-exp-confirm").addEventListener("click", () => {
      const format = overlay.querySelector("#j0n4t-pg-exp-format").value;
      const mode = overlay.querySelector("#j0n4t-pg-exp-mode").value;
      close();
      onExport(format, mode);
    });

    document.body.appendChild(overlay);
  }

  static async exportPool(format = "zip", mode = "full") {
    const pool = PresetGalleryAPI.getPool();

    if (format === "zip") {
      try {
        const JSZip = await loadJSZip();
        const zip = new JSZip();

        for (const [key, item] of Object.entries(pool)) {
          zip.file(`${key}.txt`, item.preset || "");

          if (mode !== "preset-only" && item.filename) {
            const parsed = parseDataURL(item.filename);
            if (parsed) {
              zip.file(`${key}.${parsed.ext}`, parsed.base64, { base64: true });
            }
          }
        }

        const blob = await zip.generateAsync({ type: "blob" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `presets_pool_${mode}.zip`;
        a.click();
        URL.revokeObjectURL(url);
      } catch (err) {
        alert("ZIP export failed: " + err.message);
      }
      return;
    }

    let dataStr = "";
    let mimeType = "text/yaml";
    let ext = "yaml";

    if (mode === "preset-only") {
      const nested = NestedPoolUtils.flatToNested(pool, true);
      if (format === "yaml") {
        dataStr = YAMLUtils.stringify(nested);
        mimeType = "text/yaml";
        ext = "yaml";
      } else {
        dataStr = JSON.stringify(nested, null, 2);
        mimeType = "application/json";
        ext = "json";
      }
    } else {
      const exportData = {};
      for (const [key, item] of Object.entries(pool)) {
        exportData[key] = {
          preset: item.preset,
          tags: item.tags || [],
          filename: item.filename || null,
        };
      }
      if (format === "yaml") {
        const nestedFull = NestedPoolUtils.flatToNested(exportData, false);
        dataStr = YAMLUtils.stringify(nestedFull);
        mimeType = "text/yaml";
        ext = "yaml";
      } else {
        dataStr = JSON.stringify(exportData, null, 2);
        mimeType = "application/json";
        ext = "json";
      }
    }

    const blob = new Blob([dataStr], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `presets_pool_${mode}.${ext}`;
    a.click();
    URL.revokeObjectURL(url);
  }

  static async importFile(file) {
    if (file.name.toLowerCase().endsWith(".zip")) {
      try {
        const JSZip = await loadJSZip();
        const zip = await JSZip.loadAsync(file);
        const importedPool = {};

        const txtFiles = {};
        const imgFiles = {};

        for (const [relativePath, zipEntry] of Object.entries(zip.files)) {
          if (zipEntry.dir) continue;

          const normalizedPath = relativePath.replace(/\\/g, "/").replace(/^[\/\\]+/, "");
          const lastDot = normalizedPath.lastIndexOf(".");
          if (lastDot === -1) continue;

          const ext = normalizedPath.slice(lastDot + 1).toLowerCase();
          const keyPath = normalizedPath.slice(0, lastDot);

          if (ext === "txt") {
            txtFiles[keyPath] = zipEntry;
          } else if (["png", "jpg", "jpeg", "webp", "gif"].includes(ext)) {
            imgFiles[keyPath] = { entry: zipEntry, ext };
          }
        }

        for (const [key, txtEntry] of Object.entries(txtFiles)) {
          const presetText = await txtEntry.async("string");
          let filename = null;

          if (imgFiles[key]) {
            const { entry, ext } = imgFiles[key];
            const base64 = await entry.async("base64");
            const mime = getMimeType(ext);
            const dataUrl = `data:${mime};base64,${base64}`;
            // Create a thumbnail to save localStorage space
            filename = await createThumbnail(dataUrl);
          }

          const cleanKey = key.toLowerCase().replace(/ /g, "_");
          const tags = cleanKey.includes("/") ? cleanKey.split("/").slice(0, -1) : [];

          importedPool[cleanKey] = {
            preset: presetText,
            tags: tags,
            filename: filename,
          };
        }

        const currentPool = PresetGalleryAPI.getPool();
        const merged = { ...currentPool, ...importedPool };
        PresetGalleryAPI.savePool(merged);
        return { success: true };
      } catch (err) {
        alert("Failed to parse ZIP file: " + err.message);
        return { success: false };
      }
    }

    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = async (e) => {
        try {
          const text = e.target.result;
          let parsedData = null;

          if (file.name.endsWith(".yaml") || file.name.endsWith(".yml")) {
            parsedData = YAMLUtils.parse(text);
          } else {
            try {
              parsedData = JSON.parse(text);
            } catch (err) {
              parsedData = YAMLUtils.parse(text);
            }
          }

          if (typeof parsedData !== "object" || parsedData === null) {
            throw new Error("Invalid file structure");
          }

          const flattenedImport = NestedPoolUtils.nestedToFlat(parsedData);
          const currentPool = PresetGalleryAPI.getPool();
          const merged = { ...currentPool, ...flattenedImport };

          // Process imported images to create thumbnails for localStorage efficiency
          for (const [key, item] of Object.entries(merged)) {
            if (item && item.filename && item.filename.startsWith("data:image/")) {
              // Create a thumbnail for each image to save localStorage space
              item.filename = await createThumbnail(item.filename);
            }
          }

          PresetGalleryAPI.savePool(merged);
          resolve({ success: true });
        } catch (err) {
          alert("Failed to parse file: " + err.message);
          resolve({ success: false });
        }
      };
      reader.readAsText(file);
    });
  }
}

class AutocompleteManager {
  constructor({
    input,
    container,
    popupClass = "j0n4t-pg-autocomplete-popup",
    itemClass = "j0n4t-pg-autocomplete-item",
    getMatches,
    renderItem,
    onSelect,
    onKeyDown,
    onBlur,
  }) {
    this.input = input;
    this.container = container || document.body;
    this.popupClass = popupClass;
    this.itemClass = itemClass;
    this.getMatches = getMatches;
    this.renderItem = renderItem;
    this.onSelect = onSelect;
    this.onKeyDown = onKeyDown;
    this.onBlur = onBlur;

    this.popupEl = null;
    this.matches = [];
    this.activeIndex = 0;

    this.initEvents();
  }

  get isOpen() {
    return !!this.popupEl;
  }

  initEvents() {
    this.input.addEventListener("input", () => this.evaluate());
    this.input.addEventListener("click", () => this.close());
    this.input.addEventListener("blur", () => {
      if (this.onBlur) this.onBlur();
      setTimeout(() => this.close(), 200);
    });
    this.input.addEventListener("keydown", (e) => this.handleKeydown(e));
  }

  evaluate() {
    const query = this.input.value;
    const cursor = this.input.selectionStart;

    this.matches = this.getMatches(query, cursor) || [];

    if (!this.matches.length) {
      this.close();
      return;
    }

    this.activeIndex = 0;
    this.renderPopup();
  }

  renderPopup() {
    if (!this.popupEl) {
      this.popupEl = Object.assign(document.createElement("div"), {
        className: this.popupClass,
      });
      this.popupEl.addEventListener("mousedown", (e) => e.stopPropagation());
      this.container.appendChild(this.popupEl);
    }

    const rect = this.input.getBoundingClientRect();
    const cRect = this.container.getBoundingClientRect();
    const zoom = cRect.width / this.container.offsetWidth || 1;

    const isBody = this.container === document.body;
    const top = isBody
      ? window.scrollY + rect.bottom
      : (rect.bottom - cRect.top) / zoom;
    const left = isBody
      ? window.scrollX + rect.left
      : (rect.left - cRect.left) / zoom;

    this.popupEl.style.top = `${top + 2}px`;
    this.popupEl.style.left = `${left}px`;
    this.popupEl.style.minWidth = `${Math.max(200, rect.width / zoom)}px`;
    this.popupEl.innerHTML = "";

    this.matches.forEach((match, idx) => {
      const row = document.createElement("div");
      row.className = `${this.itemClass}${idx === this.activeIndex ? " active" : ""}`;
      row.innerHTML = this.renderItem(match);

      row.addEventListener("mousedown", (e) => {
        e.preventDefault();
        e.stopPropagation();
        this.onSelect(match, e);
        this.close();
      });
      this.popupEl.appendChild(row);
    });
  }

  highlight() {
    if (!this.popupEl) return;
    this.popupEl
      .querySelectorAll(`.${this.itemClass.split(" ")[0]}`)
      .forEach((item, i) => {
        item.classList.toggle("active", i === this.activeIndex);
      });
  }

  handleKeydown(e) {
    const activeMatch = this.matches[this.activeIndex];

    if (this.onKeyDown && this.onKeyDown(e, activeMatch)) {
      if (this.isOpen) this.close();
      return;
    }

    if (!this.isOpen || !this.matches.length) return;

    if (["Tab", "Enter"].includes(e.key) && !e.ctrlKey) {
      e.preventDefault();
      this.onSelect(activeMatch, e);
      this.close();
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      this.activeIndex = (this.activeIndex + 1) % this.matches.length;
      this.highlight();
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      this.activeIndex =
        (this.activeIndex - 1 + this.matches.length) % this.matches.length;
      this.highlight();
    } else if (e.key === "Escape") {
      e.preventDefault();
      e.stopPropagation();
      this.close();
    }
  }

  close() {
    this.popupEl?.remove();
    this.popupEl = null;
    this.matches = [];
  }
}

class PresetGalleryStyles {
  static inject() {
    if (document.getElementById("j0n4t-pg-global-styles")) return;
    const styles = document.createElement("style");
    styles.id = "j0n4t-pg-global-styles";
    styles.textContent = /*css*/ `
      .j0n4t-pg-wrap { display: flex; flex-direction: column; gap: 4px; padding: 0; border-radius: 4px; box-sizing: border-box; width: 100%; height: 100%; font-family: sans-serif; position: relative; }
      .j0n4t-pg-wrap.hide-gallery-mode .j0n4t-pg-grid, .j0n4t-pg-wrap.hide-gallery-mode .j0n4t-pg-views, .j0n4t-pg-wrap.hide-gallery-mode #j0n4t-pg-global-collapse, .j0n4t-pg-wrap.hide-gallery-mode .j0n4t-pg-checkbox-wrap:has(#j0n4t-pg-group-toggle) { display: none !important; }

      .j0n4t-pg-basket-container { display: flex; flex-direction: column; gap: 4px; background: #15151580; border: 1px dashed #777; border-radius: 4px; padding: 0; box-sizing: border-box; width: 100%; flex-shrink: 0; transition: border-color 0.2s, background-color 0.2s; position: relative; resize: vertical; overflow-y: auto; overflow-x: hidden; min-height: 40px; }
      .j0n4t-pg-basket-container.drag-over { border-color: #007acc; background: #1a242db0; }
      .j0n4t-pg-basket-header { display: flex; justify-content: space-between; align-items: center; padding: 4px; background: #222;  position: sticky; top: 0; z-index: 1; }
      .j0n4t-pg-basket-title { font-size: 9px; color: #aaa; text-transform: uppercase; letter-spacing: 0.5px; font-weight: bold; pointer-events: none; }
      .j0n4t-pg-basket-clear-btn:hover { background: #912e2e; }
      .j0n4t-pg-basket-pool { display: flex; flex-wrap: wrap; gap: 4px; min-height: 24px; align-items: center; padding: 4px; }
      .j0n4t-pg-raw-wrapper { position: relative; width: 100%; height: 100%; display: none; padding: 4px; box-sizing: border-box; }
      .j0n4t-pg-basket-container.raw-mode .j0n4t-pg-raw-wrapper { display: block !important; }
      .j0n4t-pg-basket-container.raw-mode .j0n4t-pg-basket-pool { display: none !important; }
      .j0n4t-pg-raw-highlights, .j0n4t-pg-basket-raw-textarea { width: 100%; height: 100%; min-height: 48px; font-family: monospace; font-size: 11px; padding: 4px; box-sizing: border-box; border-radius: 3px; margin: 0; white-space: pre-wrap; word-wrap: break-word; overflow-wrap: break-word; line-height: 1.4; border: 1px solid transparent; letter-spacing: normal; word-spacing: normal; text-transform: none; text-indent: 0px; text-shadow: none; }
      .j0n4t-pg-raw-highlights { position: absolute; top: 4px; left: 4px; right: 4px; bottom: 4px; pointer-events: none; color: transparent; overflow: hidden; background: transparent; z-index: 1; width: calc(100% - 8px); height: calc(100% - 8px); }
      .j0n4t-pg-basket-raw-textarea { display: block; background: transparent; border-color: #444; color: transparent; caret-color: #fff; resize: none; position: relative; z-index: 2; }
      .j0n4t-pg-raw-token { color: #569cd6; font-weight: bold; }
      .j0n4t-pg-raw-token.plain-text { color: #cccccc; font-weight: normal; }

      .j0n4t-pg-autocomplete-popup, .j0n4t-pg-filter-autocomplete-popup, .j0n4t-pg-chip-popup { position: absolute; background: #1f1f1fe8; border: 1px solid #007acc; border-radius: 4px; box-shadow: 0 4px 12px rgba(0,0,0,0.5); display: flex; overflow-y: auto; overflow-x: hidden; font-family: sans-serif; box-sizing: border-box; max-height: 250px; width: max-content; }
      .j0n4t-pg-autocomplete-popup, .j0n4t-pg-filter-autocomplete-popup { flex-direction: column; }
      .j0n4t-pg-chip-popup { z-index: 10002; padding: 2px; background: #1a1a1ff5; border-color: #007acc; flex-direction: row; gap: 2px; border-radius: 4px; }
      .j0n4t-pg-chip-popup-item { padding: 2px; font-size: 11px; color: #ddd; cursor: pointer; display: flex; align-items: center; justify-content: center; border-radius: 3px; transition: background 0.1s, color 0.1s; }
      .j0n4t-pg-chip-popup-item:hover { background: #007acc; color: #fff; }
      .j0n4t-pg-chip-popup-item.danger:hover { background: #b23b3b; color: #fff; }
      .j0n4t-pg-chip-popup-item svg { width: 14px; height: 14px; fill: currentColor; }
      .j0n4t-pg-basket-chip.active-menu, .j0n4t-pg-basket-chip:focus { border-color: #007acc; background: #1a2c3d; box-shadow: 0 0 6px rgba(0, 122, 204, 0.6); }
      .j0n4t-pg-autocomplete-popup { z-index: 9999; max-width: 280px; }
      .j0n4t-pg-filter-autocomplete-popup { z-index: 10001; }
      .j0n4t-pg-autocomplete-item, .j0n4t-pg-filter-autocomplete-item { padding: 6px 10px; font-size: 11px; color: #ddd; cursor: pointer; border-bottom: 1px solid #333; display: flex; justify-content: space-between; align-items: center; gap: 12px; }
      .j0n4t-pg-autocomplete-item:last-child, .j0n4t-pg-filter-autocomplete-item:last-child { border-bottom: none; }
      .j0n4t-pg-autocomplete-item.active, .j0n4t-pg-filter-autocomplete-item.active { background: #007acc; color: #fff; }
      .j0n4t-pg-autocomplete-meta, .j0n4t-pg-filter-autocomplete-meta { font-size: 9px; color: #888; font-style: italic; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; text-align: right; }
      .j0n4t-pg-autocomplete-item.active .j0n4t-pg-autocomplete-meta, .j0n4t-pg-filter-autocomplete-item.active .j0n4t-pg-filter-autocomplete-meta { color: #bee3ff; }

      .j0n4t-pg-basket-empty { font-size: 10px; color: #555; font-style: italic; pointer-events: none; }
      .j0n4t-pg-basket-drop-indicator { width: 2px; background-color: #007acc; box-shadow: 0 0 4px #007acc; border-radius: 1px; transition: transform 0.05s ease; pointer-events: none; }
      .j0n4t-pg-basket-chip { display: flex; align-items: center; background-size: cover; background-position: center; border: 1px solid #3d3d3d; border-radius: 3px; padding: 2px 4px; box-sizing: border-box; cursor: grab; user-select: none; transition: background 0.15s, border-color 0.15s; position: relative; overflow: hidden; min-height: 1.4em; }
      .j0n4t-pg-basket-chip::before { content: ""; position: absolute; inset: 0; background: rgba(0, 0, 0, 0.2); z-index: 0; pointer-events: none; }
      .j0n4t-pg-basket-chip:active { cursor: grabbing; }
      .j0n4t-pg-basket-chip.dragging { opacity: 0.4; border-color: #007acc; }
      .j0n4t-pg-basket-chip-label { font-size: 10px; color: #fff; white-space: nowrap; max-width: 90px; overflow: hidden; text-overflow: ellipsis; pointer-events: none; position: relative; z-index: 1; text-shadow: 0 1px 2px rgba(0,0,0,0.9), 0 0 4px rgba(0,0,0,0.8); font-weight: 600; }
      .j0n4t-pg-basket-chip.inline-editing { border-color: #d1a119; cursor: text; padding: 2px 4px; background-image: none !important; }
      .j0n4t-pg-basket-chip.inline-editing::before { display: none; }
      .j0n4t-pg-inline-edit { background: transparent; border: none; color: #fff; font-family: monospace; font-size: 11px; outline: none; width: 100%; min-width: 50px; padding: 0; margin: 0; }
      .j0n4t-pg-basket-add-btn { display: flex; align-items: center; justify-content: center; background: transparent; border: 1px dashed #777; border-radius: 3px; padding: 2px 8px; cursor: pointer; color: #aaa; font-size: 10px; font-weight: bold; transition: 0.15s; height: 22px; user-select: none; }
      .j0n4t-pg-basket-add-btn:hover { border-color: #007acc; color: #fff; background: #1a242db0; }
      .j0n4t-pg-lora-weight { width: 38px; height: 16px; background: #1a1a1a; border: 1px solid #444; color: #fff; font-size: 9px; border-radius: 2px; padding: 0 0 0 2px; text-align: center; margin: 0 2px; outline: none; }
      .j0n4t-pg-lora-weight:focus { border-color: #007acc; }

      .j0n4t-pg-action-btn { display: flex; align-items: center; justify-content: center; width: 14px; height: 14px; color: #aaa; border-radius: 2px; cursor: pointer; transition: 0.1s; margin-left: 1px; }
      .j0n4t-pg-action-btn:hover { background: #555; color: #fff; }
      .j0n4t-pg-action-btn.del-btn:hover { background: #b23b3b; color: #fff; }
      .j0n4t-pg-action-btn svg { width: 10px; height: 10px; fill: currentColor; }
      .j0n4t-pg-top-bar { display: flex; gap: 6px; align-items: center; width: 100%; flex-shrink: 0; }
      .j0n4t-pg-search-wrapper { position: relative; flex-grow: 1; display: flex; align-items: center; }
      .j0n4t-pg-search { width: 100%; padding: 6px 24px 6px 6px; background: #1a1a1ab0; border: 1px solid #444; border-radius: 4px; color: #fff; font-size: 11px; box-sizing: border-box; min-width: 0; }
      .j0n4t-pg-search-clear { position: absolute; right: 6px; width: 14px; height: 14px; color: #777; cursor: pointer; display: none; align-items: center; justify-content: center; border-radius: 2px; transition: color 0.1s, background-color 0.1s; }
      .j0n4t-pg-search-clear:hover { color: #fff; background: #b23b3b; }
      .j0n4t-pg-search-clear svg { width: 10px; height: 10px; fill: currentColor; }

      .j0n4t-pg-views, .j0n4t-pg-toggle-gallery-wrap { display: flex; gap: 2px; flex-shrink: 0; background: #1a1a1a80; padding: 2px; border-radius: 4px; border: 1px solid #444; }
      .j0n4t-pg-view-btn { display: flex; align-items: center; justify-content: center; width: 22px; height: 22px; border-radius: 3px; cursor: pointer; color: #aaa; background: transparent; transition: 0.15s; }
      .j0n4t-pg-view-btn:hover { background: #333; color: #fff; }
      .j0n4t-pg-view-btn.active { background: #007acc; color: #fff; }
      .j0n4t-pg-view-btn svg, .j0n4t-pg-btn svg { width: 14px; height: 14px; fill: currentColor; }
      .j0n4t-pg-grid { display: grid; gap: 6px; flex-grow: 1; overflow-y: auto; min-height: 60px; height: 50%; max-height: 100vh; align-content: start; margin-top: 2px; resize: vertical; }
      .j0n4t-pg-grid.view-small { grid-template-columns: repeat(auto-fill, minmax(55px, 1fr)); }
      .j0n4t-pg-grid.view-big { grid-template-columns: repeat(auto-fill, minmax(100px, 1fr)); }
      .j0n4t-pg-grid.view-list { grid-template-columns: repeat(auto-fill, minmax(100px, 1fr)); gap: 4px; }

      .j0n4t-pg-group-header { grid-column: 1 / -1; display: flex; align-items: center; gap: 4px; color: #bdbdbd; font-size: 10px; font-weight: bold; text-transform: uppercase; letter-spacing: 0.5px; user-select: none; cursor: pointer; padding: 4px 0; position: relative; }
      .j0n4t-pg-group-header::before { content: "▼"; font-size: 8px; color: #888; transition: transform 0.15s ease; }
      .j0n4t-pg-group-header.collapsed::before { transform: rotate(-90deg); }
      .j0n4t-pg-group-color-dot { width: 10px; height: 10px; border-radius: 50%; display: inline-block; flex-shrink: 0; cursor: pointer; border: 1px solid rgba(255,255,255,0.2); transition: transform 0.15s ease, box-shadow 0.15s ease; position: relative; }
      .j0n4t-pg-group-color-dot:hover { transform: scale(1.25); box-shadow: 0 0 4px rgba(255,255,255,0.4); }
      .j0n4t-pg-group-color-picker { position: absolute; opacity: 0; width: 100%; height: 100%; top: 0; left: 0; cursor: pointer; border: none; padding: 0; margin: 0; }
      .j0n4t-pg-group-line { flex-grow: 1; height: 1px; background: #bdbdbd40; margin-right: 8px; }
      .j0n4t-pg-group-header .j0n4t-pg-group-rename-tip { display:none }
      .j0n4t-pg-group-header:hover .j0n4t-pg-group-rename-tip { display:block; font-size: 8px; color: #666; font-weight: normal; text-transform: none; opacity: 0; transition: opacity 0.2s ease; pointer-events: none; padding-right: 4px; opacity: 1; }
      .j0n4t-pg-group-header[data-group-raw="root_presets"]:hover .j0n4t-pg-group-rename-tip { display: none; }
      .j0n4t-pg-grid.hide-folders .j0n4t-pg-group-header, .j0n4t-pg-grid.hide-folders .j0n4t-pg-global-collapse-btn { display: none !important; }

      .j0n4t-pg-item { cursor: pointer; text-align: center; border: 2px solid transparent; border-radius: 4px; padding: 4px; background: #1a1a1a80; transition: 0.1s; height: fit-content; box-sizing: border-box; user-select: none; position: relative; }
      .j0n4t-pg-item:hover { background: #2a2a2a; border-color: #444; }
      .j0n4t-pg-item.selected { border-color: #007acc; background: #252525; }
      .j0n4t-pg-item.editing { border-color: #d1a119 !important; background: #2b271d !important; }
      .j0n4t-pg-item.dragging { opacity: 0.4; }
      .j0n4t-pg-hidden { display: none !important; }

      .j0n4t-pg-thumb-box { width: 100%; height: 100px; border-radius: 2px; display: flex; align-items: center; justify-content: center; background: #111; color: #666; position: relative; overflow: hidden; pointer-events: none; }
      .j0n4t-pg-grid.view-small .j0n4t-pg-thumb-box { height: 50px; }
      .j0n4t-pg-img { width: 100%; height: 100%; object-fit: cover; }
      .j0n4t-pg-icon { width: 20px; height: 20px; fill: currentColor; }
      .j0n4t-pg-initials { position: absolute; font-size: 10px; font-weight: 900; color: #fff; text-shadow: 0px 1px 2px rgba(0,0,0,0.9), 0px 0px 4px rgba(0,0,0,0.7); text-transform: uppercase; bottom: 4px; z-index: 2; pointer-events: none; letter-spacing: 0.5px; }
      .j0n4t-pg-label { font-size: 10px; color: #ccc; margin-top: 4px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; pointer-events: none; }
      .j0n4t-pg-tag-badge { position: absolute; top: 6px; left: 6px; background: rgba(0,122,204,0.85); color: #fff; font-size: 7.5px; font-weight: bold; padding: 1px 4px; border-radius: 2px; text-transform: uppercase; pointer-events: none; max-width: 50px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; z-index: 3; }
      .j0n4t-pg-corner-edit { position: absolute; top: 6px; right: 6px; background: #2a2a2a; color: #bbb; border-radius: 3px; width: 18px; height: 18px; display: none; align-items: center; justify-content: center; z-index: 4; border: 1px solid #444; transition: 0.15s; cursor: pointer; }
      .j0n4t-pg-corner-edit:hover { background: #d1a119; color: #fff; border-color: #d1a119; }
      .j0n4t-pg-corner-edit svg { width: 11px; height: 11px; fill: currentColor; }
      .j0n4t-pg-item:hover .j0n4t-pg-corner-edit { display: flex; }

      .view-list .j0n4t-pg-item { display: flex; align-items: center; gap: 6px; text-align: left; padding: 2px 4px; }
      .view-list .j0n4t-pg-thumb-box { display: none !important; }
      .view-list .j0n4t-pg-label { margin-top: 0; font-size: 11px; flex-grow: 1; line-height: 1; }
      .view-list .j0n4t-pg-tag-badge { position: relative; top: auto; left: auto; background: var(--item-color, #444); color: #bbb; max-width: none; font-size: 8px; padding: 1px 3px; }
      .view-list .j0n4t-pg-corner-edit { position: relative; top: auto; right: auto; display: flex !important; margin-left: auto; flex-shrink: 0; width: 14px; height: 14px; }
      .view-list .j0n4t-pg-corner-edit svg { width: 9px; height: 9px; }

      .j0n4t-pg-grid.hide-folders .j0n4t-pg-tag-badge { display: block !important; }
      .j0n4t-pg-control-bar { display: flex; gap: 6px; align-items: center; margin-top: 2px; flex-shrink: 0; width: 100%; }
      .j0n4t-pg-toggle { flex-grow: 1; background: #333; border: 1px solid #444; color: #bbb; padding: 4px; border-radius: 3px; cursor: pointer; font-size: 10px; text-align: center; user-select: none; white-space: nowrap; }
      .j0n4t-pg-toggle:hover { background: #444; color: #fff; }
      .j0n4t-pg-checkbox-wrap { display: flex; align-items: center; gap: 4px; font-size: 10px; color: #aaa; user-select: none; cursor: pointer; padding: 3px 2px; height: 20px; box-sizing: border-box; white-space: nowrap; }
      .j0n4t-pg-checkbox-wrap input { width: auto; margin: 0; cursor: pointer; }

      .j0n4t-pg-editor { display: flex; flex-direction: column; gap: 6px; border-top: 1px solid #3d3d3d; padding-top: 8px; margin-top: 2px; box-sizing: border-box; flex-shrink: 0; }
      .j0n4t-pg-editor.collapsed { display: none !important; }
      .j0n4t-pg-editor-banner { font-size: 10px; font-weight: bold; padding: 4px 6px; border-radius: 3px; text-transform: uppercase; margin-bottom: 2px; letter-spacing: 0.5px; flex: 1; text-overflow: ellipsis; overflow: hidden; white-space: nowrap; }
      .j0n4t-pg-editor input, .j0n4t-pg-editor textarea { background: #1a1a1ab0; border: 1px solid #444; color: #fff; font-size: 11px; padding: 5px; border-radius: 3px; box-sizing: border-box; width: 100%; }
      .j0n4t-pg-editor textarea { resize: vertical; min-height: 48px; }
      .j0n4t-pg-row { display: flex; gap: 6px; align-items: center; }
      .j0n4t-pg-btn { display: inline-flex; align-items: center; justify-content: center; gap: 4px; background: #007acc; border: none; color: #fff; padding: 6px; border-radius: 3px; cursor: pointer; font-size: 11px; font-weight: bold; text-align: center; box-sizing: border-box; height: 24px; }
      .j0n4t-pg-btn:hover { background: #0062a3; }

      .j0n4t-pg-folder-autocomplete-popup { position: absolute; background: #1f1f1fe8; border: 1px solid #007acc; border-radius: 4px; box-shadow: 0 4px 12px rgba(0,0,0,0.5); z-index: 10000; display: flex; flex-direction: column; width: max-content; overflow: hidden; font-family: sans-serif; box-sizing: border-box; }
      .j0n4t-pg-folder-autocomplete-item { padding: 6px 10px; font-size: 11px; color: #ddd; cursor: pointer; border-bottom: 1px solid #333; }
      .j0n4t-pg-folder-autocomplete-item:last-child { border-bottom: none; }
      .j0n4t-pg-folder-autocomplete-item.active { background: #007acc; color: #fff; }

      .j0n4t-pg-editor-preview { position: relative; width: 84px; flex-shrink: 0; border-radius: 3px; overflow: hidden; display: flex; align-items: center; justify-content: center; background: #111; cursor: pointer; border: 1px dashed #444; transition: border-color 0.2s; min-height: 84px; }
      .j0n4t-pg-editor-preview:hover { border-color: #007acc; }
      .j0n4t-pg-editor-preview .j0n4t-pg-corner-edit { top: 4px; right: 4px; background: #b23b3b; border-color: #b23b3b; z-index: 10; display: none; }
      .j0n4t-pg-editor-preview:hover .j0n4t-pg-corner-edit { display: flex; }
      .j0n4t-pg-editor-preview img { width: 100%; height: 100%; object-fit: cover; position: absolute; top:0; left:0; }

      .j0n4t-pg-modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.65); backdrop-filter: blur(3px); z-index: 20000; display: flex; align-items: center; justify-content: center; }
      .j0n4t-pg-modal { background: #1f1f1f; border: 1px solid #007acc; border-radius: 8px; width: 320px; padding: 16px; box-shadow: 0 8px 24px rgba(0,0,0,0.6); font-family: sans-serif; display: flex; flex-direction: column; gap: 12px; color: #eee; }
      .j0n4t-pg-modal h3 { margin: 0; font-size: 13px; font-weight: bold; color: #fff; display: flex; align-items: center; gap: 6px; }
      .j0n4t-pg-modal-field { display: flex; flex-direction: column; gap: 4px; font-size: 11px; }
      .j0n4t-pg-modal-field label { color: #aaa; font-weight: bold; }
      .j0n4t-pg-modal-field select { background: #111; border: 1px solid #444; color: #fff; padding: 6px; border-radius: 4px; font-size: 11px; outline: none; }
      .j0n4t-pg-modal-field select:focus { border-color: #007acc; }
      .j0n4t-pg-modal-actions { display: flex; justify-content: flex-end; gap: 8px; margin-top: 4px; }
    `;
    document.head.appendChild(styles);
  }
}

class PresetBasket {
  constructor(container, pool, textarea, context) {
    this.container = container;
    this.pool = pool;
    this.textarea = textarea;
    this.context = context;
    this.dropIndicator = null;
    this.popupEl = null;
    this.currentMatches = [];
    this.activeIndex = 0;

    this.initDragAndDrop();
    this.initRawInputSync();
    this.initAutocomplete();
    this.initBasketActions();
    this.renderAddNewChipButton();
  }

  initDragAndDrop() {
    this.container.addEventListener("dragenter", (e) => {
      if (!this.container.classList.contains("raw-mode")) {
        e.preventDefault();
        this.container.classList.add("drag-over");
      }
    });
    this.container.addEventListener("dragleave", (e) => {
      if (e.relatedTarget && this.container.contains(e.relatedTarget)) return;
      this.container.classList.remove("drag-over");
      this.removeDropIndicator();
    });
    this.container.addEventListener("dragover", (e) => {
      if (this.container.classList.contains("raw-mode")) return;
      e.preventDefault();
      if (!this.dropIndicator)
        this.dropIndicator = Object.assign(document.createElement("div"), {
          className: "j0n4t-pg-basket-drop-indicator",
        });

      const closest = this.getClosestChip(e.clientX, e.clientY);
      if (closest.element) {
        this.dropIndicator.style.height = `${closest.box.height}px`;
        if (e.clientX > closest.box.left + closest.box.width / 2) {
          closest.element.after(this.dropIndicator);
        } else {
          closest.element.before(this.dropIndicator);
        }
      } else {
        this.pool.appendChild(this.dropIndicator);
        this.dropIndicator.style.height = "12px";
      }
    });
    this.container.addEventListener("drop", (e) => {
      if (this.container.classList.contains("raw-mode")) return;
      e.preventDefault();
      this.container.classList.remove("drag-over");
      this.removeDropIndicator();
      const styleKey = e.dataTransfer.getData("text/plain");
      if (!styleKey) return;

      let selections = this.context.getSelectedArray();
      if (e.dataTransfer.getData("source/basket"))
        selections = selections.filter((v) => v !== styleKey);

      const closest = this.getClosestChip(e.clientX, e.clientY);
      if (closest.element) {
        let insertionIndex = selections.indexOf(closest.element.dataset.id);
        if (e.clientX > closest.box.left + closest.box.width / 2)
          insertionIndex += 1;
        if (insertionIndex !== -1)
          selections.splice(insertionIndex, 0, styleKey);
        else selections.push(styleKey);
      } else if (!selections.includes(styleKey)) selections.push(styleKey);

      this.context.updateWidgetValue([...new Set(selections)]);
    });
  }

  initRawInputSync() {
    const sync = () => {
      this.updateRawHighlights();
      this.context.updateWidgetValue(
        this.textarea.value
          .split(",")
          .map((i) => i.trim())
          .filter(Boolean)
      );
    };

    this.textarea.addEventListener("input", () => this.updateRawHighlights());
    this.textarea.addEventListener("scroll", () => {
      if (this.context.dom.rawHighlights) {
        this.context.dom.rawHighlights.scrollTop = this.textarea.scrollTop;
        this.context.dom.rawHighlights.scrollLeft = this.textarea.scrollLeft;
      }
    });
    this.textarea.addEventListener("change", sync);
    this.textarea.addEventListener("mousedown", (e) => e.stopPropagation());

    // Add mousemove listener for tooltip functionality
    this.textarea.addEventListener("mousemove", (e) => this.handleTextareaMouseMove(e));
    this.textarea.addEventListener("mouseleave", () => this.textarea.title = "");
  }

  updateRawHighlights() {
    const highlightsEl = this.context.dom.rawHighlights;
    if (!highlightsEl) return;

    const val = this.textarea.value || "";
    if (!val) {
      highlightsEl.innerHTML = "";
      return;
    }

    const parts = val.split(/(\s*,\s*)/);
    let html = "";

    parts.forEach((part) => {
      if (/^\s*,\s*$/.test(part)) {
        html += `<span class="j0n4t-pg-raw-token plain-text">${PresetUtils.escapeHTML(part)}</span>`;
      } else {
        const trimmed = part.trim();
        if (!trimmed) {
          html += `<span class="j0n4t-pg-raw-token plain-text">${PresetUtils.escapeHTML(part)}</span>`;
          return;
        }

        const leadingSpace = part.slice(0, part.indexOf(trimmed));
        const trailingSpace = part.slice(part.indexOf(trimmed) + trimmed.length);

        const item = this.context.cache[trimmed];
        let textColor = "";
        let isPlainText = false;

        if (item) {
          textColor = PresetUtils.getPresetColor(trimmed);
        } else if (/^<(lora|lyco):.+?>$/i.test(trimmed)) {
          textColor = "#4fc1ff";
        } else {
          isPlainText = true;
        }

        const spanClass = isPlainText
          ? "j0n4t-pg-raw-token plain-text"
          : "j0n4t-pg-raw-token";
        const styleAttr = textColor ? ` style="color: ${textColor};"` : "";
        const titleAttr = item && !isPlainText ? ` title="${PresetUtils.escapeHTML(`${PresetUtils.toTitleCase(PresetUtils.getPresetName(trimmed))} [${trimmed}]\n${PresetUtils.escapeHTML(item.preset || "")}`)}"` : "";

        html +=
          `<span class="j0n4t-pg-raw-token plain-text">${PresetUtils.escapeHTML(leadingSpace)}</span>` +
          `<span class="${spanClass}"${styleAttr}${titleAttr}>${PresetUtils.escapeHTML(trimmed)}</span>` +
          `<span class="j0n4t-pg-raw-token plain-text">${PresetUtils.escapeHTML(trailingSpace)}</span>`;
      }
    });

    highlightsEl.innerHTML = html + "\n";
    highlightsEl.scrollTop = this.textarea.scrollTop;
    highlightsEl.scrollLeft = this.textarea.scrollLeft;
  }

  /**
   * Handle mouse movement over the textarea to show tooltips for presets
   * @param {MouseEvent} e - Mouse event
   */
  handleTextareaMouseMove(e) {
    const rect = this.textarea.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    // Get character position at mouse coordinates
    const pos = this.getCharPositionAt(x, y);
    if (pos === -1) {
      this.textarea.title = "";
      return;
    }

    // Find which token contains this position
    const token = this.getTokenAtPosition(pos);
    if (token && token.item && !token.isPlainText) {
      // Set tooltip with preset info
      this.textarea.title = `${PresetUtils.toTitleCase(PresetUtils.getPresetName(token.key))} [${token.key}]\n${token.item.preset || ""}`;
    } else {
      this.textarea.title = "";
    }
  }

  /**
* Get character position at x,y coordinates within the textarea
* @param {number} x - X coordinate relative to textarea
* @param {number} y - Y coordinate relative to textarea
* @returns {number} Character index or -1 if not determinable
*/
  getCharPositionAt(x, y) {
    const rect = this.textarea.getBoundingClientRect();
    const clientX = rect.left + x;
    const clientY = rect.top + y;

    // Try to use the browser's caret position API for accuracy
    let pos = -1;
    if (document.caretPositionFromPoint) {
      const caretPos = document.caretPositionFromPoint(clientX, clientY);
      if (caretPos && caretPos.offsetNode === this.textarea) {
        pos = caretPos.offset;
      }
    } else if (document.caretRangeFromPoint) {
      const range = document.caretRangeFromPoint(clientX, clientY);
      if (range && range.startContainer === this.textarea) {
        pos = range.startOffset;
      }
    }

    if (pos !== -1) {
      // Post‑process: ensure we are not inside a delimiter (comma/whitespace)
      // that could have changed due to a race.
      return this._normalizeTokenPosition(pos);
    }

    // Fallback: approximate based on metrics (should rarely be used)
    const style = window.getComputedStyle(this.textarea);
    const paddingLeft = parseFloat(style.paddingLeft);
    const paddingRight = parseFloat(style.paddingRight);
    const paddingTop = parseFloat(style.paddingTop);
    const paddingBottom = parseFloat(style.paddingBottom);
    const borderLeft = parseFloat(style.borderLeftWidth);
    const borderRight = parseFloat(style.borderRightWidth);
    const borderTop = parseFloat(style.borderTopWidth);
    const borderBottom = parseFloat(style.borderBottomWidth);

    // Adjust for padding and border
    const xPos = x - paddingLeft - borderLeft;
    const yPos = y - paddingTop - borderTop;

    const innerWidth = this.textarea.clientWidth - paddingLeft - paddingRight - borderLeft - borderRight;
    const innerHeight = this.textarea.clientHeight - paddingTop - paddingBottom - borderTop - borderBottom;

    if (xPos < 0 || yPos < 0 || xPos > innerWidth || yPos > innerHeight) return -1;

    // Get font metrics
    const fontSize = parseFloat(style.fontSize);
    const lineHeight = parseFloat(style.lineHeight) || fontSize * 1.2;
    const charWidth = fontSize * 0.6; // Approximate average character width (monospace)

    // Calculate characters per line and visible lines
    const charsPerLine = Math.max(1, Math.floor(innerWidth / charWidth));
    const linesCount = Math.max(1, Math.floor(innerHeight / lineHeight));

    // Calculate column and row (zero-indexed)
    const col = Math.min(Math.round(xPos / charWidth), charsPerLine - 1);
    const row = Math.min(Math.floor(yPos / lineHeight), linesCount - 1);

    // Calculate position
    let calcPos = row * charsPerLine + col;

    // Get text content and clamp
    const text = this.textarea.value;
    if (!text) return -1;
    return this._normalizeTokenPosition(Math.min(calcPos, text.length));
  }

  /**
   * Adjusts a raw character index to the nearest position that lies inside a token
   * (i.e., not inside a comma or whitespace delimiter). This helps mitigate
   * race conditions where the textarea's value changed slightly after the
   * mouse event was processed.
   * @param {number} pos - Raw character index (0‑based)
   * @returns {number} Adjusted index, clamped to [0, text.length]
   */
  _normalizeTokenPosition(pos) {
    const value = this.textarea.value;
    if (!value) return 0;

    // Clamp to valid range
    if (pos < 0) return 0;
    if (pos > value.length) return value.length;

    // If the position is already inside a non‑delimiter, return it.
    const ch = value[pos];
    if (ch !== ',' && !/\s/.test(ch)) {
      return pos;
    }

    // Otherwise, scan left and right to find the nearest non‑delimiter.
    let left = pos - 1;
    while (left >= 0 && (value[left] === ',' || /\s/.test(value[left]))) {
      left--;
    }
    let right = pos + 1;
    while (right < value.length && (value[right] === ',' || /\s/.test(value[right]))) {
      right++;
    }

    // Choose the closer side; if tie, prefer left.
    const leftDist = pos - (left + 1); // distance to the character after left delimiter
    const rightDist = right - pos;     // distance to the character before right delimiter
    return leftDist <= rightDist ? left + 1 : right - 1;
  }

  /**
   * Get token information at a specific character position
   * @param {number} pos - Character position in textarea value
   * @returns {Object|null} Token info or null if not found
   */
  getTokenAtPosition(pos) {
    const value = this.textarea.value;
    if (!value || pos < 0 || pos > value.length) return null;

    // Split by commas and spaces to find tokens
    let currentPos = 0;
    const parts = value.split(/(\s*,\s*)/);

    for (const part of parts) {
      const partEnd = currentPos + part.length;

      // Check if position is within this part
      if (pos >= currentPos && pos <= partEnd) {
        const trimmed = part.trim();
        if (!trimmed) {
          currentPos = partEnd;
          continue;
        }

        // Check if it's a comma separator
        if (/^\s*,\s*$/.test(part)) {
          currentPos = partEnd;
          continue;
        }

        // Find where the trimmed text starts within this part
        const trimmedStart = part.indexOf(trimmed);
        const trimmedEnd = trimmedStart + trimmed.length;

        // Check if position is within the trimmed text
        const relativePos = pos - currentPos;
        if (relativePos >= trimmedStart && relativePos <= trimmedEnd) {
          // Found our token
          const item = this.context.cache[trimmed];
          let isPlainText = false;

          if (!item && !(/^<(lora|lyco):.+?>$/i.test(trimmed))) {
            isPlainText = true;
          }

          return {
            key: trimmed,
            item: item || null,
            isPlainText: isPlainText,
            start: currentPos + trimmedStart,
            end: currentPos + trimmedEnd
          };
        }
      }

      currentPos = partEnd;
    }

    return null;
  }

  initAutocomplete() {
    new AutocompleteManager({
      input: this.textarea,
      container: document.body,
      getMatches: (text, cursor) => {
        if (!this.container.classList.contains("raw-mode")) return [];
        const lastCommaIndex = text.slice(0, cursor).lastIndexOf(",");
        const currentToken = (
          lastCommaIndex === -1
            ? text.slice(0, cursor)
            : text.slice(lastCommaIndex + 1, cursor)
        ).trimStart();
        if (!currentToken) return [];

        return PresetUtils.getTopMatches(
          Object.keys(this.context.cache),
          currentToken,
          (k) => PresetUtils.getSearchBlob(k, this.context.cache[k])
        );
      },
      renderItem: (match) =>
        `<span title="${PresetUtils.getPresetTitle(match, this.context.cache)}">${PresetUtils.escapeHTML(PresetUtils.toTitleCase(match.split("/").pop()))}</span><span class="j0n4t-pg-autocomplete-meta">${PresetUtils.escapeHTML(match)}</span>`,
      onSelect: (match) => {
        const cursor = this.textarea.selectionStart;
        const leftText = this.textarea.value.slice(0, cursor);
        const prefix =
          leftText.lastIndexOf(",") === -1
            ? ""
            : leftText.slice(0, leftText.lastIndexOf(",") + 1) + " ";

        this.textarea.value =
          prefix + match + "," + this.textarea.value.slice(cursor);
        this.context.updateWidgetValue(
          this.textarea.value
            .split(",")
            .map((i) => i.trim())
            .filter(Boolean)
        );

        this.textarea.focus();
        this.textarea.selectionStart = this.textarea.selectionEnd =
          prefix.length + match.length + 2;
      },
      onKeyDown: (e, activeMatch) => {
        if (
          e.key === "ArrowRight" &&
          this.textarea.selectionStart === this.textarea.value.length &&
          activeMatch
        ) {
          return false;
        }
      },
    });
  }

  initBasketActions() {
    const { dom } = this.context;
    dom.btnClearBasket.addEventListener("click", () => {
      if (this.context.getSelectedArray().length && confirm("Empty basket?"))
        this.context.updateWidgetValue([]);
    });

    dom.chkBasketRaw.checked =
      localStorage.getItem("comfy_preset_gallery_raw_basket") === "true";
    dom.basketContainer.classList.toggle("raw-mode", dom.chkBasketRaw.checked);
    dom.chkBasketRaw.addEventListener("change", () => {
      localStorage.setItem(
        "comfy_preset_gallery_raw_basket",
        String(dom.chkBasketRaw.checked)
      );
      dom.basketContainer.classList.toggle(
        "raw-mode",
        dom.chkBasketRaw.checked
      );
    });

    dom.btnCopyBasket.addEventListener("click", () => {
      const text = this.context
        .getSelectedArray()
        .map((key) => this.context.cache[key]?.preset || key)
        .filter(Boolean)
        .join(", ");
      if (!text) return;
      navigator.clipboard.writeText(text).then(() => {
        const origBg = dom.btnCopyBasket.style.background;
        dom.btnCopyBasket.innerText = "✅ Copied!";
        dom.btnCopyBasket.style.background = "#228b22";
        setTimeout(() => {
          dom.btnCopyBasket.innerText = "📋 Output";
          dom.btnCopyBasket.style.background = origBg;
        }, 1500);
      });
    });

    dom.basketContainer.addEventListener("dblclick", (e) => {
      e.stopPropagation();
      this.spawnInlineEditor(null, "");
    });
  }

  removeDropIndicator() {
    this.dropIndicator?.remove();
    this.dropIndicator = null;
  }

  explodeChip(targetKey) {
    const currentSelections = this.context.widget.value.split(",");
    const targetPreset = this.context.cache[targetKey];
    if (!targetPreset) return;
    const rawPreset = targetPreset.preset || [targetKey];
    const updatedSelections = [];

    for (const key of currentSelections) {
      if (key.trim() === targetKey.trim()) {
        for (const token of rawPreset.split(",")) {
          updatedSelections.push(token.trim());
        }
      } else {
        updatedSelections.push(key.trim());
      }
    }

    const uniqueSelections = Array.from(new Set(updatedSelections));

    this.context.updateWidgetValue(uniqueSelections);
    this.context.syncUI(uniqueSelections.join(","));

    if (this.textarea && this.container.classList.contains("raw-mode")) {
      this.textarea.value = uniqueSelections.join(", ");
    }
  }

  getClosestChip(clientX, clientY) {
    return [
      ...this.pool.querySelectorAll(".j0n4t-pg-basket-chip:not(.dragging)"),
    ].reduce(
      (closest, el) => {
        const box = el.getBoundingClientRect();
        const dist = Math.hypot(
          clientX - (box.left + box.width / 2),
          clientY - (box.top + box.height / 2)
        );
        return dist < closest.distance
          ? { distance: dist, element: el, box }
          : closest;
      },
      { distance: Infinity, element: null, box: null }
    );
  }

  spawnInlineEditor(chipElement, initialValue) {
    const isNew = !chipElement;
    if (isNew) {
      chipElement = Object.assign(document.createElement("div"), {
        className: "j0n4t-pg-basket-chip inline-editing",
      });
      const addBtn = this.pool.querySelector(".j0n4t-pg-basket-add-btn");
      if (addBtn) {
        addBtn.before(chipElement);
      } else {
        this.pool.appendChild(chipElement);
      }
    } else {
      if (chipElement.classList.contains("inline-editing")) return;
      chipElement.classList.add("inline-editing");
      chipElement.draggable = false;
      const label = chipElement.querySelector(".j0n4t-pg-basket-chip-label");
      if (label) label.style.display = "none";
    }

    const input = Object.assign(document.createElement("input"), {
      type: "text",
      className: "j0n4t-pg-inline-edit",
      enterKeyHint: "enter",
      value: initialValue || "",
    });
    chipElement.prepend(input);
    input.focus();
    input.selectionStart = input.selectionEnd = input.value.length;

    const finishEdit = (save) => {
      const newVal = input.value.trim();
      try {
        input.remove();
      } catch (e) { }

      if (isNew) chipElement.remove();
      else {
        chipElement.classList.remove("inline-editing");
        chipElement.draggable = true;
        const label = chipElement.querySelector(".j0n4t-pg-basket-chip-label");
        if (label) label.style.display = "";
      }

      if (save) {
        const selections = this.context.getSelectedArray();
        if (isNew && newVal && !selections.includes(newVal)) {
          selections.push(newVal);
          this.context.updateWidgetValue(selections);
        } else if (!isNew && newVal !== initialValue) {
          const idx = selections.indexOf(initialValue);
          if (idx !== -1) {
            if (newVal) selections[idx] = newVal;
            else selections.splice(idx, 1);
            this.context.updateWidgetValue(selections);
          }
        }
      }
    };

    const manager = new AutocompleteManager({
      input: input,
      container: document.body,
      getMatches: (query) => {
        query = query.trim().toLowerCase();
        if (!query) return [];
        return PresetUtils.getTopMatches(
          Object.keys(this.context.cache),
          query,
          (k) => PresetUtils.getSearchBlob(k, this.context.cache[k])
        );
      },
      renderItem: (match) =>
        `<span title="${PresetUtils.getPresetTitle(match, this.context.cache)}">${PresetUtils.escapeHTML(PresetUtils.toTitleCase(match.split("/").pop()))}</span><span class="j0n4t-pg-autocomplete-meta">${PresetUtils.escapeHTML(match)}</span>`,
      onSelect: (match) => {
        input.value = match;
        finishEdit(true);
      },
      onKeyDown: (e) => {
        if (!manager.isOpen) {
          if (e.key === "Enter") {
            e.preventDefault();
            finishEdit(true);
            return true;
          } else if (e.key === "Escape") {
            e.preventDefault();
            finishEdit(false);
            return true;
          }
        }
      },
      onBlur: () => {
        finishEdit(false);
        return true;
      },
    });
  }

  renderAddNewChipButton() {
    const addBtn = Object.assign(document.createElement("div"), {
      className: "j0n4t-pg-basket-add-btn",
      innerText: "+ Add",
      title: "Add new preset or keyword",
    });
    addBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      this.spawnInlineEditor(null, "");
    });
    this.pool.appendChild(addBtn);
  }

  render(activeList) {
    this.textarea.value = activeList.join(", ");
    this.updateRawHighlights();
    this.pool.innerHTML = "";

    activeList.forEach((styleKey) => {
      const item = this.context.cache[styleKey];
      let cleanLabel = item
        ? PresetUtils.toTitleCase(PresetUtils.getPresetName(styleKey))
        : styleKey;

      const chip = Object.assign(document.createElement("div"), {
        className: "j0n4t-pg-basket-chip",
        draggable: true,
        title: item
          ? `${cleanLabel} [${styleKey}] (right-click to explode)\n${item.preset}`
          : styleKey,
      });
      chip.dataset.id = styleKey;

      if (item?.filename) {
        chip.style.backgroundImage = `url("${item.filename}")`;
      } else {
        chip.style.backgroundColor = PresetUtils.getPresetColor(styleKey);
      }

      let loraInputHtml = "";
      const loraMatch = styleKey.match(/^<(lora|lyco):(.+?)(?::(-?\d+(?:\.\d+)?))?>$/i);
      if (loraMatch) {
        const weight = loraMatch[3] || "1.0";
        loraInputHtml = `<input type="number" step="0.05" class="j0n4t-pg-lora-weight lora-weight-input" value="${weight}" title="LoRA Weight" />`;
        cleanLabel = loraMatch[2];
      }

      chip.innerHTML = `
                <div class="j0n4t-pg-basket-chip-label" title="${PresetUtils.escapeHTML(styleKey)}">${PresetUtils.escapeHTML(cleanLabel)}</div>
                ${loraInputHtml}
            `;

      if (loraMatch) {
        const loraInput = chip.querySelector(".lora-weight-input");
        loraInput.addEventListener("mousedown", (e) => e.stopPropagation());
        loraInput.addEventListener("dblclick", (e) => e.stopPropagation());

        loraInput.addEventListener("change", (e) => {
          const newWeight = parseFloat(e.target.value);
          if (isNaN(newWeight)) return;

          const newStyleKey = `<${loraMatch[1]}:${loraMatch[2]}:${newWeight}>`;
          const selections = this.context.getSelectedArray();
          const idx = selections.indexOf(styleKey);

          if (idx !== -1) {
            selections[idx] = newStyleKey;
            this.context.updateWidgetValue(selections);
          }
        });
      }

      chip.addEventListener("click", (e) => {
        if (e.target.closest(".lora-weight-input")) return;
        e.stopPropagation();
        this.showChipMenu(chip, styleKey, item);
      });
      chip.addEventListener("dblclick", (e) => {
        e.stopPropagation();
        this.spawnInlineEditor(chip, styleKey);
      });
      chip.addEventListener("dragstart", (e) => {
        chip.classList.add("dragging");
        e.dataTransfer.setData("text/plain", styleKey);
        e.dataTransfer.setData("source/basket", "true");
      });
      chip.addEventListener("dragend", () => {
        chip.classList.remove("dragging");
        this.removeDropIndicator();
      });
      chip.addEventListener("contextmenu", (e) => {
        e.preventDefault();
        e.stopPropagation();
        this.explodeChip(styleKey);
      });
      this.pool.appendChild(chip);
    });

    this.renderAddNewChipButton();
  }

  showChipMenu(chipElement, styleKey, item) {
    if (this.activeChipMenuEl) {
      this.activeChipMenuEl.classList.remove("active-menu");
    }
    this.popupEl?.remove();

    chipElement.classList.add("active-menu");
    this.activeChipMenuEl = chipElement;

    const popup = Object.assign(document.createElement("div"), {
      className: "j0n4t-pg-chip-popup",
    });

    const editBtn = document.createElement("div");
    editBtn.className = "j0n4t-pg-chip-popup-item";
    editBtn.title = "Edit";
    editBtn.innerHTML = PresetUtils.icons.edit;
    editBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      this.closeChipMenu();
      if (item) {
        this.context.openEditorForPreset(styleKey);
      } else {
        this.spawnInlineEditor(chipElement, styleKey);
      }
    });
    popup.appendChild(editBtn);

    if (item) {
      const locateBtn = document.createElement("div");
      locateBtn.className = "j0n4t-pg-chip-popup-item";
      locateBtn.title = "Locate in Gallery";
      locateBtn.innerHTML = PresetUtils.icons.eye;
      locateBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        this.closeChipMenu();
        const itemEl = this.context.dom.grid.querySelector(
          `.j0n4t-pg-item[data-style="${PresetUtils.escapeHTML(styleKey)}"]`
        );
        if (itemEl) {
          this.context.dom.search.value = "";
          let prev = itemEl.previousElementSibling;
          while (prev && !prev.classList.contains("j0n4t-pg-group-header"))
            prev = prev.previousElementSibling;
          if (prev?.classList.contains("collapsed")) {
            prev.classList.remove("collapsed");
            this.context.setCollapsedFolders(
              this.context
                .getCollapsedFolders()
                .filter((f) => f !== prev.dataset.groupRaw)
            );
          }
          this.context.grid.executeFilterPipeline();
          itemEl.scrollIntoView({ behavior: "smooth", block: "nearest" });

          itemEl.style.transition = "border-color 0.15s, box-shadow 0.15s";
          const origColor = itemEl.style.borderColor;
          itemEl.style.borderColor = "#007acc";
          itemEl.style.boxShadow = "0 0 8px rgba(0, 122, 204, 0.75)";
          setTimeout(() => {
            itemEl.style.borderColor = origColor;
            itemEl.style.boxShadow = "";
          }, 800);
        }
      });
      popup.appendChild(locateBtn);
    } else {
      const createBtn = document.createElement("div");
      createBtn.className = "j0n4t-pg-chip-popup-item";
      createBtn.title = "Create Preset from Chip";
      createBtn.innerHTML = PresetUtils.icons.add;
      createBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        this.closeChipMenu();
        this.context.setPanelCollapseState(false);
        this.context.editor.clearFields();

        const presetText = item ? item.preset : styleKey;
        this.context.editor.dom.inpPreset.value = presetText;

        const cleanName = styleKey
          .replace(/^<(lora|lyco):/i, "")
          .replace(/>$/, "")
          .split(":")[0]
          .split("/")
          .pop()
          .replace(/[^a-zA-Z0-9\s-_]/g, "")
          .trim()
          .replace(/\s+/g, "_");

        if (cleanName) {
          this.context.editor.dom.inpName.value = cleanName;
        }
        this.context.editor.dom.inpPreset.dispatchEvent(new Event("input"));
      });
      popup.appendChild(createBtn);
    }

    const delBtn = document.createElement("div");
    delBtn.className = "j0n4t-pg-chip-popup-item danger";
    delBtn.title = "Remove";
    delBtn.innerHTML = PresetUtils.icons.close;
    delBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      this.closeChipMenu();
      this.context.updateWidgetValue(
        this.context.getSelectedArray().filter((v) => v !== styleKey)
      );
    });
    popup.appendChild(delBtn);

    popup.addEventListener("mousedown", (e) => e.stopPropagation());

    document.body.appendChild(popup);
    this.popupEl = popup;

    const rect = chipElement.getBoundingClientRect();
    popup.style.top = `${window.scrollY + rect.bottom + 4}px`;
    popup.style.left = `${window.scrollX + rect.left}px`;

    const closeHandler = (e) => {
      if (!popup.contains(e.target) && e.target !== chipElement) {
        this.closeChipMenu();
        document.removeEventListener("mousedown", closeHandler);
      }
    };
    this.closeHandler = closeHandler;
    setTimeout(() => document.addEventListener("mousedown", closeHandler), 10);
  }

  closeChipMenu() {
    if (this.closeHandler) {
      document.removeEventListener("mousedown", this.closeHandler);
      this.closeHandler = null;
    }
    if (this.activeChipMenuEl) {
      this.activeChipMenuEl.classList.remove("active-menu");
      this.activeChipMenuEl = null;
    }
    this.popupEl?.remove();
    this.popupEl = null;
  }
}

class PresetGrid {
  constructor(dom, context) {
    this.dom = dom;
    this.context = context;
    this.bindEvents();
  }

  switchView(viewName) {
    ["small", "big", "list"].forEach((v) =>
      this.dom.grid.classList.remove(`view-${v}`)
    );
    this.dom.viewsContainer
      .querySelectorAll(".j0n4t-pg-view-btn")
      .forEach((btn) =>
        btn.classList.toggle("active", btn.dataset.view === viewName)
      );
    this.dom.grid.classList.add(`view-${viewName}`);
    localStorage.setItem("comfy_preset_gallery_view", viewName);
  }

  executeFilterPipeline(query = "") {
    const queryWords = query.toLowerCase().trim()
      ? query.toLowerCase().trim().split(/\s+/)
      : [];
    this.dom.searchClear.style.display = query ? "flex" : "none";

    this.dom.grid.querySelectorAll(".j0n4t-pg-item").forEach((el) => {
      el.classList.toggle(
        "j0n4t-pg-hidden",
        queryWords.length &&
        !queryWords.every((word) => el.dataset.searchBlob.includes(word))
      );
    });

    if (this.dom.chkGroup.checked) {
      this.dom.grid
        .querySelectorAll(".j0n4t-pg-group-header")
        .forEach((header) => {
          let next = header.nextElementSibling,
            hasVisibleChildren = false;
          while (next && !next.classList.contains("j0n4t-pg-group-header")) {
            const matches =
              !queryWords.length ||
              queryWords.every((word) =>
                (next.dataset.searchBlob || "").includes(word)
              );
            if (matches) {
              hasVisibleChildren = true;
              next.classList.toggle(
                "j0n4t-pg-hidden",
                header.classList.contains("collapsed")
              );
            } else next.classList.add("j0n4t-pg-hidden");
            next = next.nextElementSibling;
          }
          header.classList.toggle("j0n4t-pg-hidden", !hasVisibleChildren);
        });
    }
  }

  compile(cache) {
    let htmlBuffer = "",
      lastGroup = null;
    const collapsedList = this.context.getCollapsedFolders();

    const sortedKeys = Object.keys(cache).sort((a, b) => {
      const groupA = cache[a].tags?.length
        ? cache[a].tags.join(" > ")
        : "root_presets";
      const groupB = cache[b].tags?.length
        ? cache[b].tags.join(" > ")
        : "root_presets";
      if (groupA === "root_presets" && groupB !== "root_presets") return -1;
      if (groupB === "root_presets" && groupA !== "root_presets") return 1;
      return groupA !== groupB
        ? groupA.localeCompare(groupB)
        : a.localeCompare(b);
    });

    sortedKeys.forEach((key) => {
      const item = cache[key];
      const cleanLabel = PresetUtils.toTitleCase(
        PresetUtils.getPresetName(key)
      ),
        initials = PresetUtils.getPresetInitials(key);
      const searchBlob =
        `${key} ${initials} ${item.preset} ${(item.tags || []).join(" ")}`.toLowerCase();
      const uiGroup = item.tags?.length
        ? item.tags.map(PresetUtils.toTitleCase).join(" › ")
        : "Root Presets";
      const rawGroup = item.tags?.length ? item.tags.join("/") : "root_presets";

      if (uiGroup !== lastGroup) {
        lastGroup = uiGroup;
        const groupColor = PresetUtils.getGroupColor(rawGroup);
        const hexColor = PresetUtils.getGroupHexColor(rawGroup);
        htmlBuffer += `
            <div class="j0n4t-pg-group-header${collapsedList.includes(rawGroup) ? " collapsed" : ""}" data-group="${PresetUtils.escapeHTML(uiGroup)}" data-group-raw="${PresetUtils.escapeHTML(rawGroup)}">
                <span class="j0n4t-pg-group-color-dot" style="background-color: ${groupColor};" title="Click to customize group color">
                    <input type="color" class="j0n4t-pg-group-color-picker" value="${hexColor}" title="Customize group color" />
                </span>
                <span>${PresetUtils.escapeHTML(uiGroup)}</span>
                <div class="j0n4t-pg-group-line"></div>
                <span class="j0n4t-pg-group-rename-tip">Right-click to rename</span>
            </div>`;
      }

      const thumb = item.filename
        ? `<img class="j0n4t-pg-img" src="${item.filename}" loading="lazy">`
        : `<div style="background-color: ${PresetUtils.getPresetColor(key)}; width:100%; height:100%; display:flex; align-items:center; justify-content:center; color:#fff;">${PresetUtils.icons.file}</div>`;
      const badge = item.tags?.length
        ? `<div class="j0n4t-pg-tag-badge" style="--item-color: ${PresetUtils.getPresetColor(key)};">${PresetUtils.escapeHTML(PresetUtils.toTitleCase(item.tags[item.tags.length - 1]))}</div>`
        : "";

      htmlBuffer += `
       <div class="j0n4t-pg-item" data-style="${PresetUtils.escapeHTML(key)}" data-search-blob="${PresetUtils.escapeHTML(searchBlob)}" draggable="true" title="${PresetUtils.escapeHTML(cleanLabel)} [${PresetUtils.escapeHTML(key)}]\n${PresetUtils.escapeHTML(item.preset || "")}">
          <div class="j0n4t-pg-corner-edit" title="Edit">${PresetUtils.icons.edit}</div>
          ${badge}
          <div class="j0n4t-pg-thumb-box">
            ${thumb}
            <div class="j0n4t-pg-initials">${PresetUtils.escapeHTML(initials)}</div>
          </div>
          <div class="j0n4t-pg-label">${PresetUtils.escapeHTML(cleanLabel)}</div>
        </div>`;
    });

    this.dom.grid.innerHTML =
      htmlBuffer ||
      `<div style="grid-column:1/-1; text-align:center; padding:20px; color:#666; font-size:11px;">No presets found</div>`;
    this.dom.btnGlobalCollapse.innerText =
      collapsedList.length >
        this.dom.grid.querySelectorAll(".j0n4t-pg-group-header").length / 2
        ? "↕️ Expand All"
        : "↕️ Collapse All";
    this.attachGridItemEvents();
    this.switchView(localStorage.getItem("comfy_preset_gallery_view") || "big");
    this.executeFilterPipeline(this.dom.search.value);
    this.context.syncEditorHighlight();
  }

  attachGridItemEvents() {
    this.dom.grid
      .querySelectorAll(".j0n4t-pg-group-header")
      .forEach((header) => {
        const rawFolder = header.dataset.groupRaw;
        const colorDot = header.querySelector(".j0n4t-pg-group-color-dot");
        const colorPicker = header.querySelector(".j0n4t-pg-group-color-picker");
        if (colorPicker) {
          colorPicker.addEventListener("click", (e) => e.stopPropagation());
          colorPicker.addEventListener("mousedown", (e) => e.stopPropagation());

          colorPicker.addEventListener("input", (e) => {
            e.stopPropagation();
            const newColor = e.target.value;
            if (colorDot) colorDot.style.backgroundColor = newColor;
            PresetUtils.setGroupColor(rawFolder, newColor);
          });

          colorPicker.addEventListener("change", (e) => {
            e.stopPropagation();
            const newColor = e.target.value;
            PresetUtils.setGroupColor(rawFolder, newColor);
            this.compile(this.context.cache);
          });
        }

        header.addEventListener("click", (e) => {
          if (
            e.target.closest(".j0n4t-pg-group-color-picker") ||
            e.target.closest(".j0n4t-pg-group-color-dot")
          )
            return;
          const isCollapsed = header.classList.toggle("collapsed");
          let list = this.context.getCollapsedFolders();
          if (isCollapsed && !list.includes(rawFolder)) {
            list.push(rawFolder);
          } else {
            list = list.filter((i) => i !== rawFolder);
          }
          this.context.setCollapsedFolders(list);
          this.dom.btnGlobalCollapse.innerText =
            list.length >
              this.dom.grid.querySelectorAll(".j0n4t-pg-group-header").length / 2
              ? "↕️ Expand All"
              : "↕️ Collapse All";
          this.executeFilterPipeline(this.dom.search.value);
        });
        header.addEventListener("contextmenu", async (e) => {
          if (rawFolder === "root_presets") return;
          e.preventDefault();
          e.stopPropagation();
          const newName = prompt(
            `Rename folder "${rawFolder.replace(/_/g, " ")}" to:`,
            rawFolder.replace(/_/g, " ")
          )
            ?.trim()
            .toLowerCase()
            .replace(/ /g, "_");
          if (!newName || newName === rawFolder) return;
          const res = await PresetGalleryAPI.renameFolder(rawFolder, newName);
          if (res.success) {
            this.context.setCollapsedFolders(
              this.context.getCollapsedFolders().filter((i) => i !== rawFolder)
            );
            await this.context.loadGallery();
            this.context.updateWidgetValue(
              this.context
                .getSelectedArray()
                .map((i) =>
                  i.startsWith(`${rawFolder}/`)
                    ? i.replace(`${rawFolder}/`, `${newName}/`)
                    : i
                )
            );
          } else alert(`Rename failed`);
        });
      });

    this.dom.grid.querySelectorAll(".j0n4t-pg-item").forEach((item) => {
      item.addEventListener("dragstart", (e) => {
        item.classList.add("dragging");
        e.dataTransfer.effectAllowed = "copyMove";
        e.dataTransfer.setData("text/plain", item.dataset.style);
        e.dataTransfer.setData("source/grid", "true");
      });
      item.addEventListener("dragend", () => item.classList.remove("dragging"));
      item
        .querySelector(".j0n4t-pg-corner-edit")
        .addEventListener("click", (e) => {
          e.stopPropagation();
          this.context.openEditorForPreset(item.dataset.style);
        });
    });
  }

  syncSelection(activeList) {
    this.dom.grid
      .querySelectorAll(".j0n4t-pg-item")
      .forEach((el) =>
        el.classList.toggle("selected", activeList.includes(el.dataset.style))
      );
  }

  bindEvents() {
    this.dom.viewsContainer.addEventListener("click", (e) => {
      const btn = e.target.closest(".j0n4t-pg-view-btn");
      if (btn) this.switchView(btn.dataset.view);
    });

    this.dom.chkGroup.checked =
      localStorage.getItem("comfy_preset_gallery_grouped") !== "false";
    this.dom.grid.classList.toggle("hide-folders", !this.dom.chkGroup.checked);
    this.dom.btnGlobalCollapse.style.display = this.dom.chkGroup.checked
      ? "block"
      : "none";

    this.dom.chkGroup.addEventListener("change", () => {
      localStorage.setItem(
        "comfy_preset_gallery_grouped",
        String(this.dom.chkGroup.checked)
      );
      this.dom.grid.classList.toggle(
        "hide-folders",
        !this.dom.chkGroup.checked
      );
      this.dom.btnGlobalCollapse.style.display = this.dom.chkGroup.checked
        ? "block"
        : "none";
      this.executeFilterPipeline(this.dom.search.value);
    });

    this.dom.btnGlobalCollapse.addEventListener("click", () => {
      const headers = this.dom.grid.querySelectorAll(".j0n4t-pg-group-header");
      const collapseAll =
        !this.dom.btnGlobalCollapse.innerText.includes("Expand");
      this.context.setCollapsedFolders(
        collapseAll ? [...headers].map((h) => h.dataset.groupRaw) : []
      );
      this.dom.btnGlobalCollapse.innerText = collapseAll
        ? "↕️ Expand All"
        : "↕️ Collapse All";
      headers.forEach((h) => h.classList.toggle("collapsed", collapseAll));
      this.executeFilterPipeline(this.dom.search.value);
    });

    this.dom.grid.addEventListener("click", (e) => {
      if (
        e.target.closest(".j0n4t-pg-corner-edit") ||
        e.target.closest(".j0n4t-pg-group-header")
      )
        return;
      const item = e.target.closest(".j0n4t-pg-item");
      if (!item || !this.context.widget.callback) return;
      const key = item.dataset.style;
      let sel = this.context.getSelectedArray();
      this.context.updateWidgetValue(
        sel.includes(key) ? sel.filter((v) => v !== key) : [...sel, key]
      );
    });
  }
}

class PresetEditor {
  constructor(dom, context) {
    this.dom = dom;
    this.context = context;
    this.editingKey = "";
    this.currentMode = "new";
    this.isSaved = false;
    this.bindEvents();
    this.initFolderAutocomplete();
  }

  renderPreview() {
    const rmBtnHtml = `<div class="j0n4t-pg-corner-edit" id="j0n4t-pg-rm-img-btn" title="Remove Image">${PresetUtils.icons.close}</div>`;
    if (this.dom.editor.classList.contains("has-image")) {
      let imgSrc = "";
      if (this.dom.inpFile.files?.[0]) {
        if (this.localPreviewUrl) URL.revokeObjectURL(this.localPreviewUrl);
        imgSrc = this.localPreviewUrl = URL.createObjectURL(
          this.dom.inpFile.files[0]
        );
      } else if (
        this.editingKey &&
        this.context.cache[this.editingKey]?.filename
      ) {
        imgSrc = this.context.cache[this.editingKey].filename;
      }
      if (imgSrc) {
        this.dom.editorPreview.innerHTML = `${rmBtnHtml}<img src="${imgSrc}" />`;
        return;
      }
    }

    const uniqueKey =
      (this.dom.inpFolder.value.trim()
        ? `${this.dom.inpFolder.value.trim()}/`
        : "") + (this.dom.inpName.value.trim() || "New");
    this.dom.editorPreview.innerHTML = `<div style="background-color: ${PresetUtils.getPresetColor(this.dom.inpFolder.value.trim() || "")}; width:100%; height:100%; display:flex; align-items:center; justify-content:center; color:#fff; position:absolute;">${PresetUtils.icons.file}<div class="j0n4t-pg-initials" style="font-size:14px;">${PresetUtils.escapeHTML(PresetUtils.getPresetInitials(uniqueKey))}</div></div>`;
  }

  updateBanner() {
    const { banner, btnSave } = this.dom;
    if (this.currentMode === "new") {
      banner.innerText = "✨ Creating New Preset";
      banner.style.color = "#32d332";
      banner.style.background = "#228b2220";
      btnSave.innerText = "Save";
      btnSave.style.background = "#007acc";
    } else if (this.editingKey) {
      banner.innerText = `${this.isSaved ? "✅" : "📝"} ${this.editingKey}`;
      banner.title = banner.innerText;
      banner.style.color = this.isSaved ? "#fff" : "#f0bc2f";
      banner.style.background = "#d1a11920";
      btnSave.innerText = this.isSaved ? "Saved!" : "Save";
      btnSave.style.background = this.isSaved ? "#27b427" : "#007acc";
    } else {
      banner.innerText = "📝 Select Edit ✏️ on an Preset";
      banner.style.color = "#888";
      banner.style.background = "#33333330";
    }
  }

  resetImageState() {
    this.dom.inpFile.value = "";
    this.dom.editor.classList.remove("has-image");
    this.dom.editor.classList.add("no-image");
    if (this.localPreviewUrl) {
      URL.revokeObjectURL(this.localPreviewUrl);
      this.localPreviewUrl = null;
    }
    this.renderPreview();
  }

  clearFields() {
    this.currentMode = "new";
    this.editingKey = "";
    this.isSaved = false;
    this.dom.inpName.value = "";
    this.dom.inpFolder.value = "";
    this.dom.inpPreset.value = "";
    this.resetImageState();
    this.updateBanner();
    this.context.syncEditorHighlight();
  }

  async openPreset(styleKey) {
    if (!this.context.cache[styleKey]) return;
    this.context.setPanelCollapseState(false);
    this.resetImageState();
    this.editingKey = styleKey;
    this.currentMode = "edit";
    this.isSaved = true;

    const parts = styleKey.split("/");
    this.dom.inpName.value = parts.pop() || "";
    this.dom.inpFolder.value = parts.join("/");
    this.dom.inpPreset.value = this.context.cache[styleKey].preset || "";

    if (this.context.cache[styleKey].filename) {
      this.dom.editor.classList.replace("no-image", "has-image");
    }
    this.renderPreview();

    this.updateBanner();
    this.context.syncEditorHighlight();
  }

  async handleSave() {
    let name = this.dom.inpName.value.trim().toLowerCase().replace(/ /g, "_");
    if (!name) {
      const pt = this.dom.inpPreset.value.trim();
      if (!pt) return alert("Keywords or Name required to save.");
      name =
        pt
          .split(/\s+/)
          .slice(0, 3)
          .map((w) => w.replace(/[^a-zA-Z0-9]/g, "").toLowerCase())
          .filter(Boolean)
          .join("_") || `unnamed_preset_${Date.now().toString().slice(-4)}`;
      this.dom.inpName.value = name;
    }

    const uniqueKey =
      (this.dom.inpFolder.value.trim()
        ? `${this.dom.inpFolder.value.trim().toLowerCase().replace(/ /g, "_")}/`
        : "") + name;
    let selections = this.context.getSelectedArray();

    if (this.currentMode === "new") {
      if (
        this.context.cache[uniqueKey] &&
        !confirm(`Overwrite "${uniqueKey}"?`)
      )
        return;
    }

    let imageData = null;
    let clearImage = false;

    if (this.dom.inpFile.files[0]) {
      imageData = await fileToDataURL(this.dom.inpFile.files[0]);
    } else if (this.dom.editor.classList.contains("no-image")) {
      clearImage = true;
    } else if (
      this.editingKey &&
      this.context.cache[this.editingKey]?.filename
    ) {
      imageData = this.context.cache[this.editingKey].filename;
    }

    const res = await PresetGalleryAPI.savePreset({
      name,
      folder: this.dom.inpFolder.value.trim(),
      presetText: this.dom.inpPreset.value.trim(),
      imageData,
      clearImage,
      editingKey: this.editingKey,
      mode: this.currentMode,
    });

    if (!res.success) return alert(`Save failed.`);

    if (
      this.currentMode === "edit" &&
      this.editingKey !== uniqueKey &&
      this.context.cache[this.editingKey]
    ) {
      selections = selections.map((item) =>
        item === this.editingKey ? uniqueKey : item
      );
    }

    if (!selections.includes(uniqueKey)) selections.push(uniqueKey);

    this.editingKey = uniqueKey;
    this.currentMode = "edit";
    this.isSaved = true;
    await this.context.loadGallery();
    this.context.updateWidgetValue(selections);
    this.updateBanner();
  }

  async handleDelete() {
    if (!this.editingKey || !this.context.cache[this.editingKey])
      return alert("No valid target.");
    if (!confirm(`Delete "${this.editingKey}"?`)) return;

    await PresetGalleryAPI.deletePreset(this.editingKey);
    await this.context.loadGallery();
    this.context.updateWidgetValue(
      this.context.getSelectedArray().filter((v) => v !== this.editingKey)
    );
    this.clearFields();
  }

  bindEvents() {
    const markDirty = () => {
      if (this.currentMode === "edit" && this.isSaved) {
        this.isSaved = false;
        this.updateBanner();
      }
      if (this.dom.editor.classList.contains("no-image")) this.renderPreview();
    };

    ["inpName", "inpFolder", "inpPreset"].forEach((id) =>
      this.dom[id].addEventListener("input", markDirty)
    );
    this.dom.editorPreview.addEventListener("click", (e) => {
      if (e.target.closest("#j0n4t-pg-rm-img-btn")) {
        e.stopPropagation();
        if (confirm("Clear image?")) {
          this.resetImageState();
          markDirty();
        }
      } else this.dom.inpFile.click();
    });
    this.dom.inpFile.addEventListener("change", () => {
      if (this.dom.inpFile.files[0]) {
        this.dom.editor.classList.replace("no-image", "has-image");
        this.renderPreview();
        markDirty();
      }
    });

    const handleQuickSave = (e) => {
      if (e.key === "Enter" && e.shiftKey) {
        e.preventDefault();
        this.dom.btnSave.click();
      }
    };
    ["inpName", "inpFolder", "inpPreset"].forEach((id) =>
      this.dom[id].addEventListener("keydown", handleQuickSave)
    );

    this.dom.inpPreset.addEventListener("paste", (e) => {
      if (!this.dom.inpName.value.trim() || this.currentMode === "new") {
        const text = (e.clipboardData || window.clipboardData).getData("text");
        if (text) {
          const suggested = text
            .split(/[,\n]/)[0]
            .trim()
            .toLowerCase()
            .replace(/[^a-z0-9\s-_]/g, "")
            .trim()
            .replace(/\s+/g, "_")
            .split("_")
            .slice(0, 4)
            .join("_");
          if (suggested) {
            this.dom.inpName.value = suggested;
            markDirty();
          }
        }
      }
    });

    this.dom.btnClearFields.addEventListener("click", () => this.clearFields());
    this.dom.btnSave.addEventListener("click", () => this.handleSave());
    this.dom.btnDel.addEventListener("click", () => this.handleDelete());
  }

  initFolderAutocomplete() {
    new AutocompleteManager({
      input: this.dom.inpFolder,
      container: document.body,
      popupClass: "j0n4t-pg-folder-autocomplete-popup",
      itemClass: "j0n4t-pg-folder-autocomplete-item",
      getMatches: (query) => {
        query = query.trim().toLowerCase().replace(/ /g, "_");
        if (!query) return [];
        const allFolders = Array.from(
          new Set(
            Object.values(this.context.cache).flatMap((i) =>
              i.tags?.length ? [i.tags.join("/")] : []
            )
          )
        );
        return PresetUtils.getTopMatches(allFolders, query, (f) =>
          f.replace(/_/g, " ")
        );
      },
      renderItem: (match) => match.replace(/_/g, " "),
      onSelect: (match) => {
        this.dom.inpFolder.value = match;
        this.dom.inpFolder.focus();
      },
    });
  }
}

class PresetGalleryApp {
  constructor(node, widget) {
    this.node = node;
    this.widget = widget;
    this.cache = {};
    this.dom = this.buildDOMStructure();

    this.basket = new PresetBasket(
      this.dom.basketContainer,
      this.dom.wrap.querySelector(".j0n4t-pg-basket-pool"),
      this.dom.rawTextarea,
      this
    );
    this.editor = new PresetEditor(this.dom, this);
    this.grid = new PresetGrid(this.dom, this);

    this.bindEvents();
    this.editor.renderPreview();
  }

  buildDOMStructure() {
    const wrap = document.createElement("div");
    wrap.className = "j0n4t-pg-wrap";
    wrap.innerHTML = `
            <div class="j0n4t-pg-basket-container">
                <div class="j0n4t-pg-basket-header">
                    <div class="j0n4t-pg-basket-title">🧺 Presets Basket</div>
                    <div style="display: flex; gap: 4px; align-items: center;">
                        <label class="j0n4t-pg-checkbox-wrap" style="height:auto; padding:0; margin-right:4px;"><input type="checkbox" id="j0n4t-pg-basket-raw-toggle" />Raw</label>
                        <button type="button" id="j0n4t-pg-basket-copy-btn" title="Copy expanded prompt output (useful for creating new presets)" style="font-size:9px; color:#fff; background:#444; border:none; padding:2px 6px; border-radius:3px; cursor:pointer;">📋 Output</button>
                        <button type="button" class="j0n4t-pg-basket-clear-btn" title="Clear basket" style="font-size:9px; color:#fff; background:#b23b3b; border:none; padding:2px 6px; border-radius:3px; cursor:pointer;">🗑️ Clear</button>
                    </div>
                </div>
                <div class="j0n4t-pg-basket-pool"></div>
                <div class="j0n4t-pg-raw-wrapper">
                    <div class="j0n4t-pg-raw-highlights" id="j0n4t-pg-raw-highlights"></div>
                    <textarea class="j0n4t-pg-basket-raw-textarea" id="j0n4t-pg-raw-input" placeholder="Tokens..."></textarea>
                </div>
            </div>
            <div class="j0n4t-pg-top-bar">
                <div class="j0n4t-pg-search-wrapper"><input type="text" enterkeyhint="enter" class="j0n4t-pg-search" placeholder="Search..." /><div class="j0n4t-pg-search-clear">${PresetUtils.icons.close}</div></div>
                <div class="j0n4t-pg-views">
                    <div class="j0n4t-pg-view-btn" data-view="small">${PresetUtils.icons.small}</div><div class="j0n4t-pg-view-btn" data-view="big">${PresetUtils.icons.big}</div><div class="j0n4t-pg-view-btn" data-view="list">${PresetUtils.icons.list}</div>
                </div>
                <div class="j0n4t-pg-toggle-gallery-wrap" title="Toggle Gallery View"><div class="j0n4t-pg-view-btn active" id="j0n4t-pg-hide-gallery-btn">${PresetUtils.icons.eye}</div></div>
            </div>
             <div class="j0n4t-pg-control-bar">
                <div class="j0n4t-pg-toggle" id="j0n4t-pg-toggle">⚙️ Management Panel</div>
                <button type="button" id="j0n4t-pg-global-collapse" style="background:#2a2a2a80; border:1px solid #444; color:#ccc; padding:4px 8px; border-radius:3px; cursor:pointer; font-size:10px;">↕️ Collapse All</button>
                <label class="j0n4t-pg-checkbox-wrap"><input type="checkbox" id="j0n4t-pg-group-toggle" />Group</label>
            </div>
            <div class="j0n4t-pg-editor collapsed no-image">
                <div class="j0n4t-pg-row">
                    <div id="j0n4t-pg-banner" class="j0n4t-pg-editor-banner">📝 Select an Item</div>
                    <input type="file" id="j0n4t-pg-json-file" accept=".zip,.json,.yaml,.yml" style="display:none;" />
                    <button type="button" id="j0n4t-pg-import-btn" class="j0n4t-pg-btn" style="background:#454545;" title="Import Presets (.zip, .yaml, .json)">${PresetUtils.icons.import}</button>
                    <button type="button" id="j0n4t-pg-export-btn" class="j0n4t-pg-btn" style="background:#454545;" title="Export Presets (.zip, .yaml, .json)">${PresetUtils.icons.export}</button>
                    <button type="button" id="j0n4t-pg-clear-fields-btn" class="j0n4t-pg-btn" style="background:#555;">New</button>
                    <button type="button" id="j0n4t-pg-save-btn" class="j0n4t-pg-btn" style="background:#007acc;">Save</button>
                    <button type="button" id="j0n4t-pg-del-btn" class="j0n4t-pg-btn" style="background:#a32a2a;">Delete</button>
                </div>
                <div style="display:flex; gap:6px; align-items:stretch;">
                    <div id="j0n4t-pg-editor-preview" class="j0n4t-pg-editor-preview"></div>
                    <div style="display:flex; flex-direction:column; gap:6px; flex-grow:1;">
                        <textarea id="j0n4t-pg-preset" placeholder="Keywords..."></textarea>
                        <div class="j0n4t-pg-row"><input type="text" id="j0n4t-pg-folder" placeholder="Folder" style="flex:1;" /><input type="text" id="j0n4t-pg-name" placeholder="Name" style="flex:1;" /></div>
                    </div>
                </div>
                <input type="file" id="j0n4t-pg-file" accept="image/*" style="display:none;" />
            </div>
            <div class="j0n4t-pg-grid"></div>
        `;
    return {
      wrap,
      grid: wrap.querySelector(".j0n4t-pg-grid"),
      search: wrap.querySelector(".j0n4t-pg-search"),
      searchClear: wrap.querySelector(".j0n4t-pg-search-clear"),
      editor: wrap.querySelector(".j0n4t-pg-editor"),
      banner: wrap.querySelector("#j0n4t-pg-banner"),
      toggle: wrap.querySelector("#j0n4t-pg-toggle"),
      viewsContainer: wrap.querySelector(".j0n4t-pg-views"),
      chkGroup: wrap.querySelector("#j0n4t-pg-group-toggle"),
      btnGlobalCollapse: wrap.querySelector("#j0n4t-pg-global-collapse"),
      editorPreview: wrap.querySelector("#j0n4t-pg-editor-preview"),
      inpName: wrap.querySelector("#j0n4t-pg-name"),
      inpFolder: wrap.querySelector("#j0n4t-pg-folder"),
      inpPreset: wrap.querySelector("#j0n4t-pg-preset"),
      inpFile: wrap.querySelector("#j0n4t-pg-file"),
      btnClearFields: wrap.querySelector("#j0n4t-pg-clear-fields-btn"),
      btnSave: wrap.querySelector("#j0n4t-pg-save-btn"),
      btnDel: wrap.querySelector("#j0n4t-pg-del-btn"),
      inpJsonFile: wrap.querySelector("#j0n4t-pg-json-file"),
      btnImport: wrap.querySelector("#j0n4t-pg-import-btn"),
      btnExport: wrap.querySelector("#j0n4t-pg-export-btn"),
      btnCopyBasket: wrap.querySelector("#j0n4t-pg-basket-copy-btn"),
      btnClearBasket: wrap.querySelector(".j0n4t-pg-basket-clear-btn"),
      chkBasketRaw: wrap.querySelector("#j0n4t-pg-basket-raw-toggle"),
      basketContainer: wrap.querySelector(".j0n4t-pg-basket-container"),
      rawTextarea: wrap.querySelector("#j0n4t-pg-raw-input"),
      rawHighlights: wrap.querySelector("#j0n4t-pg-raw-highlights"),
      btnHideGallery: wrap.querySelector("#j0n4t-pg-hide-gallery-btn"),
    };
  }

  getCollapsedFolders() {
    try {
      return (
        JSON.parse(localStorage.getItem("pg_collapsed_folders_list")) || []
      );
    } catch (e) {
      return [];
    }
  }

  setCollapsedFolders(list) {
    localStorage.setItem("pg_collapsed_folders_list", JSON.stringify(list));
  }

  getSelectedArray() {
    return this.widget.value
      ? this.widget.value
        .split(",")
        .map((v) => v.trim())
        .filter(Boolean)
      : [];
  }

  updateWidgetValue(arr) {
    this.widget.value = arr.join(", ");
    this.widget.callback?.(this.widget.value);
    this.syncUI(this.widget.value);
    if (this.node.graph) this.node.graph._version++;
  }

  setPanelCollapseState(col, isInit = false) {
    const isCurrentlyCollapsed = this.dom.editor.classList.contains("collapsed");
    if (isCurrentlyCollapsed === col) return;

    if (!isInit) {
      const spaceDelta = (this.dom.editor.offsetHeight || 200) + 6;

      if (col) {
        this.lastEditorHeight = spaceDelta;
        const isGalleryHidden = this.dom.wrap.classList.contains("hide-gallery-mode");
        if (!isGalleryHidden && this.dom.grid.offsetHeight > 0) {
          const currentGridH = this.dom.grid.offsetHeight;
          this.dom.grid.style.height = `${currentGridH + spaceDelta}px`;
          this.dom.grid.style.flexGrow = "0";
          localStorage.setItem("comfy_preset_gallery_grid_h", String(currentGridH + spaceDelta));
        } else {
          const currentBasketH = this.dom.basketContainer.offsetHeight;
          this.dom.basketContainer.style.height = `${currentBasketH + spaceDelta}px`;
          localStorage.setItem("comfy_preset_gallery_basket_h", String(currentBasketH + spaceDelta));
        }
      } else {
        const takeBackHeight = this.lastEditorHeight || 200;
        const isGalleryHidden = this.dom.wrap.classList.contains("hide-gallery-mode");
        if (!isGalleryHidden && this.dom.grid.offsetHeight > 0) {
          const currentGridH = this.dom.grid.offsetHeight;
          const newH = Math.max(60, currentGridH - takeBackHeight);
          this.dom.grid.style.height = `${newH}px`;
          localStorage.setItem("comfy_preset_gallery_grid_h", String(newH));
        } else {
          const currentBasketH = this.dom.basketContainer.offsetHeight;
          const newH = Math.max(40, currentBasketH - takeBackHeight);
          this.dom.basketContainer.style.height = `${newH}px`;
          localStorage.setItem("comfy_preset_gallery_basket_h", String(newH));
        }
      }
    }

    this.dom.editor.classList.toggle("collapsed", col);
    this.dom.toggle.innerText = col ? "⚙️ Management Panel" : "🔼 Hide Panel";
    localStorage.setItem("comfy_preset_gallery_collapsed", String(col));
  }

  syncEditorHighlight() {
    this.dom.grid
      .querySelectorAll(".j0n4t-pg-item")
      .forEach((el) =>
        el.classList.toggle(
          "editing",
          this.editor.currentMode === "edit" &&
          el.dataset.style === this.editor.editingKey
        )
      );
  }

  openEditorForPreset(styleKey) {
    this.editor.openPreset(styleKey);
  }

  async loadGallery() {
    this.cache = await PresetGalleryAPI.fetchGallery();
    this.grid.compile(this.cache);
  }

  async syncUI(val) {
    const arr = val
      ? val
        .split(",")
        .map((v) => v.trim())
        .filter(Boolean)
      : [];
    this.grid.syncSelection(arr);
    this.basket.render(arr);
    this.syncEditorHighlight();
  }

  bindEvents() {
    this.dom.toggle.addEventListener("click", () =>
      this.setPanelCollapseState(
        !this.dom.editor.classList.contains("collapsed")
      )
    );
    this.dom.search.addEventListener("input", () =>
      this.grid.executeFilterPipeline(this.dom.search.value)
    );
    this.dom.searchClear.addEventListener("click", () => {
      this.dom.search.value = "";
      this.grid.executeFilterPipeline();
      this.dom.search.focus();
    });

    this.dom.btnExport.addEventListener("click", () => {
      PresetGalleryAPI.showExportModal((format, mode) => {
        PresetGalleryAPI.exportPool(format, mode);
      });
    });

    this.dom.btnImport.addEventListener("click", () => this.dom.inpJsonFile.click());
    this.dom.inpJsonFile.addEventListener("change", async (e) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const res = await PresetGalleryAPI.importFile(file);
      if (res.success) {
        await this.loadGallery();
        alert("Presets imported successfully!");
      }
      this.dom.inpJsonFile.value = "";
    });

    this.dom.btnHideGallery.addEventListener("click", () => {
      const isHidden = this.dom.wrap.classList.toggle("hide-gallery-mode");
      this.dom.btnHideGallery.classList.toggle("active", !isHidden);
      localStorage.setItem("comfy_preset_gallery_hidden", String(isHidden));
    });

    if (localStorage.getItem("comfy_preset_gallery_hidden") === "true") {
      this.dom.wrap.classList.add("hide-gallery-mode");
      this.dom.btnHideGallery.classList.remove("active");
    }
    const savedBasketH = localStorage.getItem("comfy_preset_gallery_basket_h");
    if (savedBasketH) {
      this.dom.basketContainer.style.height = `${savedBasketH}px`;
    }

    const savedGridH = localStorage.getItem("comfy_preset_gallery_grid_h");
    if (savedGridH) {
      this.dom.grid.style.height = `${savedGridH}px`;
      this.dom.grid.style.flexGrow = "0";
    }

    this.resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const h = entry.target.offsetHeight;
        if (h === 0) continue;

        if (entry.target === this.dom.basketContainer) {
          localStorage.setItem("comfy_preset_gallery_basket_h", String(h));
        } else if (entry.target === this.dom.grid) {
          localStorage.setItem("comfy_preset_gallery_grid_h", String(h));
          entry.target.style.flexGrow = "0";
        }
      }
    });

    this.resizeObserver.observe(this.dom.basketContainer);
    this.resizeObserver.observe(this.dom.grid);
  }

  initFilterAutocomplete() {
    const manager = new AutocompleteManager({
      input: this.dom.search,
      container: this.dom.wrap,
      popupClass: "j0n4t-pg-filter-autocomplete-popup",
      itemClass: "j0n4t-pg-filter-autocomplete-item",
      getMatches: (query) => {
        query = query.trim().toLowerCase();
        if (!query) return [];
        return PresetUtils.getTopMatches(Object.keys(this.cache), query, (k) =>
          PresetUtils.getSearchBlob(k, this.cache[k])
        );
      },
      renderItem: (match) =>
        `<span title="${PresetUtils.getPresetTitle(match, this.cache)}">${PresetUtils.escapeHTML(PresetUtils.toTitleCase(match.split("/").pop()))}</span><span class="j0n4t-pg-filter-autocomplete-meta">${PresetUtils.escapeHTML(match)}</span>`,
      onSelect: (match) => {
        const sel = this.getSelectedArray();
        if (!sel.includes(match)) this.updateWidgetValue([...sel, match]);
        this.dom.search.value = "";
        this.grid.executeFilterPipeline();
        this.dom.search.focus();
      },
      onKeyDown: (e) => {
        if (!manager.isOpen && e.key === "Enter" && !e.shiftKey) {
          this.grid.executeFilterPipeline(this.dom.search.value);
        }
      },
    });
  }

  async init() {
    await this.loadGallery();
    if (this.widget.value) await this.syncUI(this.widget.value);
    this.initFilterAutocomplete();
    this.setPanelCollapseState(
      localStorage.getItem("comfy_preset_gallery_collapsed") === "true",
      true
    );
    this.node.setSize([
      this.node.size[0] || MIN_NODE_WIDTH,
      this.node.size[1] || MIN_NODE_HEIGHT,
    ]);
  }
}

// Registration
PresetGalleryStyles.inject();

app.registerExtension({
  name: "Comfy.PresetGallery",
  async beforeRegisterNodeDef(nodeType, nodeData) {
    if (nodeData.name !== "PresetGalleryNode") return;
    const onNodeCreated = nodeType.prototype.onNodeCreated;

    nodeType.prototype.onNodeCreated = function () {
      onNodeCreated?.apply(this, arguments);
      const widget = this.widgets?.find((w) => w.name === "preset_selection");
      if (!widget) return;
      widget.hidden = true;

      const galleryView = new PresetGalleryApp(this, widget);
      const baseCallback = widget.callback;

      widget.callback = function (value) {
        galleryView.syncUI(value);
        baseCallback?.apply(this, arguments);
      };

      // Client-side prompt expansion prior to queue execution
      widget.serializeValue = function () {
        const raw = widget.value || "";
        const keys = raw
          .split(",")
          .map((k) => k.trim())
          .filter(Boolean);
        const expanded = keys
          .map((k) => galleryView.cache[k]?.preset || k)
          .join(", ");
        return expanded;
      };

      galleryView.init();
      this.addDOMWidget("preset_gallery_ui", "HTML", galleryView.dom.wrap);
    };
  },
  async nodeCreated(node) {
    if (node.comfyClass === "PresetGalleryNode") {
      node.size = node.min_size = [MIN_NODE_WIDTH, MIN_NODE_HEIGHT];
      node.properties = node.properties || {};
    }
  },
});
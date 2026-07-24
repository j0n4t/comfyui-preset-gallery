import PresetUtils from "./PresetUtils.js";

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

const createThumbnail = async (dataUrl) => {
  if (!dataUrl || !dataUrl.startsWith("data:image/")) return dataUrl;

  try {
    const img = new Image();
    img.src = dataUrl;

    await new Promise((resolve, reject) => {
      img.onload = resolve;
      img.onerror = reject;
    });

    const canvas = document.createElement("canvas");
    const MAX_DIMENSION = 200;

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

    const ctx = canvas.getContext("2d");
    ctx.drawImage(img, 0, 0, width, height);

    return canvas.toDataURL("image/jpeg", 0.7);
  } catch (error) {
    console.error("Error creating thumbnail:", error);
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

export default class PresetGalleryAPI {
  static API_ENDPOINT = "/preset_gallery/presets";

  static async fetchGallery() {
    try {
      const res = await fetch(PresetGalleryAPI.API_ENDPOINT);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const serverPool = await res.json();

      // Auto-migrate browser localStorage presets to server on first load
      const localData = localStorage.getItem("comfy_preset_gallery_pool");
      if (localData && Object.keys(serverPool).length === 0) {
        try {
          const localPool = JSON.parse(localData);
          if (Object.keys(localPool).length > 0) {
            await PresetGalleryAPI.savePool(localPool);
            localStorage.removeItem("comfy_preset_gallery_pool");
            return localPool;
          }
        } catch (e) {
          console.error("[PresetGalleryAPI] Failed to migrate localStorage pool:", e);
        }
      }

      return serverPool;
    } catch (error) {
      console.error("[PresetGalleryAPI] Error fetching gallery:", error);
      return {};
    }
  }

  static async getPool() {
    return await PresetGalleryAPI.fetchGallery();
  }

  static async savePool(pool) {
    try {
      const res = await fetch(PresetGalleryAPI.API_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(pool),
      });
      return await res.json();
    } catch (error) {
      console.error("[PresetGalleryAPI] Error saving pool:", error);
      return { success: false, error };
    }
  }

  static async savePreset({ name, folder, presetText, imageData, clearImage, editingKey, mode }) {
    const pool = await PresetGalleryAPI.getPool();
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
      finalImage = await createThumbnail(imageData);
    }

    pool[newKey] = {
      preset: presetText,
      tags: tags,
      filename: finalImage,
    };

    await PresetGalleryAPI.savePool(pool);
    return { success: true, key: newKey };
  }

  static async deletePreset(uniqueKey) {
    const pool = await PresetGalleryAPI.getPool();
    delete pool[uniqueKey];
    await PresetGalleryAPI.savePool(pool);
    return { success: true };
  }

  static async renameFolder(oldFolder, newFolder) {
    const pool = await PresetGalleryAPI.getPool();
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

    await PresetGalleryAPI.savePool(newPool);
    return { success: true };
  }

  static buildPresetSelectorTree(pool) {
    const container = document.createElement("div");
    container.className = "j0n4t-pg-selector-container";

    const controls = document.createElement("div");
    controls.className = "j0n4t-pg-selector-controls";
    controls.innerHTML = `
      <label class="j0n4t-pg-checkbox-wrap">
        <input type="checkbox" id="j0n4t-pg-sel-all" checked />
        <span><strong>Select / Deselect All</strong></span>
      </label>
    `;
    container.appendChild(controls);

    const treeBox = document.createElement("div");
    treeBox.className = "j0n4t-pg-selector-tree";

    const groups = {};
    for (const [key, item] of Object.entries(pool)) {
      const gKey = item.tags && item.tags.length ? item.tags.join("/") : "root_presets";
      if (!groups[gKey]) groups[gKey] = [];
      groups[gKey].push({ key, item });
    }

    for (const [gKey, items] of Object.entries(groups)) {
      const gName = gKey === "root_presets" ? "Root Presets" : gKey.split("/").map(PresetUtils.toTitleCase).join(" › ");

      const groupEl = document.createElement("div");
      groupEl.className = "j0n4t-pg-tree-group";

      const groupHeader = document.createElement("div");
      groupHeader.className = "j0n4t-pg-tree-group-header";
      groupHeader.innerHTML = `
        <label class="j0n4t-pg-checkbox-wrap">
          <input type="checkbox" class="j0n4t-pg-group-cb" data-group="${PresetUtils.escapeHTML(gKey)}" checked />
          <span><strong>${PresetUtils.escapeHTML(gName)}</strong> (${items.length})</span>
        </label>
      `;
      groupEl.appendChild(groupHeader);

      const itemsBox = document.createElement("div");
      itemsBox.className = "j0n4t-pg-tree-group-items";

      items.forEach(({ key }) => {
        const itemRow = document.createElement("div");
        itemRow.className = "j0n4t-pg-tree-item";
        itemRow.innerHTML = `
          <label class="j0n4t-pg-checkbox-wrap">
            <input type="checkbox" class="j0n4t-pg-item-cb" data-group="${PresetUtils.escapeHTML(gKey)}" value="${PresetUtils.escapeHTML(key)}" checked />
            <span>${PresetUtils.escapeHTML(PresetUtils.getPresetName(key))}</span>
          </label>
        `;
        itemsBox.appendChild(itemRow);
      });

      groupEl.appendChild(itemsBox);
      treeBox.appendChild(groupEl);
    }

    container.appendChild(treeBox);

    const masterCb = controls.querySelector("#j0n4t-pg-sel-all");
    const groupCbs = treeBox.querySelectorAll(".j0n4t-pg-group-cb");
    const itemCbs = treeBox.querySelectorAll(".j0n4t-pg-item-cb");

    const updateGroupAndMasterStates = () => {
      let allItemsChecked = true;
      let anyItemChecked = false;

      groupCbs.forEach((gCb) => {
        const gKey = gCb.dataset.group;
        const groupItems = treeBox.querySelectorAll(`.j0n4t-pg-item-cb[data-group="${CSS.escape(gKey)}"]`);
        const checkedCount = Array.from(groupItems).filter((c) => c.checked).length;

        if (checkedCount === groupItems.length) {
          gCb.checked = true;
          gCb.indeterminate = false;
        } else if (checkedCount === 0) {
          gCb.checked = false;
          gCb.indeterminate = false;
        } else {
          gCb.checked = false;
          gCb.indeterminate = true;
        }

        if (checkedCount > 0) anyItemChecked = true;
        if (checkedCount < groupItems.length) allItemsChecked = false;
      });

      masterCb.checked = allItemsChecked;
      masterCb.indeterminate = !allItemsChecked && anyItemChecked;
    };

    masterCb.addEventListener("change", () => {
      itemCbs.forEach((cb) => (cb.checked = masterCb.checked));
      groupCbs.forEach((cb) => {
        cb.checked = masterCb.checked;
        cb.indeterminate = false;
      });
    });

    groupCbs.forEach((gCb) => {
      gCb.addEventListener("change", () => {
        const gKey = gCb.dataset.group;
        const groupItems = treeBox.querySelectorAll(`.j0n4t-pg-item-cb[data-group="${CSS.escape(gKey)}"]`);
        groupItems.forEach((cb) => (cb.checked = gCb.checked));
        updateGroupAndMasterStates();
      });
    });

    itemCbs.forEach((cb) => {
      cb.addEventListener("change", updateGroupAndMasterStates);
    });

    return {
      element: container,
      getSelectedKeys: () =>
        Array.from(treeBox.querySelectorAll(".j0n4t-pg-item-cb:checked")).map((cb) => cb.value),
    };
  }

  static async showExportModal(onExport) {
    const pool = await PresetGalleryAPI.getPool();
    if (Object.keys(pool).length === 0) {
      alert("No presets available to export.");
      return;
    }

    const overlay = document.createElement("div");
    overlay.className = "j0n4t-pg-modal-overlay";

    const modal = document.createElement("div");
    modal.className = "j0n4t-pg-modal j0n4t-pg-modal-large";
    modal.innerHTML = `
      <h3>📦 Export Selected Presets</h3>
      <div class="j0n4t-pg-modal-row">
        <div class="j0n4t-pg-modal-field" style="flex:1;">
          <label>File Format</label>
          <select id="j0n4t-pg-exp-format">
            <option value="zip">ZIP Archive (.zip)</option>
            <option value="yaml">YAML (.yaml)</option>
            <option value="json">JSON (.json)</option>
          </select>
        </div>
        <div class="j0n4t-pg-modal-field" style="flex:1;">
          <label>Data Content</label>
          <select id="j0n4t-pg-exp-mode">
            <option value="full">Full Data (With Images)</option>
            <option value="preset-only">Presets Only (Clean)</option>
          </select>
        </div>
      </div>
      <div class="j0n4t-pg-modal-field">
        <label>Select Presets & Groups to Export</label>
        <div id="j0n4t-pg-tree-mount"></div>
      </div>
      <div class="j0n4t-pg-modal-actions">
        <button type="button" class="j0n4t-pg-btn" id="j0n4t-pg-exp-cancel" style="background:#444;">Cancel</button>
        <button type="button" class="j0n4t-pg-btn" id="j0n4t-pg-exp-confirm" style="background:#007acc;">Export Selected</button>
      </div>
    `;

    overlay.appendChild(modal);

    const tree = PresetGalleryAPI.buildPresetSelectorTree(pool);
    modal.querySelector("#j0n4t-pg-tree-mount").appendChild(tree.element);

    const close = () => overlay.remove();
    modal.querySelector("#j0n4t-pg-exp-cancel").addEventListener("click", close);
    overlay.addEventListener("click", (e) => {
      if (e.target === overlay) close();
    });

    modal.querySelector("#j0n4t-pg-exp-confirm").addEventListener("click", () => {
      const selectedKeys = tree.getSelectedKeys();
      if (!selectedKeys.length) {
        alert("Please select at least one preset to export.");
        return;
      }
      const format = modal.querySelector("#j0n4t-pg-exp-format").value;
      const mode = modal.querySelector("#j0n4t-pg-exp-mode").value;
      close();
      onExport(format, mode, selectedKeys);
    });

    document.body.appendChild(overlay);
  }

  static async exportPool(format = "zip", mode = "full", selectedKeys = null) {
    let pool = await PresetGalleryAPI.getPool();

    if (selectedKeys && Array.isArray(selectedKeys)) {
      const filtered = {};
      for (const k of selectedKeys) {
        if (pool[k]) filtered[k] = pool[k];
      }
      pool = filtered;
    }

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

    let dataStr;
    let mimeType;
    let ext;

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

  static async showImportModal(importedPool, onConfirm) {
    const overlay = document.createElement("div");
    overlay.className = "j0n4t-pg-modal-overlay";

    const modal = document.createElement("div");
    modal.className = "j0n4t-pg-modal j0n4t-pg-modal-large";

    const currentPool = await PresetGalleryAPI.getPool();
    const duplicates = Object.keys(importedPool).filter((k) => k in currentPool);

    modal.innerHTML = `
      <h3>📥 Import Presets</h3>
      <div class="j0n4t-pg-modal-field">
        <label>Handling Duplicate Presets (${duplicates.length} detected)</label>
        <select id="j0n4t-pg-dup-strategy">
          <option value="overwrite">Overwrite existing presets</option>
          <option value="skip">Skip duplicates</option>
          <option value="keep_both">Keep both (Rename imported with _copy)</option>
        </select>
      </div>
      <div class="j0n4t-pg-modal-field">
        <label>Select Presets & Groups to Import</label>
        <div id="j0n4t-pg-tree-mount"></div>
      </div>
      <div class="j0n4t-pg-modal-actions">
        <button type="button" class="j0n4t-pg-btn" id="j0n4t-pg-imp-cancel" style="background:#444;">Cancel</button>
        <button type="button" class="j0n4t-pg-btn" id="j0n4t-pg-imp-confirm" style="background:#007acc;">Import Selected</button>
      </div>
    `;

    overlay.appendChild(modal);

    const tree = PresetGalleryAPI.buildPresetSelectorTree(importedPool);
    modal.querySelector("#j0n4t-pg-tree-mount").appendChild(tree.element);

    const close = () => overlay.remove();
    modal.querySelector("#j0n4t-pg-imp-cancel").addEventListener("click", close);
    overlay.addEventListener("click", (e) => {
      if (e.target === overlay) close();
    });

    modal.querySelector("#j0n4t-pg-imp-confirm").addEventListener("click", () => {
      const selectedKeys = tree.getSelectedKeys();
      if (!selectedKeys.length) {
        alert("Please select at least one preset to import.");
        return;
      }
      const duplicateStrategy = modal.querySelector("#j0n4t-pg-dup-strategy").value;
      close();
      onConfirm({ selectedKeys, duplicateStrategy });
    });

    document.body.appendChild(overlay);
  }

  static async importFile(file) {
    let importedPool = {};

    if (file.name.toLowerCase().endsWith(".zip")) {
      try {
        const JSZip = await loadJSZip();
        const zip = await JSZip.loadAsync(file);

        const txtFiles = {};
        const imgFiles = {};

        for (const [relativePath, zipEntry] of Object.entries(zip.files)) {
          if (zipEntry.dir) continue;

          const normalizedPath = relativePath.replace(/\\/g, "/").replace(/^[/\\]+/, "");
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
      } catch (err) {
        alert("Failed to parse ZIP file: " + err.message);
        return { success: false };
      }
    } else {
      try {
        const text = await new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = (e) => resolve(e.target.result);
          reader.onerror = reject;
          reader.readAsText(file);
        });

        let parsedData = null;
        if (file.name.endsWith(".yaml") || file.name.endsWith(".yml")) {
          parsedData = YAMLUtils.parse(text);
        } else {
          parsedData = JSON.parse(text);
        }

        if (typeof parsedData !== "object" || parsedData === null) {
          throw new Error("Invalid file structure");
        }

        importedPool = NestedPoolUtils.nestedToFlat(parsedData);

        for (const item of Object.values(importedPool)) {
          if (item && item.filename && item.filename.startsWith("data:image/")) {
            item.filename = await createThumbnail(item.filename);
          }
        }
      } catch (err) {
        alert("Failed to parse file: " + err.message);
        return { success: false };
      }
    }

    if (Object.keys(importedPool).length === 0) {
      alert("No valid presets found in the imported file.");
      return { success: false };
    }

    return new Promise((resolve) => {
      PresetGalleryAPI.showImportModal(importedPool, async ({ selectedKeys, duplicateStrategy }) => {
        const currentPool = await PresetGalleryAPI.getPool();

        for (const key of selectedKeys) {
          const item = importedPool[key];
          if (!item) continue;

          let targetKey = key;
          if (targetKey in currentPool) {
            if (duplicateStrategy === "skip") {
              continue;
            } else if (duplicateStrategy === "keep_both") {
              let copyIndex = 1;
              const parts = key.split("/");
              const baseName = parts.pop();
              const folderPrefix = parts.length ? parts.join("/") + "/" : "";

              while (`${folderPrefix}${baseName}_copy_${copyIndex}` in currentPool) {
                copyIndex++;
              }
              targetKey = `${folderPrefix}${baseName}_copy_${copyIndex}`;
              item.tags = targetKey.includes("/") ? targetKey.split("/").slice(0, -1) : [];
            }
          }

          currentPool[targetKey] = item;
        }

        await PresetGalleryAPI.savePool(currentPool);
        resolve({ success: true });
      });
    });
  }
}
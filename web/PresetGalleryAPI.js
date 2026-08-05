import NestedPresetUtils from "./NestedPresetUtils.js";
import PresetUtils from "./PresetUtils.js";
import YAMLUtils from "./YAMLUtils.js";

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
    const sortedPresets = Object.entries(presets)
      .sort((a, b) => a[0].localeCompare(b[0]))
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

    let finalImage = presets[editingKey]?.filename || null;
    if (clearImage) {
      finalImage = null;
    } else if (imageData) {
      finalImage = await PresetUtils.createThumbnail(imageData);
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

  static buildPresetSelectorTree(presets, existingPresets = null) {
    const container = document.createElement("div");
    container.className = "j0n4t-pg-selector-container";

    const controls = document.createElement("div");
    controls.className = "j0n4t-pg-selector-controls";

    controls.innerHTML = `
      <div style="display: flex; justify-content: space-between; align-items: center; width: 100%; margin-bottom: 8px;">
        <label class="j0n4t-pg-checkbox-wrap" style="margin: 0;">
          <input type="checkbox" id="j0n4t-pg-sel-all" checked />
          <span><strong>Select / Deselect All</strong></span>
        </label>
        <button type="button" id="j0n4t-pg-toggle-collapse-all" style="background: transparent; border: 1px solid #777; color: inherit; padding: 2px 8px; border-radius: 4px; cursor: pointer; font-size: 0.85em;">Collapse All</button>
      </div>
    `;
    container.appendChild(controls);

    const treeBox = document.createElement("div");
    treeBox.className = "j0n4t-pg-selector-tree";

    const groups = {};
    for (const [key, item] of Object.entries(presets).sort((a, b) => a[0].localeCompare(b[0]))) {
      const hasContent = item && ((typeof item.preset === "string" && item.preset.trim().length > 0) || item.filename);
      if (!hasContent) continue;

      const gKey = PresetUtils.getPresetFolder(key) || "root_presets";
      if (!groups[gKey]) groups[gKey] = [];
      groups[gKey].push({ key, item });
    }

    for (const [gKey, items] of Object.entries(groups)) {
      let gName;
      let groupHex = "#007acc";
      if (gKey === "root_presets") {
        gName = "Root Presets";
      } else {
        gName = gKey.split("/").map(PresetUtils.toTitleCase).join(" › ");
        if (presets[gKey] && presets[gKey].__color__) groupHex = presets[gKey].__color__;
      }

      let newCount = 0;
      let replacedCount = 0;
      let sameCount = 0;

      if (existingPresets) {
        items.forEach(({ key, item }) => {
          if (existingPresets[key]) {
            const oldText = existingPresets[key].preset || "";
            const newText = item.preset || "";
            const oldImg = existingPresets[key].filename || null;
            const newImg = item.filename || null;

            if (oldText !== newText || oldImg !== newImg) {
              replacedCount++;
            } else {
              sameCount++;
            }
          } else {
            newCount++;
          }
        });
      }

      let statsHtml = "";
      if (existingPresets) {
        statsHtml = `
          <div style="display: flex; gap: 4px; font-size: 0.75em; align-items: center; margin-left: auto;">
            ${newCount > 0 ? `<span style="background: #2b8a3e; color: white; padding: 2px 6px; border-radius: 12px; font-weight: 500;" title="New Presets">+${newCount} New</span>` : ""}
            ${replacedCount > 0 ? `<span style="background: #e67700; color: white; padding: 2px 6px; border-radius: 12px; font-weight: 500;" title="Modified Presets">~${replacedCount} Replaced</span>` : ""}
            ${sameCount > 0 ? `<span style="background: #495057; color: white; padding: 2px 6px; border-radius: 12px; font-weight: 500;" title="Unchanged Presets">=${sameCount} Same</span>` : ""}
          </div>
        `;
      }

      const groupEl = document.createElement("div");
      groupEl.className = "j0n4t-pg-tree-group";

      const groupHeader = document.createElement("div");
      groupHeader.className = "j0n4t-pg-tree-group-header";
      groupHeader.innerHTML = `
        <div style="display: flex; align-items: center; width: 100%; padding-right: 4px;">
          <span class="j0n4t-pg-collapse-btn" style="cursor: pointer; padding-right: 8px; user-select: none; width: 20px; text-align: center; font-size: 0.9em;">▼</span>
          <label class="j0n4t-pg-checkbox-wrap" style="margin: 0; display: flex; align-items: center;">
            <input type="checkbox" class="j0n4t-pg-group-cb" data-group="${PresetUtils.escapeHTML(gKey)}" checked />
            <span style="border-left:3px solid ${groupHex}; padding-left:6px; margin-right: 8px;"><strong>${PresetUtils.escapeHTML(gName)}</strong> (${items.length})</span>
          </label>
          ${statsHtml}
        </div>
      `;
      groupEl.appendChild(groupHeader);

      const itemsBox = document.createElement("div");
      itemsBox.className = "j0n4t-pg-tree-group-items";

      items.forEach(({ key, item }) => {
        let diffHtml = "";
        let hasDiff = false;
        let isNew = false;
        let isSame = false;

        if (existingPresets) {
          if (existingPresets[key]) {
            const oldText = existingPresets[key].preset || "";
            const newText = item.preset || "";
            const oldImg = existingPresets[key].filename || null;
            const newImg = item.filename || null;

            if (oldText !== newText || oldImg !== newImg) {
              hasDiff = true;

              let textDiffHtml;
              if (oldText !== newText) {
                textDiffHtml = `
                  <div style="color: #ff6b6b; margin-bottom: 4px;"><strong>- Current:</strong><br/>${PresetUtils.escapeHTML(oldText)}</div>
                  <div style="color: #51cf66;"><strong>+ Imported:</strong><br/>${PresetUtils.escapeHTML(newText)}</div>
                `;
              } else {
                textDiffHtml = `<div style="color: #888; font-style: italic;">(Text unchanged)</div>`;
              }

              let imgDiffHtml = "";
              if (oldImg !== newImg) {
                imgDiffHtml = `<div style="margin-top: 6px; color: #fcc419;"><strong>* Image/Thumbnail modified</strong></div>`;
              }

              diffHtml = `
                <div class="j0n4t-pg-diff-container" style="display: none; padding: 8px; margin-top: 4px; margin-left: 28px; background: rgba(0,0,0,0.15); border-left: 2px solid #fcc419; font-family: monospace; font-size: 0.85em; max-height: 200px; overflow-y: auto; border-radius: 4px;">
                  ${textDiffHtml}
                  ${imgDiffHtml}
                </div>
              `;
            } else {
              isSame = true;
            }
          } else {
            isNew = true;
          }
        }

        const itemRow = document.createElement("div");
        itemRow.className = "j0n4t-pg-tree-item";
        itemRow.style.display = "flex";
        itemRow.style.flexDirection = "column";

        let itemStatusTag = "";
        let status = "new";

        if (hasDiff) {
          itemStatusTag = `<span style="font-size: 0.75em; font-weight: bold; color: #fcc419; margin-left: 6px;">(Replaced)</span>`;
          status = "replaced";
        }
        if (isNew) {
          itemStatusTag = `<span style="font-size: 0.75em; font-weight: bold; color: #51cf66; margin-left: 6px;">(New)</span>`;
          status = "new";
        }
        if (isSame) {
          status = "same";
        }

        const checkedAttr = isSame ? "" : "checked";

        itemRow.innerHTML = `
          <div style="display: flex; align-items: center; width: 100%;">
            ${hasDiff
            ? `<span class="j0n4t-pg-diff-btn" style="cursor: pointer; padding-right: 8px; user-select: none; width: 20px; text-align: center; font-size: 0.9em; color: #fcc419;" title="Toggle Diff">⊞</span>`
            : `<span style="width: 20px; padding-right: 8px; display: inline-block;"></span>`
          }
            <label class="j0n4t-pg-checkbox-wrap" style="flex: 1; margin: 0;">
              <input type="checkbox" class="j0n4t-pg-item-cb" data-group="${PresetUtils.escapeHTML(gKey)}" data-status="${status}" data-user-modified="false" value="${PresetUtils.escapeHTML(key)}" ${checkedAttr} />
              <span>${PresetUtils.escapeHTML(PresetUtils.getPresetName(key))}</span>
              ${itemStatusTag}
            </label>
          </div>
          ${diffHtml}
        `;

        if (hasDiff) {
          const diffBtn = itemRow.querySelector(".j0n4t-pg-diff-btn");
          const diffContainer = itemRow.querySelector(".j0n4t-pg-diff-container");
          diffBtn.addEventListener("click", () => {
            const isHidden = diffContainer.style.display === "none";
            diffContainer.style.display = isHidden ? "block" : "none";
            diffBtn.textContent = isHidden ? "⊟" : "⊞";
          });
        }

        itemsBox.appendChild(itemRow);
      });

      const collapseBtn = groupHeader.querySelector(".j0n4t-pg-collapse-btn");
      collapseBtn.addEventListener("click", () => {
        const isCollapsed = itemsBox.style.display === "none";
        itemsBox.style.display = isCollapsed ? "" : "none";
        collapseBtn.textContent = isCollapsed ? "▼" : "▶";
      });

      groupEl.appendChild(itemsBox);
      treeBox.appendChild(groupEl);
    }

    container.appendChild(treeBox);

    const masterCb = controls.querySelector("#j0n4t-pg-sel-all");
    const toggleAllBtn = controls.querySelector("#j0n4t-pg-toggle-collapse-all");
    const groupCbs = treeBox.querySelectorAll(".j0n4t-pg-group-cb");
    const itemCbs = treeBox.querySelectorAll(".j0n4t-pg-item-cb");

    let isAllCollapsed = false;
    toggleAllBtn.addEventListener("click", () => {
      isAllCollapsed = !isAllCollapsed;
      toggleAllBtn.textContent = isAllCollapsed ? "Expand All" : "Collapse All";

      const groupBtns = treeBox.querySelectorAll(".j0n4t-pg-collapse-btn");
      const itemBoxes = treeBox.querySelectorAll(".j0n4t-pg-tree-group-items");

      groupBtns.forEach((btn, idx) => {
        btn.textContent = isAllCollapsed ? "▶" : "▼";
        if (itemBoxes[idx]) {
          itemBoxes[idx].style.display = isAllCollapsed ? "none" : "";
        }
      });
    });

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
      itemCbs.forEach((cb) => {
        cb.checked = masterCb.checked;
        cb.dataset.userModified = "true";
      });
      groupCbs.forEach((cb) => {
        cb.checked = masterCb.checked;
        cb.indeterminate = false;
      });
    });

    groupCbs.forEach((gCb) => {
      gCb.addEventListener("change", () => {
        const gKey = gCb.dataset.group;
        const groupItems = treeBox.querySelectorAll(`.j0n4t-pg-item-cb[data-group="${CSS.escape(gKey)}"]`);
        groupItems.forEach((cb) => {
          cb.checked = gCb.checked;
          cb.dataset.userModified = "true";
        });
        updateGroupAndMasterStates();
      });
    });

    itemCbs.forEach((cb) => {
      cb.addEventListener("change", () => {
        cb.dataset.userModified = "true";
        updateGroupAndMasterStates();
      });
    });

    updateGroupAndMasterStates();

    return {
      element: container,
      getSelectedKeys: () =>
        Array.from(treeBox.querySelectorAll(".j0n4t-pg-item-cb:checked")).map((cb) => cb.value),
      applyDuplicateStrategy: (strategy) => {
        let stateChanged = false;
        itemCbs.forEach((cb) => {
          if (cb.dataset.userModified === "true") return;

          const status = cb.dataset.status;
          if (status === "new") return;

          let targetState = cb.checked;
          if (strategy === "skip") {
            targetState = false;
          } else if (strategy === "overwrite") {
            targetState = status === "replaced";
          } else if (strategy === "keep_both") {
            targetState = true;
          }

          if (cb.checked !== targetState) {
            cb.checked = targetState;
            stateChanged = true;
          }
        });

        if (stateChanged) updateGroupAndMasterStates();
      }
    };
  }

  static async showExportModal(onExport) {
    const presets = await PresetGalleryAPI.getPresets();
    if (Object.keys(presets).length === 0) {
      await PresetUtils.alert("No presets available to export.");
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
        <label class="j0n4t-pg-checkbox-wrap">
          <input type="checkbox" id="j0n4t-pg-exp-colors" checked />
          <span><strong>Include Custom Group Colors (__color__)</strong></span>
        </label>
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

    const tree = PresetGalleryAPI.buildPresetSelectorTree(presets);
    modal.querySelector("#j0n4t-pg-tree-mount").appendChild(tree.element);

    const close = () => overlay.remove();
    modal.querySelector("#j0n4t-pg-exp-cancel").addEventListener("click", close);
    overlay.addEventListener("click", (e) => {
      if (e.target === overlay) close();
    });

    modal.querySelector("#j0n4t-pg-exp-confirm").addEventListener("click", async () => {
      const selectedKeys = tree.getSelectedKeys();
      if (!selectedKeys.length) {
        await PresetUtils.alert("Please select at least one preset to export.");
        return;
      }
      const format = modal.querySelector("#j0n4t-pg-exp-format").value;
      const mode = modal.querySelector("#j0n4t-pg-exp-mode").value;
      const includeColors = modal.querySelector("#j0n4t-pg-exp-colors").checked;
      close();
      onExport(format, mode, selectedKeys, includeColors);
    });

    document.body.appendChild(overlay);
  }

  static async exportPresets(format = "zip", mode = "full", selectedKeys = null, includeColors = true) {
    let presets = await PresetGalleryAPI.getPresets();

    if (selectedKeys && Array.isArray(selectedKeys)) {
      const filtered = {};
      for (const k of selectedKeys) {
        if (presets[k]) filtered[k] = presets[k];
      }
      if (includeColors) {
        for (const [k, item] of Object.entries(presets)) {
          if (item.__color__) filtered[k] = item;
        }
      }
      presets = filtered;
    }
    presets = Object.keys(presets).sort().reduce((acc, key) => {
      acc[key] = presets[key];
      return acc;
    }, {});

    if (format === "zip") {
      try {
        const JSZip = await loadJSZip();
        const zip = new JSZip();

        for (const [key, item] of Object.entries(presets)) {
          if (item.preset) {
            zip.file(`${key}.txt`, item.preset || "");

            if (mode !== "preset-only" && item.filename) {
              const parsed = PresetUtils.parseDataURL(item.filename);
              if (parsed) {
                zip.file(`${key}.${parsed.ext}`, parsed.base64, { base64: true });
              }
            }
          }

          if (includeColors && item.__color__) {
            zip.file(`${key}/__color__.txt`, item.__color__);
          }
        }

        const blob = await zip.generateAsync({ type: "blob" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `presets_${mode}.zip`;
        a.click();
        URL.revokeObjectURL(url);
      } catch (err) {
        await PresetUtils.alert("ZIP export failed: " + err.message);
      }
      return;
    }

    let dataStr;
    let mimeType;
    let ext;

    if (mode === "preset-only") {
      const nested = NestedPresetUtils.flatToNested(presets, true, includeColors);
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
      for (const [key, item] of Object.entries(presets)) {
        if (item.preset) {
          const exportItem = {
            preset: item.preset,
            filename: item.filename || null,
          };
          if (includeColors && item.__color__) {
            exportItem.__color__ = item.__color__;
          }
          exportData[key] = exportItem;
        } else if (includeColors && item.__color__) {
          exportData[key] = { __color__: item.__color__ };
        }
      }
      if (format === "yaml") {
        const nestedFull = NestedPresetUtils.flatToNested(exportData, false, includeColors);
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
    a.download = `presets_${mode}.${ext}`;
    a.click();
    URL.revokeObjectURL(url);
  }

  static async showImportModal(importedPresets, onConfirm) {
    const overlay = document.createElement("div");
    overlay.className = "j0n4t-pg-modal-overlay";

    const modal = document.createElement("div");
    modal.className = "j0n4t-pg-modal j0n4t-pg-modal-large";

    const currentPresets = await PresetGalleryAPI.getPresets();
    const duplicates = Object.keys(importedPresets).filter((k) => k in currentPresets && importedPresets[k].preset);

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
        <label class="j0n4t-pg-checkbox-wrap">
          <input type="checkbox" id="j0n4t-pg-imp-colors" checked />
          <span><strong>Import Custom Group Colors (__color__)</strong></span>
        </label>
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

    const tree = PresetGalleryAPI.buildPresetSelectorTree(importedPresets, currentPresets);
    modal.querySelector("#j0n4t-pg-tree-mount").appendChild(tree.element);
    modal.querySelector("#j0n4t-pg-dup-strategy").addEventListener("change", (e) => {
      tree.applyDuplicateStrategy(e.target.value);
    });

    const close = () => overlay.remove();
    modal.querySelector("#j0n4t-pg-imp-cancel").addEventListener("click", close);
    overlay.addEventListener("click", (e) => {
      if (e.target === overlay) close();
    });

    modal.querySelector("#j0n4t-pg-imp-confirm").addEventListener("click", async () => {
      const selectedKeys = tree.getSelectedKeys();
      if (!selectedKeys.length) {
        await PresetUtils.alert("Please select at least one preset to import.");
        return;
      }
      const duplicateStrategy = modal.querySelector("#j0n4t-pg-dup-strategy").value;
      const importColors = modal.querySelector("#j0n4t-pg-imp-colors").checked;
      close();
      onConfirm({ selectedKeys, duplicateStrategy, importColors });
    });

    document.body.appendChild(overlay);
  }

  static async importFile(file) {
    let importedPresets = {};

    if (file.name.toLowerCase().endsWith(".zip")) {
      try {
        const JSZip = await loadJSZip();
        const zip = await JSZip.loadAsync(file);

        const txtFiles = {};
        const imgFiles = {};

        for (const [relativePath, zipEntry] of Object.entries(zip.files)) {
          if (zipEntry.dir) continue;

          const normalizedPath = relativePath.replace(/\\/g, "/").replace(/^[/\\]+/, "");

          if (normalizedPath.endsWith("/__color__.txt") || normalizedPath === "__color__.txt") {
            const groupKey = normalizedPath.replace(/\/?__color__\.txt$/i, "").toLowerCase().replace(/ /g, "_");
            const colorVal = (await zipEntry.async("string")).trim();
            if (groupKey) {
              importedPresets[groupKey] = { ...(importedPresets[groupKey] || {}), __color__: colorVal };
            }
            continue;
          }

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
            const mime = PresetUtils.getMimeType(ext);
            const dataUrl = `data:${mime};base64,${base64}`;
            filename = await PresetUtils.createThumbnail(dataUrl);
          }

          const cleanKey = key.toLowerCase().replace(/ /g, "_");
          if (!cleanKey) continue;

          importedPresets[cleanKey] = {
            ...(importedPresets[cleanKey] || {}),
            preset: presetText,
            filename: filename,
          };
        }
      } catch (err) {
        await PresetUtils.alert("Failed to parse ZIP file: " + err.message);
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

        importedPresets = NestedPresetUtils.nestedToFlat(parsedData);

        for (const item of Object.values(importedPresets)) {
          if (item && item.filename && item.filename.startsWith("data:image/")) {
            item.filename = await PresetUtils.createThumbnail(item.filename);
          }
        }
      } catch (err) {
        await PresetUtils.alert("Failed to parse file: " + err.message);
        return { success: false };
      }
    }

    if (Object.keys(importedPresets).length === 0) {
      await PresetUtils.alert("No valid presets found in the imported file.");
      return { success: false };
    }

    return new Promise((resolve) => {
      PresetGalleryAPI.showImportModal(importedPresets, async ({ selectedKeys, duplicateStrategy, importColors }) => {
        const currentPresets = await PresetGalleryAPI.getPresets();

        if (importColors) {
          for (const [key, item] of Object.entries(importedPresets)) {
            if (item && item.__color__) {
              currentPresets[key] = { ...(currentPresets[key] || {}), __color__: item.__color__ };
            }
          }
        }

        for (const key of selectedKeys) {
          const item = importedPresets[key];
          if (!item || (!item.preset && item.__color__)) continue;

          let targetKey = key;
          if (targetKey in currentPresets && currentPresets[targetKey].preset) {
            if (duplicateStrategy === "skip") {
              continue;
            } else if (duplicateStrategy === "keep_both") {
              let copyIndex = 1;
              const parts = key.split("/");
              const baseName = parts.pop();
              const folderPrefix = parts.length ? parts.join("/") + "/" : "";

              while (`${folderPrefix}${baseName}_copy_${copyIndex}` in currentPresets && currentPresets[`${folderPrefix}${baseName}_copy_${copyIndex}`].preset) {
                copyIndex++;
              }
              targetKey = `${folderPrefix}${baseName}_copy_${copyIndex}`;
            }
          }

          currentPresets[targetKey] = item;
        }
        await PresetGalleryAPI.savePresets(currentPresets);
        resolve({ success: true });
      });
    });
  }
}
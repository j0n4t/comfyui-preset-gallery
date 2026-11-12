import ModalUtils from "./ModalUtils.js";
import NestedPresetUtils from "./NestedPresetUtils.js";
import PresetDOM from "./PresetDOM.js";
import PresetGalleryAPI from "./PresetGalleryAPI.js";
import PresetLogic from "./PresetLogic.js";
import YAMLUtils from "./YAMLUtils.js";
import PresetDisplay from "./PresetDisplay.js";

/**
 * @typedef {Object} ExportConfig
 * @property {string} [format]
 * @property {string} [mode]
 * @property {string[] | null} [selectedKeys]
 * @property {boolean} [includeColors]
 * @property {PresetCache} [editedPresets]
 * @property {string} [libraryId]
 * @property {string} [libraryName]
 */

/**
 * @typedef {Object} SelectionSummary
 * @property {number} newCount
 * @property {number} replacedCount
 * @property {number} sameCount
 * @property {number} total
 */

/**
 * @typedef {Object} SelectorTreeResult
 * @property {HTMLDivElement} element
 * @property {() => string[]} getSelectedKeys
 * @property {() => PresetCache} getPresets
 * @property {(strategy: string) => void} applyDuplicateStrategy
 */

/**
 * One library inside a bundle: its id and name plus the presets it holds.
 * @typedef {Object} BundleLibrary
 * @property {string} id
 * @property {string} name
 * @property {PresetCache} presets
 */

/**
 * A multi-library archive: the manifest plus one entry per library.
 * @typedef {Object} LibraryBundle
 * @property {number} version
 * @property {string} layout
 * @property {BundleLibrary[]} libraries
 */

/**
 * One library row in the bundle selector tree.
 * @typedef {Object} BundleTreeRow
 * @property {string} id
 * @property {string} name
 * @property {PresetCache} presets
 * @property {string} target "restore", "skip" or a served library id
 * @property {string} strategy
 * @property {HTMLElement | null} countEl
 * @property {HTMLInputElement | null} checkEl
 * @property {HTMLElement | null} itemsEl
 */

/**
 * The bundle selector: one group row per library, each holding that library's
 * own preset tree.
 * @typedef {Object} BundleSelectorTree
 * @property {HTMLDivElement} element
 * @property {BundleTreeRow[]} rows
 * @property {() => Record<string, string[]>} getSelectedKeysByLibrary
 * @property {() => Record<string, PresetCache>} getPresetsByLibrary
 */

/** The bundle manifest version this build writes and reads. */
const BUNDLE_VERSION = 1;

/**
 * A zip-shaped sink that collects entries into a plain record instead of
 * writing them, so a bundle can be assembled without a zip library.
 * @param {Record<string, string | {base64: string}>} entries
 * @returns {{ file: (path: string, contents: string, options?: {base64?: boolean}) => void }}
 */
const bundleEntrySink = (entries) => ({
  file: (path, contents, options) => {
    entries[path] = options?.base64 ? { base64: contents } : contents;
  },
});

const loadJSZip = async () => {
  if (window.JSZip) return window.JSZip;
  return new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src =
      "https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js";
    script.onload = () => resolve(window.JSZip);
    script.onerror = () => reject(new Error("Failed to load JSZip library"));
    document.head.appendChild(script);
  });
};

const ExportUtils = {
  /**
   * Sanitizes a library name for use as the leading stem of an exported
   * filename: runs of non-alphanumeric characters become a single
   * underscore ("Sdxl Styles" -> "Sdxl_Styles"), falling back to
   * "presets" when nothing usable remains.
   * @param {string} [name]
   * @returns {string}
   */
  getExportStem(name) {
    const stem = String(name || "")
      .replace(/[^A-Za-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "");
    return stem || "presets";
  },

  /**
   * @param {string[]} selectedKeys
   * @param {PresetCache} presets
   * @param {PresetCache | null} [existingPresets=null]
   * @returns {SelectionSummary}
   */
  getSelectionSummary(selectedKeys, presets, existingPresets = null) {
    let summary = {
      newCount: 0,
      replacedCount: 0,
      sameCount: 0,
      total: selectedKeys.length,
    };

    selectedKeys.forEach((key) => {
      const item = presets[key];
      if (!item) return;

      if (existingPresets && existingPresets[key]) {
        const oldText = existingPresets[key].preset || "";
        const newText = item.preset || "";
        const oldImg = existingPresets[key].filename || null;
        const newImg = item.filename || null;

        if (oldText !== newText || oldImg !== newImg) {
          summary.replacedCount++;
        } else {
          summary.sameCount++;
        }
      } else {
        summary.newCount++;
      }
    });

    return summary;
  },

  /**
   * @param {PresetCache} presets
   * @param {PresetCache | null} [existingPresets=null]
   * @param {{ nested?: boolean }} [options] `nested` drops the tree's own
   *   controls and its scroll cap, so it can sit inside another selector - the
   *   bundle tree puts one of these under every library row.
   * @returns {SelectorTreeResult}
   */
  buildPresetSelectorTree(presets, existingPresets = null, options = {}) {
    const { nested = false } = options;
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
    if (nested) {
      treeBox.style.maxHeight = "none";
      treeBox.style.overflowY = "visible";
    }

    /** @type {Record<string, PresetMatch[]>} */
    const groups = {};
    for (const [key, item] of Object.entries(presets).sort((a, b) =>
      a[0].localeCompare(b[0]),
    )) {
      const hasContent =
        item &&
        ((typeof item.preset === "string" && item.preset.trim().length > 0) ||
          item.filename);
      if (!hasContent) continue;

      const gKey = PresetDisplay.getPresetFolder(key) || "root_presets";
      if (!groups[gKey]) groups[gKey] = [];
      groups[gKey].push({ key, item });
    }

    for (const [gKey, items] of Object.entries(groups)) {
      let gName;
      let groupHex = "#007acc";
      if (gKey === "root_presets") {
        gName = "Root Presets";
      } else {
        gName = gKey.split("/").map(PresetDisplay.toTitleCase).join(" › ");
        if (presets[gKey] && presets[gKey].__color__)
          groupHex = presets[gKey].__color__;
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
            if (oldText !== newText || oldImg !== newImg) replacedCount++;
            else sameCount++;
          } else {
            newCount++;
          }
        });
      }

      let statsHtml = "";
      if (existingPresets) {
        statsHtml = `
          <div style="display: flex; gap: 4px; font-size: 0.75em; align-items: center; margin-left: auto;">
            ${newCount > 0 ? `<span style="background: #2b8a3e; color: white; padding: 2px 6px; border-radius: 12px; font-weight: 500;">+${newCount} New</span>` : ""}
            ${replacedCount > 0 ? `<span style="background: #e67700; color: white; padding: 2px 6px; border-radius: 12px; font-weight: 500;">~${replacedCount} Replaced</span>` : ""}
            ${sameCount > 0 ? `<span style="background: #495057; color: white; padding: 2px 6px; border-radius: 12px; font-weight: 500;">=${sameCount} Same</span>` : ""}
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
          <span class="j0n4t-pg-edit-group-btn" style="cursor: pointer; padding-right: 8px; user-select: none; font-size: 0.9em; color: #4dabf7;" title="Rename Folder">✎</span>
          <label class="j0n4t-pg-checkbox-wrap" style="margin: 0; display: flex; align-items: center;">
            <input type="checkbox" class="j0n4t-pg-group-cb" data-group="${PresetDOM.escapeHTML(gKey)}" checked />
            <span class="j0n4t-pg-group-name" style="border-left:3px solid ${groupHex}; padding-left:6px; margin-right: 8px;"><strong>${PresetDOM.escapeHTML(gName)}</strong> (${items.length})</span>
          </label>
          ${statsHtml}
        </div>
      `;
      groupEl.appendChild(groupHeader);

      const itemsBox = document.createElement("div");
      itemsBox.className = "j0n4t-pg-tree-group-items";

      items.forEach(({ key, item }) => {
        let detailsHtml = "";
        let hasDiff = false;
        let isNew = false;
        let isSame = false;

        if (existingPresets && existingPresets[key]) {
          const oldText = existingPresets[key].preset || "";
          const newText = item.preset || "";
          const oldImg = existingPresets[key].filename || null;
          const newImg = item.filename || null;

          if (oldText !== newText || oldImg !== newImg) {
            hasDiff = true;
            let textDiffHtml =
              oldText !== newText
                ? `<div style="color: #ff6b6b; margin-bottom: 4px;"><strong>- Current:</strong><br/>${PresetDOM.escapeHTML(oldText)}</div><div style="color: #51cf66;"><strong>+ Imported:</strong><br/>${PresetDOM.escapeHTML(newText)}</div>`
                : `<div style="color: #888; font-style: italic;">(Text unchanged)</div>`;
            let imgDiffHtml =
              oldImg !== newImg
                ? `<div style="margin-top: 6px; color: #fcc419;"><strong>* Image/Thumbnail modified</strong></div>`
                : "";
            detailsHtml = `${textDiffHtml}${imgDiffHtml}`;
          } else {
            isSame = true;
          }
        } else if (existingPresets) {
          isNew = true;
        }

        if (!hasDiff) {
          detailsHtml = `
                        <div style="color: #bbb; margin-bottom: 4px;"><strong>Content:</strong><br/>${PresetDOM.escapeHTML(item.preset || "(Empty)")}</div>
                        ${item.filename ? `<div style="margin-top: 6px;"><img src="${item.filename}" style="max-height: 80px; border-radius: 4px;" /></div>` : ""}
                    `;
        }

        const currentImgHtml = item.filename
          ? `<div style="margin-bottom: 4px;"><span style="display:block; font-size:0.8em; color:#888;">Current Image:</span><img src="${item.filename}" style="max-height: 60px; max-width: 100%; border-radius: 4px; display: block;" /></div>`
          : `<div style="margin-bottom: 4px; font-style: italic; color: #888; font-size: 0.85em;">No current image</div>`;

        const detailsContainerHtml = `
                    <div class="j0n4t-pg-details-container" style="display: none; padding: 8px; margin-top: 4px; margin-left: 54px; background: rgba(0,0,0,0.15); border-left: 2px solid ${hasDiff ? "#fcc419" : "#51cf66"}; font-family: monospace; font-size: 0.85em; max-height: 200px; overflow-y: auto; border-radius: 4px;">
                        ${detailsHtml}
                    </div>
                    `;

        const editContainerHtml = `
                    <div class="j0n4t-pg-edit-container" style="display: none; padding: 8px; margin-top: 4px; margin-left: 54px; background: rgba(0,0,0,0.25); border-left: 2px solid #4dabf7; font-size: 0.85em; border-radius: 4px;">
                        <label style="display:block; margin-bottom:2px;">Name</label>
                        <input type="text" class="edit-name" value="${PresetDOM.escapeHTML(PresetDisplay.getPresetName(key))}" style="width: 100%; margin-bottom: 8px; background: #222; color: #fff; border: 1px solid #444; padding: 4px;" />
                        
                        <label style="display:block; margin-bottom:2px;">Preset Content</label>
                        <textarea class="edit-text" style="width: 100%; height: 80px; margin-bottom: 8px; background: #222; color: #fff; border: 1px solid #444; padding: 4px;">${PresetDOM.escapeHTML(item.preset || "")}</textarea>
                        
                        <label style="display:block; margin-bottom:2px;">Current Picture</label>
                        <div class="edit-img-preview-wrap" style="margin-bottom: 8px;">
                        ${currentImgHtml}
                        </div>

                        <label style="display:block; margin-bottom:2px;">Update Image</label>
                        <input type="file" class="edit-image" accept="image/*" style="width: 100%; margin-bottom: 8px;" />
                        
                        <button type="button" class="edit-save" style="background: #007acc; color: white; border: none; padding: 4px 12px; cursor: pointer; border-radius: 3px;">Save Changes</button>
                    </div>
                    `;

        const itemRow = document.createElement("div");
        itemRow.className = "j0n4t-pg-tree-item";
        itemRow.style.display = "flex";
        itemRow.style.flexDirection = "column";

        let itemStatusTag = "";
        let status = hasDiff ? "replaced" : isNew ? "new" : "same";
        if (hasDiff)
          itemStatusTag = `<span style="font-size: 0.75em; font-weight: bold; color: #fcc419; margin-left: 6px;">(Replaced)</span>`;
        if (isNew)
          itemStatusTag = `<span style="font-size: 0.75em; font-weight: bold; color: #51cf66; margin-left: 6px;">(New)</span>`;

        const checkedAttr = isSame ? "" : "checked";

        itemRow.innerHTML = `
                    <div style="display: flex; align-items: center; width: 100%;">
                        <span class="j0n4t-pg-details-btn" style="cursor: pointer; padding-right: 8px; user-select: none; width: 20px; text-align: center; font-size: 0.9em; color: ${hasDiff ? "#fcc419" : "#888"};" title="Toggle Details">⊞</span>
                        <span class="j0n4t-pg-edit-btn" style="cursor: pointer; padding-right: 8px; user-select: none; font-size: 0.9em; color: #4dabf7;" title="Edit Item">✎</span>
                        <label class="j0n4t-pg-checkbox-wrap" style="flex: 1; margin: 0;">
                        <input type="checkbox" class="j0n4t-pg-item-cb" data-group="${PresetDOM.escapeHTML(gKey)}" data-status="${status}" data-user-modified="false" value="${PresetDOM.escapeHTML(key)}" ${checkedAttr} />
                        <span class="j0n4t-pg-item-name">${PresetDOM.escapeHTML(PresetDisplay.getPresetName(key))}</span>
                        ${itemStatusTag}
                        </label>
                    </div>
                    ${detailsContainerHtml}
                    ${editContainerHtml}
                    `;

        const detailsBtn = /** @type {HTMLSpanElement} */ (
          itemRow.querySelector(".j0n4t-pg-details-btn")
        );
        const detailsContainer = /** @type {HTMLDivElement} */ (
          itemRow.querySelector(".j0n4t-pg-details-container")
        );
        detailsBtn.addEventListener("click", () => {
          const isHidden = detailsContainer.style.display === "none";
          detailsContainer.style.display = isHidden ? "block" : "none";
          detailsBtn.textContent = isHidden ? "⊟" : "⊞";
        });

        const editBtn = /** @type {HTMLSpanElement} */ (
          itemRow.querySelector(".j0n4t-pg-edit-btn")
        );
        const editContainer = /** @type {HTMLDivElement} */ (
          itemRow.querySelector(".j0n4t-pg-edit-container")
        );
        const saveBtn = /** @type {HTMLButtonElement} */ (
          editContainer.querySelector(".edit-save")
        );

        editBtn.addEventListener("click", () => {
          editContainer.style.display =
            editContainer.style.display === "none" ? "block" : "none";
        });

        saveBtn.addEventListener("click", async () => {
          const newNameInput = /** @type {HTMLInputElement} */ (
            editContainer.querySelector(".edit-name")
          );
          const newTextInput = /** @type {HTMLTextAreaElement} */ (
            editContainer.querySelector(".edit-text")
          );
          const fileInput = /** @type {HTMLInputElement} */ (
            editContainer.querySelector(".edit-image")
          );
          const cb = /** @type {HTMLInputElement} */ (
            itemRow.querySelector(".j0n4t-pg-item-cb")
          );

          const oldKey = cb.value;
          const folder = PresetDisplay.getPresetFolder(oldKey);
          const cleanName = newNameInput.value
            .trim()
            .toLowerCase()
            .replace(/ /g, "_");
          const newKey =
            folder && folder !== "root_presets"
              ? `${folder}/${cleanName}`
              : cleanName;

          presets[oldKey].preset = newTextInput.value.trim();
          if (fileInput.files && fileInput.files[0]) {
            const dataUrl = await new Promise((res) => {
              const reader = new FileReader();
              reader.onload = (e) =>
                res(/** @type {string} */ (e.target?.result));
              if (fileInput.files) reader.readAsDataURL(fileInput.files[0]);
            });
            presets[oldKey].filename = await PresetDOM.createThumbnail(dataUrl);

            const imgWrap = /** @type {HTMLDivElement} */ (
              editContainer.querySelector(".edit-img-preview-wrap")
            );
            imgWrap.innerHTML = `<span style="display:block; font-size:0.8em; color:#888;">Current Image:</span><img src="${presets[oldKey].filename}" style="max-height: 60px; max-width: 100%; border-radius: 4px; display: block;" />`;
            fileInput.value = "";
          }

          if (newKey !== oldKey) {
            presets[newKey] = presets[oldKey];
            delete presets[oldKey];
            cb.value = newKey;
            const nameEL = itemRow.querySelector(".j0n4t-pg-item-name");
            if (nameEL) {
              nameEL.textContent = newNameInput.value;
            }
          }

          editContainer.style.display = "none";
          cb.dataset.userModified = "true";
          cb.checked = true;

          let updatedDetailsHtml = `
            <div style="color: #bbb; margin-bottom: 4px;"><strong>Content (Edited):</strong><br/>${PresetDOM.escapeHTML(newTextInput.value)}</div>
            ${presets[newKey || oldKey].filename ? `<div style="margin-top: 6px;"><img src="${presets[newKey || oldKey].filename}" style="max-height: 80px; border-radius: 4px;" /></div>` : ""}
          `;
          detailsContainer.innerHTML = updatedDetailsHtml;
        });

        itemsBox.appendChild(itemRow);
      });

      const groupEditBtn = /** @type {HTMLSpanElement | null} */ (
        groupHeader.querySelector(".j0n4t-pg-edit-group-btn")
      );
      if (groupEditBtn) {
        groupEditBtn.addEventListener("click", async () => {
          const newGroupName = prompt(
            "Rename Folder (use / to separate nested folders):",
            gKey === "root_presets" ? "" : gKey,
          );
          if (newGroupName === null) return;
          const cleanNewFolder = newGroupName
            .trim()
            .split("/")
            .map((part) => part.trim().toLowerCase().replace(/ /g, "_"))
            .filter(Boolean)
            .join("/");
          if (cleanNewFolder === gKey) return;

          const checkboxes = /** @type {NodeListOf<HTMLInputElement>} */ (
            itemsBox.querySelectorAll(".j0n4t-pg-item-cb")
          );
          const keyMoves = Array.from(checkboxes, (cb) => {
            const oldKey = cb.value;
            const itemName = PresetDisplay.getPresetName(oldKey);
            return {
              cb,
              oldKey,
              newKey: cleanNewFolder
                ? `${cleanNewFolder}/${itemName}`
                : itemName,
            };
          });
          const movingKeys = new Set(keyMoves.map(({ oldKey }) => oldKey));
          if (
            keyMoves.some(
              ({ newKey }) => newKey in presets && !movingKeys.has(newKey),
            )
          ) {
            await ModalUtils.alert(
              "A preset with that name already exists in the destination folder.",
            );
            return;
          }

          for (const { oldKey, newKey, cb } of keyMoves) {
            if (presets[oldKey]) {
              presets[newKey] = presets[oldKey];
              delete presets[oldKey];
            }
            cb.value = newKey;
            cb.dataset.group = cleanNewFolder || "root_presets";
          }

          if (gKey !== "root_presets" && presets[gKey]?.__color__) {
            if (cleanNewFolder) {
              presets[cleanNewFolder] = {
                ...(presets[cleanNewFolder] || {}),
                __color__: presets[gKey].__color__,
              };
            }
            delete presets[gKey].__color__;
            if (Object.keys(presets[gKey]).length === 0) delete presets[gKey];
          }

          const groupCb = /** @type {HTMLInputElement | null} */ (
            groupHeader.querySelector(".j0n4t-pg-group-cb")
          );
          if (groupCb) groupCb.dataset.group = cleanNewFolder || "root_presets";

          const groupNameEl = /** @type {HTMLElement | null} */ (
            groupHeader.querySelector(".j0n4t-pg-group-name")
          );
          if (groupNameEl) {
            const displayName = cleanNewFolder
              ? cleanNewFolder
                  .split("/")
                  .map(PresetDisplay.toTitleCase)
                  .join(" › ")
              : "Root Presets";
            groupNameEl.innerHTML = `<strong>${PresetDOM.escapeHTML(displayName)}</strong> (${items.length})`;
          }
        });
      }

      const collapseBtn = /** @type {HTMLSpanElement | null} */ (
        groupHeader.querySelector(".j0n4t-pg-collapse-btn")
      );
      if (collapseBtn) {
        collapseBtn.addEventListener("click", () => {
          const isCollapsed = itemsBox.style.display === "none";
          itemsBox.style.display = isCollapsed ? "" : "none";
          collapseBtn.textContent = isCollapsed ? "▼" : "▶";
        });
      }

      groupEl.appendChild(itemsBox);
      treeBox.appendChild(groupEl);
    }

    container.appendChild(treeBox);

    const masterCb = /** @type {HTMLInputElement | null} */ (
      controls.querySelector("#j0n4t-pg-sel-all")
    );
    const toggleAllBtn = /** @type {HTMLButtonElement | null} */ (
      controls.querySelector("#j0n4t-pg-toggle-collapse-all")
    );
    const groupCbs = /** @type {NodeListOf<HTMLInputElement>} */ (
      treeBox.querySelectorAll(".j0n4t-pg-group-cb")
    );
    const itemCbs = /** @type {NodeListOf<HTMLInputElement>} */ (
      treeBox.querySelectorAll(".j0n4t-pg-item-cb")
    );

    let isAllCollapsed = false;
    if (toggleAllBtn) {
      toggleAllBtn.addEventListener("click", () => {
        isAllCollapsed = !isAllCollapsed;
        toggleAllBtn.textContent = isAllCollapsed
          ? "Expand All"
          : "Collapse All";
        treeBox
          .querySelectorAll(".j0n4t-pg-collapse-btn")
          .forEach((btn, idx) => {
            btn.textContent = isAllCollapsed ? "▶" : "▼";
            const box = /** @type {HTMLElement | null} */ (
              treeBox.querySelectorAll(".j0n4t-pg-tree-group-items")[idx]
            );
            if (box) box.style.display = isAllCollapsed ? "none" : "";
          });
      });
    }

    const updateGroupAndMasterStates = () => {
      let allItemsChecked = true;
      let anyItemChecked = false;

      groupCbs.forEach((gCb) => {
        const gKey = gCb.dataset.group || "";
        const groupItems = /** @type {NodeListOf<HTMLInputElement>} */ (
          treeBox.querySelectorAll(
            `.j0n4t-pg-item-cb[data-group="${CSS.escape(gKey)}"]`,
          )
        );
        const checkedCount = Array.from(groupItems).filter(
          (c) => c.checked,
        ).length;
        gCb.checked =
          checkedCount === groupItems.length && groupItems.length > 0;
        gCb.indeterminate =
          checkedCount > 0 && checkedCount < groupItems.length;
        if (checkedCount > 0) anyItemChecked = true;
        if (checkedCount < groupItems.length) allItemsChecked = false;
      });

      if (masterCb) {
        masterCb.checked = allItemsChecked;
        masterCb.indeterminate = !allItemsChecked && anyItemChecked;
      }
    };

    if (masterCb) {
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
    }

    groupCbs.forEach((gCb) => {
      gCb.addEventListener("change", () => {
        const gKey = gCb.dataset.group || "";
        treeBox
          .querySelectorAll(
            `.j0n4t-pg-item-cb[data-group="${CSS.escape(gKey)}"]`,
          )
          .forEach((cb) => {
            const itemCb = /** @type {HTMLInputElement} */ (cb);
            itemCb.checked = gCb.checked;
            itemCb.dataset.userModified = "true";
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
      element: nested ? treeBox : container,
      getSelectedKeys: () =>
        Array.from(treeBox.querySelectorAll(".j0n4t-pg-item-cb:checked")).map(
          (cb) => /** @type {HTMLInputElement} */ (cb).value,
        ),
      getPresets: () => presets,
      applyDuplicateStrategy: (strategy) => {
        let stateChanged = false;
        itemCbs.forEach((cb) => {
          if (cb.dataset.userModified === "true") return;
          const status = cb.dataset.status;
          if (status === "new") return;

          let targetState = cb.checked;
          if (strategy === "skip") targetState = false;
          else if (strategy === "overwrite")
            targetState = status === "replaced";
          else if (strategy === "keep_both") targetState = true;

          if (cb.checked !== targetState) {
            cb.checked = targetState;
            stateChanged = true;
          }
        });
        if (stateChanged) updateGroupAndMasterStates();
      },
    };
  },

  /**
   * The multi-library selector: one group row per library, each holding that
   * library's own preset tree.
   *
   * Every library is a row in the same shape as a folder group, so a whole
   * bundle reads as one tree - the library header carries a checkbox and its
   * preset count, with the folder groups and items underneath. The per-library
   * tree is `buildPresetSelectorTree` with `nested`, so it brings the
   * new/replaced/same badges, the diffs and the inline editor.
   *
   * `importControls` adds a target and a duplicate-strategy dropdown to each
   * library header; the import dialog needs them, the export side does not.
   * Changing the target rebuilds that library's tree against the new target,
   * keeping the keys already checked.
   * @param {Object} options
   * @param {Array<{id: string, name: string}>} options.libraries
   * @param {Record<string, PresetCache>} options.cachesById
   * @param {Record<string, PresetCache> | null} [options.existingCachesById]
   * @param {Array<{id: string, name: string}>} [options.served] libraries a target may name
   * @param {boolean} [options.importControls]
   * @returns {BundleSelectorTree}
   */
  buildBundleSelectorTree({
    libraries,
    cachesById,
    existingCachesById = null,
    served = [],
    importControls = false,
  }) {
    const container = document.createElement("div");
    container.className = "j0n4t-pg-selector-container";

    const controls = document.createElement("div");
    controls.className = "j0n4t-pg-selector-controls";
    controls.innerHTML = `
      <div style="display: flex; justify-content: space-between; align-items: center; width: 100%;">
        <label class="j0n4t-pg-checkbox-wrap" style="margin: 0;">
          <input type="checkbox" id="j0n4t-pg-bundle-sel-all" checked />
          <span><strong>Select / Deselect All Libraries</strong></span>
        </label>
        <button type="button" id="j0n4t-pg-bundle-toggle-collapse" style="background: transparent; border: 1px solid #777; color: inherit; padding: 2px 8px; border-radius: 4px; cursor: pointer; font-size: 0.85em;">Collapse All</button>
      </div>
    `;
    container.appendChild(controls);

    /** @type {BundleTreeRow[]} */
    const rows = [];
    /** @type {Map<string, SelectorTreeResult>} */
    const trees = new Map();
    /** @type {HTMLElement[]} */
    const groupEls = [];

    /** @param {BundleTreeRow} row */
    const targetOptions = (row) => {
      /** @type {string[]} */
      const options = [
        `<option value="restore" ${row.target === "restore" ? "selected" : ""}>Restore to ${PresetDOM.escapeHTML(row.id)}</option>`,
        `<option value="skip" ${row.target === "skip" ? "selected" : ""}>Skip this library</option>`,
      ];
      for (const library of served) {
        if (library.id === row.id) continue;
        options.push(
          `<option value="${PresetDOM.escapeHTML(library.id)}" ${row.target === library.id ? "selected" : ""}>Import into ${PresetDOM.escapeHTML(library.name)}</option>`,
        );
      }
      return options.join("");
    };

    /** @param {BundleTreeRow} row */
    const effectiveTarget = (row) =>
      row.target === "restore" ? row.id : row.target;

    /** @param {BundleTreeRow} row */
    const updateCount = (row) => {
      if (!row.countEl) return;
      const total = Object.keys(row.presets).length;
      const selected = trees.get(row.id)?.getSelectedKeys().length ?? 0;
      if (effectiveTarget(row) === "skip") {
        row.countEl.textContent = `${total} presets (skipped)`;
        return;
      }
      const duplicates = ExportUtils.getDuplicateCount(
        Object.keys(row.presets),
        row.presets,
        existingCachesById
          ? existingCachesById[effectiveTarget(row)] ?? null
          : null,
      );
      row.countEl.textContent = `${selected}/${total} presets, ${duplicates} duplicate${duplicates === 1 ? "" : "s"}`;
    };

    /** Every preset checkbox inside a container, typed as an input. */
    const itemBoxes = (/** @type {HTMLElement} */ el) =>
      /** @type {HTMLInputElement[]} */ (
        Array.from(el.querySelectorAll(".j0n4t-pg-item-cb"))
      );

    /**
     * Reflect one library's checkbox and count from its subtree.
     * @param {BundleTreeRow} current
     */
    const updateLibraryState = (current) => {
      const boxes = current.itemsEl ? itemBoxes(current.itemsEl) : [];
      const checked = boxes.filter((cb) => cb.checked).length;
      if (current.checkEl) {
        current.checkEl.checked = boxes.length > 0 && checked === boxes.length;
        current.checkEl.indeterminate = checked > 0 && checked < boxes.length;
      }
      updateCount(current);
    };

    for (const library of libraries || []) {
      const presets = (cachesById && cachesById[library.id]) || {};
      /** @type {BundleTreeRow} */
      const row = {
        id: library.id,
        name: library.name || library.id,
        presets,
        target: "restore",
        strategy: "overwrite",
        countEl: null,
        checkEl: null,
        itemsEl: null,
      };
      rows.push(row);

      const groupEl = document.createElement("div");
      groupEl.className = "j0n4t-pg-tree-group j0n4t-pg-bundle-group";
      groupEls.push(groupEl);

      const groupHeader = document.createElement("div");
      groupHeader.className = "j0n4t-pg-tree-group-header";
      groupHeader.innerHTML = `
        <div style="display: flex; align-items: center; width: 100%; padding-right: 4px;">
          <span class="j0n4t-pg-collapse-btn" style="cursor: pointer; padding-right: 8px; user-select: none; width: 20px; text-align: center; font-size: 0.9em;">▼</span>
          <label class="j0n4t-pg-checkbox-wrap" style="margin: 0; display: flex; align-items: center;">
            <input type="checkbox" class="j0n4t-pg-bundle-lib-cb" checked />
            <span class="j0n4t-pg-group-name" style="border-left:3px solid #007acc; padding-left:6px; margin-right: 8px;"><strong>${PresetDOM.escapeHTML(row.name)}</strong> (${Object.keys(presets).length})</span>
          </label>
          <span class="j0n4t-pg-bundle-count" style="margin-left: auto; color: #888; font-size: 0.8em;"></span>
        </div>
        ${importControls ? `
          <div style="display: flex; gap: 8px; margin-top: 4px;">
            <select class="j0n4t-pg-bundle-target" style="flex: 1;">${targetOptions(row)}</select>
            <select class="j0n4t-pg-bundle-strategy" style="flex: 1;">
              <option value="overwrite">Overwrite existing presets</option>
              <option value="skip">Skip duplicates</option>
              <option value="keep_both">Keep both (rename with _copy)</option>
            </select>
          </div>
        ` : ""}
      `;

      const itemsBox = document.createElement("div");
      itemsBox.className = "j0n4t-pg-tree-group-items";

      row.countEl = groupHeader.querySelector(".j0n4t-pg-bundle-count");
      row.checkEl = groupHeader.querySelector(".j0n4t-pg-bundle-lib-cb");
      row.itemsEl = itemsBox;

      /** Rebuild the library's preset tree against its effective target. */
      const mountTree = () => {
        const tree = ExportUtils.buildPresetSelectorTree(
          presets,
          existingCachesById
            ? existingCachesById[effectiveTarget(row)] ?? null
            : null,
          { nested: true },
        );
        trees.set(row.id, tree);
        itemsBox.replaceChildren(tree.element);
        updateLibraryState(row);
      };

      row.checkEl?.addEventListener("change", () => {
        const checked = /** @type {HTMLInputElement} */ (row.checkEl).checked;
        itemBoxes(itemsBox).forEach((cb) => {
          cb.checked = checked;
          cb.dispatchEvent(new Event("change"));
        });
        updateLibraryState(row);
      });

      itemsBox.addEventListener("change", (e) => {
        const target = e.target;
        if (
          target instanceof HTMLElement &&
          target.classList.contains("j0n4t-pg-item-cb")
        ) {
          updateLibraryState(row);
        }
      });

      const collapseBtn = /** @type {HTMLElement | null} */ (
        groupHeader.querySelector(".j0n4t-pg-collapse-btn")
      );
      collapseBtn?.addEventListener("click", () => {
        const isCollapsed = itemsBox.style.display === "none";
        itemsBox.style.display = isCollapsed ? "" : "none";
        if (collapseBtn) collapseBtn.textContent = isCollapsed ? "▼" : "▶";
      });

      if (importControls) {
        const targetSelect = /** @type {HTMLSelectElement | null} */ (
          groupHeader.querySelector(".j0n4t-pg-bundle-target")
        );
        targetSelect?.addEventListener("change", () => {
          row.target = targetSelect.value;
          const kept = new Set(trees.get(row.id)?.getSelectedKeys() || []);
          mountTree();
          itemBoxes(itemsBox).forEach((cb) => {
            cb.checked = kept.has(cb.value);
            cb.dispatchEvent(new Event("change"));
          });
          updateLibraryState(row);
        });

        const strategySelect = /** @type {HTMLSelectElement | null} */ (
          groupHeader.querySelector(".j0n4t-pg-bundle-strategy")
        );
        strategySelect?.addEventListener("change", () => {
          row.strategy = strategySelect.value;
        });
      }

      groupEl.appendChild(groupHeader);
      groupEl.appendChild(itemsBox);
      mountTree();
      container.appendChild(groupEl);
    }

    const masterCb = /** @type {HTMLInputElement | null} */ (
      controls.querySelector("#j0n4t-pg-bundle-sel-all")
    );
    masterCb?.addEventListener("change", () => {
      for (const row of rows) {
        if (!row.itemsEl) continue;
        itemBoxes(row.itemsEl).forEach((cb) => {
          cb.checked = masterCb.checked;
          cb.dispatchEvent(new Event("change"));
        });
        updateLibraryState(row);
      }
    });

    const toggleAllBtn = /** @type {HTMLButtonElement | null} */ (
      controls.querySelector("#j0n4t-pg-bundle-toggle-collapse")
    );
    let isAllCollapsed = false;
    toggleAllBtn?.addEventListener("click", () => {
      isAllCollapsed = !isAllCollapsed;
      toggleAllBtn.textContent = isAllCollapsed ? "Expand All" : "Collapse All";
      groupEls.forEach((groupEl) => {
        const btn = /** @type {HTMLElement | null} */ (
          groupEl.querySelector(".j0n4t-pg-collapse-btn")
        );
        const box = /** @type {HTMLElement | null} */ (
          groupEl.querySelector(".j0n4t-pg-tree-group-items")
        );
        if (btn) btn.textContent = isAllCollapsed ? "▶" : "▼";
        if (box) box.style.display = isAllCollapsed ? "none" : "";
      });
    });

    return {
      element: container,
      rows,
      getSelectedKeysByLibrary: () => {
        /** @type {Record<string, string[]>} */
        const selected = {};
        for (const row of rows) {
          selected[row.id] = trees.get(row.id)?.getSelectedKeys() || [];
        }
        return selected;
      },
      getPresetsByLibrary: () => {
        /** @type {Record<string, PresetCache>} */
        const presets = {};
        for (const row of rows) presets[row.id] = row.presets;
        return presets;
      },
    };
  },

  /**
   * The preset map an export writes.
   *
   * Entries with no text and no image are dropped, folder colours are kept only
   * for folders the exported keys still reach, and the keys are sorted so the
   * output is stable. `selectedKeys` narrows the export to a selection; a null
   * or omitted value exports the whole library.
   * @param {PresetCache} presets
   * @param {string[] | null} [selectedKeys]
   * @param {boolean} [includeColors]
   * @returns {PresetCache}
   */
  filterExportPresets(presets, selectedKeys = null, includeColors = true) {
    /**
     * The folders a set of keys reaches, so their colours survive a selection.
     * @param {PresetCache} [presetMap]
     * @param {string[] | null} [keys]
     * @returns {Set<string>}
     */
    const getActiveFolders = (presetMap = {}, keys = null) => {
      const active = new Set();
      const targetKeys = keys || Object.keys(presetMap);
      for (const k of targetKeys) {
        const item = presetMap?.[k];
        if (
          item &&
          ((typeof item.preset === "string" && item.preset.trim().length > 0) ||
            item.filename)
        ) {
          const parts = k.split("/");
          while (parts.length > 1) {
            parts.pop();
            active.add(parts.join("/"));
          }
        }
      }
      return active;
    };

    /** @type {PresetCache} */
    let filtered = {};

    if (selectedKeys && Array.isArray(selectedKeys)) {
      for (const k of selectedKeys) {
        if (presets?.[k]) {
          const itemCopy = { ...presets[k] };
          if (!includeColors) delete itemCopy.__color__;
          filtered[k] = itemCopy;
        }
      }
      if (includeColors) {
        const activeFolders = getActiveFolders(presets, selectedKeys);
        for (const folder of activeFolders) {
          if (presets?.[folder] && presets[folder].__color__) {
            filtered[folder] = {
              ...(filtered[folder] || {}),
              __color__: presets[folder].__color__,
            };
          }
        }
      }
    } else {
      const activeFolders = getActiveFolders(presets);
      for (const [k, item] of Object.entries(presets)) {
        if (!item) continue;
        const hasContent =
          (typeof item.preset === "string" && item.preset.trim().length > 0) ||
          item.filename;
        if (hasContent) {
          const copy = { ...item };
          if (!includeColors) delete copy.__color__;
          filtered[k] = copy;
        } else if (includeColors && item.__color__ && activeFolders.has(k)) {
          filtered[k] = { __color__: item.__color__ };
        }
      }
    }

    return Object.keys(filtered)
      .sort()
      .reduce((acc, key) => {
        acc[key] = filtered[key];
        return acc;
      }, /** @type {PresetCache} */ ({}));
  },

  /**
   * Write one library's entries into a zip, under `prefix` when it has one.
   *
   * Text becomes `<key>.txt`, an image becomes `<key>.<ext>` carrying the
   * base64 payload, and a folder colour becomes `<key>/__color__.txt`. A
   * colour-only entry writes its colour and nothing else.
   *
   * `zip` only needs a `file(path, data, options)` method, so a plain record
   * sink works too - that is how `buildBundleEntries` assembles a bundle
   * without a zip library.
   * @param {any} zip a JSZip instance or a compatible sink
   * @param {string} prefix library id, or "" for the archive root
   * @param {PresetCache} presets
   * @param {string} mode "full" or "preset-only"
   * @param {boolean} includeColors
   */
  addPresetZipEntries(zip, prefix, presets, mode, includeColors) {
    const base = prefix ? `${prefix.replace(/\/+$/, "")}/` : "";
    for (const [key, item] of Object.entries(presets)) {
      if (item.preset) {
        zip.file(`${base}${key}.txt`, item.preset || "");

        if (mode !== "preset-only" && item.filename) {
          const parsed = PresetLogic.parseDataURL(item.filename);
          if (parsed) {
            zip.file(`${base}${key}.${parsed.ext}`, parsed.base64, {
              base64: true,
            });
          }
        }
      }

      if (includeColors && item.__color__) {
        zip.file(`${base}${key}/__color__.txt`, item.__color__);
      }
    }
  },

  /**
   * The manifest's layout name for an export format: the zip format stores one
   * file per preset, the others store one document per library.
   * @param {string} format
   * @returns {string}
   */
  bundleLayout(format) {
    return format === "json" || format === "yaml" ? format : "files";
  },

  /**
   * The bundle's root manifest: what it is, which layout it uses, and the
   * libraries it carries.
   * @param {Array<{id: string, name: string}>} libraries
   * @param {string} layout
   * @returns {{version: number, layout: string, libraries: Array<{id: string, name: string}>}}
   */
  buildBundleManifest(libraries, layout) {
    return {
      version: BUNDLE_VERSION,
      layout,
      libraries: (libraries || []).map((library) => ({
        id: library.id,
        name: library.name || library.id,
      })),
    };
  },

  /**
   * The bundle's file table: archive path -> text, or `{ base64 }` for an image.
   *
   * The per-library layout is the single-library export namespaced by the
   * library id, which is why the entries go through `addPresetZipEntries`.
   * `selectedKeysById` narrows a library to a selection; a library left with
   * nothing selected is left out of the bundle entirely, manifest included.
   * @param {Array<{id: string, name: string}>} libraries
   * @param {Record<string, PresetCache>} cachesById
   * @param {string} format
   * @param {string} mode
   * @param {boolean} includeColors
   * @param {Record<string, string[]> | null} [selectedKeysById]
   * @returns {Record<string, string | {base64: string}>}
   */
  buildBundleEntries(libraries, cachesById, format, mode, includeColors, selectedKeysById = null) {
    const layout = ExportUtils.bundleLayout(format);
    /** @type {Record<string, string | {base64: string}>} */
    const entries = {};

    const active = (libraries || [])
      .map((library) => ({
        library,
        presets: ExportUtils.filterExportPresets(
          (cachesById && cachesById[library.id]) || {},
          selectedKeysById ? selectedKeysById[library.id] ?? null : null,
          includeColors,
        ),
      }))
      .filter(({ presets }) => Object.keys(presets).length > 0);

    entries["manifest.json"] = JSON.stringify(
      ExportUtils.buildBundleManifest(
        active.map(({ library }) => library),
        layout,
      ),
      null,
      2,
    );

    for (const { library, presets } of active) {
      if (layout === "files") {
        ExportUtils.addPresetZipEntries(
          bundleEntrySink(entries),
          library.id,
          presets,
          mode,
          includeColors,
        );
        continue;
      }

      entries[`libraries/${library.id}.${layout}`] =
        ExportUtils.serializeLibraryFile(presets, layout, mode);
    }

    return entries;
  },

  /**
   * The document for one library inside a json/yaml bundle: the same shape the
   * single-library export writes, so the existing parser reads it back.
   * @param {PresetCache} presets
   * @param {string} format "json" or "yaml"
   * @param {string} mode "full" or "preset-only"
   * @returns {string}
   */
  serializeLibraryFile(presets, format, mode) {
    if (format === "yaml") {
      return YAMLUtils.stringify(
        NestedPresetUtils.flatToNested(presets, mode === "preset-only", true),
      );
    }
    if (mode === "preset-only") {
      return JSON.stringify(
        NestedPresetUtils.flatToNested(presets, true, true),
        null,
        2,
      );
    }
    return JSON.stringify(presets, null, 2);
  },

  /**
   * Build the bundle archive and return the JSZip instance, so a caller can
   * download it or inspect it.
   * @param {Array<{id: string, name: string}>} libraries
   * @param {Record<string, PresetCache>} cachesById
   * @param {string} format
   * @param {string} mode
   * @param {boolean} includeColors
   * @param {Record<string, string[]> | null} [selectedKeysById]
   * @returns {Promise<any>}
   */
  async buildLibraryBundleZip(
    libraries,
    cachesById,
    format,
    mode,
    includeColors,
    selectedKeysById = null,
  ) {
    const JSZip = await loadJSZip();
    const zip = new JSZip();
    const entries = ExportUtils.buildBundleEntries(
      libraries,
      cachesById,
      format,
      mode,
      includeColors,
      selectedKeysById,
    );
    for (const [path, contents] of Object.entries(entries)) {
      if (contents && typeof contents === "object") {
        zip.file(path, contents.base64, { base64: true });
      } else {
        zip.file(path, contents);
      }
    }
    return zip;
  },

  /**
   * Build the bundle and download it as one archive.
   * @param {Array<{id: string, name: string}>} libraries
   * @param {Record<string, PresetCache>} cachesById
   * @param {string} format
   * @param {string} mode
   * @param {boolean} includeColors
   * @param {Record<string, string[]> | null} [selectedKeysById]
   * @returns {Promise<void>}
   */
  async exportLibraryBundle(
    libraries,
    cachesById,
    format,
    mode,
    includeColors,
    selectedKeysById = null,
  ) {
    const zip = await ExportUtils.buildLibraryBundleZip(
      libraries,
      cachesById,
      format,
      mode,
      includeColors,
      selectedKeysById,
    );
    const blob = await zip.generateAsync({ type: "blob" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `preset_gallery_libraries_${mode}.zip`;
    a.click();
    URL.revokeObjectURL(url);
  },

  /**
   * @param {ExportConfig} config
   */
  async exportPresets({
    format = "zip",
    mode = "full",
    selectedKeys = null,
    includeColors = true,
    editedPresets = {},
    libraryId,
    libraryName,
  }) {
    const exportStem = ExportUtils.getExportStem(libraryName ?? libraryId);
    const presets = ExportUtils.filterExportPresets(
      editedPresets,
      selectedKeys,
      includeColors,
    );

    if (format === "zip") {
      try {
        const JSZip = await loadJSZip();
        const zip = new JSZip();

        ExportUtils.addPresetZipEntries(zip, "", presets, mode, includeColors);

        const blob = await zip.generateAsync({ type: "blob" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `${exportStem}_${mode}.zip`;
        a.click();
        URL.revokeObjectURL(url);
      } catch (err) {
        await ModalUtils.alert(
          "ZIP export failed: " + /** @type {Error} */ (err).message,
        );
      }
      return;
    }

    let dataStr;
    let mimeType;
    let ext;

    if (mode === "preset-only") {
      const nested = NestedPresetUtils.flatToNested(
        presets,
        true,
        includeColors,
      );
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
      /** @type {PresetCache} */
      const exportData = {};
      for (const [key, item] of Object.entries(presets)) {
        if (item.preset) {
          /** @type {PresetCacheItem} */
          const exportItem = {
            preset: item.preset,
            filename: item.filename,
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
        const nestedFull = NestedPresetUtils.flatToNested(
          exportData,
          false,
          includeColors,
        );
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
    a.download = `${exportStem}_${mode}.${ext}`;
    a.click();
    URL.revokeObjectURL(url);
  },

  /**
   * @param {PresetCache} importedPresets
   * @param {string} defaultLibraryId the library to preselect
   * @param {(result: { selectedKeys: string[], duplicateStrategy: string, importColors: boolean, editedPresets: PresetCache, libraryId: string }) => void} onConfirm
   */
  async showImportModal(importedPresets, defaultLibraryId, onConfirm) {
    const libraries = await PresetGalleryAPI.fetchLibraries();
    const availableLibraries = libraries.length
      ? libraries
      : [
          {
            id: PresetGalleryAPI.DEFAULT_LIBRARY_ID,
            name: PresetGalleryAPI.DEFAULT_LIBRARY_ID,
            default: true,
          },
        ];
    let libraryId = availableLibraries.some(
      (library) => library.id === defaultLibraryId,
    )
      ? defaultLibraryId
      : availableLibraries[0].id;
    let currentPresets = await PresetGalleryAPI.getPresets(libraryId);
    const overlay = document.createElement("div");
    overlay.className = "j0n4t-pg-modal-overlay";

    const modal = document.createElement("div");
    modal.className = "j0n4t-pg-modal j0n4t-pg-modal-large";

    const duplicates = Object.keys(importedPresets).filter(
      (k) => k in currentPresets && importedPresets[k].preset,
    );
    const createLibraryOption = "__create_new_library__";

    modal.innerHTML = `
      <h3>📥 Import Presets</h3>
      <div class="j0n4t-pg-modal-field">
        <label for="j0n4t-pg-imp-library">Import into library</label>
        <select id="j0n4t-pg-imp-library">
          ${availableLibraries.map((library) => `<option value="${PresetDOM.escapeHTML(library.id)}" ${library.id === libraryId ? "selected" : ""}>${PresetDOM.escapeHTML(library.name)}</option>`).join("")}
          <option value="${createLibraryOption}">＋ Create a new library…</option>
        </select>
      </div>
      <div class="j0n4t-pg-modal-field">
        <label id="j0n4t-pg-dup-label">Handling Duplicate Presets (${duplicates.length} detected)</label>
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

    let tree = ExportUtils.buildPresetSelectorTree(
      importedPresets,
      currentPresets,
    );
    const mount = /** @type {HTMLElement | null} */ (
      modal.querySelector("#j0n4t-pg-tree-mount")
    );
    if (mount) mount.appendChild(tree.element);

    const libraryEl = /** @type {HTMLSelectElement | null} */ (
      modal.querySelector("#j0n4t-pg-imp-library")
    );
    const duplicateLabel = modal.querySelector("#j0n4t-pg-dup-label");
    if (libraryEl && mount) {
      libraryEl.addEventListener("change", async () => {
        const requestedLibrary = libraryEl.value;
        if (requestedLibrary === createLibraryOption) {
          const newLibraryId = await ModalUtils.prompt(
            "Create New Library",
            "",
          );
          const validId =
            newLibraryId &&
            /^[A-Za-z0-9_-]+$/.test(newLibraryId) &&
            !["main", "default"].includes(newLibraryId.toLowerCase());
          const alreadyExists =
            newLibraryId &&
            availableLibraries.some(
              (library) =>
                library.id.toLowerCase() === newLibraryId.toLowerCase(),
            );
          if (!validId || alreadyExists) {
            if (newLibraryId !== null) {
              await ModalUtils.alert(
                alreadyExists
                  ? "A library with that ID already exists."
                  : "Use only letters, numbers, underscores, and hyphens. The ID cannot be main or default.",
              );
            }
            libraryEl.value = libraryId;
            return;
          }

          libraryId = newLibraryId;
          currentPresets = {};
          const option = document.createElement("option");
          option.value = newLibraryId;
          option.textContent = newLibraryId;
          libraryEl.insertBefore(
            option,
            libraryEl.querySelector(`option[value="${createLibraryOption}"]`),
          );
          libraryEl.value = newLibraryId;
          if (duplicateLabel)
            duplicateLabel.textContent =
              "Handling Duplicate Presets (0 detected)";
          tree = ExportUtils.buildPresetSelectorTree(
            importedPresets,
            currentPresets,
          );
          mount.replaceChildren(tree.element);
          return;
        }
        const libraryPresets =
          await PresetGalleryAPI.getPresets(requestedLibrary);
        if (libraryEl.value !== requestedLibrary) return;
        libraryId = requestedLibrary;
        currentPresets = libraryPresets;
        const duplicateCount = Object.keys(importedPresets).filter(
          (key) => key in currentPresets && importedPresets[key].preset,
        ).length;
        if (duplicateLabel) {
          duplicateLabel.textContent = `Handling Duplicate Presets (${duplicateCount} detected)`;
        }
        tree = ExportUtils.buildPresetSelectorTree(
          importedPresets,
          currentPresets,
        );
        mount.replaceChildren(tree.element);
      });
    }

    const dupSelect = /** @type {HTMLSelectElement | null} */ (
      modal.querySelector("#j0n4t-pg-dup-strategy")
    );
    if (dupSelect) {
      dupSelect.addEventListener("change", (e) => {
        const target = /** @type {HTMLSelectElement} */ (e.target);
        tree.applyDuplicateStrategy(target.value);
      });
    }

    const close = () => overlay.remove();
    const cancelBtn = /** @type {HTMLButtonElement | null} */ (
      modal.querySelector("#j0n4t-pg-imp-cancel")
    );
    if (cancelBtn) cancelBtn.addEventListener("click", close);

    overlay.addEventListener("click", (e) => {
      if (e.target === overlay) close();
    });

    const confirmBtn = /** @type {HTMLButtonElement | null} */ (
      modal.querySelector("#j0n4t-pg-imp-confirm")
    );
    if (confirmBtn) {
      confirmBtn.addEventListener("click", async () => {
        const selectedKeys = tree.getSelectedKeys();
        if (!selectedKeys.length) {
          await ModalUtils.alert(
            "Please select at least one preset to import.",
          );
          return;
        }
        const duplicateStrategy = dupSelect ? dupSelect.value : "overwrite";
        const colorsEl = /** @type {HTMLInputElement | null} */ (
          modal.querySelector("#j0n4t-pg-imp-colors")
        );
        const importColors = colorsEl ? colorsEl.checked : true;
        const editedPresets = tree.getPresets();
        const summary = ExportUtils.getSelectionSummary(
          selectedKeys,
          editedPresets,
          currentPresets,
        );
        if (
          await ModalUtils.confirm(
            `📊 Import Summary:\n` +
              `• Total Selected: ${summary.total}\n` +
              `• New Styles: ${summary.newCount}\n` +
              `• Replaced Styles: ${summary.replacedCount}\n` +
              `• Unchanged Styles: ${summary.sameCount}`,
          )
        ) {
          close();
          onConfirm({
            selectedKeys,
            duplicateStrategy,
            importColors,
            editedPresets,
            libraryId,
          });
        }
      });
    }

    document.body.appendChild(overlay);
  },

  /**
   * @param {File} file
   * @returns {Promise<{ success: boolean }>}
   */
  /**
   * Merge the selected imported entries into a target library's own cache.
   *
   * `incomingPresets` is the map the selector tree holds - the imported map with
   * any rename or text edit applied - so a key the tree renamed is read from it
   * rather than from the file as it was parsed. `skip` leaves an existing key
   * alone, `keep_both` files the imported copy under `_copy_N`, and `overwrite`
   * (the default) replaces it. Folder colours follow the imported keys.
   * @param {PresetCache} currentPresets the target library as it is now
   * @param {PresetCache} incomingPresets
   * @param {string[]} selectedKeys
   * @param {string} duplicateStrategy
   * @param {boolean} importColors
   * @returns {PresetCache} the merged cache, ready to save
   */
  applyImportSelection(
    currentPresets,
    incomingPresets,
    selectedKeys,
    duplicateStrategy,
    importColors,
  ) {
    const importedActiveFolders = new Set();

    for (const key of selectedKeys) {
      const item = incomingPresets[key];
      if (!item || (!item.preset && !item.filename)) continue;

      let targetKey = key;
      if (
        targetKey in currentPresets &&
        currentPresets[targetKey].preset
      ) {
        if (duplicateStrategy === "skip") {
          continue;
        } else if (duplicateStrategy === "keep_both") {
          let copyIndex = 1;
          const parts = key.split("/");
          const baseName = parts.pop();
          const folderPrefix = parts.length ? parts.join("/") + "/" : "";
          while (
            `${folderPrefix}${baseName}_copy_${copyIndex}` in currentPresets &&
            currentPresets[`${folderPrefix}${baseName}_copy_${copyIndex}`]
              .preset
          ) {
            copyIndex++;
          }
          targetKey = `${folderPrefix}${baseName}_copy_${copyIndex}`;
        }
      }

      const newItem = { ...item };
      if (!importColors) delete newItem.__color__;
      currentPresets[targetKey] = newItem;

      const targetParts = targetKey.split("/");
      while (targetParts.length > 1) {
        targetParts.pop();
        importedActiveFolders.add(targetParts.join("/"));
      }

      const origParts = key.split("/");
      while (origParts.length > 1) {
        origParts.pop();
        importedActiveFolders.add(origParts.join("/"));
      }
    }

    if (importColors) {
      for (const folderKey of importedActiveFolders) {
        const sourceItem = incomingPresets[folderKey];
        if (sourceItem && sourceItem.__color__) {
          currentPresets[folderKey] = {
            ...(currentPresets[folderKey] || {}),
            __color__: sourceItem.__color__,
          };
        }
      }
    }

    return currentPresets;
  },

  /**
   * Read the preset entries under `prefix` from a zip into a flat cache.
   *
   * `prefix` namespaces a bundle: with "main/" only the entries under that
   * folder are read, and the keys come back without it, so the result is that
   * library's own cache. Without a prefix the whole archive is read, which is
   * the single-library export layout.
   * @param {any} zip a JSZip instance
   * @param {string} [prefix]
   * @returns {Promise<PresetCache>}
   */
  async readPresetEntriesFromZip(zip, prefix = "") {
    const normalizedPrefix = prefix
      ? `${prefix.replace(/^\/+/, "").replace(/\/+$/, "")}/`
      : "";
    /** @type {PresetCache} */
    const presets = {};
    /** @type {Record<string, any>} */
    const txtFiles = {};
    /** @type {Record<string, { entry: any, ext: string }>} */
    const imgFiles = {};

    for (const [relativePath, zipEntry] of Object.entries(zip.files)) {
      const entry = /** @type {any} */ (zipEntry);
      if (entry.dir) continue;
      const normalizedPath = relativePath
        .replace(/\\/g, "/")
        .replace(/^\/+/, "");
      if (normalizedPrefix && !normalizedPath.startsWith(normalizedPrefix)) {
        continue;
      }
      const localPath = normalizedPrefix
        ? normalizedPath.slice(normalizedPrefix.length)
        : normalizedPath;
      if (!localPath) continue;

      if (
        localPath.endsWith("/__color__.txt") ||
        localPath === "__color__.txt"
      ) {
        const groupKey = localPath
          .replace(/\/?__color__\.txt$/i, "")
          .toLowerCase()
          .replace(/ /g, "_");
        const colorVal = (await entry.async("string")).trim();
        if (groupKey) {
          presets[groupKey] = {
            ...(presets[groupKey] || {}),
            __color__: colorVal,
          };
        }
        continue;
      }
      const lastDot = localPath.lastIndexOf(".");
      if (lastDot === -1) continue;
      const ext = localPath.slice(lastDot + 1).toLowerCase();
      const keyPath = localPath.slice(0, lastDot);
      if (ext === "txt") {
        txtFiles[keyPath] = entry;
      } else if (["png", "jpg", "jpeg", "webp", "gif"].includes(ext)) {
        imgFiles[keyPath] = { entry, ext };
      }
    }

    for (const [key, txtEntry] of Object.entries(txtFiles)) {
      const presetText = await txtEntry.async("string");
      let filename;
      if (imgFiles[key]) {
        const { entry, ext } = imgFiles[key];
        const base64 = await entry.async("base64");
        const mime = PresetLogic.getMimeType(ext);
        const dataUrl = `data:${mime};base64,${base64}`;
        filename = await PresetDOM.createThumbnail(dataUrl);
      }
      const cleanKey = key.toLowerCase().replace(/ /g, "_");
      if (!cleanKey) continue;
      presets[cleanKey] = {
        ...(presets[cleanKey] || {}),
        preset: presetText,
        filename: filename,
      };
    }

    return presets;
  },

  /**
   * Parse a preset document (JSON or YAML) into a flat cache.
   *
   * Keys are normalized the way every other write normalizes them - the
   * editor's save, the export tree's rename and the zip import all lowercase
   * and turn spaces into underscores. A document import is a write too, so
   * without this the same preset could exist as both `Faces/Portrait` and
   * `faces/portrait` depending on how it arrived.
   * @param {string} text
   * @param {string} format "json" or "yaml"
   * @returns {Promise<PresetCache>}
   */
  async presetsFromDocument(text, format) {
    const parsedData =
      format === "yaml" ? YAMLUtils.parse(text) : JSON.parse(text);
    if (typeof parsedData !== "object" || parsedData === null) {
      throw new Error("Invalid file structure");
    }
    const presets = NestedPresetUtils.nestedToFlat(parsedData);
    for (const key of Object.keys(presets)) {
      const cleanKey = key.toLowerCase().replace(/ /g, "_");
      if (cleanKey === key) continue;
      presets[cleanKey] = presets[key];
      delete presets[key];
    }
    for (const item of Object.values(presets)) {
      if (item && item.filename && item.filename.startsWith("data:image/")) {
        item.filename = await PresetDOM.createThumbnail(item.filename);
      }
    }
    return presets;
  },

  /**
   * Read a bundle archive into its manifest and per-library caches.
   *
   * Returns null when the archive has no manifest, which is how a
   * single-library export (or any other zip) is told apart from a bundle.
   * @param {any} zip a JSZip instance
   * @returns {Promise<LibraryBundle | null>}
   */
  async readBundleFromZip(zip) {
    const manifestEntry = zip.files["manifest.json"];
    if (!manifestEntry) return null;

    let manifest;
    try {
      manifest = JSON.parse(await manifestEntry.async("string"));
    } catch {
      return null;
    }
    if (
      !manifest ||
      manifest.version !== BUNDLE_VERSION ||
      !["files", "json", "yaml"].includes(manifest.layout) ||
      !Array.isArray(manifest.libraries)
    ) {
      throw new Error("Unsupported or corrupt library bundle");
    }

    /** @type {LibraryBundle} */
    const bundle = {
      version: manifest.version,
      layout: manifest.layout,
      libraries: [],
    };

    for (const library of manifest.libraries) {
      if (!library || typeof library.id !== "string" || !library.id) continue;
      /** @type {PresetCache} */
      let presets = {};
      if (manifest.layout === "files") {
        presets = await ExportUtils.readPresetEntriesFromZip(
          zip,
          `${library.id}/`,
        );
      } else {
        const entry = zip.files[`libraries/${library.id}.${manifest.layout}`];
        if (entry) {
          presets = await ExportUtils.presetsFromDocument(
            await entry.async("string"),
            manifest.layout,
          );
        }
      }
      bundle.libraries.push({
        id: library.id,
        name: library.name || library.id,
        presets,
      });
    }

    return bundle;
  },

  /**
   * How many of a bundle library's keys the target library already holds.
   * @param {string[]} keys
   * @param {PresetCache} presets
   * @param {PresetCache | null} [existing]
   * @returns {number}
   */
  getDuplicateCount(keys, presets, existing = null) {
    if (!existing) return 0;
    return keys.filter((key) => key in existing && presets[key]?.preset).length;
  },

  /**
   * The bundle import dialog: one row per library, each holding that library's
   * preset tree and choosing its own target and duplicate strategy.
   *
   * "Restore to <id>" writes the library back where it came from, creating it
   * when the server does not serve it yet; "Skip" writes nothing; naming another
   * served library merges into that one instead.
   * @param {LibraryBundle} bundle
   * @param {(result: { rows: Array<{ id: string, presets: PresetCache, selectedKeys: string[], target: string, strategy: string }>, importColors: boolean }) => void} onConfirm
   */
  async showImportBundleModal(bundle, onConfirm) {
    const libraries = await PresetGalleryAPI.fetchLibraries();
    const served = libraries.length
      ? libraries
      : [
          {
            id: PresetGalleryAPI.DEFAULT_LIBRARY_ID,
            name: PresetGalleryAPI.DEFAULT_LIBRARY_ID,
            default: true,
          },
        ];
    const caches = await PresetGalleryAPI.fetchLibraryCaches(
      served.map((library) => library.id),
    );

    const overlay = document.createElement("div");
    overlay.className = "j0n4t-pg-modal-overlay";
    const modal = document.createElement("div");
    modal.className = "j0n4t-pg-modal j0n4t-pg-modal-large";
    modal.innerHTML = `
      <h3>📥 Import Libraries</h3>
      <div class="j0n4t-pg-modal-field">
        <label class="j0n4t-pg-checkbox-wrap">
          <input type="checkbox" id="j0n4t-pg-bimp-colors" checked />
          <span><strong>Import Custom Group Colors (__color__)</strong></span>
        </label>
      </div>
      <div class="j0n4t-pg-modal-field">
        <label>Select Libraries & Presets to Import</label>
        <div id="j0n4t-pg-bimp-tree" style="max-height: 320px; overflow-y: auto;"></div>
      </div>
      <div class="j0n4t-pg-modal-actions">
        <button type="button" class="j0n4t-pg-btn" id="j0n4t-pg-bimp-cancel" style="background:#444;">Cancel</button>
        <button type="button" class="j0n4t-pg-btn" id="j0n4t-pg-bimp-confirm" style="background:#007acc;">Import Selected</button>
      </div>
    `;
    overlay.appendChild(modal);

    const treeEl = /** @type {HTMLElement | null} */ (
      modal.querySelector("#j0n4t-pg-bimp-tree")
    );

    /** @type {Record<string, PresetCache>} */
    const cachesById = {};
    for (const library of bundle.libraries) {
      cachesById[library.id] = library.presets;
    }

    const tree = ExportUtils.buildBundleSelectorTree({
      libraries: bundle.libraries.map((library) => ({
        id: library.id,
        name: library.name,
      })),
      cachesById,
      existingCachesById: caches,
      served,
      importControls: true,
    });
    treeEl?.replaceChildren(tree.element);

    const close = () => overlay.remove();
    const cancelBtn = /** @type {HTMLButtonElement | null} */ (
      modal.querySelector("#j0n4t-pg-bimp-cancel")
    );
    if (cancelBtn) cancelBtn.addEventListener("click", close);

    overlay.addEventListener("click", (e) => {
      if (e.target === overlay) close();
    });

    const confirmBtn = /** @type {HTMLButtonElement | null} */ (
      modal.querySelector("#j0n4t-pg-bimp-confirm")
    );
    if (confirmBtn) {
      confirmBtn.addEventListener("click", async () => {
        const colorsEl = /** @type {HTMLInputElement | null} */ (
          modal.querySelector("#j0n4t-pg-bimp-colors")
        );
        const importColors = colorsEl ? colorsEl.checked : true;

        /** @type {string[]} */
        const summaryLines = [];
        /** @type {string[]} */
        const empty = [];
        /** @type {string[]} */
        const skipped = [];
        /** @type {Array<{ row: BundleTreeRow, target: string, keys: string[] }>} */
        const writes = [];

        for (const row of tree.rows) {
          if (!Object.keys(row.presets).length) {
            empty.push(row.name);
            continue;
          }
          const keys = tree.getSelectedKeysByLibrary()[row.id] || [];
          if (!keys.length) {
            skipped.push(row.name);
            continue;
          }
          const target = row.target === "restore" ? row.id : row.target;
          if (target === "skip") {
            summaryLines.push(`• ${row.name}: skipped`);
            continue;
          }
          const summary = ExportUtils.getSelectionSummary(
            keys,
            row.presets,
            caches[target],
          );
          writes.push({ row, target, keys });
          summaryLines.push(
            `• ${row.name} → ${target}: ${summary.newCount} new, ${summary.replacedCount} replaced, ${summary.sameCount} unchanged`,
          );
        }
        if (empty.length) {
          summaryLines.push(`• Empty, not written: ${empty.join(", ")}`);
        }
        if (skipped.length) {
          summaryLines.push(
            `• Nothing selected, not written: ${skipped.join(", ")}`,
          );
        }

        if (!writes.length) {
          await ModalUtils.alert("Please select at least one preset to import.");
          return;
        }

        if (
          await ModalUtils.confirm(
            `📊 Import Summary:\n${summaryLines.join("\n")}`,
          )
        ) {
          close();
          onConfirm({
            rows: writes.map(({ row, target, keys }) => ({
              id: row.id,
              presets: row.presets,
              selectedKeys: keys,
              target,
              strategy: row.strategy,
            })),
            importColors,
          });
        }
      });
    }

    document.body.appendChild(overlay);
  },

  /**
   * Run the bundle import dialog and write every selected library, one target
   * at a time so two rows aiming at the same library accumulate.
   * @param {LibraryBundle} bundle
   * @returns {Promise<{ success: boolean }>}
   */
  async importBundle(bundle) {
    return new Promise((resolve) => {
      ExportUtils.showImportBundleModal(
        bundle,
        async (
          /** @type {{ rows: Array<{ id: string, presets: PresetCache, selectedKeys: string[], target: string, strategy: string }>, importColors: boolean }} */ {
            rows,
            importColors,
          },
        ) => {
          for (const row of rows) {
            const current = await PresetGalleryAPI.getPresets(row.target);
            const merged = ExportUtils.applyImportSelection(
              current,
              row.presets,
              row.selectedKeys,
              row.strategy,
              importColors,
            );
            await PresetGalleryAPI.savePresets(merged, row.target);
          }
          resolve({ success: true });
        },
      );
    });
  },

  /**
   * @param {File} file
   * @param {string} defaultLibraryId the library to preselect
   */
  async importFile(file, defaultLibraryId) {
    /** @type {PresetCache} */
    let importedPresets = {};

    if (file.name.toLowerCase().endsWith(".zip")) {
      try {
        const JSZip = await loadJSZip();
        const zip = await JSZip.loadAsync(file);
        const bundle = await ExportUtils.readBundleFromZip(zip);
        if (bundle) {
          try {
            return await ExportUtils.importBundle(bundle);
          } catch (err) {
            await ModalUtils.alert(
              "Failed to import the library bundle: " +
                /** @type {Error} */ (err).message,
            );
            return { success: false };
          }
        }
        importedPresets = await ExportUtils.readPresetEntriesFromZip(zip);
      } catch (err) {
        await ModalUtils.alert(
          "Failed to parse ZIP file: " + /** @type {Error} */ (err).message,
        );
        return { success: false };
      }
    } else {
      try {
        const text = await new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = (e) =>
            resolve(/** @type {string} */ (e.target?.result));
          reader.onerror = reject;
          reader.readAsText(file);
        });
        importedPresets = await ExportUtils.presetsFromDocument(
          /** @type {string} */ (text),
          file.name.endsWith(".yaml") || file.name.endsWith(".yml")
            ? "yaml"
            : "json",
        );
      } catch (err) {
        await ModalUtils.alert(
          "Failed to parse file: " + /** @type {Error} */ (err).message,
        );
        return { success: false };
      }
    }

    if (Object.keys(importedPresets).length === 0) {
      await ModalUtils.alert("No valid presets found in the imported file.");
      return { success: false };
    }

    return new Promise((resolve) => {
      ExportUtils.showImportModal(
        importedPresets,
        defaultLibraryId,
        async (
          /** @type {{ selectedKeys: string[], duplicateStrategy: string, importColors: boolean, editedPresets: PresetCache, libraryId: string }} */ {
            selectedKeys,
            duplicateStrategy,
            importColors,
            editedPresets,
            libraryId,
          },
        ) => {
          const currentPresets = await PresetGalleryAPI.getPresets(libraryId);
          const merged = ExportUtils.applyImportSelection(
            currentPresets,
            editedPresets,
            selectedKeys,
            duplicateStrategy,
            importColors,
          );
          await PresetGalleryAPI.savePresets(merged, libraryId);
          resolve({ success: true });
        },
      );
    });
  },
};

export default ExportUtils;

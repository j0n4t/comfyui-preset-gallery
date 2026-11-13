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
 * @property {(collapsed: boolean) => void} setAllCollapsed
 * @property {(checked: boolean) => void} setAllChecked
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
 * A folder that left its library during a rename.
 * @typedef {Object} FolderMove
 * @property {string} libraryId the library the folder went to
 * @property {string} folder the folder path inside that library
 * @property {PresetCache} presets the moved presets, keyed by their new keys
 * @property {string[]} selectedKeys the moved keys that were checked
 */

/**
 * One library an import will write.
 * @typedef {Object} ImportWrite
 * @property {string} name
 * @property {string} sourceId the library the presets came from
 * @property {PresetCache} presets
 * @property {string[]} selectedKeys
 * @property {number} count real presets, ignoring folder-colour entries
 */

/**
 * The edited preview an import dialog hands back.
 * @typedef {Object} ImportResult
 * @property {ImportWrite[]} rows
 * @property {boolean} importColors
 * @property {string} strategy
 */

/**
 * One library in the picker.
 * @typedef {Object} PickerRow
 * @property {string} sourceId
 * @property {string} name
 * @property {PresetCache} presets
 * @property {boolean} created true when a folder move brought the row into
 *   being, so it can go away again when it empties
 * @property {SelectorTreeResult | null} tree
 * @property {HTMLElement | null} element
 * @property {HTMLElement | null} nameEl
 * @property {HTMLElement | null} consequenceEl
 * @property {HTMLElement | null} countEl
 * @property {HTMLInputElement | null} checkEl
 * @property {HTMLElement | null} itemsEl
 * @property {HTMLElement | null} renameEl
 * @property {HTMLElement | null} collapseEl
 */

/**
 * The editable preview of an import or export.
 * @typedef {Object} LibraryPicker
 * @property {HTMLDivElement} element
 * @property {() => Array<{sourceId: string, name: string, presets: PresetCache, selectedKeys: string[], count: number}>} getRows
 * @property {() => Record<string, PresetCache>} getShape
 * @property {() => Record<string, string[]>} getSelection
 * @property {() => string} getStrategy
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
   * @param {{ nested?: boolean, libraryId?: string, onMove?: (move: FolderMove) => void }} [options]
   *   `nested` drops the tree's own controls and its scroll cap, so it can sit
   *   inside another selector - the bundle tree puts one of these under every
   *   library row. `libraryId` names the library the presets belong to, which is
   *   how a `library#folder` rename tells a move from a rename in place, and
   *   `onMove` is where a moved folder is handed over.
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
        // Same lookup the grid uses for a folder header: walk up the path, and
        // take a parent folder's colour. The old exact-key read missed a colour
        // stored on a parent folder, or one spelled in another case, and fell
        // back to the default blue.
        groupHex = PresetDisplay.getPresetColor(gKey, presets);
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
          const newGroupName = await ModalUtils.prompt(
            "Rename Folder (use / for nested folders; library#folder moves it)",
            gKey === "root_presets" ? "" : gKey,
          );
          if (newGroupName === null) return;
          const trimmed = newGroupName.trim();
          if (trimmed.startsWith("#")) {
            await ModalUtils.alert("Name the library before the #.");
            return;
          }
          // `library#folder` sends the folder to another library instead of
          // renaming it where it is; without a library of our own there is no
          // move to make, only a rename.
          const { libraryId: namedLibrary, key: typedPath } =
            PresetLogic.splitQualifiedKey(trimmed);
          const cleanNewFolder = typedPath
            .split("/")
            .map((part) => part.trim().toLowerCase().replace(/ /g, "_"))
            .filter(Boolean)
            .join("/");
          if (!cleanNewFolder) return;

          if (namedLibrary !== null && options.libraryId == null) {
            await ModalUtils.alert(
              "Rename a folder to library#folder only inside the library picker.",
            );
            return;
          }
          const moving =
            namedLibrary !== null && namedLibrary !== options.libraryId;
          if (!moving && cleanNewFolder === gKey) return;

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
              checked: cb.checked,
            };
          });

          if (moving) {
            if (!options.onMove) {
              await ModalUtils.alert(
                "Moving a folder into another library needs the library picker.",
              );
              return;
            }
            /** @type {PresetCache} */
            const moved = {};
            /** @type {string[]} */
            const selectedKeys = [];
            for (const { oldKey, newKey, checked } of keyMoves) {
              if (presets[oldKey]) {
                moved[newKey] = presets[oldKey];
                delete presets[oldKey];
              }
              if (checked) selectedKeys.push(newKey);
            }
            const carriedColorKey =
              gKey === "root_presets"
                ? null
                : PresetDisplay.getFolderColorKey(presets, gKey);
            if (carriedColorKey) {
              moved[cleanNewFolder] = {
                ...(moved[cleanNewFolder] || {}),
                __color__: presets[carriedColorKey].__color__,
              };
              delete presets[carriedColorKey].__color__;
              if (Object.keys(presets[carriedColorKey]).length === 0) {
                delete presets[carriedColorKey];
              }
            }
            options.onMove({
              libraryId: namedLibrary,
              folder: cleanNewFolder,
              presets: moved,
              selectedKeys,
            });
            return;
          }

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

          const carriedColorKey =
            gKey === "root_presets"
              ? null
              : PresetDisplay.getFolderColorKey(presets, gKey);
          if (carriedColorKey) {
            if (cleanNewFolder) {
              presets[cleanNewFolder] = {
                ...(presets[cleanNewFolder] || {}),
                __color__: presets[carriedColorKey].__color__,
              };
            }
            delete presets[carriedColorKey].__color__;
            if (Object.keys(presets[carriedColorKey]).length === 0) {
              delete presets[carriedColorKey];
            }
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
    /**
     * Collapse or expand everything the tree holds: the folder groups, and any
     * preset's own expanded contents - the `⊞` details drawer and the `✎`
     * inline editor. Expanding does not reopen those; they are per-preset and
     * were opened by hand.
     * @param {boolean} collapsed
     */
    const setAllCollapsed = (collapsed) => {
      isAllCollapsed = collapsed;
      if (toggleAllBtn) {
        toggleAllBtn.textContent = collapsed ? "Expand All" : "Collapse All";
      }
      treeBox
        .querySelectorAll(".j0n4t-pg-collapse-btn")
        .forEach((btn, idx) => {
          btn.textContent = collapsed ? "▶" : "▼";
          const box = /** @type {HTMLElement | null} */ (
            treeBox.querySelectorAll(".j0n4t-pg-tree-group-items")[idx]
          );
          if (box) box.style.display = collapsed ? "none" : "";
        });
      if (!collapsed) return;
      treeBox
        .querySelectorAll(".j0n4t-pg-details-container")
        .forEach((el) => {
          /** @type {HTMLElement} */ (el).style.display = "none";
        });
      treeBox.querySelectorAll(".j0n4t-pg-details-btn").forEach((el) => {
        /** @type {HTMLElement} */ (el).textContent = "⊞";
      });
      treeBox
        .querySelectorAll(".j0n4t-pg-edit-container")
        .forEach((el) => {
          /** @type {HTMLElement} */ (el).style.display = "none";
        });
    };
    if (toggleAllBtn) {
      toggleAllBtn.addEventListener("click", () =>
        setAllCollapsed(!isAllCollapsed),
      );
    }

    const updateGroupAndMasterStates = () => {
      // One pass over the items. Querying each group's items here was
      // O(items x groups) per change event, which is what made a single click
      // in a large library block the page for seconds.
      const totals = new Map();
      const checkedByGroup = new Map();
      itemCbs.forEach((cb) => {
        const group = cb.dataset.group || "";
        totals.set(group, (totals.get(group) || 0) + 1);
        if (cb.checked) {
          checkedByGroup.set(group, (checkedByGroup.get(group) || 0) + 1);
        }
      });

      let allItemsChecked = true;
      let anyItemChecked = false;

      groupCbs.forEach((gCb) => {
        const group = gCb.dataset.group || "";
        const total = totals.get(group) || 0;
        const count = checkedByGroup.get(group) || 0;
        gCb.checked = count === total && total > 0;
        gCb.indeterminate = count > 0 && count < total;
        if (count > 0) anyItemChecked = true;
        if (count < total) allItemsChecked = false;
      });

      if (masterCb) {
        masterCb.checked = allItemsChecked;
        masterCb.indeterminate = !allItemsChecked && anyItemChecked;
      }
    };

    /**
     * Check or uncheck every preset in the tree in one pass. The picker uses
     * this for its own master checkbox and for a library's checkbox: setting
     * each box and firing its `change` event costs O(items x groups).
     * @param {boolean} checked
     */
    const setAllChecked = (checked) => {
      itemCbs.forEach((cb) => {
        cb.checked = checked;
        cb.dataset.userModified = "true";
      });
      groupCbs.forEach((cb) => {
        cb.checked = checked;
        cb.indeterminate = false;
      });
      if (masterCb) {
        masterCb.checked = checked;
        masterCb.indeterminate = false;
      }
    };

    if (masterCb) {
      masterCb.addEventListener("change", () => setAllChecked(masterCb.checked));
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
      setAllCollapsed,
      setAllChecked,
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
   * The editable preview of what an import or export will write.
   *
   * Every row is one library: a checkbox, a name with a pencil, a line saying
   * what writing it will do, and its own preset tree. The preview *is* the
   * shape - a rename or a checkbox mutates it in place, and `getShape()` is
   * what the caller writes. There is no history and no undo.
   *
   * `name` is the library that will be written; `sourceId` is the library the
   * row's presets came from, which is what tells "restores in place" apart from
   * "merges into" another library. Renaming a row onto another row's name
   * merges the two, so names stay unique.
   * @param {Object} options
   * @param {Array<{sourceId: string, name: string, presets: PresetCache}>} options.rows
   * @param {Array<{id: string, name: string}>} [options.served]
   * @param {Record<string, PresetCache> | null} [options.existingCachesById]
   * @param {"import" | "export"} [options.mode]
   * @returns {LibraryPicker}
   */
  buildLibraryPicker({
    rows,
    served = [],
    existingCachesById = null,
    mode = "import",
  }) {
    const container = document.createElement("div");
    container.className = "j0n4t-pg-selector-container";

    const controls = document.createElement("div");
    controls.className = "j0n4t-pg-selector-controls";
    controls.innerHTML = `
      <div style="display: flex; justify-content: space-between; align-items: center; width: 100%;">
        <label class="j0n4t-pg-checkbox-wrap" style="margin: 0;">
          <input type="checkbox" id="j0n4t-pg-picker-sel-all" checked />
          <span><strong>Select / Deselect All Libraries</strong></span>
        </label>
        <button type="button" id="j0n4t-pg-picker-toggle-collapse" style="background: transparent; border: 1px solid #777; color: inherit; padding: 2px 8px; border-radius: 4px; cursor: pointer; font-size: 0.85em;">Collapse All</button>
      </div>
      ${mode === "import" ? `
        <div style="display: flex; align-items: center; gap: 8px; margin-top: 6px;">
          <label for="j0n4t-pg-picker-strategy" style="font-size: 0.85em; color: #aaa;">Duplicate presets</label>
          <select id="j0n4t-pg-picker-strategy" style="flex: 1;">
            <option value="overwrite">Overwrite existing presets</option>
            <option value="skip">Skip duplicates</option>
            <option value="keep_both">Keep both (rename with _copy)</option>
          </select>
        </div>
      ` : ""}
    `;
    container.appendChild(controls);

    /**
     * @param {{sourceId: string, name: string, presets: PresetCache}} input
     * @returns {PickerRow}
     */
    const makeRow = (input) => ({
      sourceId: input.sourceId ?? input.name ?? "",
      name: input.name ?? input.sourceId ?? "",
      presets: input.presets || {},
      created: false,
      tree: null,
      element: null,
      nameEl: null,
      consequenceEl: null,
      countEl: null,
      checkEl: null,
      itemsEl: null,
      renameEl: null,
      collapseEl: null,
    });

    /** @type {PickerRow[]} */
    const pickerRows = (rows || []).map(makeRow);

    /** Every preset checkbox inside a container, typed as an input. */
    const itemBoxes = (/** @type {HTMLElement} */ el) =>
      /** @type {HTMLInputElement[]} */ (
        Array.from(el.querySelectorAll(".j0n4t-pg-item-cb"))
      );

    /** A row's preset box, which `renderRow` always sets before use. */
    const itemsOf = (/** @type {PickerRow} */ pr) =>
      /** @type {HTMLElement} */ (pr.itemsEl);

    /** @param {number} n */
    const plural = (n) => (n === 1 ? "" : "s");

    /**
     * Real presets, ignoring the folder-colour entries a cache carries.
     * @param {PresetCache} presets
     */
    const presetCount = (presets) =>
      Object.values(presets).filter(
        (item) =>
          item &&
          ((typeof item.preset === "string" && item.preset.trim().length > 0) ||
            item.filename),
      ).length;

    /**
     * @param {PickerRow} pr
     * @param {string} libraryId
     */
    const duplicatesAgainst = (pr, libraryId) =>
      ExportUtils.getDuplicateCount(
        Object.keys(pr.presets),
        pr.presets,
        existingCachesById ? existingCachesById[libraryId] ?? null : null,
      );

    /**
     * One line under the name saying what writing this row will do.
     * @param {PickerRow} pr
     */
    const consequenceText = (pr) => {
      const total = presetCount(pr.presets);
      const noun = `${total} preset${plural(total)}`;
      if (pr.sourceId && pr.name === pr.sourceId) {
        const duplicates = duplicatesAgainst(pr, pr.name);
        return `restores in place · ${noun}, ${duplicates} duplicate${plural(duplicates)}`;
      }
      const known = served.find((library) => library.id === pr.name);
      if (!known) return `creates a new library · ${noun}`;
      const duplicates = duplicatesAgainst(pr, pr.name);
      return `merges into ${known.name} · ${noun}, ${duplicates} duplicate${plural(duplicates)}`;
    };

    /**
     * Rebuild the header from the row's current state.
     * @param {PickerRow} pr
     */
    const updateRow = (pr) => {
      const total = presetCount(pr.presets);
      const selected = pr.tree ? pr.tree.getSelectedKeys().length : 0;
      if (pr.nameEl) {
        pr.nameEl.innerHTML =
          `<strong>${PresetDOM.escapeHTML(pr.name)}</strong>` +
          ` (${selected}/${total})`;
      }
      if (pr.consequenceEl) {
        pr.consequenceEl.textContent = consequenceText(pr);
      }
      const boxes = pr.itemsEl ? itemBoxes(pr.itemsEl) : [];
      const checked = boxes.filter((cb) => cb.checked).length;
      if (pr.checkEl) {
        pr.checkEl.checked = boxes.length > 0 && checked === boxes.length;
        pr.checkEl.indeterminate = checked > 0 && checked < boxes.length;
      }
    };

    /**
     * Mount the row's preset tree against its current name.
     * @param {PickerRow} pr
     */
    const mountTree = (pr) => {
      pr.tree = ExportUtils.buildPresetSelectorTree(
        pr.presets,
        existingCachesById ? existingCachesById[pr.name] ?? null : null,
        {
          nested: true,
          libraryId: pr.name,
          onMove: (move) => onMove(pr, move),
        },
      );
      itemsOf(pr).replaceChildren(pr.tree.element);
      updateRow(pr);
    };

    /**
     * Rebuild the tree, keeping the keys the user had checked.
     * @param {PickerRow} pr
     * @param {Set<string> | null} [keptKeys]
     */
    const applyRow = (pr, keptKeys = null) => {
      const kept = keptKeys ?? new Set(pr.tree?.getSelectedKeys() || []);
      mountTree(pr);
      itemBoxes(itemsOf(pr)).forEach((cb) => {
        cb.checked = kept.has(cb.value);
        cb.dispatchEvent(new Event("change"));
      });
      updateRow(pr);
    };

    /**
     * Append a row and check the keys it arrived with.
     * @param {{sourceId: string, name: string, presets: PresetCache}} input
     * @param {Set<string> | null} [keptKeys]
     * @returns {PickerRow}
     */
    const addRow = (input, keptKeys = null) => {
      const pr = makeRow(input);
      pr.created = true;
      pickerRows.push(pr);
      container.appendChild(renderRow(pr));
      if (keptKeys) {
        itemBoxes(itemsOf(pr)).forEach((cb) => {
          cb.checked = keptKeys.has(cb.value);
          cb.dispatchEvent(new Event("change"));
        });
        updateRow(pr);
      }
      return pr;
    };

    /**
     * A folder renamed to another library: it leaves this row and lands in the
     * row for that library, which a first move creates.
     * @param {PickerRow} pr the row the folder left
     * @param {FolderMove} move
     */
    const onMove = (pr, move) => {
      const target = pickerRows.find((other) => other.name === move.libraryId);
      if (target) {
        target.presets = { ...target.presets, ...move.presets };
        applyRow(target, new Set(move.selectedKeys));
      } else {
        addRow(
          {
            sourceId: pr.name,
            name: move.libraryId,
            presets: move.presets,
          },
          new Set(move.selectedKeys),
        );
      }
      applyRow(pr);
      // A row that only existed because a folder moved in goes away when it
      // empties; one of the original rows stays put.
      if (pr.created && Object.keys(pr.presets).length === 0) {
        removeRow(pr);
      }
    };

    /**
     * @param {PickerRow} pr
     */
    const removeRow = (pr) => {
      pr.element?.remove();
      const index = pickerRows.indexOf(pr);
      if (index !== -1) pickerRows.splice(index, 1);
    };

    /**
     * Renaming onto another row's name folds the two rows into one.
     * @param {PickerRow} pr
     * @param {string} clean
     */
    const renameRow = (pr, clean) => {
      if (clean === pr.name) return;
      const target = pickerRows.find(
        (other) => other !== pr && other.name === clean,
      );
      if (target) {
        // Both rows' picks survive the fold.
        const kept = new Set([
          ...(target.tree?.getSelectedKeys() || []),
          ...(pr.tree?.getSelectedKeys() || []),
        ]);
        target.presets = { ...target.presets, ...pr.presets };
        removeRow(pr);
        applyRow(target, kept);
        return;
      }
      pr.name = clean;
      applyRow(pr);
    };

    /**
     * @param {PickerRow} pr
     */
    const bindRow = (pr) => {
      pr.renameEl?.addEventListener("click", async () => {
        const typed = await ModalUtils.prompt("Library name", pr.name);
        if (typed === null) return;
        const clean = typed.trim();
        if (!/^[A-Za-z0-9_-]+$/.test(clean)) {
          await ModalUtils.alert(
            "Use only letters, numbers, underscores, and hyphens.",
          );
          return;
        }
        renameRow(pr, clean);
      });

      pr.checkEl?.addEventListener("change", () => {
        const checked = /** @type {HTMLInputElement} */ (pr.checkEl).checked;
        pr.tree?.setAllChecked(checked);
        updateRow(pr);
      });

      itemsOf(pr).addEventListener("change", (e) => {
        const target = e.target;
        if (
          target instanceof HTMLElement &&
          target.classList.contains("j0n4t-pg-item-cb")
        ) {
          updateRow(pr);
        }
      });

      pr.collapseEl?.addEventListener("click", () => {
        const isCollapsed = itemsOf(pr).style.display === "none";
        itemsOf(pr).style.display = isCollapsed ? "" : "none";
        if (pr.collapseEl) {
          pr.collapseEl.textContent = isCollapsed ? "▼" : "▶";
        }
      });
    };

    /** @param {PickerRow} pr */
    const renderRow = (pr) => {
      const groupEl = document.createElement("div");
      groupEl.className = "j0n4t-pg-tree-group j0n4t-pg-bundle-group";

      // The pencil is how the preview edits the shape: renaming a row names
      // the library that gets written, in export as in import. The consequence
      // line is import-only - export has nothing to merge on the server.
      const consequenceHtml =
        mode === "import"
          ? `<div class="j0n4t-pg-bundle-consequence" style="color: #888; font-size: 0.8em; margin-top: 2px; padding-left: 28px;"></div>`
          : "";

      const header = document.createElement("div");
      header.className = "j0n4t-pg-tree-group-header";
      header.innerHTML = `
        <div style="display: flex; align-items: center; width: 100%; padding-right: 4px;">
          <span class="j0n4t-pg-collapse-btn" style="cursor: pointer; padding-right: 8px; user-select: none; width: 20px; text-align: center; font-size: 0.9em;">▼</span>
          <label class="j0n4t-pg-checkbox-wrap" style="margin: 0; display: flex; align-items: center;">
            <input type="checkbox" class="j0n4t-pg-bundle-lib-cb" checked />
            <span class="j0n4t-pg-group-name j0n4t-pg-bundle-name" style="border-left:3px solid #007acc; padding-left:6px; margin-right: 8px;"></span>
          </label>
          <button type="button" class="j0n4t-pg-bundle-rename" title="Rename this library" style="background: transparent; border: 1px solid #555; color: inherit; cursor: pointer; border-radius: 3px; padding: 0 6px; font-size: 0.85em;">✎</button>
          <span class="j0n4t-pg-bundle-count" style="margin-left: auto; color: #888; font-size: 0.8em;"></span>
        </div>
        ${consequenceHtml}
      `;

      const itemsBox = document.createElement("div");
      itemsBox.className = "j0n4t-pg-tree-group-items";

      pr.element = groupEl;
      pr.nameEl = header.querySelector(".j0n4t-pg-bundle-name");
      pr.consequenceEl = header.querySelector(".j0n4t-pg-bundle-consequence");
      pr.countEl = header.querySelector(".j0n4t-pg-bundle-count");
      pr.checkEl = header.querySelector(".j0n4t-pg-bundle-lib-cb");
      pr.renameEl = header.querySelector(".j0n4t-pg-bundle-rename");
      pr.collapseEl = header.querySelector(".j0n4t-pg-collapse-btn");
      pr.itemsEl = itemsBox;

      groupEl.appendChild(header);
      groupEl.appendChild(itemsBox);
      bindRow(pr);
      mountTree(pr);
      return groupEl;
    };

    for (const pr of pickerRows) {
      container.appendChild(renderRow(pr));
    }

    const strategyEl = /** @type {HTMLSelectElement | null} */ (
      container.querySelector("#j0n4t-pg-picker-strategy")
    );
    strategyEl?.addEventListener("change", () => {
      for (const pr of pickerRows) {
        pr.tree?.applyDuplicateStrategy(strategyEl.value);
        updateRow(pr);
      }
    });

    const masterCb = /** @type {HTMLInputElement | null} */ (
      controls.querySelector("#j0n4t-pg-picker-sel-all")
    );
    masterCb?.addEventListener("change", () => {
      for (const pr of pickerRows) {
        if (pr.checkEl) pr.checkEl.checked = masterCb.checked;
        // One bulk set per row: firing a change event per preset was
        // O(items x groups) and blocked the page on a large library.
        pr.tree?.setAllChecked(masterCb.checked);
        updateRow(pr);
      }
    });

    const toggleAllBtn = /** @type {HTMLButtonElement | null} */ (
      controls.querySelector("#j0n4t-pg-picker-toggle-collapse")
    );
    let allCollapsed = false;
    toggleAllBtn?.addEventListener("click", () => {
      allCollapsed = !allCollapsed;
      toggleAllBtn.textContent = allCollapsed ? "Expand All" : "Collapse All";
      for (const pr of pickerRows) {
        if (pr.collapseEl) pr.collapseEl.textContent = allCollapsed ? "▶" : "▼";
        itemsOf(pr).style.display = allCollapsed ? "none" : "";
        // The row's whole tree collapses, and with it the folders and any
        // preset's expanded contents inside it.
        pr.tree?.setAllCollapsed(allCollapsed);
      }
    });

    return {
      element: container,
      getRows: () =>
        pickerRows.map((pr) => ({
          sourceId: pr.sourceId,
          name: pr.name,
          presets: pr.presets,
          selectedKeys: pr.tree ? pr.tree.getSelectedKeys() : [],
          count: presetCount(pr.presets),
        })),
      getShape: () => {
        /** @type {Record<string, PresetCache>} */
        const shape = {};
        for (const pr of pickerRows) shape[pr.name] = pr.presets;
        return shape;
      },
      getSelection: () => {
        /** @type {Record<string, string[]>} */
        const selection = {};
        for (const pr of pickerRows) {
          selection[pr.name] = pr.tree ? pr.tree.getSelectedKeys() : [];
        }
        return selection;
      },
      getStrategy: () => {
        const el = /** @type {HTMLSelectElement | null} */ (
          container.querySelector("#j0n4t-pg-picker-strategy")
        );
        return el ? el.value : "overwrite";
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
          const colorKey = PresetDisplay.getFolderColorKey(presets, folder);
          if (colorKey) {
            filtered[folder] = {
              ...(filtered[folder] || {}),
              __color__: presets[colorKey].__color__,
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
   * @param {(result: ImportResult) => void} onConfirm
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
    const defaultId = availableLibraries.some(
      (library) => library.id === defaultLibraryId,
    )
      ? defaultLibraryId
      : availableLibraries[0].id;
    const caches = await PresetGalleryAPI.fetchLibraryCaches(
      availableLibraries.map((library) => library.id),
    );
    // This dialog builds its own overlay rather than going through
    // ModalUtils.show, so it has to inject the modal stylesheet itself.
    ModalUtils.injectStyles();
    const overlay = document.createElement("div");
    overlay.className = "j0n4t-pg-modal-overlay";

    const modal = document.createElement("div");
    modal.className = "j0n4t-pg-modal j0n4t-pg-modal-expand";

    modal.innerHTML = `
      <h3>📥 Import Presets</h3>
      <div class="j0n4t-pg-modal-field">
        <label class="j0n4t-pg-checkbox-wrap">
          <input type="checkbox" id="j0n4t-pg-imp-colors" checked />
          <span><strong>Import Custom Group Colors (__color__)</strong></span>
        </label>
      </div>
      <div class="j0n4t-pg-modal-field">
        <label>Preview the Libraries to Import</label>
        <div id="j0n4t-pg-tree-mount"></div>
      </div>
      <div class="j0n4t-pg-modal-actions">
        <button type="button" class="j0n4t-pg-btn" id="j0n4t-pg-imp-cancel" style="background:#444;">Cancel</button>
        <button type="button" class="j0n4t-pg-btn" id="j0n4t-pg-imp-confirm" style="background:#007acc;">Import Selected</button>
      </div>
    `;

    overlay.appendChild(modal);

    const picker = ExportUtils.buildLibraryPicker({
      rows: [
        {
          // a file import has no library of its own, so the row never claims
          // to be restoring one
          sourceId: "",
          name: defaultId,
          presets: importedPresets,
        },
      ],
      served: availableLibraries,
      existingCachesById: caches,
      mode: "import",
    });
    const mount = /** @type {HTMLElement | null} */ (
      modal.querySelector("#j0n4t-pg-tree-mount")
    );
    if (mount) mount.replaceChildren(picker.element);

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
        const rows = picker.getRows().filter((row) => row.selectedKeys.length);
        if (!rows.length) {
          await ModalUtils.alert(
            "Please select at least one preset to import.",
          );
          return;
        }
        const colorsEl = /** @type {HTMLInputElement | null} */ (
          modal.querySelector("#j0n4t-pg-imp-colors")
        );
        const importColors = colorsEl ? colorsEl.checked : true;
        const strategy = picker.getStrategy();

        /** @type {string[]} */
        const summaryLines = ExportUtils.importSummary(
          rows,
          caches,
          strategy,
          importColors,
        );

        if (
          await ModalUtils.confirm(
            `📊 Import Summary:\n${summaryLines.join("\n")}`,
          )
        ) {
          close();
          onConfirm({ rows, importColors, strategy });
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
   * The bundle import dialog: the picker, seeded with one row per library in
   * the bundle. Renaming a row sends it to another library; a folder renamed to
   * `library#folder` moves into that row.
   * @param {LibraryBundle} bundle
   * @param {(result: ImportResult) => void} onConfirm
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

    // This dialog builds its own overlay rather than going through
    // ModalUtils.show, so it has to inject the modal stylesheet itself.
    ModalUtils.injectStyles();
    const overlay = document.createElement("div");
    overlay.className = "j0n4t-pg-modal-overlay";
    const modal = document.createElement("div");
    modal.className = "j0n4t-pg-modal j0n4t-pg-modal-expand";
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

    const picker = ExportUtils.buildLibraryPicker({
      rows: bundle.libraries.map((library) => ({
        sourceId: library.id,
        name: library.id,
        presets: library.presets,
      })),
      served,
      existingCachesById: caches,
      mode: "import",
    });
    const treeEl = /** @type {HTMLElement | null} */ (
      modal.querySelector("#j0n4t-pg-bimp-tree")
    );
    treeEl?.replaceChildren(picker.element);

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
        const strategy = picker.getStrategy();

        /** @type {string[]} */
        const summaryLines = [];
        /** @type {string[]} */
        const empty = [];
        /** @type {string[]} */
        const skipped = [];
        /** @type {ImportWrite[]} */
        const rows = [];

        for (const row of picker.getRows()) {
          if (!row.count) {
            empty.push(row.name);
            continue;
          }
          if (!row.selectedKeys.length) {
            skipped.push(row.name);
            continue;
          }
          rows.push(row);
        }

        summaryLines.push(
          ...ExportUtils.importSummary(rows, caches, strategy, importColors),
        );
        if (empty.length) {
          summaryLines.push(`• Empty, not written: ${empty.join(", ")}`);
        }
        if (skipped.length) {
          summaryLines.push(
            `• Nothing selected, not written: ${skipped.join(", ")}`,
          );
        }

        if (!rows.length) {
          await ModalUtils.alert("Please select at least one preset to import.");
          return;
        }

        if (
          await ModalUtils.confirm(
            `📊 Import Summary:\n${summaryLines.join("\n")}`,
          )
        ) {
          close();
          onConfirm({ rows, importColors, strategy });
        }
      });
    }

    document.body.appendChild(overlay);
  },

  /**
   * One line per destination library: what arrives, and what the library will
   * hold once the global strategy is applied.
   * @param {ImportWrite[]} rows
   * @param {Record<string, PresetCache>} caches the destination libraries now
   * @param {string} strategy
   * @param {boolean} importColors
   * @returns {string[]}
   */
  importSummary(rows, caches, strategy, importColors) {
    return rows.map((row) => {
      const target = caches[row.name] ?? {};
      const summary = ExportUtils.getSelectionSummary(
        row.selectedKeys,
        row.presets,
        target,
      );
      const resulting = ExportUtils.applyImportSelection(
        { ...target },
        row.presets,
        row.selectedKeys,
        strategy,
        importColors,
      );
      const label =
        !row.sourceId || row.name === row.sourceId
          ? row.name
          : `${row.name} ← ${row.sourceId}`;
      return `• ${label}: ${summary.newCount} new, ${summary.replacedCount} replaced, ${summary.sameCount} unchanged → ${Object.keys(resulting).length} presets`;
    });
  },

  /**
   * Write an import, one destination library at a time.
   * same library accumulate, because each write reads the destination fresh.
   * @param {ImportResult} result
   * @returns {Promise<void>}
   */
  async writeImport(result) {
    for (const row of result.rows) {
      const current = await PresetGalleryAPI.getPresets(row.name);
      const merged = ExportUtils.applyImportSelection(
        current,
        row.presets,
        row.selectedKeys,
        result.strategy,
        result.importColors,
      );
      await PresetGalleryAPI.savePresets(merged, row.name);
    }
  },

  /**
   * Run the bundle import dialog and write every selected library, one target
   * at a time so two rows aiming at the same library accumulate.
   * @param {LibraryBundle} bundle
   * @returns {Promise<{ success: boolean }>}
   */
  async importBundle(bundle) {
    return new Promise((resolve) => {
      ExportUtils.showImportBundleModal(bundle, async (result) => {
        await ExportUtils.writeImport(result);
        resolve({ success: true });
      });
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
        async (result) => {
          await ExportUtils.writeImport(result);
          resolve({ success: true });
        },
      );
    });
  },
};

export default ExportUtils;

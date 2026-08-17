import { app } from "../../../scripts/app.js";

import AutocompleteManager from "./AutocompleteManager.js";
import ModalUtils from "./ModalUtils.js";
import PresetGalleryAPI from "./PresetGalleryAPI.js";
import PresetBasket from "./PresetBasket.js";
import PresetEditor from "./PresetEditor.js";
import PresetGrid from "./PresetGrid.js";
import PresetLogic from "./PresetLogic.js";
import ExportUtils from "./ExportUtils.js";
import PresetDOM from "./PresetDOM.js";

const MIN_NODE_HEIGHT = 640;
const MIN_NODE_WIDTH = 400;

class PresetGalleryApp {
  static WRAP_STYLES = /*css*/ `
    .j0n4t-pg-wrap { display: flex; flex: auto; flex-direction: column; gap: 4px; padding: 0; border-radius: 4px; box-sizing: border-box; width: 100%; min-height: 100%; font-family: sans-serif; position: relative; outline: none; overflow: hidden; resize: vertical; }
    .j0n4t-pg-wrap.hide-gallery-mode .j0n4t-pg-grid, .j0n4t-pg-wrap.hide-gallery-mode .j0n4t-pg-more-options-wrap { display: none; }
    .j0n4t-pg-basket-container { display: flex; flex-direction: column; min-height: 80px;  resize: vertical; background: #15151580; border: 1px dashed #777; border-radius: 4px; box-sizing: border-box; width: 100%; flex-shrink: 0; transition: border-color 0.2s, background-color 0.2s; position: relative;  overflow-y: auto; overflow-x: hidden; }
    .j0n4t-pg-basket-pool-wrapper { flex: 1 1 auto; overflow-y: auto; position: relative; margin: 4px; display: block; box-sizing: border-box; }
    .j0n4t-pg-basket-raw-textarea { flex: 1 1 auto; resize: none; }
    .j0n4t-pg-wrap.hide-gallery-mode .j0n4t-pg-basket-container { flex: 1 1 100%; resize: none; }
  `;

  static ACTION_TOPBAR_SEARCH_STYLES = /*css*/ `
    .j0n4t-pg-action-btn { display: flex; align-items: center; justify-content: center; width: 14px; height: 14px; color: #aaa; border-radius: 2px; cursor: pointer; transition: 0.1s; margin-left: 1px; outline: none; }
    .j0n4t-pg-action-btn:hover, .j0n4t-pg-action-btn:focus-visible { background: #555; color: #fff; }
    .j0n4t-pg-action-btn.del-btn:hover, .j0n4t-pg-action-btn.del-btn:focus-visible { background: #b23b3b; color: #fff; }
    .j0n4t-pg-action-btn svg { width: 10px; height: 10px; fill: currentColor; }
    .j0n4t-pg-search-wrapper { position: relative; flex-grow: 1; display: flex; align-items: center; }
    .j0n4t-pg-search { width: 100%; padding: 6px 24px 6px 6px; background: #1a1a1ab0; border: 1px solid #444; border-radius: 4px; color: #fff; font-size: 11px; box-sizing: border-box; min-width: 0; outline: none; }
    .j0n4t-pg-search:focus { border-color: #007acc; }
    .j0n4t-pg-search-clear { position: absolute; right: 6px; width: 14px; height: 14px; color: #777; cursor: pointer; display: none; align-items: center; justify-content: center; border-radius: 2px; transition: color 0.1s, background-color 0.1s; outline: none; }
    .j0n4t-pg-search-clear:hover, .j0n4t-pg-search-clear:focus-visible { color: #fff; background: #b23b3b; }
    .j0n4t-pg-search-clear svg { width: 10px; height: 10px; fill: currentColor; }
  `;

  static GALLERY_STYLES = /*css*/ `
    .j0n4t-pg-control-bar { display: flex; gap: 4px; align-items: center; margin-top: 2px; flex-shrink: 0; width: 100%; }
    .j0n4t-pg-controls { display: flex; gap: 2px; flex-shrink: 0; background: #1a1a1a80; padding: 2px; border-radius: 4px; border: 1px solid #444; }
    .j0n4t-pg-view-btn { display: flex; align-items: center; justify-content: center; width: 22px; height: 22px; border-radius: 3px; cursor: pointer; color: #aaa; background: transparent; transition: 0.15s; outline: none; }
    .j0n4t-pg-view-btn:hover, .j0n4t-pg-view-btn:focus-visible { background: #333; color: #fff; }
    .j0n4t-pg-view-btn.active { background: #007acc; color: #fff; }
    .j0n4t-pg-view-btn svg, .j0n4t-pg-btn svg { width: 14px; height: 14px; fill: currentColor; }
    .j0n4t-pg-view-btn svg.rotatable { transition: transform 0.2s ease; }
    .j0n4t-pg-view-btn.collapsed-state svg.rotatable { transform: rotate(180deg); }
    .j0n4t-pg-grid { display: grid; gap: 6px; flex: 1 1 auto; overflow-y: auto; min-height: 60px; align-content: start; margin-top: 2px; outline: none; }
    .j0n4t-pg-grid.view-small { grid-template-columns: repeat(auto-fill, minmax(55px, 1fr)); }
    .j0n4t-pg-grid.view-big { grid-template-columns: repeat(auto-fill, minmax(100px, 1fr)); }
    .j0n4t-pg-grid.view-list { grid-template-columns: repeat(auto-fill, minmax(100px, 1fr)); gap: 4px; }
    .j0n4t-pg-grid.hide-folders .j0n4t-pg-tag-badge { display: block !important; }
    .j0n4t-pg-checkbox-wrap { display: flex; align-items: center; gap: 4px; font-size: 10px; color: #aaa; user-select: none; cursor: pointer; padding: 3px 2px; height: 20px; box-sizing: border-box; white-space: nowrap; outline: none; }
    .j0n4t-pg-checkbox-wrap input { width: auto; margin: 0; cursor: pointer; outline: none; }
    .j0n4t-pg-checkbox-wrap input:focus-visible { outline: 1px solid #007acc; outline-offset: 2px; }
    .j0n4t-pg-more-options-wrap { position: relative; }
    .j0n4t-pg-popup-menu { position: absolute; bottom: 100%; right: 0; margin-bottom: 6px; background: #1a1a1a; border: 1px solid #444; border-radius: 4px; padding: 4px; display: none; gap: 4px; z-index: 1000; box-shadow: 0 4px 12px rgba(0,0,0,0.5); min-width: fit-content; }
    .j0n4t-pg-popup-menu.show { display: flex; }
    .j0n4t-pg-popup-section { display: flex; gap: 2px; justify-content: center; background: #222; padding: 2px; border-radius: 3px; }
  `;

  static MODAL_STYLES = /*css*/ `
    .j0n4t-pg-modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.65); backdrop-filter: blur(3px); z-index: 20000; display: flex; align-items: center; justify-content: center; }
    .j0n4t-pg-modal { background: #1f1f1f; border: 1px solid #007acc; border-radius: 8px; min-width: 200px; padding: 16px; box-shadow: 0 8px 24px rgba(0,0,0,0.6); font-family: sans-serif; display: flex; flex-direction: column; gap: 12px; color: #eee; }
    .j0n4t-pg-modal.j0n4t-pg-modal-large { width: 420px; max-width: 90vw; }
    .j0n4t-pg-modal h3 { margin: 0; font-size: 13px; font-weight: bold; color: #fff; display: flex; align-items: center; gap: 6px; }
    .j0n4t-pg-modal-row { display: flex; gap: 10px; width: 100%; }
    .j0n4t-pg-modal-field { display: flex; flex-direction: column; gap: 4px; font-size: 11px; }
    .j0n4t-pg-modal-field label { color: #aaa; font-weight: bold; }
    .j0n4t-pg-modal-field select { background: #111; border: 1px solid #444; color: #fff; padding: 6px; border-radius: 4px; font-size: 11px; outline: none; }
    .j0n4t-pg-modal-field select:focus { border-color: #007acc; }
    .j0n4t-pg-modal-actions { display: flex; justify-content: flex-end; gap: 8px; margin-top: 4px; }
  `;

  static PRESET_TREE_SELECTOR_STYLES = /*css*/ `
    .j0n4t-pg-selector-container { border: 1px solid #333; background: #141414; border-radius: 4px; padding: 6px; display: flex; flex-direction: column; gap: 6px; }
    .j0n4t-pg-selector-controls { border-bottom: 1px solid #222; padding-bottom: 4px; }
    .j0n4t-pg-selector-tree { max-height: 220px; overflow-y: auto; display: flex; flex-direction: column; gap: 6px; padding-right: 4px; }
    .j0n4t-pg-tree-group { display: flex; flex-direction: column; gap: 2px; }
    .j0n4t-pg-tree-group-header { background: #1e1e1e; padding: 2px 6px; border-radius: 3px; }
    .j0n4t-pg-tree-group-items { padding-left: 16px; display: flex; flex-direction: column; gap: 1px; }
    .j0n4t-pg-tree-item { padding: 1px 0; }
  `;

  constructor(node, widget) {
    this.node = node;
    this.widget = widget;
    this.cache = {};
    this.rollManager = new PresetLogic.RollManager();
    this.dom = this.buildDOMStructure();

    this.basket = new PresetBasket(
      this.dom.basketContainer,
      this.dom.wrap.querySelector(".j0n4t-pg-basket-pool"),
      this.dom.rawTextarea,
      this
    );
    this.editor = new PresetEditor(this.dom, this);
    this.grid = new PresetGrid(this.dom, this);

    PresetDOM.injectStyles('j0n4t-pg-wrap-styles', PresetGalleryApp.WRAP_STYLES);
    PresetDOM.injectStyles('j0n4t-pg-action-topbar-search-styles', PresetGalleryApp.ACTION_TOPBAR_SEARCH_STYLES);
    PresetDOM.injectStyles('j0n4t-pg-gallery-styles', PresetGalleryApp.GALLERY_STYLES);
    PresetDOM.injectStyles('j0n4t-pg-modal-styles', PresetGalleryApp.MODAL_STYLES);
    PresetDOM.injectStyles('j0n4t-pg-preset-tree-selector-styles', PresetGalleryApp.PRESET_TREE_SELECTOR_STYLES);

    this.bindEvents();
    this.editor.renderPreview();
  }

  buildDOMStructure() {
    const wrap = document.createElement("div");
    wrap.className = "j0n4t-pg-wrap";
    wrap.innerHTML = `
      <div class="j0n4t-pg-basket-container">
        <div class="j0n4t-pg-basket-header">
          <div class="j0n4t-pg-basket-title" aria-label="Presets Basket">🧺 Presets Basket</div>
          <div style="display: flex; gap: 4px; align-items: center;">
                  <button type="button" class="j0n4t-pg-basket-copy-btn" title="Copy basket content" aria-label="Copy basket content">${PresetDOM.icons.copy}</button>
                  <button type="button" class="j0n4t-pg-basket-reroll-btn" title="Feeling lucky?" aria-label="Feeling lucky?" style="display:flex; font-size:14px; background:transparent; border:none; cursor:pointer; padding:0; outline:none; filter: grayscale(1) brightness(1.5);">${PresetDOM.icons.dice}</button>
                  <label class="j0n4t-pg-checkbox-wrap" style="height:auto; padding:0; margin-right:4px;"><input type="checkbox" id="j0n4t-pg-basket-raw-toggle" />Raw</label>
                  <button type="button" class="j0n4t-pg-basket-clear-btn" title="Clear basket" aria-label="Clear basket" style="font-size:9px; color:#fff; background:#b23b3b; border:none; padding:2px 6px; border-radius:3px; cursor:pointer;">🗑️ Clear</button>
          </div>
        </div>
        <div class="j0n4t-pg-basket-pool-wrapper">
          <div class="j0n4t-pg-basket-pool" role="listbox" aria-label="Preset selections pool"></div>
        </div>
        <textarea class="j0n4t-pg-basket-raw-textarea" id="j0n4t-pg-raw-input" placeholder="Tokens..." spellcheck="false" aria-label="Raw text tokens"></textarea>
      </div>

      <div class="j0n4t-pg-control-bar">
              <div class="j0n4t-pg-controls">
                <div class="j0n4t-pg-view-btn" id="j0n4t-pg-toggle" tabindex="0" role="button" aria-expanded="false" title="Management Panel">${PresetDOM.icons.preset}</div>  
              </div>
              <div class="j0n4t-pg-search-wrapper"><input type="text" enterkeyhint="enter" class="j0n4t-pg-search" placeholder="Search..." aria-label="Search Presets" /><div class="j0n4t-pg-search-clear" tabindex="0" role="button" aria-label="Clear Search">${PresetDOM.icons.close}</div></div>
              <div class="j0n4t-pg-controls">
                <div class="j0n4t-pg-more-options-wrap">
                  <div class="j0n4t-pg-view-btn" id="j0n4t-pg-more-options-btn" tabindex="0" role="button" aria-label="More Options" title="More Options">${PresetDOM.icons.more}</div>
                  <div class="j0n4t-pg-popup-menu" id="j0n4t-pg-popup-menu">
                    <div class="j0n4t-pg-popup-section j0n4t-pg-views" role="group" aria-label="View styles">
                      <div class="j0n4t-pg-view-btn" data-view="small" tabindex="0" role="button" aria-pressed="false" aria-label="Small View" title="Small View">${PresetDOM.icons.small}</div>
                      <div class="j0n4t-pg-view-btn" data-view="big" tabindex="0" role="button" aria-pressed="false" aria-label="Large View" title="Large View">${PresetDOM.icons.big}</div>
                      <div class="j0n4t-pg-view-btn" data-view="list" tabindex="0" role="button" aria-pressed="false" aria-label="List View" title="List View">${PresetDOM.icons.list}</div>
                    </div>
                    <div class="j0n4t-pg-popup-section" id="j0n4t-pg-group-controls">
                      <div class="j0n4t-pg-view-btn" id="j0n4t-pg-global-collapse" tabindex="0" role="button" title="Collapse All" aria-label="Collapse All">${PresetDOM.icons.collapse}</div>
                      <div class="j0n4t-pg-view-btn" id="j0n4t-pg-group-toggle" tabindex="0" role="button" title="Toggle Grouping" aria-label="Toggle Grouping" aria-pressed="false">${PresetDOM.icons.group}</div>
                      <div class="j0n4t-pg-view-btn" id="j0n4t-pg-hide-hidden" tabindex="0" role="button" title="Toggle Hidden Presets" aria-label="Toggle Hidden Presets" aria-pressed="false">${PresetDOM.icons.hidden}</div>
                    </div>
                  </div>
                </div>
                <div class="j0n4t-pg-view-btn active" id="j0n4t-pg-hide-gallery-btn" tabindex="0" role="button" aria-pressed="true" title="Toggle Gallery View" aria-label="Toggle Gallery Visibility">${PresetDOM.icons.eye}</div>
              </div>
            </div>

            <div class="j0n4t-pg-editor collapsed no-image">
              <div class="j0n4t-pg-row">
                <div id="j0n4t-pg-banner" class="j0n4t-pg-editor-banner" title="📝 Select an Item">📝 Select an Item</div>
                <input type="file" id="j0n4t-pg-json-file" accept=".zip,.json,.yaml,.yml" style="display:none;" />
                <button type="button" id="j0n4t-pg-import-btn" class="j0n4t-pg-btn" style="background:#454545;" title="Import Presets (.zip, .yaml, .json)" aria-label="Import Presets">${PresetDOM.icons.import}</button>
                <button type="button" id="j0n4t-pg-export-btn" class="j0n4t-pg-btn" style="background:#454545;" title="Export Presets (.zip, .yaml, .json)" aria-label="Export Presets">${PresetDOM.icons.export}</button>
                <button type="button" id="j0n4t-pg-clear-fields-btn" class="j0n4t-pg-btn" style="background:#555;">New</button>
                <button type="button" id="j0n4t-pg-save-btn" class="j0n4t-pg-btn" style="background:#007acc;">Save</button>
                <button type="button" id="j0n4t-pg-del-btn" class="j0n4t-pg-btn" style="background:#a32a2a;">Delete</button>
              </div>
              <div style="display:flex; gap:6px; align-items:stretch;">
                <div id="j0n4t-pg-editor-preview" class="j0n4t-pg-editor-preview" tabindex="0" role="button" aria-label="Edit Preview Image"></div>
                <div style="display:flex; flex-direction:column; gap:6px; flex-grow:1;">
                    <textarea id="j0n4t-pg-preset" placeholder="Keywords..." spellcheck="false" aria-label="Preset Keywords"></textarea>
                    <div class="j0n4t-pg-row"><input type="text" id="j0n4t-pg-folder" placeholder="Folder" aria-label="Preset Folder" style="flex:1;" /><input type="text" id="j0n4t-pg-name" placeholder="Name" aria-label="Preset Name" style="flex:1;" /></div>
                </div>
              </div>
              <input type="file" id="j0n4t-pg-file" accept="image/*" style="display:none;" />
            </div>

            <div class="j0n4t-pg-grid" role="listbox" aria-label="Preset Gallery List"></div>
  `;
    return {
      wrap,
      grid: wrap.querySelector(".j0n4t-pg-grid"),
      search: wrap.querySelector(".j0n4t-pg-search"),
      searchClear: wrap.querySelector(".j0n4t-pg-search-clear"),
      editor: wrap.querySelector(".j0n4t-pg-editor"),
      banner: wrap.querySelector("#j0n4t-pg-banner"),
      toggle: wrap.querySelector("#j0n4t-pg-toggle"),
      btnMoreOptions: wrap.querySelector("#j0n4t-pg-more-options-btn"),
      popupMenu: wrap.querySelector("#j0n4t-pg-popup-menu"),
      viewsContainer: wrap.querySelector(".j0n4t-pg-views"),
      chkGroup: wrap.querySelector("#j0n4t-pg-group-toggle"),
      btnGlobalCollapse: wrap.querySelector("#j0n4t-pg-global-collapse"),
      btnHideHidden: wrap.querySelector("#j0n4t-pg-hide-hidden"),
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
      btnCopyBasket: wrap.querySelector(".j0n4t-pg-basket-copy-btn"),
      btnClearBasket: wrap.querySelector(".j0n4t-pg-basket-clear-btn"),
      btnRerollBasket: wrap.querySelector(".j0n4t-pg-basket-reroll-btn"),
      chkBasketRaw: wrap.querySelector("#j0n4t-pg-basket-raw-toggle"),
      basketContainer: wrap.querySelector(".j0n4t-pg-basket-container"),
      rawTextarea: wrap.querySelector("#j0n4t-pg-raw-input"),
      rawHighlights: wrap.querySelector("#j0n4t-pg-raw-highlights"),
      btnHideGallery: wrap.querySelector("#j0n4t-pg-hide-gallery-btn"),
    };
  }

  getCollapsedFolders() {
    return JSON.parse(localStorage.getItem("pg_collapsed_folders_list")) || [];
  }

  setCollapsedFolders(list) {
    localStorage.setItem("pg_collapsed_folders_list", JSON.stringify(list));
  }

  getSelectedArray() {
    return this.widget.value
      ? PresetLogic.splitPresets(this.widget.value)
      : [];
  }

  updateWidgetValue(arr) {
    this.widget.value = arr.join(", ");
    this.widget.callback?.(this.widget.value);
    this.syncUI(this.widget.value);
    if (this.node.graph) this.node.graph._version++;
  }

  setPanelCollapseState(col) {
    const isCurrentlyCollapsed = this.dom.editor.classList.contains("collapsed");
    if (isCurrentlyCollapsed === col) return;

    this.dom.editor.classList.toggle("collapsed", col);
    this.dom.toggle.classList.toggle("active", !col);
    this.dom.toggle.title = col ? "Management Panel" : "Hide Panel";
    this.dom.toggle.setAttribute("aria-expanded", String(!col));
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

  openEditorForPreset(styleKey, focus) {
    this.editor.openPreset(styleKey, focus);
  }

  async loadGallery() {
    this.cache = await PresetGalleryAPI.fetchGallery();
    this.grid.compile(this.cache);
  }

  async syncUI(val) {
    const arr = val
      ? PresetLogic.splitPresets(val)
      : [];
    this.grid.syncSelection(arr);
    this.basket.render(arr);
    this.syncEditorHighlight();
    this.dom.btnRerollBasket.title = arr.length === 0 ? "Feeling lucky?" : "Re-roll variants";
  }

  bindEvents() {
    this.dom.wrap.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        const triggerable = e.target.closest(".j0n4t-pg-view-btn, .j0n4t-pg-search-clear, .j0n4t-pg-toggle, .j0n4t-pg-basket-copy-btn, .j0n4t-pg-basket-clear-btn, .j0n4t-pg-basket-reroll-btn");
        if (triggerable) {
          e.preventDefault();
          triggerable.click();
        }
      }
    });

    this.dom.toggle.addEventListener("click", () =>
      this.setPanelCollapseState(
        !this.dom.editor.classList.contains("collapsed")
      )
    );

    // More Options Popup logic
    this.dom.btnMoreOptions.addEventListener("click", (e) => {
      e.stopPropagation();
      this.dom.popupMenu.classList.toggle("show");
    });

    document.addEventListener("click", (e) => {
      if (this.dom.popupMenu.classList.contains("show")) {
        if (!this.dom.btnMoreOptions.contains(e.target) && !this.dom.popupMenu.contains(e.target)) {
          this.dom.popupMenu.classList.remove("show");
        }
      }
    });

    this.dom.search.addEventListener("input", () =>
      this.grid.executeFilterPipeline(this.dom.search.value)
    );
    this.dom.searchClear.addEventListener("click", () => {
      this.dom.search.value = "";
      this.grid.executeFilterPipeline();
      this.dom.search.focus();
    });

    this.dom.btnExport.addEventListener("click", () => {
      ExportUtils.showExportModal((config) => {
        ExportUtils.exportPresets(config);
      });
    });

    this.dom.btnImport.addEventListener("click", () => this.dom.inpJsonFile.click());
    this.dom.inpJsonFile.addEventListener("change", async (e) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const res = await ExportUtils.importFile(file);
      if (res.success) {
        await this.loadGallery();
        await ModalUtils.alert("Presets imported successfully!");
      }
      this.dom.inpJsonFile.value = "";
    });

    this.dom.btnRerollBasket.addEventListener("click", () => {
      const selections = this.getSelectedArray();
      if (selections.length === 0) {
        const cache = this.cache || {};
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
        const availableGroups = Array.from(groupsMap.keys()).filter(key => !key.startsWith("_"));
        if (availableGroups.length === 0) return;
        const newSelections = [];
        const addedSet = new Set();
        const targetTotal = Math.floor(Math.random() * (20 - 10 + 1)) + 10;
        while (newSelections.length < targetTotal) {
          const numGroupsToPick = Math.floor(Math.random() * (7 - 3 + 1)) + 3;
          const shuffledGroups = [...availableGroups].sort(() => 0.5 - Math.random());
          const selectedGroups = shuffledGroups.slice(0, Math.min(numGroupsToPick, shuffledGroups.length));
          let addedInIteration = false;
          for (const group of selectedGroups) {
            const groupPresets = groupsMap.get(group) || [];
            if (groupPresets.length === 0) continue;
            const numChips = Math.floor(Math.random() * 2);
            for (let i = 0; i < numChips; i++) {
              const randomPreset = groupPresets[Math.floor(Math.random() * groupPresets.length)];
              if (!addedSet.has(randomPreset)) {
                addedSet.add(randomPreset);
                newSelections.push(randomPreset);
                addedInIteration = true;
                if (newSelections.length >= targetTotal) break;
              }
            }
            if (newSelections.length >= targetTotal) break;
          }
          const totalPresetsCount = Object.keys(cache).length;
          if (!addedInIteration || addedSet.size >= totalPresetsCount) {
            break;
          }
        }
        newSelections.sort((a, b) => a.localeCompare(b));
        if (cache["_/combo/_default"]) newSelections.unshift("_/combo/_default");
        this.updateWidgetValue(newSelections);
      } else {
        this.rollManager.clearAll();
        this.syncUI(this.widget.value);
      }
    });

    this.dom.btnHideGallery.addEventListener("click", () => {
      const isHidden = this.dom.wrap.classList.toggle("hide-gallery-mode");
      this.dom.btnHideGallery.classList.toggle("active", !isHidden);
      this.dom.btnHideGallery.setAttribute("aria-pressed", String(!isHidden));
      localStorage.setItem("comfy_preset_gallery_hidden", String(isHidden));
    });

    if (localStorage.getItem("comfy_preset_gallery_hidden") === "true") {
      this.dom.wrap.classList.add("hide-gallery-mode");
      this.dom.btnHideGallery.classList.remove("active");
      this.dom.btnHideGallery.setAttribute("aria-pressed", "false");
    }
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
        return PresetLogic.getTopMatches(Object.keys(this.cache), query, (k) =>
          PresetLogic.getSearchBlob(k, this.cache[k]), this.cache
        );
      },
      renderItem: (match) =>
        `<span>${PresetDOM.escapeHTML(PresetLogic.toTitleCase(match.split("/").pop()))}</span><span class="j0n4t-pg-filter-autocomplete-meta">${PresetDOM.escapeHTML(match)}</span>`,
      onSelect: (match) => {
        const sel = this.getSelectedArray();
        if (!sel.includes(match)) this.updateWidgetValue([...sel, match]);
        this.dom.search.value = "";
        this.grid.executeFilterPipeline();
        this.dom.search.focus();
      },
      onKeyDown: (e) => {
        if (!manager.isOpen && e.key === "Enter" && !e.shiftKey) {
          const searchValue = this.dom.search.value.trim();
          if (searchValue) {
            const sel = this.getSelectedArray();
            if (!sel.includes(searchValue)) {
              this.updateWidgetValue([...sel, searchValue]);
            }
            this.dom.search.value = "";
            this.grid.executeFilterPipeline();
            this.dom.search.focus();
          }
          return true;
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

      widget.serializeValue = function () {
        const raw = widget.value || "";
        galleryView.rollManager.resetCounts(); // Clean slate for serialization
        return PresetLogic.expandRecursively(raw, galleryView.cache, new Set(), galleryView.rollManager);
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
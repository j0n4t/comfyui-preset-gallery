import { app } from "../../../scripts/app.js";

import AutocompleteManager from "./AutocompleteManager.js";
import PresetGalleryAPI from "./PresetGalleryAPI.js";
import PresetBasket from "./PresetBasket.js";
import PresetEditor from "./PresetEditor.js";
import PresetGrid from "./PresetGrid.js";
import PresetUtils from "./PresetUtils.js";

const MIN_NODE_HEIGHT = 640;
const MIN_NODE_WIDTH = 400;

class PresetGalleryApp {
  static WRAP_STYLES = /*css*/ `
    .j0n4t-pg-wrap { display: flex; flex-direction: column; gap: 4px; padding: 0; border-radius: 4px; box-sizing: border-box; width: 100%; height: 100%; font-family: sans-serif; position: relative; outline: none; }
    .j0n4t-pg-wrap.hide-gallery-mode .j0n4t-pg-grid, .j0n4t-pg-wrap.hide-gallery-mode .j0n4t-pg-views, .j0n4t-pg-wrap.hide-gallery-mode #j0n4t-pg-global-collapse, .j0n4t-pg-wrap.hide-gallery-mode .j0n4t-pg-checkbox-wrap:has(#j0n4t-pg-group-toggle) { display: none !important; }
  `;

  static ACTION_TOPBAR_SEARCH_STYLES = /*css*/ `
    .j0n4t-pg-action-btn { display: flex; align-items: center; justify-content: center; width: 14px; height: 14px; color: #aaa; border-radius: 2px; cursor: pointer; transition: 0.1s; margin-left: 1px; outline: none; }
    .j0n4t-pg-action-btn:hover, .j0n4t-pg-action-btn:focus-visible { background: #555; color: #fff; }
    .j0n4t-pg-action-btn.del-btn:hover, .j0n4t-pg-action-btn.del-btn:focus-visible { background: #b23b3b; color: #fff; }
    .j0n4t-pg-action-btn svg { width: 10px; height: 10px; fill: currentColor; }
    .j0n4t-pg-top-bar { display: flex; gap: 6px; align-items: center; width: 100%; flex-shrink: 0; }
    .j0n4t-pg-search-wrapper { position: relative; flex-grow: 1; display: flex; align-items: center; }
    .j0n4t-pg-search { width: 100%; padding: 6px 24px 6px 6px; background: #1a1a1ab0; border: 1px solid #444; border-radius: 4px; color: #fff; font-size: 11px; box-sizing: border-box; min-width: 0; outline: none; }
    .j0n4t-pg-search:focus { border-color: #007acc; }
    .j0n4t-pg-search-clear { position: absolute; right: 6px; width: 14px; height: 14px; color: #777; cursor: pointer; display: none; align-items: center; justify-content: center; border-radius: 2px; transition: color 0.1s, background-color 0.1s; outline: none; }
    .j0n4t-pg-search-clear:hover, .j0n4t-pg-search-clear:focus-visible { color: #fff; background: #b23b3b; }
    .j0n4t-pg-search-clear svg { width: 10px; height: 10px; fill: currentColor; }
  `;

  static VIEWS_TOGGLE_GRID_STYLES = /*css*/ `
    .j0n4t-pg-views, .j0n4t-pg-toggle-gallery-wrap { display: flex; gap: 2px; flex-shrink: 0; background: #1a1a1a80; padding: 2px; border-radius: 4px; border: 1px solid #444; }
    .j0n4t-pg-view-btn { display: flex; align-items: center; justify-content: center; width: 22px; height: 22px; border-radius: 3px; cursor: pointer; color: #aaa; background: transparent; transition: 0.15s; outline: none; }
    .j0n4t-pg-view-btn:hover, .j0n4t-pg-view-btn:focus-visible { background: #333; color: #fff; }
    .j0n4t-pg-view-btn.active { background: #007acc; color: #fff; }
    .j0n4t-pg-view-btn svg, .j0n4t-pg-btn svg { width: 14px; height: 14px; fill: currentColor; }
    .j0n4t-pg-grid { display: grid; gap: 6px; flex-grow: 1; overflow-y: auto; min-height: 60px; height: 50%; max-height: 100vh; align-content: start; margin-top: 2px; resize: vertical; outline: none; }
    .j0n4t-pg-grid.view-small { grid-template-columns: repeat(auto-fill, minmax(55px, 1fr)); }
    .j0n4t-pg-grid.view-big { grid-template-columns: repeat(auto-fill, minmax(100px, 1fr)); }
    .j0n4t-pg-grid.view-list { grid-template-columns: repeat(auto-fill, minmax(100px, 1fr)); gap: 4px; }
  `;

  static CONTROL_BAR_TOGGLE_CHECKBOX_STYLES = /*css*/ `
    .j0n4t-pg-grid.hide-folders .j0n4t-pg-tag-badge { display: block !important; }
    .j0n4t-pg-control-bar { display: flex; gap: 6px; align-items: center; margin-top: 2px; flex-shrink: 0; width: 100%; }
    .j0n4t-pg-toggle { flex-grow: 1; background: #333; border: 1px solid #444; color: #bbb; padding: 4px; border-radius: 3px; cursor: pointer; font-size: 10px; text-align: center; user-select: none; white-space: nowrap; outline: none; }
    .j0n4t-pg-toggle:hover, .j0n4t-pg-toggle:focus-visible { background: #444; color: #fff; border-color: #007acc; }
    .j0n4t-pg-checkbox-wrap { display: flex; align-items: center; gap: 4px; font-size: 10px; color: #aaa; user-select: none; cursor: pointer; padding: 3px 2px; height: 20px; box-sizing: border-box; white-space: nowrap; outline: none; }
    .j0n4t-pg-checkbox-wrap input { width: auto; margin: 0; cursor: pointer; outline: none; }
    .j0n4t-pg-checkbox-wrap input:focus-visible { outline: 1px solid #007acc; outline-offset: 2px; }
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
    this.dom = this.buildDOMStructure();

    this.basket = new PresetBasket(
      this.dom.basketContainer,
      this.dom.wrap.querySelector(".j0n4t-pg-basket-pool"),
      this.dom.rawTextarea,
      this
    );
    this.editor = new PresetEditor(this.dom, this);
    this.grid = new PresetGrid(this.dom, this);

    PresetUtils.injectStyles('j0n4t-pg-wrap-styles', PresetGalleryApp.WRAP_STYLES);
    PresetUtils.injectStyles('j0n4t-pg-action-topbar-search-styles', PresetGalleryApp.ACTION_TOPBAR_SEARCH_STYLES);
    PresetUtils.injectStyles('j0n4t-pg-views-toggle-grid-styles', PresetGalleryApp.VIEWS_TOGGLE_GRID_STYLES);
    PresetUtils.injectStyles('j0n4t-pg-control-bar-toggle-checkbox-styles', PresetGalleryApp.CONTROL_BAR_TOGGLE_CHECKBOX_STYLES);
    PresetUtils.injectStyles('j0n4t-pg-modal-styles', PresetGalleryApp.MODAL_STYLES);
    PresetUtils.injectStyles('j0n4t-pg-preset-tree-selector-styles', PresetGalleryApp.PRESET_TREE_SELECTOR_STYLES);

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
                        <label class="j0n4t-pg-checkbox-wrap" style="height:auto; padding:0; margin-right:4px;"><input type="checkbox" id="j0n4t-pg-basket-raw-toggle" />Raw</label>
                        <button type="button" class="j0n4t-pg-basket-clear-btn" title="Clear basket" aria-label="Clear basket" style="font-size:9px; color:#fff; background:#b23b3b; border:none; padding:2px 6px; border-radius:3px; cursor:pointer;">🗑️ Clear</button>
                    </div>
                </div>
                <div class="j0n4t-pg-basket-pool-wrapper">
                  <div class="j0n4t-pg-basket-pool" role="listbox" aria-label="Preset selections pool"></div>
                </div>
                <textarea class="j0n4t-pg-basket-raw-textarea" id="j0n4t-pg-raw-input" placeholder="Tokens..." spellcheck="false" aria-label="Raw text tokens"></textarea>
            </div>
            <div class="j0n4t-pg-top-bar">
                <div class="j0n4t-pg-search-wrapper"><input type="text" enterkeyhint="enter" class="j0n4t-pg-search" placeholder="Search..." aria-label="Search Presets" /><div class="j0n4t-pg-search-clear" tabindex="0" role="button" aria-label="Clear Search">${PresetUtils.icons.close}</div></div>
                <div class="j0n4t-pg-views" role="group" aria-label="View styles">
                    <div class="j0n4t-pg-view-btn" data-view="small" tabindex="0" role="button" aria-pressed="false" aria-label="Small View">${PresetUtils.icons.small}</div><div class="j0n4t-pg-view-btn" data-view="big" tabindex="0" role="button" aria-pressed="false" aria-label="Large View">${PresetUtils.icons.big}</div><div class="j0n4t-pg-view-btn" data-view="list" tabindex="0" role="button" aria-pressed="false" aria-label="List View">${PresetUtils.icons.list}</div>
                </div>
                <div class="j0n4t-pg-toggle-gallery-wrap" title="Toggle Gallery View"><div class="j0n4t-pg-view-btn active" id="j0n4t-pg-hide-gallery-btn" tabindex="0" role="button" aria-pressed="true" aria-label="Toggle Gallery Visibility">${PresetUtils.icons.eye}</div></div>
            </div>
             <div class="j0n4t-pg-control-bar">
                <div class="j0n4t-pg-toggle" id="j0n4t-pg-toggle" tabindex="0" role="button" aria-expanded="false">⚙️ Management Panel</div>
                <button type="button" id="j0n4t-pg-global-collapse" style="background:#2a2a2a80; border:1px solid #444; color:#ccc; padding:4px 8px; border-radius:3px; cursor:pointer; font-size:10px;">↕️ Collapse All</button>
                <label class="j0n4t-pg-checkbox-wrap"><input type="checkbox" id="j0n4t-pg-group-toggle" />Group</label>
            </div>
            <div class="j0n4t-pg-editor collapsed no-image">
                <div class="j0n4t-pg-row">
                    <div id="j0n4t-pg-banner" class="j0n4t-pg-editor-banner">📝 Select an Item</div>
                    <input type="file" id="j0n4t-pg-json-file" accept=".zip,.json,.yaml,.yml" style="display:none;" />
                    <button type="button" id="j0n4t-pg-import-btn" class="j0n4t-pg-btn" style="background:#454545;" title="Import Presets (.zip, .yaml, .json)" aria-label="Import Presets">${PresetUtils.icons.import}</button>
                    <button type="button" id="j0n4t-pg-export-btn" class="j0n4t-pg-btn" style="background:#454545;" title="Export Presets (.zip, .yaml, .json)" aria-label="Export Presets">${PresetUtils.icons.export}</button>
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
      btnClearBasket: wrap.querySelector(".j0n4t-pg-basket-clear-btn"),
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
    this.dom.wrap.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        const triggerable = e.target.closest(".j0n4t-pg-view-btn, .j0n4t-pg-search-clear, .j0n4t-pg-toggle, .j0n4t-pg-basket-clear-btn");
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
        PresetGalleryAPI.exportPresets(format, mode);
      });
    });

    this.dom.btnImport.addEventListener("click", () => this.dom.inpJsonFile.click());
    this.dom.inpJsonFile.addEventListener("change", async (e) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const res = await PresetGalleryAPI.importFile(file);
      if (res.success) {
        await this.loadGallery();
        await PresetUtils.alert("Presets imported successfully!");
      }
      this.dom.inpJsonFile.value = "";
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
          PresetUtils.getSearchBlob(k, this.cache[k]), this.cache
        );
      },
      renderItem: (match) =>
        `<span>${PresetUtils.escapeHTML(PresetUtils.toTitleCase(match.split("/").pop()))}</span><span class="j0n4t-pg-filter-autocomplete-meta">${PresetUtils.escapeHTML(match)}</span>`,
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
        return PresetUtils.expandRecursively(raw, galleryView.cache);
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
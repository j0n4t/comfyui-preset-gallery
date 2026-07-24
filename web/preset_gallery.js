import { app } from "../../../scripts/app.js";

import AutocompleteManager from "./AutocompleteManager.js";
import PresetGalleryStyles from "./PresetGalleryStyles.js";
import PresetGalleryAPI from "./PresetGalleryAPI.js";
import PresetBasket from "./PresetBasket.js";
import PresetEditor from "./PresetEditor.js";
import PresetGrid from "./PresetGrid.js";
import PresetUtils from "./PresetUtils.js";

const MIN_NODE_HEIGHT = 640;
const MIN_NODE_WIDTH = 400;

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
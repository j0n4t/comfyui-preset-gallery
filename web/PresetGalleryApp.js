import AutocompleteManager from "./AutocompleteManager.js";
import ModalUtils from "./ModalUtils.js";
import PresetGalleryAPI from "./PresetGalleryAPI.js";
import PresetBasket from "./PresetBasket.js";
import PresetEditor from "./PresetEditor.js";
import PresetGrid from "./PresetGrid.js";
import PresetLogic from "./PresetLogic.js";
import ExportUtils from "./ExportUtils.js";
import PresetDOM from "./PresetDOM.js";
import PresetGallerySettings from "./PresetGallerySettings.js";
import PresetSession from "./PresetSession.js";
import createGalleryContext from "./PresetGalleryContext.js";

// The node's own floor. Below this the gallery cannot show its basket, control
// bar, editor and a row of grid at once: those come to 303px of wrap content
// (80 + 28 + 123, three 4px gaps, plus the grid's 60px minimum) and the node
// adds 92px of chrome around it.
export const MIN_NODE_HEIGHT = 400;
export const MIN_NODE_WIDTH = 400;

export default class PresetGalleryApp {
  static instancesByNode = new WeakMap();
  static instancesByWrap = new WeakMap();

  static WRAP_STYLES = /*css*/ `
    .j0n4t-pg-wrap { display: flex; flex: auto; flex-direction: column; gap: 4px; padding: 0; border-radius: 4px; box-sizing: border-box; width: 100%; min-height: 100%; font-family: sans-serif; position: relative; outline: none; overflow: hidden; }
    .j0n4t-pg-wrap.hide-gallery-mode .j0n4t-pg-grid, .j0n4t-pg-wrap.hide-gallery-mode .j0n4t-pg-more-options-wrap { display: none; }
    .j0n4t-pg-basket-container { display: flex; flex-direction: column; min-height: 80px;  resize: vertical; background: #15151580; border: 1px dashed #777; border-radius: 4px; box-sizing: border-box; width: 100%; flex-shrink: 0; transition: border-color 0.2s, background-color 0.2s; position: relative;  overflow-y: auto; overflow-x: hidden; container: pg-basket / size; }
    .j0n4t-pg-basket-pool-wrapper { flex: 1 1 auto; overflow-y: auto; position: relative; margin: 4px; display: block; box-sizing: border-box; }
    .j0n4t-pg-basket-raw-textarea { flex: 1 1 auto; resize: none; }
    .j0n4t-pg-wrap.hide-gallery-mode .j0n4t-pg-basket-container { flex: 1 1 100%; resize: none; }
  `;

  /**
   * Height modes, keyed off `data-height-mode` on the wrap. Each mode is a
   * *ceiling* on the gallery viewport, so the grid scrolls inside the gallery
   * instead of growing its host to the full height of the preset library.
   * `fit` is the default and needs one rule per host:
   *
   *   - graph mode: ComfyUI maps node.size[1] onto `--node-height` and applies
   *     it as a *min*-height on `.lg-node`, while the Vue node renderer sizes
   *     the node from the DOM. Capping the wrap by `--node-height` therefore
   *     makes the node render at exactly the size the user dragged it to.
   *     92px is the node chrome the wrap sits inside - header (30) + body
   *     padding (16) + the DOM widget's default 10px margin on both sides
   *     (20) + the widget grid's row gap - all in CSS px, so canvas zoom does
   *     not affect it. Where `--node-height` is absent (legacy canvas
   *     rendering, app mode) the declaration is invalid and `max-height` stays
   *     `none`, which is what legacy rendering wants anyway: there ComfyUI
   *     sizes the widget element from the node itself.
   *   - app mode: there is no node. The promoted widget renders inside
   *     `[data-testid="app-mode-widget-item"]`, below a label row and an
   *     optional description row, inside the `[data-testid="linear-widgets"]`
   *     scroll panel. Capping the wrap at the panel height alone still leaves
   *     the panel scrolling by that chrome (measured: 46px, so the item is
   *     497px in a 457px panel), so the item is turned into a definite-height
   *     flex column and the widget chain is made definite to fill what is left.
   *
   * Each `fit` rule sets `min-height` alongside `max-height` because in CSS a
   * min-height that resolves larger than the max-height *wins*, and the wrap's
   * inherited `min-height: 100%` otherwise latches onto the host height and
   * defeats the ceiling. `min(100%, <ceiling>)` keeps the gallery filling its
   * host when the library is small without ever exceeding the ceiling.
   */
  static HEIGHT_STYLES = /*css*/ `
    .j0n4t-pg-wrap[data-height-mode="fit"] { min-height: min(100%, max(120px, calc(var(--node-height) - 92px))); max-height: max(120px, calc(var(--node-height) - 92px)); }
    [data-testid="app-mode-widget-item"]:has(.j0n4t-pg-wrap[data-height-mode="fit"]) { display: flex; flex-direction: column; height: 100%; min-height: 0; }
    [data-testid="app-mode-widget-item"]:has(.j0n4t-pg-wrap[data-height-mode="fit"]) > div:last-child { flex: 1 1 auto; min-height: 0; }
    [data-testid="app-mode-widget-item"]:has(.j0n4t-pg-wrap[data-height-mode="fit"]) *:has(.j0n4t-pg-wrap[data-height-mode="fit"]) { height: 100%; min-height: 0; }
    [data-testid="app-mode-widget-item"] .j0n4t-pg-wrap[data-height-mode="fit"] { min-height: 100%; max-height: 100%; }
    .j0n4t-pg-wrap[data-height-mode="fixed"] { height: var(--pg-fixed-height, 640px); min-height: 120px; resize: vertical; }
  `;

  static ACTION_TOPBAR_SEARCH_STYLES = /*css*/ `
    .j0n4t-pg-action-btn { display: flex; align-items: center; justify-content: center; width: 14px; height: 14px; color: #aaa; border-radius: 2px; cursor: pointer; transition: 0.1s; margin-left: 1px; outline: none; }
    .j0n4t-pg-action-btn:hover, .j0n4t-pg-action-btn:focus { background: #555; color: #fff; }
    .j0n4t-pg-action-btn.del-btn:hover, .j0n4t-pg-action-btn.del-btn:focus { background: #b23b3b; color: #fff; }
    .j0n4t-pg-action-btn svg { width: 10px; height: 10px; fill: currentColor; }
    .j0n4t-pg-search-wrapper { position: relative; flex-grow: 1; display: flex; align-items: center; }
    .j0n4t-pg-search { width: 100%; padding: 6px 24px 6px 6px; background: #1a1a1ab0; border: 1px solid #444; border-radius: 4px; color: #fff; font-size: 11px; box-sizing: border-box; min-width: 0; outline: none; }
    .j0n4t-pg-search:focus { border-color: #007acc; }
    .j0n4t-pg-search-clear { position: absolute; right: 6px; width: 14px; height: 14px; color: #777; cursor: pointer; display: none; align-items: center; justify-content: center; border-radius: 2px; transition: color 0.1s, background-color 0.1s; outline: none; }
    .j0n4t-pg-search-clear:hover, .j0n4t-pg-search-clear:focus { color: #fff; background: #b23b3b; }
    .j0n4t-pg-search-clear svg { width: 10px; height: 10px; fill: currentColor; }
  `;

  static GALLERY_STYLES = /*css*/ `
    .j0n4t-pg-control-bar { display: flex; gap: 4px; align-items: center; margin-top: 2px; flex-shrink: 0; width: 100%; }
    .j0n4t-pg-controls { display: flex; gap: 2px; flex-shrink: 0; background: #1a1a1a80; padding: 2px; border-radius: 4px; border: 1px solid #444; }
    .j0n4t-pg-view-btn { display: flex; align-items: center; justify-content: center; width: 22px; height: 22px; border-radius: 3px; cursor: pointer; color: #aaa; background: transparent; transition: 0.15s; outline: none; }
    .j0n4t-pg-view-btn:hover, .j0n4t-pg-view-btn:focus { background: #333; color: #fff; }
    .j0n4t-pg-view-btn.active { background: #007acc; color: #fff; }
    .j0n4t-pg-view-btn svg, .j0n4t-pg-btn svg { width: 14px; height: 14px; fill: currentColor; }
    .j0n4t-pg-view-btn svg.rotatable { transition: transform 0.2s ease; }
    .j0n4t-pg-view-btn.collapsed-state svg.rotatable { transform: rotate(180deg); }
    .j0n4t-pg-grid { display: grid; gap: 6px; flex: 1 1 auto; overflow-y: auto; min-height: 60px; align-content: start; margin-top: 2px; outline: none; }
    .j0n4t-pg-grid.view-small { grid-template-columns: repeat(auto-fill, minmax(55px, 1fr)); }
    .j0n4t-pg-grid.view-big { grid-template-columns: repeat(auto-fill, minmax(100px, 1fr)); }
    .j0n4t-pg-grid.view-list { grid-template-columns: repeat(auto-fill, minmax(100px, 1fr)); gap: 4px; }
    .j0n4t-pg-grid.hide-folders .j0n4t-pg-tag-badge { display: block !important; }
    .j0n4t-pg-checkbox-wrap { display: flex; align-items: center; gap: 4px; font-size: 12px; color: #aaa; user-select: none; cursor: pointer; padding: 3px 2px; height: 20px; box-sizing: border-box; white-space: nowrap; outline: none; }
    .j0n4t-pg-checkbox-wrap input { width: auto; margin: 0; cursor: pointer; outline: none; }
    .j0n4t-pg-checkbox-wrap input:focus { outline: 1px solid #007acc; outline-offset: 2px; }
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

  /**
   * @param {any} node
   * @param {any} widget
   */
  constructor(node, widget) {
    this.node = node;
    this.widget = widget;
    this.session = new PresetSession({ nodeId: node?.id || "global" });
    this.dom = this.buildDOMStructure();
    this.context = createGalleryContext({
      session: this.session,
      dom: this.dom,
      widget,
      view: this,
    });
    PresetGalleryApp.instancesByNode.set(this.node, this);
    PresetGalleryApp.instancesByWrap.set(this.dom.wrap, this);

    this.settings = new PresetGallerySettings(this.context);
    this.basket = new PresetBasket(
      this.dom.basketContainer,
      this.dom.basketPool,
      this.dom.rawTextarea,
      this.context
    );
    this.editor = new PresetEditor(this.context);
    this.grid = new PresetGrid(this.context);
    // The three siblings reference each other, so they can only be attached
    // to the context once all of them exist.
    this.context.editor = this.editor;
    this.context.grid = this.grid;

    PresetDOM.injectStyles('j0n4t-pg-wrap-styles', PresetGalleryApp.WRAP_STYLES);
    PresetDOM.injectStyles('j0n4t-pg-height-styles', PresetGalleryApp.HEIGHT_STYLES);
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
          <div class="j0n4t-pg-basket-title" aria-label="Presets Basket">🧺 Basket</div>
          <div style="display: flex; gap: 4px; align-items: center;">
                  <button type="button" class="j0n4t-pg-basket-action-btn j0n4t-pg-basket-multiselect-btn" title="Enable multi-selection mode" aria-label="Multi-selection mode" aria-pressed="false">${PresetDOM.icons.select} <span>Select</span></button>
                  <button type="button" class="j0n4t-pg-basket-action-btn j0n4t-pg-basket-copy-btn" title="Copy selected chips" aria-label="Copy selected chips" disabled>${PresetDOM.icons.copy} <span>Copy</span></button>
                  <button type="button" class="j0n4t-pg-basket-action-btn j0n4t-pg-basket-paste-btn" title="Paste chips from clipboard" aria-label="Paste chips">${PresetDOM.icons.paste} <span>Paste</span></button>
                  <button type="button" class="j0n4t-pg-basket-action-btn j0n4t-pg-basket-pin-btn" title="Pin selected chips" aria-label="Pin selected chips" disabled>${PresetDOM.icons.pin} <span>Pin</span></button>
                  <button type="button" class="j0n4t-pg-basket-action-btn danger j0n4t-pg-basket-delete-btn" title="Delete selected chips" aria-label="Delete selected chips" disabled>${PresetDOM.icons.trash} <span>Delete</span></button>
                  <button type="button" class="j0n4t-pg-basket-reroll-btn" title="Feeling lucky?" aria-label="Feeling lucky?">${PresetDOM.icons.dice}</button>
                  <label class="j0n4t-pg-checkbox-wrap" style="height:auto; padding:0; margin-right:4px;"><input type="checkbox" id="j0n4t-pg-basket-raw-toggle" />Raw</label>
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
                <div class="j0n4t-pg-view-btn" id="j0n4t-pg-config-btn" tabindex="0" role="button" aria-expanded="false" title="Settings">${PresetDOM.icons.config}</div>  
              </div>
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
      grid: /** @type {HTMLDivElement} */ (wrap.querySelector(".j0n4t-pg-grid")),
      search: /** @type {HTMLInputElement} */ (wrap.querySelector(".j0n4t-pg-search")),
      searchClear: /** @type {HTMLDivElement} */ (wrap.querySelector(".j0n4t-pg-search-clear")),
      editor: /** @type {HTMLDivElement} */ (wrap.querySelector(".j0n4t-pg-editor")),
      banner: /** @type {HTMLDivElement} */ (wrap.querySelector("#j0n4t-pg-banner")),
      toggle: /** @type {HTMLDivElement} */ (wrap.querySelector("#j0n4t-pg-toggle")),
      btnConfig: /** @type {HTMLDivElement} */ (wrap.querySelector("#j0n4t-pg-config-btn")),
      btnMoreOptions: /** @type {HTMLDivElement} */ (wrap.querySelector("#j0n4t-pg-more-options-btn")),
      popupMenu: /** @type {HTMLDivElement} */ (wrap.querySelector("#j0n4t-pg-popup-menu")),
      viewsContainer: /** @type {HTMLDivElement} */ (wrap.querySelector(".j0n4t-pg-views")),
      chkGroup: /** @type {HTMLDivElement} */ (wrap.querySelector("#j0n4t-pg-group-toggle")),
      btnGlobalCollapse: /** @type {HTMLDivElement} */ (wrap.querySelector("#j0n4t-pg-global-collapse")),
      btnHideHidden: /** @type {HTMLDivElement} */ (wrap.querySelector("#j0n4t-pg-hide-hidden")),
      editorPreview: /** @type {HTMLDivElement} */ (wrap.querySelector("#j0n4t-pg-editor-preview")),
      inpName: /** @type {HTMLInputElement} */ (wrap.querySelector("#j0n4t-pg-name")),
      inpFolder: /** @type {HTMLInputElement} */ (wrap.querySelector("#j0n4t-pg-folder")),
      inpPreset: /** @type {HTMLInputElement} */ (wrap.querySelector("#j0n4t-pg-preset")),
      inpFile: /** @type {HTMLInputElement} */ (wrap.querySelector("#j0n4t-pg-file")),
      btnClearFields: /** @type {HTMLButtonElement} */ (wrap.querySelector("#j0n4t-pg-clear-fields-btn")),
      btnSave: /** @type {HTMLButtonElement} */ (wrap.querySelector("#j0n4t-pg-save-btn")),
      btnDel: /** @type {HTMLButtonElement} */ (wrap.querySelector("#j0n4t-pg-del-btn")),
      inpJsonFile: /** @type {HTMLInputElement} */ (wrap.querySelector("#j0n4t-pg-json-file")),
      btnImport: /** @type {HTMLButtonElement} */ (wrap.querySelector("#j0n4t-pg-import-btn")),
      btnExport: /** @type {HTMLButtonElement} */ (wrap.querySelector("#j0n4t-pg-export-btn")),
      btnCopyBasket: /** @type {HTMLButtonElement} */ (wrap.querySelector(".j0n4t-pg-basket-copy-btn")),
      btnBasketMultiSelect: /** @type {HTMLButtonElement} */ (wrap.querySelector(".j0n4t-pg-basket-multiselect-btn")),
      btnBasketPaste: /** @type {HTMLButtonElement} */ (wrap.querySelector(".j0n4t-pg-basket-paste-btn")),
      btnBasketPin: /** @type {HTMLButtonElement} */ (wrap.querySelector(".j0n4t-pg-basket-pin-btn")),
      btnBasketDelete: /** @type {HTMLButtonElement} */ (wrap.querySelector(".j0n4t-pg-basket-delete-btn")),
      btnRerollBasket: /** @type {HTMLButtonElement} */ (wrap.querySelector(".j0n4t-pg-basket-reroll-btn")),
      chkBasketRaw: /** @type {HTMLInputElement} */ (wrap.querySelector("#j0n4t-pg-basket-raw-toggle")),
      basketContainer: /** @type {HTMLDivElement} */ (wrap.querySelector(".j0n4t-pg-basket-container")),
      basketHeader: /** @type {HTMLDivElement} */ (wrap.querySelector(".j0n4t-pg-basket-header")),
      basketTitle: /** @type {HTMLDivElement} */ (wrap.querySelector(".j0n4t-pg-basket-title")),
      basketPool: /** @type {HTMLDivElement} */ (wrap.querySelector(".j0n4t-pg-basket-pool")),
      rawTextarea: /** @type {HTMLTextAreaElement} */ (wrap.querySelector("#j0n4t-pg-raw-input")),
      btnHideGallery: /** @type {HTMLDivElement} */ (wrap.querySelector("#j0n4t-pg-hide-gallery-btn")),
    };
  }

  /** @param {string[]} arr  */
  updateWidgetValue(arr) {
    this.widget.value = arr.join(", ");
    this.session.prunePins(arr);
    this.widget.callback?.(this.widget.value);
    this.syncUI(this.widget.value);
    if (this.node.graph) this.node.graph._version++;
  }

  /** @param {boolean} col  */
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
          /** @type {HTMLElement} */ (el).dataset.style === this.editor.editingKey
        )
      );
  }

  /**
   * @param {string} styleKey
   * @param {boolean} [focus]
   */
  openEditorForPreset(styleKey, focus) {
    this.editor.openPreset(styleKey, focus);
  }

  async loadGallery() {
    this.session.cache = await PresetGalleryAPI.fetchGallery();
    this.grid.compile(this.session.cache);
  }

  /**
   * @param {string} val
   */
  async syncUI(val) {
    const arr = val
      ? PresetLogic.splitPresets(val)
      : [];
    this.grid.syncSelection(arr);
    this.basket.render(arr);
    this.syncEditorHighlight();

    const diceTitle = this.settings?.diceBehavior === "overwrite" ? "Overwrite with new presets" : "Re-roll variants";
    this.dom.btnRerollBasket.title = arr.length === 0 ? "Feeling lucky?" : diceTitle;
  }

  /** @param {boolean} overwriteMode */
  triggerRoll(overwriteMode) {
    this.session.rollManager.clearAll();
    if (!overwriteMode) {
      this.syncUI(this.widget.value);
      return;
    }

    const selection = this.session.buildRollSelection({
      cache: this.session.cache,
      excludedFolders: this.session.getExcludedRollFolders(),
      min: this.settings?.rollMin ?? 10,
      max: this.settings?.rollMax ?? 20,
      selected: this.session.getSelectedArray(this.widget.value),
    });
    if (!selection) return;

    this.updateWidgetValue(selection);
  }

  checkSeedChange() {
    if (!this.settings || !this.settings.rollOnSeedChange) return false;
    if (!this.node.graph) return false;
    return this.session.detectSeedChange(this.node.graph._nodes);
  }

  bindEvents() {
    this.dom.wrap.addEventListener("keydown", (e) => {
      const target = /** @type {HTMLElement} */ (e.target);
      const isInput = ["INPUT", "TEXTAREA"].includes(target.tagName);

      if (e.key === "Enter" && !e.ctrlKey || e.key === " ") {
        const triggerable = target.closest(".j0n4t-pg-view-btn, .j0n4t-pg-search-clear, .j0n4t-pg-toggle, .j0n4t-pg-basket-action-btn, .j0n4t-pg-basket-reroll-btn");
        if (triggerable) {
          e.preventDefault();
          /** @type {HTMLElement} */ (triggerable).click();
          return;
        }
      }
      if (e.key === "Escape") {
        if (isInput) target.blur();
        if (this.dom.search.value) this.dom.searchClear.click();
        return;
      }
      if ((e.ctrlKey && e.key === "f") || (!isInput && e.key === "/")) {
        e.preventDefault();
        this.dom.search.focus();
      }
      else if (e.ctrlKey && e.key.toLowerCase() === "e") {
        e.preventDefault();
        this.dom.toggle.click();
      }
      else if (e.ctrlKey && e.key.toLowerCase() === "h") {
        e.preventDefault();
        this.dom.btnHideGallery.click();
      }
      else if (e.ctrlKey && e.key.toLowerCase() === "d") {
        e.preventDefault();
        const mainBehavior = this.settings?.diceBehavior === "overwrite";
        this.triggerRoll(e.shiftKey ? !mainBehavior : mainBehavior);
      }
    });

    this.dom.toggle.addEventListener("click", () =>
      this.setPanelCollapseState(
        !this.dom.editor.classList.contains("collapsed")
      )
    );

    this.dom.btnConfig.addEventListener("click", () => {
      this.settings.openModal();
    });

    // More Options Popup logic
    this.dom.btnMoreOptions.addEventListener("click", (e) => {
      e.stopPropagation();
      this.dom.popupMenu.classList.toggle("show");
    });

    document.addEventListener("click", (e) => {
      if (this.dom.popupMenu.classList.contains("show")) {
        if (!this.dom.btnMoreOptions.contains(/** @type {HTMLElement} */(e.target)) && !this.dom.popupMenu.contains(/** @type {HTMLElement} */(e.target))) {
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
      const file = /** @type {HTMLInputElement} */ (e.target).files?.[0];
      if (!file) return;
      const res = await ExportUtils.importFile(file);
      if (res.success) {
        await this.loadGallery();
        await ModalUtils.alert("Presets imported successfully!");
      }
      this.dom.inpJsonFile.value = "";
    });

    this.dom.btnRerollBasket.addEventListener("click", (e) => {
      if (e.ctrlKey || e.metaKey) {
        if (!this.settings.rollOnGeneration && !this.settings.rollOnSeedChange) {
          this.settings.rollOnGeneration = true;
          this.settings.rollOnSeedChange = false;
        } else if (this.settings.rollOnGeneration && !this.settings.rollOnSeedChange) {
          this.settings.rollOnGeneration = false;
          this.settings.rollOnSeedChange = true;
        } else if (!this.settings.rollOnGeneration && this.settings.rollOnSeedChange) {
          this.settings.rollOnGeneration = true;
          this.settings.rollOnSeedChange = true;
        } else {
          this.settings.rollOnGeneration = false;
          this.settings.rollOnSeedChange = false;
        }
        this.settings.save();
        this.settings.updateDiceVisuals();
        return;
      }
      const isOverwrite = this.settings?.diceBehavior === "overwrite";
      const overwriteMode = e.shiftKey ? !isOverwrite : isOverwrite;
      this.triggerRoll(overwriteMode);
    });
    this.dom.basketHeader.addEventListener("mousemove", (e) => {
      this.dom.basketHeader.classList.toggle("shift-held", e.shiftKey);
    });
    this.dom.basketHeader.addEventListener("mouseleave", () => {
      this.dom.basketHeader.classList.remove("shift-held");
    });
    this.dom.basketHeader.addEventListener("keydown", (e) => {
      if (e.key === "Shift") this.dom.basketHeader.classList.add("shift-held");
    });
    this.dom.basketHeader.addEventListener("keyup", (e) => {
      if (e.key === "Shift") this.dom.basketHeader.classList.remove("shift-held");
    });

    this.dom.basketTitle.addEventListener("click", () => {
      this.basket.renameActiveTab();
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

    this.bindResizeTracking();
  }

  /**
   * Records the manual resizes the gallery allows: its own height in fixed
   * mode, plus the basket and editor panels when the user asked for those to be
   * remembered.
   *
   * A `resize` handle fires no event, so the size is sampled across a
   * pointerdown/pointerup pair. The pointerup is tracked on the window, because
   * the pointer leaves the element as soon as the user drags past its edge. The
   * first handler to run wins: these elements nest, so the innermost one - the
   * basket or the editor box - claims the gesture and the wrap does not.
   */
  bindResizeTracking() {
    const targets = [this.dom.wrap, this.dom.basketContainer, this.dom.inpPreset];
    /** @type {HTMLElement | null} */
    let dragged = null;
    let startHeight = 0;

    for (const el of targets) {
      el.addEventListener("pointerdown", () => {
        if (dragged) return;
        dragged = el;
        startHeight = el.offsetHeight;
      });
    }

    window.addEventListener("pointerup", () => {
      const el = dragged;
      dragged = null;
      if (!el || el.offsetHeight === startHeight) return;
      this.recordResize(el);
    });
  }

  /** @param {HTMLElement} el */
  recordResize(el) {
    const height = el.offsetHeight;
    if (el === this.dom.wrap) {
      // Only fixed mode sizes the wrap itself; the other modes are sized by the
      // node or the app panel, so a height dragged here is not a preference.
      if (this.settings?.heightMode !== "fixed") return;
      // The browser wrote an inline height for the drag. Drop it and store the
      // value instead, so the mode's own rules stay in charge of the element.
      el.style.height = "";
      this.settings.heightFixed = height;
      this.settings.save();
      this.settings.applyHeightMode();
      return;
    }
    if (!this.settings?.rememberPanelSizes) return;
    const key = el === this.dom.basketContainer ? "basket" : "editor";
    this.settings.panelSizes = { ...this.settings.panelSizes, [key]: height };
    this.settings.save();
  }

  focusSearch() {
    this.dom.search.focus();
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
        return PresetLogic.getTopMatches(Object.keys(this.session.cache), query, (k) =>
          PresetLogic.getSearchBlob(k, this.session.cache[k]), this.session.cache
        );
      },
      renderItem: (match) =>
        `<span>${PresetDOM.escapeHTML(PresetLogic.toTitleCase(match.split("/").pop()))}</span><span class="j0n4t-pg-filter-autocomplete-meta">${PresetDOM.escapeHTML(match)}</span>`,
      onSelect: (match) => {
        const sel = this.session.getSelectedArray(this.widget.value);
        if (!sel.includes(match)) this.updateWidgetValue([...sel, match]);
        this.dom.search.value = "";
        this.grid.executeFilterPipeline();
        this.dom.search.focus();
      },
      onKeyDown: (e) => {
        if (!manager.isOpen && e.key === "Enter" && !e.ctrlKey && !e.shiftKey) {
          const searchValue = this.dom.search.value.trim();
          if (searchValue) {
            const sel = this.session.getSelectedArray(this.widget.value);
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
      localStorage.getItem("comfy_preset_gallery_collapsed") === "true"
    );
    this.node.setSize([
      this.node.size[0] || MIN_NODE_WIDTH,
      this.node.size[1] || MIN_NODE_HEIGHT,
    ]);
  }
}
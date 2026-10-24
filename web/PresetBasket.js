import BasketDragDrop from "./BasketDragDrop.js";
import BasketSelectionController from "./BasketSelectionController.js";
import ChipMenuManager from "./ChipMenuManager.js";
import InlineEditorManager from "./InlineEditorManager.js";
import PresetBasketTabs from "./PresetBasketTabs.js";
import PresetDOM from "./PresetDOM.js";
import PresetLogic from "./PresetLogic.js";
import RawTextareaManager from "./RawTextareaManager.js";
import RollManager from "./RollManager.js";
import YAMLUtils from "./YAMLUtils.js";


export default class PresetBasket {
  static BASKET_CONTAINER_STYLES = /*css*/ `
    .j0n4t-pg-basket-pool.drag-over { border-color: #007acc; background: #1a242db0; }
    .j0n4t-pg-basket-header { display: flex; justify-content: space-between; align-items: center; background: #222;  position: sticky; top: 0; padding: 4px; z-index: 1; }
    .j0n4t-pg-basket-title { font-size: 11px; color: #aaa; text-transform: uppercase; letter-spacing: 0.5px; font-weight: bold; cursor: pointer; }
    .j0n4t-pg-basket-action-btn { background: #333; border: 1px solid #555; border-radius: 3px; color: #bbb; cursor: pointer; font-size: 12px; padding: 1px 3px; white-space: nowrap; display: flex; align-items: center; gap: 2px; }
    .j0n4t-pg-basket-action-btn:hover, .j0n4t-pg-basket-action-btn:focus, .j0n4t-pg-basket-action-btn.active { background: #007acc; border-color: #007acc; color: #fff; outline: none; }
    .j0n4t-pg-basket-action-btn.danger:hover, .j0n4t-pg-basket-action-btn.danger:focus { background: #912e2e; border-color: #912e2e; }
    .j0n4t-pg-basket-action-btn:disabled { color: #666; background: #222; border-color: #333; cursor: default; }
    .j0n4t-pg-var-reroll-btn { display: flex; align-items: center; justify-content: center; background: transparent; border: none; color: #aaa; cursor: pointer; font-size: 13px; padding: 0 4px; outline: none; transition: 0.15s; }
    .j0n4t-pg-var-reroll-btn:hover, .j0n4t-pg-var-reroll-btn:focus { color: #fff; transform: scale(1.1); }
    .j0n4t-pg-checkbox-wrap {height: auto; padding: 0; margin-right: 4px;}
    .j0n4t-pg-basket-reroll-btn:hover, .j0n4t-pg-basket-reroll-btn:focus { transform: scale(1.1); }
    .j0n4t-pg-basket-reroll-btn { display: flex; font-size: 14px; background: transparent; border: none; cursor: pointer; padding: 0; outline: none; transition: transform 0.2s ease; }
    .j0n4t-pg-basket-header.shift-held .j0n4t-pg-basket-reroll-btn { filter: invert(1); transform: rotate(180deg); }
    .j0n4t-pg-basket-pool { display: flex; flex-wrap: wrap; gap: 4px; min-height: 24px; height: 100%; align-items: center; align-content: flex-start; padding: 4px; }
    .j0n4t-pg-basket-container .j0n4t-pg-raw-wrapper { display: none; width: auto; }
    .j0n4t-pg-basket-container.raw-mode .j0n4t-pg-raw-wrapper { display: block; margin: 4px; }
    .j0n4t-pg-basket-container.raw-mode .j0n4t-pg-basket-pool-wrapper { display: none; }

    .j0n4t-pg-basket-tabs-sidebar { display: flex; flex-direction: column; background: #1a1a1a; border-right: 1px solid #333; width: 27px; align-items: center; padding: 4px 0; gap: 4px; user-select: none; }
    .j0n4t-pg-basket-tabs-list { display: flex; flex-direction: column; gap: 4px; width: 100%; align-items: center; overflow-y: auto; flex: 1; max-height: calc(100% - 30px); }
    .j0n4t-pg-basket-tab-item { width: 20px; height: 20px; display: flex; align-items: center; justify-content: center; background: #2a2a2a; border: 1px solid #444; border-radius: 4px; color: #aaa; font-size: 10px; font-weight: bold; cursor: pointer; position: relative; transition: 0.15s; outline: none; }
    .j0n4t-pg-basket-tab-item:hover, .j0n4t-pg-basket-tab-item:focus { background: #3a3a3a; color: #fff; border-color: #007acc; }
    .j0n4t-pg-basket-tab-item.active { background: #007acc; color: #fff; border-color: #007acc; }
    .j0n4t-pg-basket-tab-add-btn { width: 20px; height: 20px; display: flex; align-items: center; justify-content: center; background: transparent; border: 1px dashed #666; border-radius: 4px; color: #aaa; font-size: 14px; cursor: pointer; transition: 0.15s; outline: none; }
    .j0n4t-pg-basket-tab-add-btn:hover, .j0n4t-pg-basket-tab-add-btn:focus { background: #2a2a2a; border-color: #007acc; color: #fff; }
    .j0n4t-pg-basket-tab-menu { position: fixed; z-index: 10000; display: flex; flex-direction: column; min-width: 100px; padding: 3px; background: #1f1f1f; border: 1px solid #444; border-radius: 4px; box-shadow: 0 4px 12px rgba(0,0,0,0.8); }
    .j0n4t-pg-basket-tab-menu button { padding: 5px 8px; background: transparent; border: 0; border-radius: 2px; color: #ccc; text-align: left; font-size: 11px; cursor: pointer; }
    .j0n4t-pg-basket-tab-menu button:hover, .j0n4t-pg-basket-tab-menu button:focus { background: #444; color: #fff; outline: none; }
    .j0n4t-pg-basket-tab-menu button:disabled { color: #666; cursor: default; }
    .j0n4t-pg-basket-tabs-sidebar.drag-over .j0n4t-pg-basket-tabs-list,
    .j0n4t-pg-basket-tabs-sidebar.drag-over .j0n4t-pg-basket-tab-add-btn { border-color: #007acc; background: #1a242db0; }
    .j0n4t-pg-basket-tab-item.drop-target { border-color: #007acc; background: #007acc40; box-shadow: 0 0 6px #007acc; }
  `;

  static BASKET_CHIP_ETC_STYLES = /*css*/ `
    .j0n4t-pg-basket-empty { font-size: 10px; color: #555; font-style: italic; cursor: pointer; }
    .j0n4t-pg-basket-drop-indicator { width: 2px; background-color: #007acc; box-shadow: 0 0 4px #007acc; border-radius: 1px; transition: transform 0.05s ease; cursor: pointer; }
    .j0n4t-pg-basket-chip { display: flex; align-items: center; background-size: cover; background-position: center; border: 2px solid #5d5d5da0; border-radius: 3px; padding: 2px 4px; box-sizing: border-box; cursor: grab; user-select: none; transition: background 0.15s, border-color 0.15s; position: relative; overflow: hidden; min-height: 1.4em; outline: none; }
    .j0n4t-pg-basket-chip::before { content: ""; position: absolute; inset: 0; background: rgba(0, 0, 0, 0.2); z-index: 0; cursor: pointer; }
    .j0n4t-pg-basket-chip:active { cursor: grabbing; }
    .j0n4t-pg-basket-chip.dragging { opacity: 0.4; }
    .j0n4t-pg-basket-chip.selected { outline: auto; }
    .j0n4t-pg-basket-chip-segments { display: flex; gap: 0.2em; width: 100%; align-items: center; }
    .j0n4t-pg-basket-chip-segment { flex: 1; text-align: center; text-overflow: ellipsis; white-space: nowrap; }
    .j0n4t-pg-basket-chip-weight { font-size: 9px; font-weight: bold; font-family: monospace; background: rgba(0, 0, 0, 0.4); color: #fff;  border-radius: 999px; padding: 0 3px; margin-right: 4px; cursor: pointer; z-index: 1; pointer-events: auto; }
    .j0n4t-pg-basket-chip-weight:hover { background: #007acc; }
    .j0n4t-pg-basket-chip.pinned { border-color: #ff6002bd; }
    .j0n4t-pg-basket-chip.pinned::after { content: '📌'; position: absolute; right: -1px; top: -2px; font-size: 9px; cursor: pointer; z-index: 2; }
    .j0n4t-pg-chip-popup-item.active-pin { color: #ff6002bd; }

    .j0n4t-pg-basket-chip-label { font-size: 10px; color: #fff; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; cursor: pointer; position: relative; text-shadow: 0 1px 2px rgba(0,0,0,0.9), 0 0 4px rgba(0,0,0,0.8); font-weight: 600; display: inline-flex; align-items: center; }
    .j0n4t-pg-basket-chip .j0n4t-pg-lib-badge { color: #fff; background: rgba(0,0,0,0.45); padding: 1px 3px; border-radius: 2px; font-size: 7.5px; font-weight: bold; text-transform: uppercase; letter-spacing: 0.3px; margin-left: 3px; }
    .j0n4t-pg-basket-chip.inline-editing { border-color: #d1a119; cursor: text; padding: 2px 4px; background-image: none !important; }
    .j0n4t-pg-basket-chip.inline-editing::before { display: none; }
    .j0n4t-pg-inline-edit { background: transparent; border: none; color: #fff; font-family: monospace; font-size: 11px; outline: none; width: 100%; min-width: 50px; padding: 0; margin: 0; }

    .j0n4t-pg-basket-add-btn { display: flex; align-items: center; justify-content: center; background: transparent; border: 2px dashed #777; border-radius: 3px; padding: 2px 8px; cursor: pointer; color: #aaa; font-size: 10px; font-weight: bold; transition: 0.15s; height: 22px; user-select: none; outline: none; }
    .j0n4t-pg-basket-add-btn:hover, .j0n4t-pg-basket-add-btn:focus { border-color: #007acc; color: #fff; background: #1a242db0; }
    .j0n4t-pg-text-input, .j0n4t-pg-bool-input, .j0n4t-pg-num-input, .j0n4t-pg-select-input { width: 38px; height: 16px; background: #1a1a1a; border: 1px solid #444; color: #fff; font-size: 9px; border-radius: 2px; padding: 0 2px; text-align: center; margin: 0 2px; outline: none; position: relative; cursor: pointer; }
    .j0n4t-pg-text-input:focus, .j0n4t-pg-bool-input:focus, .j0n4t-pg-num-input:focus, .j0n4t-pg-select-input:focus { border-color: #007acc; }
    .j0n4t-pg-bool-input { width: auto; }
    .j0n4t-pg-select-input { width: auto; max-width: 110px; font-weight: 600; font-family: inherit; }
    .j0n4t-pg-select-input option { background: #1a1a1a; color: #fff; }
    .j0n4t-pg-chip-popup { position: absolute; background: #1f1f1f; border: 1px solid #444; border-radius: 4px; box-shadow: 0 4px 12px rgba(0,0,0,0.8); z-index: 1000; display: flex; flex-direction: column; padding: 2px 0; outline: none; }
    .j0n4t-pg-chip-popup-actions { display: flex;  flex-direction: row; justify-content: space-around; padding: 0 2px; }
    .j0n4t-pg-chip-popup-item, .j0n4t-pg-var-edit-btn { padding: 4px; font-size: 11px; color: #ccc; cursor: pointer; display: flex; align-items: center; gap: 6px; white-space: nowrap; outline: none; }
    .j0n4t-pg-chip-popup-item svg, .j0n4t-pg-var-edit-btn svg { width: 12px; height: 12px; fill: currentColor; }
    .j0n4t-pg-chip-popup-item:hover, .j0n4t-pg-chip-popup-item:focus, .j0n4t-pg-var-edit-btn:hover, .j0n4t-pg-var-edit-btn:focus { background: #555; color: #fff; }
    .j0n4t-pg-var-edit-btn { background: transparent; border: 0; }
    .j0n4t-pg-chip-popup-item.danger:hover, .j0n4t-pg-chip-popup-item.danger:focus { background: #912e2e; color: #fff; }
    .j0n4t-pg-var-more { display: flex; font-size: 11px; }

    .j0n4t-pg-weight-btn { background: #333; color: #fff; border: 1px solid #555; border-radius: 3px; cursor: pointer; width: 20px; height: 20px; display: flex; align-items: center; justify-content: center; outline: none; font-size: 14px; line-height: 1; }
    .j0n4t-pg-weight-btn:hover, .j0n4t-pg-weight-btn:focus { background: #007acc; border-color: #007acc; }
    .j0n4t-pg-weight-input { width: 44px; height: 20px; text-align: center; background: #111; color: #fff; border: 1px solid #555; border-radius: 2px; font-size: 11px; outline: none; font-family: monospace; }
    .j0n4t-pg-weight-input:focus { border-color: #007acc; }

    .j0n4t-pg-var-popup-container {display: flex; flex-direction: column; max-height: 50vh; max-width: 80vw; overflow: scroll; }
    .j0n4t-pg-var-popup-row { display: flex; align-items: center; padding: 2px 4px; }
    .j0n4t-pg-var-popup-row label { font-size: 10px; color: #d1a119; font-weight: 600; min-width: 40px; text-transform: capitalize; }
    .j0n4t-pg-var-input { flex: 1; background: transparent; border: 1px solid #3d3d3d; border-radius: 3px; color: #fff; font-size: 11px; outline: none; padding: 2px 4px; margin: 0 4px; cursor: text; box-sizing: border-box; }
    .j0n4t-pg-var-input:focus { border-color: #d1a119; }

    @container pg-basket (max-width: 500px) {
      .j0n4t-pg-basket-header span { display: none; }
    }
  `;

  /**
   * @param {HTMLDivElement} container
   * @param {HTMLDivElement} basket
   * @param {HTMLTextAreaElement} textarea
   * @param {GalleryContext} context
   */
  constructor(container, basket, textarea, context) {
    this.container = container;
    this.basket = basket;
    this.textarea = textarea;
    this.context = context;
    /** @type {BasketDragDrop} */
    this.dragDrop = new BasketDragDrop(context, this);
    this.currentMatches = [];
    this.activeIndex = 0;
    this._updatingTextarea = false;
    /** @type {BasketSelectionController} */
    this.selection = new BasketSelectionController(context, this);
    this.inlineEditorManager = new InlineEditorManager(this.context, this);
    this.chipMenuManager = new ChipMenuManager(this.context, this);

    PresetDOM.injectStyles("j0n4t-pg-basket-container-styles", PresetBasket.BASKET_CONTAINER_STYLES);
    PresetDOM.injectStyles("j0n4t-pg-basket-chip-etc-styles", PresetBasket.BASKET_CHIP_ETC_STYLES);

    // Restructure container to include the side tabs sidebar
    this.container.style.display = "flex";
    this.container.style.flexDirection = "row";

    const mainPane = document.createElement("div");
    mainPane.style.cssText = "flex: 1; display: flex; flex-direction: column; overflow: hidden; min-width: 0;";
    while (this.container.firstChild) {
      mainPane.appendChild(this.container.firstChild);
    }

    const sidebar = document.createElement("div");
    sidebar.className = "j0n4t-pg-basket-tabs-sidebar";
    sidebar.innerHTML = `
      <div class="j0n4t-pg-basket-tabs-list"></div>
      <button class="j0n4t-pg-basket-tab-add-btn" title="New Basket Tab">+</button>
    `;

    this.container.appendChild(sidebar);
    this.container.appendChild(mainPane);

    this.tabsSidebarList = /** @type {HTMLElement} */ (sidebar.querySelector(".j0n4t-pg-basket-tabs-list"));
    this.tabAddBtn = /** @type {HTMLElement} */ (sidebar.querySelector(".j0n4t-pg-basket-tab-add-btn"));

    /** @type {PresetBasketTabs} */
    this.tabState = new PresetBasketTabs(context);
    /** @type {HTMLElement | null} */
    this.tabMenu = null;
    this.initTabs();

    this.tabAddBtn.addEventListener("click", () => this.createNewTab());

    // Track what is being dragged over the tab sidebar
    this._sidebarDragState = null;
    document.addEventListener("pointerdown", (e) => {
      if (this.tabMenu && !this.tabMenu.contains(/** @type {Node} */(e.target))) {
        this.closeTabMenu();
      }
    });
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") this.closeTabMenu();
    });

    // Custom event: external code can dispatch this to add chips to a new tab
    // Usage: container.dispatchEvent(new CustomEvent("preset-gallery:add-chips-to-new-tab", { detail: { chips: ["preset1", "preset2"] } }))
    this.container.addEventListener("preset-gallery:add-chips-to-new-tab", (e) => {
      // @ts-expect-error bleh
      const chips = e.detail?.chips;
      if (Array.isArray(chips) && chips.length > 0) {
        this.addChipsToNewTab(chips);
      }
    });

    this.rawManager = new RawTextareaManager(this.textarea, this.context, null, (val) => {
      const tokens = PresetLogic.parseTokens(val, this.context.cache);
      const selections = tokens
        .filter((t) => !t.isDelimiter && t.text.trim())
        .map((t) => (t.key ? t.key : t.text.trim()));
      this.context.updateWidgetValue(selections);
    });

    this.dragDrop.init();
    this.initSidebarDragAndDrop();
    this.initBasketActions();
  }

  /**
   * Load the saved tabs (or start one) and draw the sidebar. The tab state
   * itself lives in `PresetBasketTabs`; this only presents it.
   */
  initTabs() {
    this.tabState.load();
    this.renderTabsList();
    this.updateBasketTitle();
  }

  persistTabs() {
    this.tabState.persist();
  }

  saveCurrentState(skipPersist = false) {
    this.tabState.snapshot(skipPersist);
  }

  /** @param {string} tabId */
  switchTab(tabId) {
    if (this.tabState.isActive(tabId)) return;

    this.selection.selected.clear();
    this.selection.anchor = null;

    // The tab component installs the tab's pins, rolls and selection through the
    // app's restore operation; the widget callback renders from that state.
    if (!this.tabState.switchTo(tabId)) return;

    this.closeTabMenu();
    // Update sidebar tab active states in-place — no HTML rebuild or listener re-attachment
    // needed since the tab list structure hasn't changed. renderTabsList() is reserved for
    // structural changes (add/delete tab).
    this._updateTabSidebarActiveState();
    this.updateBasketTitle();
  }

  /**
   * Updates only the active/aria-selected state and titles of existing tab sidebar items
   * without rebuilding the HTML or re-attaching event listeners.
   */
  _updateTabSidebarActiveState() {
    if (!this.tabsSidebarList) return;
    this.tabsSidebarList.querySelectorAll(".j0n4t-pg-basket-tab-item").forEach((item, index) => {
      const id = item.getAttribute("data-tab-id");
      const isActive = this.tabState.isActive(id);
      item.classList.toggle("active", isActive);
      item.setAttribute("aria-selected", String(isActive));

      const targetTab = this.tabState.find(id);
      const baseTitle = targetTab?.title || `Tab ${index + 1}`;
      /** @type {HTMLElement} */ (item).title = `${PresetDOM.escapeHTML(baseTitle)}${isActive ? " (Click for tab options)" : ""}`;
    });
  }

  createNewTab() {
    this.selection.selected.clear();
    this.selection.anchor = null;
    this.tabState.create();
    this.renderTabsList();
    this.updateBasketTitle();
  }

  /**
   * Creates a new tab and populates it with the given chips.
   * @param {string[]} chips - Array of preset keys/strings to add to the new tab
   * @param {string} [title] - Optional title for the new tab (defaults to "Basket N")
   */
  addChipsToNewTab(chips, title) {
    this.selection.selected.clear();
    this.selection.anchor = null;
    this.tabState.create({ chips, title });
    this.renderTabsList();
    this.updateBasketTitle();
  }

  /**
   * Expands a preset key into its individual chip tokens.
   * @param {string} styleKey
   * @returns {string[]}
   */
  spreadPresetToChips(styleKey) {
    if (!styleKey) return [];
    const item = this.context.cache?.[styleKey];
    const presetText = item?.preset || styleKey;
    return PresetLogic.splitPresets(presetText);
  }

  /**
   * Appends spread chips to an existing tab's basket.
   * @param {string} tabId
   * @param {string[]} chips
   */
  appendChipsToTab(tabId, chips) {
    this.tabState.appendChips(tabId, chips);
  }

  /**
   * Sets up drag-and-drop handlers on the tab sidebar.
   * Dragging a preset onto the sidebar creates a new tab with the spread contents;
   * dragging onto an existing tab appends the spread contents to that tab.
   */
  initSidebarDragAndDrop() {
    const sidebar = /** @type {HTMLElement | null} */ (this.container.querySelector(".j0n4t-pg-basket-tabs-sidebar"));
    if (!sidebar) return;

    sidebar.addEventListener("dragenter", (/** @type {DragEvent} */ e) => {
      if (!e.dataTransfer) return;
      const types = Array.from(e.dataTransfer.types || []);
      if (!types.includes("text/plain")) return;
      e.preventDefault();
      e.stopPropagation();
      sidebar.classList.add("drag-over");
    });

    sidebar.addEventListener("dragover", (/** @type {DragEvent} */ e) => {
      if (!e.dataTransfer) return;
      const types = Array.from(e.dataTransfer.types || []);
      if (!types.includes("text/plain")) return;
      e.preventDefault();
      e.stopPropagation();
    });

    sidebar.addEventListener("dragleave", (/** @type {DragEvent} */ e) => {
      if (e.relatedTarget && sidebar.contains(/** @type {Node} */(e.relatedTarget))) return;
      sidebar.classList.remove("drag-over");
    });

    sidebar.addEventListener("drop", (/** @type {DragEvent} */ e) => {
      if (!e.dataTransfer) return;
      e.preventDefault();
      e.stopPropagation();
      sidebar.classList.remove("drag-over");
      this._clearTabDropTargets();

      const styleKey = e.dataTransfer.getData("text/plain");
      if (!styleKey) return;

      const chips = this.spreadPresetToChips(styleKey);
      if (chips.length === 0) return;

      // Check if we dropped on a specific tab item
      const tabItem = /** @type {HTMLElement | null} */ (e.target)?.closest?.(".j0n4t-pg-basket-tab-item");

      if (tabItem) {
        const tabId = tabItem.getAttribute("data-tab-id");
        if (tabId) {
          this.appendChipsToTab(tabId, chips);
          return;
        }
      }

      // Dropped on sidebar background or add button — create a new tab with the spread chips
      const presetName = PresetLogic.getPresetName(styleKey);
      const tabTitle = presetName ? PresetLogic.toTitleCase(presetName) : undefined;
      this.addChipsToNewTab(chips, tabTitle);
    });

    // Highlight individual tab items as drop targets during dragover
    this.tabsSidebarList?.addEventListener("dragover", (e) => {
      if (!e.dataTransfer) return;
      const types = Array.from(e.dataTransfer.types || []);
      if (!types.includes("text/plain")) return;
      if (e.dataTransfer.getData("source/basket") === "true") return;

      this._clearTabDropTargets();
      const tabItem = /** @type {HTMLElement | null} */ (e.target)?.closest?.(".j0n4t-pg-basket-tab-item");
      if (tabItem) {
        tabItem.classList.add("drop-target");
      }
    });

    this.tabsSidebarList?.addEventListener("dragleave", () => {
      this._clearTabDropTargets();
    });
  }

  _clearTabDropTargets() {
    this.tabsSidebarList?.querySelectorAll(".j0n4t-pg-basket-tab-item.drop-target").forEach(el => {
      el.classList.remove("drop-target");
    });
  }

  /** @param {string} tabId */
  duplicateTab(tabId) {
    this.selection.selected.clear();
    this.selection.anchor = null;
    // The duplicate carries the source tab's pins and rolled choices, so the
    // component's restore is the same transition as a switch.
    if (!this.tabState.duplicate(tabId)) return;
    this.renderTabsList();
    this.updateBasketTitle();
  }

  closeTabMenu() {
    const menu = this.tabMenu;
    this.tabMenu = null;
    if (menu) {
      if (menu.isConnected) menu.remove();
    }
  }

  /**
   * @param {string} tabId
   * @param {DOMRect} tabRect
   */
  openTabMenu(tabId, tabRect) {
    this.closeTabMenu();
    const menu = document.createElement("div");
    menu.className = "j0n4t-pg-basket-tab-menu";
    menu.setAttribute("role", "menu");
    menu.innerHTML = `
      <button type="button" role="menuitem">Duplicate</button>
      <button type="button" role="menuitem" ${this.tabState.tabs.length <= 1 ? "disabled" : ""}>Close</button>
      <button type="button" role="menuitem">Export Tabs</button>
      <button type="button" role="menuitem">Import Tabs</button>
    `;
    menu.style.left = `${tabRect.right + 4}px`;
    menu.style.top = `${tabRect.top}px`;
    document.body.appendChild(menu);
    this.tabMenu = menu;

    menu.addEventListener("blur", (e) => {
      if (e.relatedTarget && menu.contains(/** @type {Node} */(e.relatedTarget))) return;
      this.closeTabMenu();
    }, true);

    const menuRect = menu.getBoundingClientRect();
    if (menuRect.right > window.innerWidth) {
      menu.style.left = `${Math.max(0, tabRect.left - menuRect.width - 4)}px`;
    }
    if (menuRect.bottom > window.innerHeight) {
      menu.style.top = `${Math.max(0, window.innerHeight - menuRect.height - 4)}px`;
    }

    const [duplicateButton, closeButton, exportButton, importButton] = menu.querySelectorAll("button");
    duplicateButton.addEventListener("click", () => {
      this.closeTabMenu();
      this.duplicateTab(tabId);
    });
    closeButton.addEventListener("click", () => {
      this.closeTabMenu();
      this.deleteTab(tabId);
    });
    exportButton.addEventListener("click", () => {
      this.closeTabMenu();
      this.exportTabs();
    });
    importButton.addEventListener("click", () => {
      this.closeTabMenu();
      this.importTabs();
    });
    duplicateButton.focus();
  }

  /**
   * @param {string | null} tabId
   */
  deleteTab(tabId) {
    // Clear the chip selection before the restore renders when the active tab
    // goes away: its indexes belong to chips that are about to disappear.
    if (this.tabState.isActive(tabId)) {
      this.selection.selected.clear();
      this.selection.anchor = null;
    }
    if (!this.tabState.remove(tabId)) return;
    // switchTab updates the sidebar in place, so a full rebuild is needed here to
    // drop the removed tab's element.
    this.renderTabsList();
    this.updateBasketTitle();
  }

  renderTabsList() {
    if (!this.tabsSidebarList) return;
    this.closeTabMenu();
    let html = "";
    this.tabState.tabs.forEach((tab, index) => {
      const isActive = this.tabState.isActive(tab.id);
      const displayName = `${index + 1}`;
      html += `
        <div class="j0n4t-pg-basket-tab-item ${isActive ? 'active' : ''}"
             data-tab-id="${tab.id}"
             title="${PresetDOM.escapeHTML(tab.title || ('Tab ' + (index + 1)))}${(isActive ? " (Click for tab options)" : "")}"
             tabindex="0" role="tab" aria-selected="${isActive}">
          ${displayName}
        </div>
      `;
    });
    this.tabsSidebarList.innerHTML = html;

    this.tabsSidebarList.querySelectorAll(".j0n4t-pg-basket-tab-item").forEach(item => {
      const openOptions = () => {
        const tabId = item.getAttribute("data-tab-id");
        if (tabId) {
          if (this.tabState.isActive(tabId)) {
            const tabRect = item.getBoundingClientRect();
            this.openTabMenu(tabId, tabRect);
          }
          else {
            this.switchTab(tabId);
          }
        }
      };
      item.addEventListener("click", openOptions);
      // @ts-expect-error blah ts boring
      item.addEventListener("keydown", (/** @type {KeyboardEvent} */ e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          openOptions();
        }
      });
    });
  }

  /**
   * Opens an inline editor on the basket title to rename the active tab.
   */
  renameActiveTab() {
    const titleEl = this.context.dom.basketTitle;
    if (!titleEl) return;

    const tab = this.tabState.active();
    if (!tab) return;

    const currentTitle = tab.title || '';
    titleEl.style.display = 'none';

    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'j0n4t-pg-inline-edit';
    input.value = currentTitle;
    input.style.width = '100%';
    input.style.minWidth = '60px';
    /** @type {HTMLElement} */ (titleEl.parentNode).insertBefore(input, titleEl.nextSibling);

    let isFinishing = false;
    const finishEdit = (/** @type {boolean} */ save) => {
      if (isFinishing) return;
      isFinishing = true;

      const newVal = input.value.trim();
      input.remove();
      titleEl.style.display = '';

      if (save && newVal && newVal !== currentTitle) {
        this.tabState.rename(newVal);
        this.updateBasketTitle();
        this._updateTabSidebarActiveState();
      }
    };

    input.focus();
    input.select();

    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        e.stopPropagation();
        finishEdit(true);
      } else if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        finishEdit(false);
      }
    });

    input.addEventListener('blur', () => finishEdit(true));
  }

  /**
   * Updates the basket title element to show the active tab's name.
   */
  updateBasketTitle() {
    const titleEl = this.context.dom.basketTitle;
    if (!titleEl) return;

    const tab = this.tabState.active();
    if (!tab) return;

    const icon = '\u{1F9FA}';
    titleEl.textContent = `${icon} ${tab.title || 'Tab'}`;
  }

  /**
   * Opens a modal to select tabs and exports them as a JSON file.
   */
  async exportTabs() {
    const { default: ModalUtils } = await import("./ModalUtils.js");

    const tabRows = this.tabState.tabs.map((tab, index) => `
      <label style="display: flex; align-items: center; gap: 8px; padding: 4px 0; cursor: pointer;">
        <input type="checkbox" data-tab-index="${index}" checked />
        <span>${PresetDOM.escapeHTML(tab.title || `Tab ${index + 1}`)}</span>
      </label>
    `).join("");

    /** @type {number[]} */
    let selectedIndexes = [];
    /** @type {HTMLElement | null} */
    let modalRef = null;
    const result = await ModalUtils.show({
      title: "Export Tabs",
      expand: true,
      content: `
        <div style="max-height: 300px; overflow-y: auto;">
          ${tabRows}
        </div>
      `,
      buttons: [
        { text: "Cancel", closeOnFinish: true, callback: () => null },
        {
          text: "Export", isDefault: true, closeOnFinish: true, callback: () => {
            if (modalRef) {
              modalRef.querySelectorAll("input[type=checkbox]").forEach((checkbox) => {
                if (/** @type {HTMLInputElement} */ (checkbox).checked) {
                  const index = Number(/** @type { HTMLInputElement } */(checkbox).dataset.tabIndex);
                  if (index >= 0 && index < this.tabState.tabs.length) {
                    selectedIndexes.push(index);
                  }
                }
              });
            }
            return true;
          }
        }
      ],
      onOpen: (modal) => {
        modalRef = modal;
      }
    });

    if (!result) return;

    if (selectedIndexes.length === 0) {
      await ModalUtils.alert("No tabs selected for export.");
      return;
    }

    const exportData = {
      version: 1,
      tabs: selectedIndexes.map(index => {
        const tab = this.tabState.tabs[index];
        return {
          title: tab.title,
          basket: tab.basket.join(", "),
          pins: tab.pins.join(", "),
          rolls: tab.rolls
        };
      })
    };

    const yamlContent = YAMLUtils.stringify(exportData);
    const blob = new Blob([yamlContent], { type: "text/yaml" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "preset_basket_tabs.yaml";
    a.click();
    URL.revokeObjectURL(url);
  }

  /**
   * Opens a file picker, reads a YAML or JSON file, and shows a modal to select tabs to import.
   */
  async importTabs() {
    const { default: ModalUtils } = await import("./ModalUtils.js");

    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".yaml,.yml,.json,text/yaml,application/json";

    const file = await new Promise((resolve) => {
      input.addEventListener("change", () => resolve(input.files?.[0] || null));
      input.click();
    });

    if (!file) return;

    try {
      const text = await file.text();
      let data;
      const isYAML = /\.ya?ml$/i.test(file.name);
      if (isYAML) {
        data = YAMLUtils.parse(text);
      } else {
        data = JSON.parse(text);
      }

      if (!data.tabs || !Array.isArray(data.tabs) || data.tabs.length === 0) {
        await ModalUtils.alert("No tabs found in the selected file.");
        return;
      }

      const tabRows = data.tabs.map((/** @type {{ title: any; }} */ tab, /** @type {number} */ index) => `
        <label style="display: flex; align-items: center; gap: 8px; padding: 4px 0; cursor: pointer;">
          <input type="checkbox" data-tab-index="${index}" checked />
          <span>${PresetDOM.escapeHTML(tab.title || `Tab ${index + 1}`)}</span>
        </label>
      `).join("");

      /** @type {BasketTab[]} */
      let selectedTabs = [];
      /** @type {HTMLDivElement | null} */
      let modalRef = null;
      const result = await ModalUtils.show({
        title: "Import Tabs",
        expand: true,
        content: `
          <div style="max-height: 300px; overflow-y: auto;">
            ${tabRows}
          </div>
        `,
        buttons: [
          { text: "Cancel", closeOnFinish: true, callback: () => null },
          {
            text: "Import", isDefault: true, closeOnFinish: true, callback: () => {
              if (modalRef) {
                selectedTabs = [];
                modalRef.querySelectorAll("input[type=checkbox]").forEach((checkbox) => {
                  if (/** @type { HTMLInputElement } */ (checkbox).checked) {
                    const index = Number(/** @type { HTMLInputElement } */(checkbox).dataset.tabIndex);
                    if (index >= 0 && index < data.tabs.length) {
                      selectedTabs.push(data.tabs[index]);
                    }
                  }
                });
              }
              return true;
            }
          }
        ],
        onOpen: (modal) => {
          modalRef = modal;
        }
      });

      if (!result) return;

      if (selectedTabs.length === 0) {
        await ModalUtils.alert("No tabs selected for import.");
        return;
      }

      this.tabState.insertMany(selectedTabs);

      this.renderTabsList();
      this.updateBasketTitle();

      await ModalUtils.alert(`Successfully imported ${selectedTabs.length} tab(s).`);
    } catch (err) {
      // @ts-expect-error bleh
      await ModalUtils.alert("Failed to import tabs: " + err.message);
    }
  }

  initBasketActions() {
    const { dom } = this.context;

    dom.btnBasketMultiSelect.addEventListener("click", () => {
      this.selection.multiSelect = !this.selection.multiSelect;
      dom.btnBasketMultiSelect.classList.toggle("active", this.selection.multiSelect);
      dom.btnBasketMultiSelect.setAttribute("aria-pressed", String(this.selection.multiSelect));
      dom.btnBasketMultiSelect.title = this.selection.multiSelect
        ? "Exit multi-selection mode"
        : "Enable multi-selection mode";
      if (!this.selection.multiSelect) {
        this.selection.selected.clear();
        this.selection.anchor = null;
        this.selection.apply();
      }
    });
    dom.btnCopyBasket.addEventListener("click", () => {
      void this.selection.copySelected();
    });
    dom.btnBasketPaste.addEventListener("click", () => {
      void this.selection.paste();
    });
    dom.btnBasketPin.addEventListener("click", () => this.selection.togglePins());
    dom.btnBasketDelete.addEventListener("click", () => this.selection.deleteSelected());
    this.selection.updateActionButtons();

    dom.chkBasketRaw.checked = localStorage.getItem("comfy_preset_gallery_raw_basket") === "true";
    dom.basketContainer.classList.toggle("raw-mode", dom.chkBasketRaw.checked);
    dom.chkBasketRaw.addEventListener("change", () => {
      localStorage.setItem("comfy_preset_gallery_raw_basket", String(dom.chkBasketRaw.checked));
      dom.basketContainer.classList.toggle("raw-mode", dom.chkBasketRaw.checked);
    });

    this.basket.addEventListener("dblclick", (e) => {
      /** @type {HTMLElement | null} */ const chip = /** @type {HTMLElement} */ (e.target).closest('.j0n4t-pg-basket-chip');
      if (chip) {
        e.stopPropagation();
        this.chipMenuManager.close(false);

        const styleKey = chip.dataset.id || "";
        let editVal = styleKey;
        const rawPreset = chip.dataset.preset;
        const { core: coreKey, weightStr, isWeighted } = PresetLogic.parseWeight(styleKey);
        if (isWeighted) {
          editVal = `(${coreKey}:${weightStr})`;
        } else if (rawPreset) {
          editVal = rawPreset;
        }

        this.inlineEditorManager.spawn(chip, editVal, Number(chip.dataset.start), Number(chip.dataset.end));
      } else {
        e.stopPropagation();
        this.inlineEditorManager.spawn(null, "");
      }
    });

    this.basket.addEventListener("click", (e) => {
      if (e.detail > 1) {
        this.chipMenuManager.close(false);
        return;
      }

      const target = /** @type {HTMLElement} */ (e.target);
      const addBtn = target.closest('.j0n4t-pg-basket-add-btn');
      if (addBtn) return this.inlineEditorManager.spawn(null, "");

      if (target.closest("input")) return;

      const weightBadge = target.closest('.j0n4t-pg-basket-chip-weight');
      /** @type {HTMLElement | null} */ const chip = target.closest('.j0n4t-pg-basket-chip');

      if (chip) {
        e.stopPropagation();
        this.selection.handleChip(chip, e);
        if (this.selection.multiSelect) {
          this.chipMenuManager.close(false);
          return;
        }
        if (e.ctrlKey || e.metaKey || e.shiftKey) {
          this.chipMenuManager.close(false);
          return;
        }
        const styleKey = chip.dataset.id || "";
        const { core: coreKey } = PresetLogic.parseWeight(styleKey);
        const evalId = chip.dataset.evalId || coreKey;

        this.chipMenuManager.toggle(chip, !!weightBadge);

        let targetKey = styleKey;
        const presetVal = chip.dataset.preset;

        if (presetVal) {
          const match = PresetLogic.findPresetMatch(presetVal, this.context.cache);
          if (match) targetKey = match.key;
        } else if (this.context.cache?.[evalId]) {
          targetKey = evalId;
        } else if (this.context.cache?.[coreKey]) {
          targetKey = coreKey;
        }

        if (!this.context.dom.editor.classList.contains("collapsed") && this.context.editor.isSaved) {
          this.context.openEditorForPreset(targetKey);
        }
      } else {
        this.selection.selected.clear();
        this.selection.anchor = null;
        this.selection.apply();
        /** @type {HTMLElement} */ (this.basket.querySelector('.j0n4t-pg-basket-add-btn')).focus();
      }
    });

    this.basket.addEventListener("change", (e) => {
      const target = /** @type {HTMLElement} */ (e.target);
      /** @type {HTMLInputElement | null} */ const dynamicInput = target.closest('input.text-input, input.bool-input, input.num-input');
      if (dynamicInput) {
        /** @type {HTMLElement | null} */ const chip = dynamicInput.closest('.j0n4t-pg-basket-chip');
        if (!chip) return;
        const styleKey = chip.dataset.id || "";
        const startIndex = Number(chip.dataset.start);
        const endIndex = Number(chip.dataset.end);

        let newValue;
        if (dynamicInput.type === "checkbox") {
          newValue = dynamicInput.checked.toString();
        } else if (dynamicInput.type === "number") {
          newValue = parseFloat(dynamicInput.value);
          if (isNaN(newValue)) return;
        } else {
          newValue = dynamicInput.value.trim();
        }
        const newStyleKey = PresetLogic.expandRecursively(styleKey, this.context.cache).replace(/([:;])[^:;]+(>)$/, `$1${newValue}$2`);

        this.updateChipSelection(startIndex, endIndex, newStyleKey);
      }
    });

    this.basket.addEventListener("keydown", (e) => {
      const target = /** @type {HTMLElement} */ (e.target);
      const modifierKey = e.ctrlKey || e.metaKey;
      const focusedChip = /** @type {HTMLElement} */ (target.closest(".j0n4t-pg-basket-chip"));

      if (!target.closest("input") && modifierKey && e.key.toLowerCase() === "x" &&
        (focusedChip || this.selection.selected.size > 0)) {
        e.preventDefault();
        e.stopPropagation();
        if (focusedChip && !this.selection.selected.has(Number(focusedChip.dataset.index))) {
          const index = Number(focusedChip.dataset.index);
          this.selection.selected = new Set([index]);
          this.selection.anchor = index;
          this.selection.apply(index);
        }
        void this.selection.copySelected(focusedChip).then(() => this.selection.deleteSelected());
        return;
      }
      if (!target.closest("input") && modifierKey && e.key.toLowerCase() === "c" &&
        (focusedChip || this.selection.selected.size > 0)) {
        e.preventDefault();
        e.stopPropagation();
        this.selection.copySelected(focusedChip);
        return;
      }
      if (!target.closest("input") && modifierKey && e.key.toLowerCase() === "v") {
        e.preventDefault();
        e.stopPropagation();
        this.selection.paste();
        return;
      }
      if (!target.closest("input") && modifierKey && e.key.toLowerCase() === "a" &&
        (focusedChip || target.closest(".j0n4t-pg-basket-add-btn"))) {
        e.preventDefault();
        e.stopPropagation();
        const chips = Array.from(this.basket.querySelectorAll(".j0n4t-pg-basket-chip"));
        this.selection.selected = new Set(
          chips.map(chip => Number(/** @type {HTMLElement} */(chip).dataset.index))
        );
        const anchorIndex = focusedChip
          ? Number(focusedChip.dataset.index)
          : Number(/** @type {HTMLElement | undefined} */(chips[0])?.dataset.index);
        this.selection.anchor = chips.length ? anchorIndex : null;
        this.selection.apply(chips.length ? anchorIndex : undefined);
        return;
      }

      if (!target.closest("input") && focusedChip && !e.altKey &&
        (e.shiftKey || modifierKey) &&
        ["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(e.key)) {
        const chipElements = /** @type {HTMLElement[]} */ (
          Array.from(this.basket.querySelectorAll(".j0n4t-pg-basket-chip"))
        );
        const targetChip = this.getSpatialTarget(focusedChip, e.key, chipElements);
        if (targetChip) {
          e.preventDefault();
          e.stopPropagation();
          if (e.shiftKey) {
            this.selection.anchor ??= Number(focusedChip.dataset.index);
            this.selection.selectRange(
              this.selection.anchor,
              Number(targetChip.dataset.index)
            );
          } else {
            this.selection.handleChip(targetChip, e);
          }
        }
        return;
      }

      if (e.key === "Enter" && !e.ctrlKey || e.key === " ") {
        /** @type {HTMLElement | null} */ const triggerable = target.closest(".j0n4t-pg-basket-add-btn, .j0n4t-pg-basket-chip");
        if (triggerable && !target.closest("input")) {
          e.stopPropagation();
          e.preventDefault();
          triggerable.click();
        }
      }

      if ((e.key === "+" || e.key === "=" || e.key === "-") && !target.closest("input")) {
        /** @type {HTMLElement | null} */ const chip = target.closest('.j0n4t-pg-basket-chip');
        if (chip) {
          e.stopPropagation();
          e.preventDefault();
          const startIndex = Number(chip.dataset.start);
          const endIndex = Number(chip.dataset.end);
          const styleKey = chip.dataset.id || "";
          const { core: activeCoreKey, weight: currentWeight } = PresetLogic.parseWeight(styleKey);

          let val = currentWeight || 1.0;
          val += (e.key === "+" || e.key === "=") ? 0.05 : -0.05;

          let finalNewKey = val === 1.0 ? activeCoreKey : `(${activeCoreKey}:${Number(val.toFixed(2))})`;

          if (this.updateChipSelection(startIndex, endIndex, finalNewKey)) {
            this.focusChip(startIndex);
          }
        }
        return;
      }

      if (e.key === "Delete" && !target.closest("input")) {
        /** @type {HTMLElement | null} */ const chip = target.closest('.j0n4t-pg-basket-chip');
        if (chip && this.selection.selected.size > 1 &&
          this.selection.selected.has(Number(chip.dataset.index))) {
          e.stopPropagation();
          e.preventDefault();
          this.selection.deleteSelected();
        } else if (chip) {
          e.stopPropagation();
          e.preventDefault();
          const startIndex = Number(chip.dataset.start);
          const endIndex = Number(chip.dataset.end);
          const selections = this.context.getSelectedArray();
          if (startIndex >= 0 && endIndex <= selections.length) {
            selections.splice(startIndex, endIndex - startIndex);
            this.context.updateWidgetValue(selections);
            this.chipMenuManager.close(false);
            this.focusChip(startIndex);
          }
        }
        return;
      }

      if (e.key === "p" && !target.closest("input")) {
        /** @type {HTMLElement | null} */ const chip = target.closest('.j0n4t-pg-basket-chip');
        if (chip) {
          e.stopPropagation();
          e.preventDefault();
          if (this.selection.selected.size > 1 &&
            this.selection.selected.has(Number(chip.dataset.index))) {
            this.selection.togglePins();
          } else {
            this.togglePin(chip);
          }
        }
        return;
      }

      if (!target.closest("input") && !this.chipMenuManager.popupEl) {
        /** @type {HTMLElement | null} */
        const chip = target.closest('.j0n4t-pg-basket-chip');
        if (chip) {
          const keyMap = { s: "swap", e: "edit", l: "locate", c: "create" };
          // @ts-expect-error bleh
          const action = keyMap[e.key.toLowerCase()];
          if (action) {
            e.stopPropagation();
            e.preventDefault();
            const styleKey = chip.dataset.id || "";
            const { core: coreKey, weight: currentWeight, isWeighted } = PresetLogic.parseWeight(styleKey);
            const startIndex = Number(chip.dataset.start);
            const endIndex = Number(chip.dataset.end);
            const item = this.context.cache[coreKey];

            if (action === "swap") {
              let editVal = this.context.cache[coreKey]?.preset || coreKey;
              if (isWeighted && editVal) editVal = `(${editVal}:${currentWeight})`;
              this.inlineEditorManager.spawn(chip, editVal, startIndex, endIndex);
            } else if (action === "edit") {
              if (item) {
                this.context.openEditorForPreset(coreKey, true);
              } else {
                let editVal = styleKey;
                const rawPreset = chip.dataset.preset;
                if (isWeighted && rawPreset) editVal = `(${rawPreset}:${currentWeight})`;
                else if (rawPreset) editVal = rawPreset;
                this.inlineEditorManager.spawn(chip, editVal, startIndex, endIndex);
              }
            } else if (action === "locate") {
              let locateKey = coreKey;
              const presetVal = chip.dataset.preset;
              if (presetVal) {
                const presetMatch = PresetLogic.findPresetMatch(presetVal, this.context.cache);
                if (presetMatch) locateKey = presetMatch.key;
              }
              this.locatePreset(locateKey);
            } else if (action === "create") {
              this.context.setPanelCollapseState(false);
              this.context.editor.clearFields();
              this.context.editor.dom.inpPreset.value = item && item.preset ? item.preset : coreKey;
              this.context.editor.rawPresetManager?.updateHighlights();
              const cleanName = coreKey.replace(/^<(lora|lyco):/i, "").replace(/>$/, "").split(":")[0].split("/").pop()?.replace(/[^a-zA-Z0-9\s-_]/g, "").trim().replace(/\s+/g, "_");
              if (cleanName) this.context.editor.dom.inpName.value = cleanName;
              this.context.editor.dom.inpPreset.dispatchEvent(new Event("input"));
              this.context.editor.dom.inpPreset.focus();
            }
            return;
          }
          if (e.key.toLowerCase() === "w") {
            e.stopPropagation();
            e.preventDefault();
            this.chipMenuManager.show(chip, true);
            return;
          }
        }
      }

      if (!target.closest("input") && !e.altKey && ["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(e.key)) {
        /** @type {HTMLElement | null} */ const currentElement = target.closest('.j0n4t-pg-basket-chip, .j0n4t-pg-basket-add-btn');
        if (currentElement) {
          const targetEl = this.getSpatialTarget(currentElement, e.key);
          if (targetEl) {
            e.stopPropagation();
            e.preventDefault();
            targetEl.focus();
            if (targetEl.classList.contains("j0n4t-pg-basket-chip")) {
              const index = Number(/** @type {HTMLElement} */(targetEl).dataset.index);
              this.selection.selected = new Set([index]);
              this.selection.anchor = index;
              this.selection.apply(index);
            }
          }
        }
      }

      if (e.altKey && ["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(e.key)) {
        /** @type {HTMLElement | null} */ const chip = target.closest('.j0n4t-pg-basket-chip');
        if (!chip) return;
        const chipElements = /** @type {HTMLElement[]} */(Array.from(this.basket.querySelectorAll('.j0n4t-pg-basket-chip')));
        const selectedIndexes = this.selection.selected.has(Number(chip.dataset.index))
          ? this.selection.selected
          : new Set([Number(chip.dataset.index)]);
        const moving = chipElements.filter(item => selectedIndexes.has(Number(item.dataset.index)));
        let targetChip = this.getSpatialTarget(chip, e.key, chipElements);
        const visited = new Set([chip]);
        while (targetChip && selectedIndexes.has(Number(targetChip.dataset.index)) && !visited.has(targetChip)) {
          visited.add(targetChip);
          targetChip = this.getSpatialTarget(targetChip, e.key, chipElements);
        }

        if (targetChip && moving.length) {
          e.stopPropagation();
          e.preventDefault();
          const placeAfter = e.key === "ArrowRight" || e.key === "ArrowDown";
          this.selection.moveSelected(Number(targetChip.dataset.index), placeAfter, selectedIndexes);
        }
      }
    });

    this.basket.addEventListener("dragstart", (e) => {
      const target = /** @type {HTMLElement} */ (e.target);
      /** @type {HTMLElement | null} */ const chip = target.closest(".j0n4t-pg-basket-chip");
      if (chip) {
        const chipIndex = Number(chip.dataset.index);
        if (!this.selection.selected.has(chipIndex)) {
          this.selection.selected = new Set([chipIndex]);
          this.selection.anchor = chipIndex;
          this.selection.apply(chipIndex);
        }
        const draggedChips = Array.from(this.basket.querySelectorAll(".j0n4t-pg-basket-chip"))
          .filter(item => this.selection.selected.has(Number(/** @type {HTMLElement} */(item).dataset.index)));
        draggedChips.forEach(item => item.classList.add("dragging"));
        e.dataTransfer?.setData("text/plain", chip.dataset.id || "");
        e.dataTransfer?.setData("source/basket", "true");
        e.dataTransfer?.setData("source/basket_start", chip.dataset.start || "");
        e.dataTransfer?.setData("source/basket_end", chip.dataset.end || "");
        e.dataTransfer?.setData("source/basket_indexes", JSON.stringify([...this.selection.selected]));
      }
    });

    this.basket.addEventListener("dragend", () => {
      this.basket.querySelectorAll(".j0n4t-pg-basket-chip").forEach(c => c.classList.remove("dragging"));
      this.dragDrop.removeDropIndicator();
    });
  }

  /**
   * Finds the geometrically or sequentially adjacent element in the basket.
   * @param {HTMLElement} currentElement
   * @param {string} key - 'ArrowUp' | 'ArrowDown' | 'ArrowLeft' | 'ArrowRight'
   * @param {HTMLElement[]} [candidateElements] - Optional subset of elements to search within
   * @returns {HTMLElement | null}
   */
  getSpatialTarget(currentElement, key, candidateElements) {
    const elements = candidateElements || Array.from(this.basket.querySelectorAll('.j0n4t-pg-basket-chip, .j0n4t-pg-basket-add-btn'));
    const currentIndex = elements.indexOf(currentElement);
    if (currentIndex === -1) return null;

    if (key === "ArrowRight") return elements[currentIndex + 1] || null;
    if (key === "ArrowLeft") return elements[currentIndex - 1] || null;

    if (key === "ArrowUp" || key === "ArrowDown") {
      const currentRect = currentElement.getBoundingClientRect();
      const currentCenterX = currentRect.left + currentRect.width / 2;

      const rects = elements.map(el => ({ el, rect: el.getBoundingClientRect() }));

      const candidates = rects.filter(item => {
        if (key === "ArrowUp") return item.rect.bottom <= currentRect.top + 4;
        return item.rect.top >= currentRect.bottom - 4;
      });

      if (candidates.length === 0) return null;

      const targetY = key === "ArrowUp"
        ? Math.max(...candidates.map(c => c.rect.bottom))
        : Math.min(...candidates.map(c => c.rect.top));

      const rowItems = candidates.filter(c =>
        Math.abs((key === "ArrowUp" ? c.rect.bottom : c.rect.top) - targetY) < 4
      );

      const closestItem = rowItems.reduce((closest, item) => {
        const itemCenterX = item.rect.left + item.rect.width / 2;
        const diff = Math.abs(itemCenterX - currentCenterX);
        return diff < closest.diff ? { item, diff } : closest;
      }, { item: rowItems[0], diff: Infinity }).item;

      return closestItem.el;
    }

    return null;
  }

  /**
   * @param {number} chipIndex
   * @param {string} [groupRaw]
   * @param {string} [gIndex]
   */
  reRollChipGroup(chipIndex, groupRaw, gIndex) {
    const activeList = this.context.getSelectedArray();
    const chipsData = PresetLogic.getGroupedChips(activeList, this.context.cache);
    const tracer = new RollManager(this.context.rollManager.rolls);
    const targetGroup = groupRaw?.trim().toLowerCase().replace(/\s+/g, "_") || "";

    for (let i = 0; i < chipsData.length; i++) {
      const startCounts = tracer.cloneCounts();
      PresetLogic.expandRecursively(chipsData[i].styleKey, this.context.cache, new Set(), tracer);

      if (i === chipIndex) {
        const start = startCounts[targetGroup] || 0;
        const end = tracer.getCount(targetGroup);

        if (gIndex !== null && gIndex !== undefined) {
          const targetRollIndex = start + parseInt(gIndex, 10);
          if (targetRollIndex < end) {
            this.context.rollManager.deleteRoll(targetGroup, targetRollIndex);
          }
        } else {
          for (let k = start; k < end; k++) {
            this.context.rollManager.deleteRoll(targetGroup, k);
          }
        }
        break;
      }
    }
    this.context.syncUI(this.context.widget.value);
  }

  /**
   * Focuses the chip at the specified start index, or falls back to the closest available element.
   * @param {number | string} [startIndex]
   */
  focusChip(startIndex) {
    setTimeout(() => {
      let target = null;
      if (startIndex !== undefined && startIndex !== null && startIndex !== "") {
        target = this.basket.querySelector(`[data-start="${startIndex}"]`);
        if (!target) {
          const chips = Array.from(this.basket.querySelectorAll(".j0n4t-pg-basket-chip"));
          const idx = Number(startIndex);
          if (!isNaN(idx)) {
            target = chips.find(c => Number(/** @type {HTMLElement} */(c).dataset.start) >= idx) || chips[chips.length - 1];
          }
        }
      }
      if (!target) {
        target = this.basket.querySelector(".j0n4t-pg-basket-add-btn");
      }
      if (target) {
        /** @type {HTMLElement} */(target).focus();
      }
    }, 50);
  }

  /**
   * The selection and clipboard commands live in BasketSelectionController;
   * these keep the Basket's public surface for the chip menu and the tests.
   */
  /** @param {number} [index] */
  applyChipSelection(index) {
    this.selection.apply(index);
  }

  updateBasketActionButtons() {
    this.selection.updateActionButtons();
  }

  /**
   * @param {number} start
   * @param {number} end
   */
  selectChipRange(start, end) {
    this.selection.selectRange(start, end);
  }

  /**
   * @param {HTMLElement} chip
   * @param {MouseEvent | KeyboardEvent} event
   */
  handleChipSelection(chip, event) {
    this.selection.handleChip(chip, event);
  }

  deleteSelectedChips() {
    this.selection.deleteSelected();
  }

  toggleSelectedPins() {
    this.selection.togglePins();
  }

  /**
   * @param {number} targetIndex
   * @param {boolean} placeAfter
   * @param {Set<number>} [selection]
   */
  moveSelectedChips(targetIndex, placeAfter, selection) {
    this.selection.moveSelected(targetIndex, placeAfter, selection);
  }

  /** @param {HTMLElement} [focusedChip] */
  async copySelectedChips(focusedChip) {
    await this.selection.copySelected(focusedChip);
  }

  /** @param {unknown} value */
  isBasketClipboardPayload(value) {
    return this.selection.isClipboardPayload(value);
  }

  async readBasketClipboard() {
    return this.selection.readClipboard();
  }

  async pasteChips() {
    await this.selection.paste();
  }

  /** @param {HTMLElement} chip */
  togglePin(chip) {
    const currentList = this.context.getSelectedArray();
    const rawToken = currentList.slice(Number(chip.dataset.start), Number(chip.dataset.end)).join(', ');
    if (this.context.pinnedChips?.has(rawToken)) {
      this.context.pinnedChips.delete(rawToken);
      chip.classList.remove("pinned");
    } else {
      this.context.pinnedChips?.add(rawToken);
      chip.classList.add("pinned");
    }
    this.context.savePins();
    this.saveCurrentState();
  }

  /** @param {string[]} activeList  */
  render(activeList) {
    // The tab is snapshotted as it renders: this is the one place that sees the
    // selection, the pins and the rolls together.
    this.tabState.snapshotList(activeList);

    if (!this._updatingTextarea) {
      this.context.rollManager.resetCounts();
      const expandedList = activeList.map((/** @type {string} */ itemStr) => {
        const { core: coreKey, weightStr, isWeighted } = PresetLogic.parseWeight(itemStr);
        if (isWeighted) {
          const coreExpanded = PresetLogic.expandRecursively(coreKey, this.context.cache, new Set(), this.context.rollManager);
          return `(${coreExpanded}:${weightStr})`;
        }
        return PresetLogic.expandRecursively(itemStr, this.context.cache, new Set(), this.context.rollManager);
      });
      this.textarea.value = expandedList.join(", ");
    }
    this.rawManager.updateHighlights();

    let htmlBuffer = "";
    const chipsData = PresetLogic.getGroupedChips(activeList, this.context.cache);

    this.context.rollManager.resetCounts();

    chipsData.forEach((chipData, index) => {
      const chip = PresetDOM.renderBasketChip(
        chipData,
        this.context.cache,
        this.context.rollManager,
        this.context.session
      );

      const rawItems = activeList.slice(chipData.startIndex, chipData.endIndex);
      const rawVal = rawItems.join(', ');
      const isPinned = this.context.pinnedChips?.has(rawVal);

      const libId = PresetLogic.splitQualifiedKey(chipData.styleKey).libraryId ||
        this.context.session?.ownerOfKey?.(chipData.styleKey);
      const isDuplicate = this.context.session?.isDuplicateKey?.(chipData.styleKey);
      const showLib = libId && (isDuplicate || libId !== "main");
      const libName = (libId ? this.context.session?.libraryName?.(libId) : null) || libId;
      const libBadge = showLib && this.context.settings?.showChipLibraryBadges !== false
        ? `<span class="j0n4t-pg-lib-badge" title="From the ${PresetDOM.escapeHTML(libName)} library">${PresetDOM.escapeHTML(libName)}</span>`
        : "";

      let labelContent = `${PresetDOM.escapeHTML(chip.processed.cleanLabel)}${libBadge}`;
      if ((!chip.processed.chipData.item || chipData.styleKey.startsWith("_/combo")) && chip.processed.segmentedLabels) {
        labelContent = `<div class="j0n4t-pg-basket-chip-segments">` +
          chip.processed.segmentedLabels.filter(Boolean).map(p => `<span class="j0n4t-pg-basket-chip-segment">${PresetDOM.escapeHTML(p)}</span>`).join('') +
          `</div>`;
      }
      const tooltipTitle = chip.processed.tooltipTitle;

      htmlBuffer += `
        <div class="j0n4t-pg-basket-chip ${isPinned ? 'pinned' : ''} ${this.selection.selected.has(index) ? 'selected' : ''}" tabindex="0" role="option" aria-selected="${this.selection.selected.has(index)}"
             draggable="true" 
             title="${PresetDOM.escapeHTML(tooltipTitle)}"
             data-id="${PresetDOM.escapeHTML(chip.processed.joinedStr)}"
             data-eval-id="${PresetDOM.escapeHTML(chip.processed.evalId)}"
             data-preset="${PresetDOM.escapeHTML(chip.processed.chipData.item?.preset || "")}"
             data-index="${index}"
             data-start="${chip.processed.chipData.startIndex}"
             data-end="${chip.processed.chipData.endIndex}"
             style='${chip.bgStyle}'>
            ${chip.weightIconHtml}
            <div class="j0n4t-pg-basket-chip-label">
                ${labelContent}
            </div>
            ${chip.inputHtml}
        </div>
      `;
    });

    htmlBuffer += `<div class="j0n4t-pg-basket-add-btn" tabindex="0" role="button" title="Add new preset or keyword" aria-label="Add new keyword">+ Add</div>`;
    this.basket.innerHTML = htmlBuffer;
    this.selection.updateActionButtons();
  }

  /**
   * @param {number} startIndex 
   * @param {number} endIndex 
   * @param {string} newStyleKey 
   * @returns {boolean}
   */
  updateChipSelection(startIndex, endIndex, newStyleKey) {
    const selections = this.context.getSelectedArray();
    if (startIndex >= selections.length) return false;

    const oldRawVal = selections.slice(startIndex, endIndex).join(', ');
    this.context.transferPin(oldRawVal, newStyleKey);
    selections.splice(startIndex, endIndex - startIndex, newStyleKey);
    this.context.updateWidgetValue(selections);
    return true;
  }

  /** @param {string} styleKey */
  locatePreset(styleKey) {
    /** @type {HTMLElement | null} */ const itemEl = this.context.dom.grid.querySelector(`.j0n4t-pg-item[data-style="${PresetDOM.escapeHTML(styleKey)}"]`);
    if (itemEl) {
      this.context.dom.search.value = "";
      let prev = /** @type {HTMLElement} */ (itemEl.previousElementSibling);
      while (prev && !prev.classList.contains("j0n4t-pg-group-header"))
        prev =  /** @type {HTMLElement} */ (prev.previousElementSibling);
      if (prev?.classList.contains("collapsed")) {
        prev.classList.remove("collapsed");
        this.context.setCollapsedFolders(this.context.getCollapsedFolders().filter((/** @type {string} */ f) => f !== prev.dataset.groupRaw));
      }
      this.context.grid.executeFilterPipeline();
      if (this.context.dom.wrap.classList.contains("hide-gallery-mode")) {
        this.context.dom.btnHideGallery.click();
      }
      setTimeout(() => {
        itemEl.scrollIntoView({ behavior: "smooth", block: "nearest" });
        itemEl.style.transition = "border-color 0.15s, box-shadow 0.15s";
        const origColor = itemEl.style.borderColor;
        itemEl.style.borderColor = "#007acc";
        itemEl.style.boxShadow = "0 0 8px rgba(0, 122, 204, 0.75)";

        setTimeout(() => {
          itemEl.style.borderColor = origColor;
          itemEl.style.boxShadow = "";
        }, 800);
      }, 10);
    }
  }
}
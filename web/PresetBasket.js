import ChipMenuManager from "./ChipMenuManager.js";
import InlineEditorManager from "./InlineEditorManager.js";
import ModalUtils from "./ModalUtils.js";
import PresetDOM from "./PresetDOM.js";
import PresetLogic from "./PresetLogic.js";
import RawTextareaManager from "./RawTextareaManager.js";

const BASKET_CLIPBOARD_TYPE = "web application/x-comfy-preset-gallery-basket+json";
let basketClipboard = null;

export default class PresetBasket {
  static BASKET_CONTAINER_STYLES = /*css*/ `
    .j0n4t-pg-basket-container.drag-over { border-color: #007acc; background: #1a242db0; }
    .j0n4t-pg-basket-header { display: flex; justify-content: space-between; align-items: center; background: #222;  position: sticky; top: 0; padding: 4px; z-index: 1; }
    .j0n4t-pg-basket-title { font-size: 9px; color: #aaa; text-transform: uppercase; letter-spacing: 0.5px; font-weight: bold; pointer-events: none; }
    .j0n4t-pg-basket-clear-btn:hover, .j0n4t-pg-basket-clear-btn:focus { background: #912e2e; outline: 2px solid #fff; }
    .j0n4t-pg-basket-copy-btn { display: flex; background: none; border: none; outline: none; padding: 0; }
    .j0n4t-pg-basket-copy-btn:hover, .j0n4t-pg-basket-copy-btn:focus { color: #007acc; transform: scale(1.1); }
    .j0n4t-pg-var-reroll-btn { display: flex; align-items: center; justify-content: center; background: transparent; border: none; color: #aaa; cursor: pointer; font-size: 13px; padding: 0 4px; outline: none; transition: 0.15s; }
    .j0n4t-pg-var-reroll-btn:hover, .j0n4t-pg-var-reroll-btn:focus { color: #fff; transform: scale(1.1); }
    .j0n4t-pg-checkbox-wrap {height:auto; padding:0; margin-right:4px;}
    .j0n4t-pg-basket-reroll-btn:hover, .j0n4t-pg-basket-reroll-btn:focus { filter: grayscale(0) brightness(1) !important; transform: scale(1.1); }
    .j0n4t-pg-basket-reroll-btn { transition: transform 0.2s ease; }
    .j0n4t-pg-basket-header.shift-held .j0n4t-pg-basket-reroll-btn { transform: rotate(180deg); }
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
  `;

  static BASKET_CHIP_ETC_STYLES = /*css*/ `
    .j0n4t-pg-basket-empty { font-size: 10px; color: #555; font-style: italic; pointer-events: none; }
    .j0n4t-pg-basket-drop-indicator { width: 2px; background-color: #007acc; box-shadow: 0 0 4px #007acc; border-radius: 1px; transition: transform 0.05s ease; pointer-events: none; }
    .j0n4t-pg-basket-chip { display: flex; align-items: center; background-size: cover; background-position: center; border: 1px solid #3d3d3d; border-radius: 3px; padding: 2px 4px; box-sizing: border-box; cursor: grab; user-select: none; transition: background 0.15s, border-color 0.15s; position: relative; overflow: hidden; min-height: 1.4em; outline: none; }
    .j0n4t-pg-basket-chip::before { content: ""; position: absolute; inset: 0; background: rgba(0, 0, 0, 0.2); z-index: 0; pointer-events: none; }
    .j0n4t-pg-basket-chip:active { cursor: grabbing; }
    .j0n4t-pg-basket-chip.dragging { opacity: 0.4; border-color: #007acc; }
    .j0n4t-pg-basket-chip:focus { border-width: 2px; border-color: #007acc; }
    .j0n4t-pg-basket-chip.selected { box-shadow: inset 0 0 0 2px #007acc; }
    .j0n4t-pg-basket-chip-segments { display: flex; gap: 0.2em; width: 100%; align-items: center; }
    .j0n4t-pg-basket-chip-segment { flex: 1; text-align: center; text-overflow: ellipsis; white-space: nowrap; }
    .j0n4t-pg-basket-chip-weight { font-size: 9px; font-weight: bold; font-family: monospace; background: rgba(0, 0, 0, 0.4); color: #fff;  border-radius: 999px; padding: 0 3px; margin-right: 4px; cursor: pointer; z-index: 1; pointer-events: auto; }
    .j0n4t-pg-basket-chip-weight:hover { background: #007acc; }
    .j0n4t-pg-basket-chip.pinned { border-color: #e09f3e; }
    .j0n4t-pg-basket-chip.pinned::after { content: '📌'; position: absolute; right: -2px; top: -2px; font-size: 10px; pointer-events: none; z-index: 2; }
    .j0n4t-pg-chip-popup-item.active-pin { color: #e09f3e; }

    .j0n4t-pg-basket-chip-label { font-size: 10px; color: #fff; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; pointer-events: none; position: relative; text-shadow: 0 1px 2px rgba(0,0,0,0.9), 0 0 4px rgba(0,0,0,0.8); font-weight: 600; }
    .j0n4t-pg-basket-chip.inline-editing { border-color: #d1a119; cursor: text; padding: 2px 4px; background-image: none !important; }
    .j0n4t-pg-basket-chip.inline-editing::before { display: none; }
    .j0n4t-pg-inline-edit { background: transparent; border: none; color: #fff; font-family: monospace; font-size: 11px; outline: none; width: 100%; min-width: 50px; padding: 0; margin: 0; }

    .j0n4t-pg-basket-add-btn { display: flex; align-items: center; justify-content: center; background: transparent; border: 1px dashed #777; border-radius: 3px; padding: 2px 8px; cursor: pointer; color: #aaa; font-size: 10px; font-weight: bold; transition: 0.15s; height: 22px; user-select: none; outline: none; }
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
  `;

  /**
   * @param {HTMLDivElement} container
   * @param {HTMLDivElement} basket
   * @param {HTMLTextAreaElement} textarea
   * @param {import("./PresetGalleryApp.js").default} context
   */
  constructor(container, basket, textarea, context) {
    this.container = container;
    this.basket = basket;
    this.textarea = textarea;
    this.context = context;
    this.dropIndicator = null;
    this.currentMatches = [];
    this.activeIndex = 0;
    this._updatingTextarea = false;
    /** @type {Set<number>} */
    this.selectedChipIndexes = new Set();
    /** @type {number | null} */
    this.selectionAnchorIndex = null;
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

    /** @type {BasketTab[]} */
    this.tabs = [];
    /** @type {string | null} */
    this.activeTabId = null;
    /** @type {HTMLElement | null} */
    this.tabMenu = null;
    this.initTabs();

    this.tabAddBtn.addEventListener("click", () => this.createNewTab());
    document.addEventListener("pointerdown", (e) => {
      if (this.tabMenu && !this.tabMenu.contains(/** @type {Node} */(e.target))) {
        this.closeTabMenu();
      }
    });
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") this.closeTabMenu();
    });

    this.rawManager = new RawTextareaManager(this.textarea, this.context, null, (val) => {
      const tokens = PresetLogic.parseTokens(val, this.context.cache);
      const selections = tokens
        .filter((t) => !t.isDelimiter && t.text.trim())
        .map((t) => (t.key ? t.key : t.text.trim()));
      this.context.updateWidgetValue(selections);
    });

    this.initDragAndDrop();
    this.initBasketActions();
  }

  initTabs() {
    const saved = localStorage.getItem("comfy_preset_gallery_basket_tabs");
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed.tabs) && parsed.tabs.length > 0) {
          this.tabs = parsed.tabs;
          this.activeTabId = parsed.activeTabId && this.tabs.some(t => t.id === parsed.activeTabId)
            ? parsed.activeTabId
            : this.tabs[0].id;

          const activeTab = this.tabs.find(t => t.id === this.activeTabId);
          if (activeTab) {
            this.context.widget.value = (activeTab.basket || []).join(", ");
            this.context.pinnedChips = new Set(activeTab.pins || []);
            if (typeof this.context.savePins === "function") {
              this.context.savePins();
            }
            if (this.context.rollManager) {
              this.context.rollManager.rolls = JSON.parse(JSON.stringify(activeTab.rolls || {}));
            }
          }
          this.renderTabsList();
          return;
        }
      } catch (e) {
        console.error("Failed to parse basket tabs from localStorage", e);
      }
    }

    // Default initial tab
    const defaultId = "tab_" + Date.now();
    this.tabs = [{
      id: defaultId,
      title: "Tab 1",
      basket: [...this.context.getSelectedArray()],
      pins: this.context.pinnedChips ? Array.from(this.context.pinnedChips) : [],
      rolls: this.context.rollManager?.rolls ? JSON.parse(JSON.stringify(this.context.rollManager.rolls)) : {}
    }];
    this.activeTabId = defaultId;
    this.renderTabsList();
    this.persistTabs();
  }

  persistTabs() {
    localStorage.setItem("comfy_preset_gallery_basket_tabs", JSON.stringify({
      tabs: this.tabs,
      activeTabId: this.activeTabId
    }));
  }

  saveCurrentState() {
    if (!this.activeTabId) return;
    const tab = this.tabs.find(t => t.id === this.activeTabId);
    if (tab) {
      tab.basket = [...this.context.getSelectedArray()];
      tab.pins = this.context.pinnedChips ? Array.from(this.context.pinnedChips) : [];
      tab.rolls = this.context.rollManager?.rolls ? JSON.parse(JSON.stringify(this.context.rollManager.rolls)) : {};
    }
    this.persistTabs();
  }

  /** @param {string} tabId */
  switchTab(tabId) {
    if (this.activeTabId === tabId) return;
    this.saveCurrentState();

    const tab = this.tabs.find(t => t.id === tabId);
    if (!tab) return;

    this.activeTabId = tabId;

    this.context.pinnedChips = new Set(tab.pins || []);
    if (this.context.rollManager) {
      this.context.rollManager.rolls = JSON.parse(JSON.stringify(tab.rolls || {}));
    }
    this.context.updateWidgetValue(tab.basket || []);
    this.context.savePins();

    this.render(this.context.getSelectedArray());
    this.renderTabsList();
    this.persistTabs();
  }

  createNewTab() {
    this.saveCurrentState();

    const newId = this.createTabId();
    const newTitle = `Tab ${this.tabs.length + 1}`;

    const newTab = {
      id: newId,
      title: newTitle,
      basket: [],
      pins: [],
      rolls: {}
    };

    this.tabs.push(newTab);
    this.activeTabId = newId;

    this.context.updateWidgetValue([]);
    this.context.pinnedChips = new Set();
    if (typeof this.context.savePins === "function") {
      this.context.savePins();
    }
    if (this.context.rollManager) {
      this.context.rollManager.rolls = {};
    }

    this.render([]);
    this.renderTabsList();
    this.persistTabs();
  }

  createTabId() {
    /** @type {string} */
    let id;
    do {
      id = `tab_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    } while (this.tabs.some(tab => tab.id === id));
    return id;
  }

  /** @param {string} tabId */
  duplicateTab(tabId) {
    this.saveCurrentState();
    const sourceTab = this.tabs.find(tab => tab.id === tabId);
    if (!sourceTab) return;

    const duplicate = {
      ...sourceTab,
      id: this.createTabId(),
      title: `${sourceTab.title || `Tab ${this.tabs.indexOf(sourceTab) + 1}`} Copy`,
      basket: [...(sourceTab.basket || [])],
      pins: [...(sourceTab.pins || [])],
      rolls: JSON.parse(JSON.stringify(sourceTab.rolls || {}))
    };
    this.tabs.push(duplicate);
    this.activeTabId = duplicate.id;
    this.context.pinnedChips = new Set(duplicate.pins);
    if (this.context.rollManager) {
      this.context.rollManager.rolls = JSON.parse(JSON.stringify(duplicate.rolls));
    }
    this.context.updateWidgetValue(duplicate.basket);
    this.context.savePins();
    this.render(this.context.getSelectedArray());
    this.renderTabsList();
    this.persistTabs();
  }

  closeTabMenu() {
    this.tabMenu?.remove();
    this.tabMenu = null;
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
      <button type="button" role="menuitem" ${this.tabs.length <= 1 ? "disabled" : ""}>Close</button>
    `;
    menu.style.left = `${tabRect.right + 4}px`;
    menu.style.top = `${tabRect.top}px`;
    document.body.appendChild(menu);
    this.tabMenu = menu;

    const menuRect = menu.getBoundingClientRect();
    if (menuRect.right > window.innerWidth) {
      menu.style.left = `${Math.max(0, tabRect.left - menuRect.width - 4)}px`;
    }
    if (menuRect.bottom > window.innerHeight) {
      menu.style.top = `${Math.max(0, window.innerHeight - menuRect.height - 4)}px`;
    }

    const [duplicateButton, closeButton] = menu.querySelectorAll("button");
    duplicateButton.addEventListener("click", () => {
      this.closeTabMenu();
      this.duplicateTab(tabId);
    });
    closeButton.addEventListener("click", () => {
      this.closeTabMenu();
      this.deleteTab(tabId);
    });
    duplicateButton.focus();
  }

  /**
   * @param {string | null} tabId
   */
  deleteTab(tabId) {
    if (this.tabs.length <= 1) return;

    const index = this.tabs.findIndex(t => t.id === tabId);
    if (index === -1) return;

    this.tabs.splice(index, 1);

    if (this.activeTabId === tabId) {
      const nextTab = this.tabs[Math.max(0, index - 1)];
      this.activeTabId = null;
      this.switchTab(nextTab.id);
    } else {
      this.renderTabsList();
      this.persistTabs();
    }
  }

  renderTabsList() {
    if (!this.tabsSidebarList) return;
    this.closeTabMenu();
    let html = "";
    this.tabs.forEach((tab, index) => {
      const isActive = tab.id === this.activeTabId;
      const displayName = `${index + 1}`;
      html += `
        <div class="j0n4t-pg-basket-tab-item ${isActive ? 'active' : ''}"
             data-tab-id="${tab.id}"
             title="${PresetDOM.escapeHTML(tab.title || ('Tab ' + (index + 1)))}${(this.activeTabId === tab.id ? " (Click for tab options)" : "")}"
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
          if (this.activeTabId === tabId) {
            const tabRect = item.getBoundingClientRect();
            this.openTabMenu(tabId, tabRect);
          }
          else {
            this.switchTab(tabId);
          }
        }
      };
      item.addEventListener("click", openOptions);
      // @ts-ignore
      item.addEventListener("keydown", (/** @type {KeyboardEvent} */ e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          openOptions();
        }
      });
    });
  }

  initDragAndDrop() {
    this.container.addEventListener("dragenter", (e) => {
      if (!this.container.classList.contains("raw-mode")) {
        e.stopPropagation();
        e.preventDefault();
        this.container.classList.add("drag-over");
      }
    });
    this.container.addEventListener("dragleave", (e) => {
      if (e.relatedTarget && this.container.contains( /** @type {HTMLElement} */(e.relatedTarget))) return;
      this.container.classList.remove("drag-over");
      this.removeDropIndicator();
    });
    this.container.addEventListener("dragover", (e) => {
      if (this.container.classList.contains("raw-mode")) return;
      e.stopPropagation();
      e.preventDefault();

      if (!this.dropIndicator) {
        this.basket.insertAdjacentHTML('beforeend', '<div class="j0n4t-pg-basket-drop-indicator"></div>');
        this.dropIndicator = /** @type {HTMLElement} */ (this.basket.lastElementChild);
      }

      const closest = this.getClosestChip(e.clientX, e.clientY);
      if (closest.element && closest.box && this.dropIndicator) {
        this.dropIndicator.style.height = `${closest.box.height}px`;
        if (e.clientX > closest.box.left + closest.box.width / 2) {
          closest.element.after(this.dropIndicator);
        } else {
          closest.element.before(this.dropIndicator);
        }
      } else {
        this.basket.appendChild(this.dropIndicator);
        this.dropIndicator.style.height = "12px";
      }
    });
    this.container.addEventListener("drop", (e) => {
      if (this.container.classList.contains("raw-mode")) return;
      e.stopPropagation();
      e.preventDefault();
      this.container.classList.remove("drag-over");
      this.removeDropIndicator();
      const styleKey = e.dataTransfer?.getData("text/plain");
      if (!styleKey) return;

      let selections = this.context.getSelectedArray();
      const sourceStartStr = e.dataTransfer?.getData("source/basket_start");
      const sourceEndStr = e.dataTransfer?.getData("source/basket_end");

      let movedItems = [styleKey];
      if (e.dataTransfer?.getData("source/basket") && sourceStartStr !== "" && sourceEndStr !== "") {
        const start = Number(sourceStartStr);
        const end = Number(sourceEndStr);
        if (!isNaN(start) && !isNaN(end) && start < end) {
          movedItems = selections.splice(start, end - start);
        }
      }

      const closest = this.getClosestChip(e.clientX, e.clientY);
      if (closest.element && closest.box) {
        const targetStartStr = closest.element.dataset.start;
        let insertionIndex = targetStartStr !== undefined ? parseInt(targetStartStr, 10) : selections.length;
        if (e.clientX > closest.box.left + closest.box.width / 2) {
          const targetEndStr = closest.element.dataset.end;
          insertionIndex = targetEndStr !== undefined ? parseInt(targetEndStr, 10) : insertionIndex;
        }
        selections.splice(insertionIndex, 0, ...movedItems);
      } else {
        selections.push(...movedItems);
      }

      this.context.updateWidgetValue(selections);
    });
  }

  initBasketActions() {
    const { dom } = this.context;

    const copyBtn = dom.btnCopyBasket || this.container.querySelector(".j0n4t-pg-basket-copy-btn");
    if (copyBtn) {
      copyBtn.addEventListener("click", () => this.showCopyModal());
    }

    dom.btnClearBasket.addEventListener("click", async () => {
      if (this.context.getSelectedArray().length && await ModalUtils.confirm("Empty basket?")) {
        const pinned = this.context.getSelectedArray().filter(item => this.context.pinnedChips?.has(item));
        this.context.updateWidgetValue(pinned);
      }
    });

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
      const target = /** @type {HTMLElement} */ (e.target);
      const addBtn = target.closest('.j0n4t-pg-basket-add-btn');
      if (addBtn) return this.inlineEditorManager.spawn(null, "");

      if (target.closest("input")) return;

      const weightBadge = target.closest('.j0n4t-pg-basket-chip-weight');
      /** @type {HTMLElement | null} */ const chip = target.closest('.j0n4t-pg-basket-chip');

      if (chip) {
        e.stopPropagation();
        this.handleChipSelection(chip, e);
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
      const focusedChip = /** @type {HTMLElement | null} */ (target.closest(".j0n4t-pg-basket-chip"));

      if (!target.closest("input") && modifierKey && e.key.toLowerCase() === "c" &&
          (focusedChip || this.selectedChipIndexes.size > 0)) {
        e.preventDefault();
        e.stopPropagation();
        this.copySelectedChips(focusedChip);
        return;
      }
      if (!target.closest("input") && modifierKey && e.key.toLowerCase() === "v") {
        e.preventDefault();
        e.stopPropagation();
        this.pasteChips();
        return;
      }
      if (!target.closest("input") && focusedChip && modifierKey && e.key.toLowerCase() === "a") {
        e.preventDefault();
        e.stopPropagation();
        this.selectedChipIndexes = new Set(
          Array.from(this.basket.querySelectorAll(".j0n4t-pg-basket-chip"), chip =>
            Number(/** @type {HTMLElement} */ (chip).dataset.index)
          )
        );
        this.selectionAnchorIndex = Number(focusedChip.dataset.index);
        this.applyChipSelection(Number(focusedChip.dataset.index));
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
            this.selectionAnchorIndex ??= Number(focusedChip.dataset.index);
            this.selectChipRange(
              this.selectionAnchorIndex,
              Number(targetChip.dataset.index)
            );
          } else {
            this.handleChipSelection(targetChip, e);
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
        if (chip) {
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
          this.togglePin(chip);
        }
        return;
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
              const index = Number(/** @type {HTMLElement} */ (targetEl).dataset.index);
              this.selectedChipIndexes = new Set([index]);
              this.selectionAnchorIndex = index;
              this.applyChipSelection(index);
            }
          }
        }
      }

      if (e.altKey && ["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(e.key)) {
        /** @type {HTMLElement | null} */ const chip = target.closest('.j0n4t-pg-basket-chip');
        if (!chip) return;
        const chipElements = /** @type {HTMLElement[]} */(Array.from(this.basket.querySelectorAll('.j0n4t-pg-basket-chip')));
        const targetChip = /** @type {HTMLElement | null} */ (this.getSpatialTarget(chip, e.key, chipElements));

        if (targetChip) {
          e.stopPropagation();
          e.preventDefault();

          const startIndex = Number(chip.dataset.start);
          const endIndex = Number(chip.dataset.end);
          const targetStart = Number(targetChip.dataset.start);
          const targetEnd = Number(targetChip.dataset.end);

          const selections = this.context.getSelectedArray();
          const itemsToMove = selections.splice(startIndex, endIndex - startIndex);
          const moveLen = itemsToMove.length;

          let newStart = targetStart;
          if (targetStart > startIndex) {
            newStart = targetEnd - moveLen;
            selections.splice(newStart, 0, ...itemsToMove);
          } else {
            selections.splice(targetStart, 0, ...itemsToMove);
          }

          this.context.updateWidgetValue(selections);
          this.focusChip(newStart);
        }
      }
    });

    this.basket.addEventListener("dragstart", (e) => {
      const target = /** @type {HTMLElement} */ (e.target);
      /** @type {HTMLElement | null} */ const chip = target.closest(".j0n4t-pg-basket-chip");
      if (chip) {
        chip.classList.add("dragging");
        e.dataTransfer?.setData("text/plain", chip.dataset.id || "");
        e.dataTransfer?.setData("source/basket", "true");
        e.dataTransfer?.setData("source/basket_start", chip.dataset.start || "");
        e.dataTransfer?.setData("source/basket_end", chip.dataset.end || "");
      }
    });

    this.basket.addEventListener("dragend", () => {
      this.basket.querySelectorAll(".j0n4t-pg-basket-chip").forEach(c => c.classList.remove("dragging"));
      this.removeDropIndicator();
    });
  }

  removeDropIndicator() {
    this.dropIndicator?.remove();
    this.dropIndicator = null;
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
   * @param {number} clientX
   * @param {number} clientY
   */
  getClosestChip(clientX, clientY) {
    /** @type {{ distance: number, element: HTMLElement | null; box: DOMRect | null }} */
    const initialResult = { distance: Infinity, element: null, box: null };
    const chips = [...this.basket.querySelectorAll(".j0n4t-pg-basket-chip:not(.dragging)")];
    const result = chips.reduce((closest, el) => {
      const box = el.getBoundingClientRect();
      const dist = Math.hypot(
        clientX - (box.left + box.width / 2),
        clientY - (box.top + box.height / 2)
      );
      return dist < closest.distance
        ? { distance: dist, element: /** @type {HTMLElement} */ (el), box }
        : closest;
    }, initialResult);
    return result;
  }

  /**
   * @param {number} chipIndex
   * @param {string} [groupRaw]
   * @param {string} [gIndex]
   */
  reRollChipGroup(chipIndex, groupRaw, gIndex) {
    const activeList = this.context.getSelectedArray();
    const chipsData = PresetLogic.getGroupedChips(activeList, this.context.cache);
    const tracer = new PresetLogic.RollManager(this.context.rollManager.rolls);
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

  /** @param {number} [index] */
  applyChipSelection(index) {
    const chips = Array.from(this.basket.querySelectorAll(".j0n4t-pg-basket-chip"));
    chips.forEach((chip, chipIndex) => {
      const selected = this.selectedChipIndexes.has(chipIndex);
      chip.classList.toggle("selected", selected);
      chip.setAttribute("aria-selected", String(selected));
    });
    if (index !== undefined && index >= 0) {
      chips[index]?.focus();
    }
  }

  /**
   * @param {number} start
   * @param {number} end
   */
  selectChipRange(start, end) {
    this.selectedChipIndexes.clear();
    for (let index = Math.min(start, end); index <= Math.max(start, end); index++) {
      this.selectedChipIndexes.add(index);
    }
    this.applyChipSelection(end);
  }

  /**
   * @param {HTMLElement} chip
   * @param {MouseEvent | KeyboardEvent} event
   */
  handleChipSelection(chip, event) {
    const index = Number(chip.dataset.index);
    const multiSelect = event.ctrlKey || event.metaKey;
    if (event.shiftKey) {
      this.selectChipRange(this.selectionAnchorIndex ?? index, index);
    } else if (multiSelect) {
      if (this.selectedChipIndexes.has(index)) {
        this.selectedChipIndexes.delete(index);
      } else {
        this.selectedChipIndexes.add(index);
      }
      this.selectionAnchorIndex = index;
      this.applyChipSelection(index);
    } else {
      this.selectedChipIndexes.clear();
      this.selectedChipIndexes.add(index);
      this.selectionAnchorIndex = index;
      this.applyChipSelection(index);
    }
  }

  /** @param {HTMLElement} [focusedChip] */
  async copySelectedChips(focusedChip) {
    const activeList = this.context.getSelectedArray();
    const chipsData = PresetLogic.getGroupedChips(activeList, this.context.cache);
    let selectedIndexes = [...this.selectedChipIndexes].sort((a, b) => a - b);
    if (selectedIndexes.length === 0 && focusedChip) {
      selectedIndexes = [Number(focusedChip.dataset.index)];
    }
    if (selectedIndexes.length === 0) return;

    const selected = new Set(selectedIndexes);
    const tracer = new PresetLogic.RollManager(this.context.rollManager.rolls).resetCounts();
    /** @type {Array<{items: string[], styleKey: string, pinned: boolean, rolls: Record<string, Array<{offset: number, value: string}>>}>} */
    const copiedChips = [];

    chipsData.forEach((chipData, index) => {
      const beforeCounts = tracer.cloneCounts();
      PresetLogic.expandRecursively(chipData.styleKey, this.context.cache, new Set(), tracer);
      if (!selected.has(index)) return;

      const items = activeList.slice(chipData.startIndex, chipData.endIndex);
      const rawValue = items.join(", ");
      /** @type {Record<string, Array<{offset: number, value: string}>>} */
      const rolls = {};
      for (const [group, endCount] of Object.entries(tracer.counts)) {
        const startCount = beforeCounts[group] || 0;
        for (let rollIndex = startCount; rollIndex < endCount; rollIndex++) {
          const value = this.context.rollManager.peekRoll(group, rollIndex);
          if (value !== undefined) {
            (rolls[group] ||= []).push({ offset: rollIndex - startCount, value });
          }
        }
      }
      copiedChips.push({
        items,
        styleKey: chipData.styleKey,
        pinned: this.context.pinnedChips?.has(rawValue) || false,
        rolls
      });
    });

    const text = copiedChips.flatMap(chip => chip.items).join(", ");
    basketClipboard = { type: "comfy-preset-gallery-basket", version: 1, chips: copiedChips, text };

    try {
      if (navigator.clipboard?.write && typeof ClipboardItem !== "undefined") {
        const clipboardItem = new ClipboardItem({
          "text/plain": new Blob([text], { type: "text/plain" }),
          [BASKET_CLIPBOARD_TYPE]: new Blob([JSON.stringify(basketClipboard)], { type: "application/x-comfy-preset-gallery-basket+json" })
        });
        await navigator.clipboard.write([clipboardItem]);
      } else if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
      }
    } catch (error) {
      console.warn("Could not write basket chips to the clipboard", error);
      try {
        await navigator.clipboard?.writeText(text);
      } catch (fallbackError) {
        console.warn("Could not write basket text to the clipboard", fallbackError);
      }
    }
  }

  /** @param {unknown} value */
  isBasketClipboardPayload(value) {
    if (!value || typeof value !== "object") return false;
    const payload = /** @type {Record<string, unknown>} */ (value);
    return payload.type === "comfyui-preset-gallery-basket" &&
      payload.version === 1 &&
      Array.isArray(payload.chips) &&
      payload.chips.every(chip =>
        chip && typeof chip === "object" &&
        Array.isArray(chip.items) &&
        chip.items.length > 0 &&
        chip.items.every(item => typeof item === "string") &&
        typeof chip.styleKey === "string" &&
        typeof chip.pinned === "boolean" &&
        chip.rolls && typeof chip.rolls === "object" &&
        Object.values(chip.rolls).every(rolls =>
          Array.isArray(rolls) &&
          rolls.every(roll =>
            roll && Number.isInteger(roll.offset) && roll.offset >= 0 && typeof roll.value === "string"
          )
        )
      );
  }

  async readBasketClipboard() {
    let plainText = "";
    try {
      if (navigator.clipboard?.read) {
        const clipboardItems = await navigator.clipboard.read();
        for (const item of clipboardItems) {
          if (item.types.includes(BASKET_CLIPBOARD_TYPE)) {
            const data = await (await item.getType(BASKET_CLIPBOARD_TYPE)).text();
            const parsed = JSON.parse(data);
            if (this.isBasketClipboardPayload(parsed)) return parsed;
          }
          if (item.types.includes("text/plain")) {
            plainText = await (await item.getType("text/plain")).text();
          }
        }
      } else if (navigator.clipboard?.readText) {
        plainText = await navigator.clipboard.readText();
      }
    } catch (error) {
      console.warn("Could not read rich basket clipboard data", error);
    }
    if (!plainText && navigator.clipboard?.readText) {
      try {
        plainText = await navigator.clipboard.readText();
      } catch (error) {
        console.warn("Could not read plain basket clipboard text", error);
      }
    }

    if (basketClipboard && plainText === basketClipboard.text) return basketClipboard;
    if (!plainText && basketClipboard) return basketClipboard;
    const items = PresetLogic.splitPresets(plainText).filter(Boolean);
    return items.length
      ? { type: "comfyui-preset-gallery-basket", version: 1, chips: items.map(item => ({ items: [item], styleKey: item, pinned: false, rolls: {} })) }
      : null;
  }

  async pasteChips() {
    const payload = await this.readBasketClipboard();
    if (!payload || !Array.isArray(payload.chips) || payload.chips.length === 0) return;

    const activeList = this.context.getSelectedArray();
    const originalLength = activeList.length;
    const existingChips = PresetLogic.getGroupedChips(activeList, this.context.cache);
    const selections = [...activeList];
    for (const chip of payload.chips) selections.push(...chip.items);

    const tracer = new PresetLogic.RollManager(this.context.rollManager.rolls).resetCounts();
    existingChips.forEach(chip =>
      PresetLogic.expandRecursively(chip.styleKey, this.context.cache, new Set(), tracer)
    );
    payload.chips.forEach(chip => {
      const beforeCounts = tracer.cloneCounts();
      PresetLogic.expandRecursively(chip.styleKey, this.context.cache, new Set(), tracer);
      for (const [group, rolls] of Object.entries(chip.rolls || {})) {
        for (const roll of rolls) {
          tracer.rolls[`${group}_${(beforeCounts[group] || 0) + roll.offset}`] = roll.value;
        }
      }
      if (chip.pinned) this.context.pinnedChips?.add(chip.items.join(", "));
    });
    this.context.rollManager.rolls = tracer.rolls;
    this.context.updateWidgetValue(selections);
    this.context.savePins();

    const updatedChips = PresetLogic.getGroupedChips(selections, this.context.cache);
    const pastedIndexes = updatedChips
      .map((chip, index) => chip.startIndex >= originalLength ? index : -1)
      .filter(index => index >= 0);
    this.selectedChipIndexes = new Set(pastedIndexes);
    this.selectionAnchorIndex = pastedIndexes[0] ?? null;
    this.applyChipSelection(pastedIndexes[pastedIndexes.length - 1]);
    this.saveCurrentState();
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
    // Automatically synchronize state of the active tab
    if (this.activeTabId) {
      const tab = this.tabs.find(t => t.id === this.activeTabId);
      if (tab) {
        tab.basket = [...activeList];
        tab.pins = this.context.pinnedChips ? Array.from(this.context.pinnedChips) : [];
        tab.rolls = this.context.rollManager?.rolls ? JSON.parse(JSON.stringify(this.context.rollManager.rolls)) : {};
        this.persistTabs();
      }
    }

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
        this.context.rollManager
      );

      const rawItems = activeList.slice(chipData.startIndex, chipData.endIndex);
      const rawVal = rawItems.join(', ');
      const isPinned = this.context.pinnedChips?.has(rawVal);

      let labelContent = PresetDOM.escapeHTML(chip.processed.cleanLabel);
      if ((!chip.processed.chipData.item || chipData.styleKey.startsWith("_/combo")) && chip.processed.segmentedLabels) {
        labelContent = `<div class="j0n4t-pg-basket-chip-segments">` +
          chip.processed.segmentedLabels.filter(Boolean).map(p => `<span class="j0n4t-pg-basket-chip-segment">${PresetDOM.escapeHTML(p)}</span>`).join('') +
          `</div>`;
      }

      htmlBuffer += `
        <div class="j0n4t-pg-basket-chip ${isPinned ? 'pinned' : ''} ${this.selectedChipIndexes.has(index) ? 'selected' : ''}" tabindex="0" role="option" aria-selected="${this.selectedChipIndexes.has(index)}"
             draggable="true" 
             title="${PresetDOM.escapeHTML(chip.processed.tooltipTitle)}"
             data-id="${PresetDOM.escapeHTML(chip.processed.joinedStr)}"
             data-eval-id="${PresetDOM.escapeHTML(chip.processed.evalId)}"
             data-preset="${PresetDOM.escapeHTML(chip.processed.chipData.item?.preset || "")}"
             data-index="${index}"
             data-start="${chip.processed.chipData.startIndex}"
             data-end="${chip.processed.chipData.endIndex}"
             style='${chip.bgStyle}'>
            ${chip.weightIconHtml}
            <div class="j0n4t-pg-basket-chip-label" title="${PresetDOM.escapeHTML(chip.processed.chipExpanded || chip.processed.joinedStr)}">
                ${labelContent}
            </div>
            ${chip.inputHtml}
        </div>
      `;
    });

    htmlBuffer += `<div class="j0n4t-pg-basket-add-btn" tabindex="0" role="button" title="Add new preset or keyword" aria-label="Add new keyword">+ Add</div>`;
    this.basket.innerHTML = htmlBuffer;
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

  getCopyContent() {
    if (this.container.classList.contains("raw-mode")) {
      return this.textarea.value;
    }
    const selections = this.context.getSelectedArray();
    if (!selections || selections.length === 0) return "";
    const cache = this.context.cache || {};

    const items = selections.map((/** @type {string} */ key) => {
      const { core: coreKey, weightStr, isWeighted } = PresetLogic.parseWeight(key);
      const item = cache[coreKey];
      if (!item) return key;
      return isWeighted ? `(${coreKey}:${weightStr})` : coreKey;
    });

    return items.join(", ");
  }

  async showCopyModal() {
    const content = this.getCopyContent();
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(content).catch(() => { });
    }
    ModalUtils.show({
      title: "📋 Basket Contents",
      content: `<textarea readonly style="width: 100%; height: 120px; background: #1a1a1a; color: #fff; border: 1px solid #444; border-radius: 4px; padding: 6px; box-sizing: border-box; font-family: monospace; font-size: 11px; resize: vertical; margin: 8px 0;">${PresetDOM.escapeHTML(content)}</textarea>`,
      buttons: [
        {
          text: "Copy",
          className: "",
          isDefault: true,
          callback: () => {
            /** @type {HTMLTextAreaElement | null} */
            const textarea = document.querySelector(".j0n4t-pg-modal textarea");
            if (textarea) {
              textarea.select();
              navigator.clipboard.writeText(textarea.value);
              const copyBtn = document.querySelector(".j0n4t-pg-modal .j0n4t-pg-btn");
              if (copyBtn) {
                copyBtn.textContent = "Copied!";
                setTimeout(() => { copyBtn.textContent = "Copy"; }, 1500);
              }
            }
          }
        },
        { text: "Close", closeOnFinish: true }
      ]
    });
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
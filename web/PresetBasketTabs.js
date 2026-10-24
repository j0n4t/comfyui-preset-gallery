/**
 * The Basket's tab state: which tabs exist, which one is active, the snapshot
 * each one holds, and the one storage key they live under.
 *
 * No DOM, no rendering: the Basket draws the sidebar and forwards user actions
 * here. A tab is `{id, title, basket, pins, rolls}` - the selection it held plus
 * the pins and rolled choices that went with it - and installing one is the
 * app's `restoreTabSelection`, the same transition a user edit goes through.
 */

/**
 * Returns the browser localStorage, or null when there is none (e.g. under
 * `node --test`). Callers must tolerate a null storage.
 * @returns {Storage | null}
 */
function defaultStorage() {
  try {
    return typeof localStorage !== "undefined" ? localStorage : null;
  } catch {
    return null;
  }
}

export default class PresetBasketTabs {
  static STORAGE_KEY = "comfy_preset_gallery_basket_tabs";

  /**
   * @param {GalleryContext} context
   * @param {{ storage?: Storage | null }} [options]
   */
  constructor(context, { storage } = {}) {
    this.context = context;
    /** @type {Storage | null} */
    this.storage = storage === undefined ? defaultStorage() : storage;
    /** @type {BasketTab[]} */
    this.tabs = [];
    /** @type {string | null} */
    this.activeTabId = null;
  }

  /**
   * Restore the saved tabs, or start one from the live selection.
   *
   * This runs while the app is still being constructed, so the gallery's widget
   * callback is not attached yet: restoring here installs the active tab's
   * state but cannot render. `PresetGalleryApp.init()` syncs the views.
   * @returns {boolean} true when the tabs came from storage
   */
  load() {
    const saved = this.read();
    if (saved) {
      this.tabs = saved.tabs;
      this.activeTabId = saved.activeTabId;
      const active = this.active();
      if (active) this.context.restoreTabSelection(active);
      return true;
    }

    const tab = this.newTab({
      title: "Basket",
      basket: this.context.getSelectedArray(),
      pins: this.context.pinnedChips ? Array.from(this.context.pinnedChips) : [],
      rolls: this.context.rollManager?.rolls,
    });
    this.tabs = [tab];
    this.activeTabId = tab.id;
    this.persist();
    return false;
  }

  /** @returns {{ tabs: BasketTab[], activeTabId: string } | null} */
  read() {
    const raw = this.storage?.getItem(PresetBasketTabs.STORAGE_KEY);
    if (!raw) return null;
    try {
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed.tabs) || parsed.tabs.length === 0) return null;
      return {
        tabs: parsed.tabs,
        activeTabId:
          parsed.activeTabId && parsed.tabs.some((/** @type {BasketTab} */ t) => t.id === parsed.activeTabId)
            ? parsed.activeTabId
            : parsed.tabs[0].id,
      };
    } catch (e) {
      console.error("Failed to parse basket tabs from localStorage", e);
      return null;
    }
  }

  persist() {
    this.storage?.setItem(
      PresetBasketTabs.STORAGE_KEY,
      JSON.stringify({ tabs: this.tabs, activeTabId: this.activeTabId })
    );
  }

  /** @returns {BasketTab | null} */
  active() {
    return this.tabs.find((tab) => tab.id === this.activeTabId) || null;
  }

  /** @param {string | null} tabId @returns {BasketTab | null} */
  find(tabId) {
    return this.tabs.find((tab) => tab.id === tabId) || null;
  }

  /** @param {string | null} tabId */
  isActive(tabId) {
    return !!tabId && this.activeTabId === tabId;
  }

  /**
   * Copy the live selection, pins and rolls into a tab.
   * @param {BasketTab} tab
   * @param {string[]} [basket] - the selection to record, when the caller
   *   already has it (the Basket's render path does)
   */
  fill(tab, basket = this.context.getSelectedArray()) {
    tab.basket = [...basket];
    tab.pins = this.context.pinnedChips ? Array.from(this.context.pinnedChips) : [];
    tab.rolls = this.context.rollManager?.rolls
      ? JSON.parse(JSON.stringify(this.context.rollManager.rolls))
      : {};
  }

  /**
   * Snapshot the active tab from the live state.
   * @param {boolean} [skipPersist=false]
   */
  snapshot(skipPersist = false) {
    const tab = this.active();
    if (!tab) return;
    this.fill(tab);
    if (!skipPersist) this.persist();
  }

  /**
   * Snapshot the active tab with the selection the Basket just rendered. The
   * basket is the authority for that array, so this avoids re-reading the
   * widget mid-render.
   * @param {string[]} basket
   */
  snapshotList(basket) {
    const tab = this.active();
    if (!tab) return;
    this.fill(tab, basket);
    this.persist();
  }

  /**
   * Make a saved tab live: its pins and rolled choices, then its selection.
   * @param {BasketTab | null} tab
   */
  restore(tab) {
    if (!tab) return;
    this.context.restoreTabSelection(tab);
  }

  /**
   * @param {string} tabId
   * @returns {boolean} false when the tab is unknown or already active
   */
  switchTo(tabId) {
    if (!tabId || this.activeTabId === tabId) return false;
    // Snapshot the outgoing tab; one persist for the whole switch.
    this.snapshot(true);

    const tab = this.find(tabId);
    if (!tab) return false;

    this.activeTabId = tabId;
    this.restore(tab);
    this.persist();
    return true;
  }

  /**
   * @param {{ title?: string, basket?: string[], pins?: string[], rolls?: Record<string, string> }} [fields]
   * @returns {BasketTab}
   */
  newTab(fields = {}) {
    return {
      id: this.newId(),
      title: fields.title || this.nextTitle(),
      basket: [...(fields.basket || [])],
      pins: [...(fields.pins || [])],
      rolls: fields.rolls ? JSON.parse(JSON.stringify(fields.rolls)) : {},
    };
  }

  /** @returns {string} */
  nextTitle() {
    return `Basket ${this.tabs.length + 1}`;
  }

  /** @returns {string} an id no tab is using */
  newId() {
    /** @type {string} */
    let id;
    do {
      id = `tab_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    } while (this.tabs.some((tab) => tab.id === id));
    return id;
  }

  /**
   * Append a new, empty tab (or one holding `chips`) and switch to it.
   * @param {{ chips?: string[], title?: string }} [fields]
   * @returns {BasketTab}
   */
  create(fields = {}) {
    this.snapshot();
    const tab = this.newTab({ title: fields.title, basket: fields.chips || [] });
    this.tabs.push(tab);
    this.activeTabId = tab.id;
    this.restore(tab);
    this.persist();
    return tab;
  }

  /**
   * @param {string} tabId
   * @returns {BasketTab | null} the copy, which becomes active
   */
  duplicate(tabId) {
    this.snapshot();
    const source = this.find(tabId);
    if (!source) return null;

    const copy = {
      ...source,
      id: this.newId(),
      title: `${source.title || `Tab ${this.tabs.indexOf(source) + 1}`} Copy`,
      basket: [...(source.basket || [])],
      pins: [...(source.pins || [])],
      rolls: JSON.parse(JSON.stringify(source.rolls || {})),
    };
    this.tabs.push(copy);
    this.activeTabId = copy.id;
    this.restore(copy);
    this.persist();
    return copy;
  }

  /**
   * Remove a tab, falling back to its neighbour when it was the active one.
   * The last tab is never removed.
   * @param {string | null} tabId
   * @returns {boolean} true when a tab was removed
   */
  remove(tabId) {
    if (this.tabs.length <= 1) return false;
    const index = this.tabs.findIndex((tab) => tab.id === tabId);
    if (index === -1) return false;

    this.tabs.splice(index, 1);

    if (this.activeTabId !== tabId) {
      this.persist();
      return true;
    }

    const next = this.tabs[Math.max(0, index - 1)];
    this.activeTabId = null;
    this.switchTo(next.id);
    return true;
  }

  /**
   * Append chips to an existing tab. The active tab's selection is written
   * through the app, so the render follows the same path as an edit.
   * @param {string} tabId
   * @param {string[]} chips
   */
  appendChips(tabId, chips) {
    if (!Array.isArray(chips) || chips.length === 0) return false;
    const tab = this.find(tabId);
    if (!tab) return false;

    tab.basket = [...(tab.basket || []), ...chips];
    if (this.activeTabId === tabId) this.context.updateWidgetValue(tab.basket);
    this.persist();
    return true;
  }

  /** @param {string} title */
  rename(title) {
    const tab = this.active();
    if (!tab) return false;
    tab.title = title;
    this.persist();
    return true;
  }

  /**
   * Add imported tabs to the end of the list. The active tab is left alone.
   * @param {Array<{ title?: string, basket?: string[] | string, pins?: string[] | string, rolls?: Record<string, string> }>} incoming
   * @returns {number} how many were added
   */
  insertMany(incoming) {
    if (!Array.isArray(incoming) || incoming.length === 0) return 0;
    const asList = (/** @type {string[] | string | undefined} */ value) => {
      if (Array.isArray(value)) return value.join(", ").split(",").map((s) => s.trim()).filter(Boolean);
      return value ? value.split(",").map((s) => s.trim()).filter(Boolean) : [];
    };

    for (const tab of incoming) {
      this.tabs.push({
        id: this.newId(),
        title: tab.title || "Imported Tab",
        basket: asList(tab.basket),
        pins: asList(tab.pins),
        rolls: tab.rolls && typeof tab.rolls === "object" ? tab.rolls : {},
      });
    }
    this.persist();
    return incoming.length;
  }
}

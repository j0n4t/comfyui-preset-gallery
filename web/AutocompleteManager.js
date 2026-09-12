import PresetDOM from "./PresetDOM.js";

/**
 * @typedef {Object} AutocompleteMatch
 * @property {any} item The underlying data payload for the match item.
 * @property {string} [title] Optional tooltip text to show on hover.
 */

/**
 * @typedef {Object} KeyDownContext
 * @property {AutocompleteMatch} activeMatch The currently selected autocomplete match.
 * @property {AutocompleteManager} manager The manager instance.
 */

/**
 * @typedef {Object} AutocompleteOptions
 * @property {HTMLInputElement | HTMLTextAreaElement} input Target input or textarea element.
 * @property {HTMLElement} [container=document.body] Container element to attach the popup to.
 * @property {string} [popupClass="j0n4t-pg-autocomplete-popup"] CSS class name for the popup element.
 * @property {string} [itemClass="j0n4t-pg-autocomplete-item"] CSS class name for individual popup items.
 * @property {(query: string, cursor: number | undefined) => AutocompleteMatch[]} getMatches Evaluates text and returns match array.
 * @property {(item: any) => string} renderItem Generates inner HTML string for a match item.
 * @property {(item: any, event: MouseEvent | KeyboardEvent) => boolean | void} onSelect Callback when an item is selected. Return `true` to keep popup open.
 * @property {(event: KeyboardEvent, context: KeyDownContext) => boolean | void} [onKeyDown] Custom keydown handler. Return `true` to intercept and close popup.
 * @property {() => void} [onBlur] Callback fired when input loses focus.
 */

export default class AutocompleteManager {
  /** @type {string} */
  static AUTOCOMPLETE_POPUP_STYLES = /*css*/ `
    .j0n4t-pg-autocomplete-popup, .j0n4t-pg-filter-autocomplete-popup { position: absolute; background: #1f1f1fe8; border: 1px solid #007acc; border-radius: 4px; box-shadow: 0 4px 12px rgba(0,0,0,0.5); display: flex; overflow-y: auto; overflow-x: hidden; font-family: sans-serif; box-sizing: border-box; max-height: 250px; width: max-content; }
    .j0n4t-pg-autocomplete-popup, .j0n4t-pg-filter-autocomplete-popup { flex-direction: column; }
    .j0n4t-pg-autocomplete-popup { z-index: 9999; max-width: 280px; }
    .j0n4t-pg-filter-autocomplete-popup { z-index: 10001; }
    .j0n4t-pg-autocomplete-item, .j0n4t-pg-filter-autocomplete-item { padding: 2px 5px; font-size: 9px; color: #ddd; cursor: pointer; border-bottom: 1px solid #333; display: flex; justify-content: space-between; align-items: center; gap: 12px; }
    .j0n4t-pg-autocomplete-item:last-child, .j0n4t-pg-filter-autocomplete-item:last-child { border-bottom: none; }
    .j0n4t-pg-autocomplete-item.active, .j0n4t-pg-filter-autocomplete-item.active { background: #007acc; color: #fff; }
    .j0n4t-pg-autocomplete-meta, .j0n4t-pg-filter-autocomplete-meta { font-size: 9px; color: #888; font-style: italic; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; text-align: right; }
    .j0n4t-pg-autocomplete-item.active .j0n4t-pg-autocomplete-meta, .j0n4t-pg-filter-autocomplete-item.active .j0n4t-pg-filter-autocomplete-meta { color: #bee3ff; }
  `;

  /** @type {string} */
  static FOLDER_AUTOCOMPLETE_STYLES = /*css*/ `
    .j0n4t-pg-folder-autocomplete-popup { position: absolute; background: #1f1f1fe8; border: 1px solid #007acc; border-radius: 4px; box-shadow: 0 4px 12px rgba(0,0,0,0.5); z-index: 10000; display: flex; flex-direction: column; width: max-content; overflow: hidden; font-family: sans-serif; box-sizing: border-box; }
    .j0n4t-pg-folder-autocomplete-item { padding: 6px 10px; font-size: 11px; color: #ddd; cursor: pointer; border-bottom: 1px solid #333; }
    .j0n4t-pg-folder-autocomplete-item:last-child { border-bottom: none; }
    .j0n4t-pg-folder-autocomplete-item.active { background: #007acc; color: #fff; }
  `;

  /**
   * @param {AutocompleteOptions} options
   */
  constructor({
    input,
    container,
    popupClass = "j0n4t-pg-autocomplete-popup",
    itemClass = "j0n4t-pg-autocomplete-item",
    getMatches,
    renderItem,
    onSelect,
    onKeyDown,
    onBlur,
  }) {
    /** @type {HTMLInputElement | HTMLTextAreaElement} */
    this.input = input;
    /** @type {HTMLElement} */
    this.container = container || document.body;
    /** @type {string} */
    this.popupClass = popupClass;
    /** @type {string} */
    this.itemClass = itemClass;
    /** @type {(query: string, cursor: number | undefined) => AutocompleteMatch[]} */
    this.getMatches = getMatches;
    /** @type {(item: any) => string} */
    this.renderItem = renderItem;
    /** @type {(item: any, event: MouseEvent | KeyboardEvent) => boolean | void} */
    this.onSelect = onSelect;
    /** @type {((event: KeyboardEvent, context: KeyDownContext) => boolean | void) | undefined} */
    this.onKeyDown = onKeyDown;
    /** @type {(() => void) | undefined} */
    this.onBlur = onBlur;

    /** @type {HTMLElement | null} */
    this.popupEl = null;
    /** @type {AutocompleteMatch[]} */
    this.matches = [];
    /** @type {number} */
    this.activeIndex = 0;

    PresetDOM.injectStyles("j0n4t-pg-autocomplete-popup-styles", AutocompleteManager.AUTOCOMPLETE_POPUP_STYLES);
    PresetDOM.injectStyles("j0n4t-pg-folder-autocomplete-styles", AutocompleteManager.FOLDER_AUTOCOMPLETE_STYLES);

    this.initEvents();
  }

  /**
   * Indicates whether the autocomplete popup is open.
   * @type {boolean}
   */
  get isOpen() {
    return !!this.popupEl;
  }

  /**
   * Binds event listeners to the input element.
   * @returns {void}
   */
  initEvents() {
    this.input.addEventListener("input", () => this.evaluate());
    this.input.addEventListener("click", () => this.close());
    this.input.addEventListener("blur", () => {
      if (this.onBlur) this.onBlur();
      setTimeout(() => this.close(), 200);
    });
    /** @type {HTMLElement} */ (this.input).addEventListener("keydown", (e) => this.handleKeydown(e));
  }

  /**
   * Evaluates input text and cursor position to update matches and trigger rendering.
   * @returns {void}
   */
  evaluate() {
    const query = this.input.value;
    const cursor = this.input.selectionStart;

    this.matches = this.getMatches(query, cursor || undefined) || [];

    if (!this.matches.length) {
      this.close();
      return;
    }

    this.activeIndex = 0;
    this.renderPopup();
  }

  /**
   * Renders the popup DOM node and places it relative to the input and viewport space.
   * @returns {void}
   */
  renderPopup() {
    if (!this.popupEl) {
      this.popupEl = Object.assign(document.createElement("div"), {
        className: this.popupClass,
      });
      this.popupEl.addEventListener("mousedown", (e) => e.stopPropagation());
      this.container.appendChild(this.popupEl);
    }

    this.popupEl.innerHTML = "";
    this.matches.forEach(({ item, title }, idx) => {
      const row = document.createElement("div");
      row.className = `${this.itemClass}${idx === this.activeIndex ? " active" : ""}`;
      if (title) row.title = title;
      row.innerHTML = this.renderItem(item);

      row.addEventListener("mousedown", (e) => {
        e.preventDefault();
        e.stopPropagation();
        const keepOpen = this.onSelect(item, e);
        if (!keepOpen) this.close();
      });
      this.popupEl?.appendChild(row);
    });

    const rect = this.input.getBoundingClientRect();
    const cRect = this.container.getBoundingClientRect();
    const zoom = cRect.width / this.container.offsetWidth || 1;
    const isBody = this.container === document.body;

    const popupHeight = this.popupEl.offsetHeight;
    const viewportHeight = window.innerHeight;

    const spaceBelow = viewportHeight - rect.bottom;
    const spaceAbove = rect.top;
    const renderOnTop = spaceAbove >= popupHeight || spaceAbove > spaceBelow;

    let top;
    if (isBody) {
      top = renderOnTop
        ? window.scrollY + rect.top - popupHeight - 2
        : window.scrollY + rect.bottom + 2;
    } else {
      top = renderOnTop
        ? (rect.top - cRect.top) / zoom - popupHeight - 2
        : (rect.bottom - cRect.top) / zoom + 2;
    }

    const left = isBody
      ? window.scrollX + rect.left
      : (rect.left - cRect.left) / zoom;

    this.popupEl.style.top = `${top}px`;
    this.popupEl.style.left = `${left}px`;
  }

  /**
   * Updates CSS active state class for popup items based on `activeIndex`.
   * @returns {void}
   */
  highlight() {
    if (!this.popupEl) return;
    this.popupEl
      .querySelectorAll(`.${this.itemClass.split(" ")[0]}`)
      .forEach((item, i) => {
        item.classList.toggle("active", i === this.activeIndex);
      });
  }

  /**
   * Handles keyboard interactions when navigating popup matches or selecting options.
   * @param {KeyboardEvent} e
   * @returns {void}
   */
  handleKeydown(e) {
    const activeMatch = this.matches[this.activeIndex];

    if (this.onKeyDown && this.onKeyDown(e, { activeMatch, manager: this })) {
      if (this.isOpen) this.close();
      return;
    }

    if (!this.isOpen || !this.matches.length) return;

    if (["Tab", "Enter"].includes(e.key) && !e.ctrlKey) {
      e.preventDefault();
      const keepOpen = this.onSelect(activeMatch.item, e);
      if (!keepOpen) this.close();
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      this.activeIndex = (this.activeIndex + 1) % this.matches.length;
      this.highlight();
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      this.activeIndex =
        (this.activeIndex - 1 + this.matches.length) % this.matches.length;
      this.highlight();
    } else if (e.key === "Escape") {
      e.preventDefault();
      e.stopPropagation();
      this.close();
    }
  }

  /**
   * Removes the popup DOM element and resets internal match states.
   * @returns {void}
   */
  close() {
    this.popupEl?.remove();
    this.popupEl = null;
    this.matches = [];
  }
}
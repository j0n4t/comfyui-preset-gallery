import ModalUtils from "./ModalUtils.js";
import PresetDOM from "./PresetDOM.js";
import PresetGalleryAPI from "./PresetGalleryAPI.js";
import {
  STORAGE_KEYS,
  defaultStorage,
  readJson,
  writeJson,
} from "./GalleryStorage.js";

/**
 * Height modes offered in the Display tab, mirrored onto `data-height-mode` on
 * the wrap. "fit" caps the gallery viewport at the node's own size in graph
 * mode and at the app panel in app mode; "fixed" caps it at `heightFixed`;
 * "unlimited" leaves it uncapped so the gallery grows with the preset library.
 * Kept in sync with PresetGalleryApp.HEIGHT_STYLES.
 */
const HEIGHT_MODES = /** @type {GalleryHeightMode[]} */ ([
  "fit",
  "fixed",
  "unlimited",
]);
const DEFAULT_HEIGHT_MODE = /** @type {GalleryHeightMode} */ ("fit");
const DEFAULT_HEIGHT_FIXED = 640;

/**
 * Validates a stored or submitted height mode, falling back to the default.
 * The cast is the narrowing step: `includes` is what actually validates.
 * @param {unknown} value
 */
function toHeightMode(value) {
  const mode = /** @type {GalleryHeightMode} */ (value);
  return HEIGHT_MODES.includes(mode) ? mode : DEFAULT_HEIGHT_MODE;
}

/**
 * A stored panel size map, keeping only usable positive numbers. Sizes come
 * back from localStorage as whatever was written, so anything else is dropped
 * rather than applied as an invalid inline height.
 * @param {unknown} value
 * @returns {GalleryPanelSizes}
 */
function toPanelSizes(value) {
  /** @type {GalleryPanelSizes} */
  const sizes = {};
  const source = /** @type {Record<string, unknown>} */ (value ?? {});
  for (const key of /** @type {const} */ (["basket", "editor"])) {
    const size = Number(source[key]);
    if (Number.isFinite(size) && size > 0) sizes[key] = Math.round(size);
  }
  return sizes;
}

/**
 * A stored fixed height, falling back to the default when it is missing or
 * unusable. An emptied number input reads back as "" (Number("") === 0), which
 * is not a height.
 * @param {unknown} value
 */
function toFixedHeight(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0
    ? Math.round(parsed)
    : DEFAULT_HEIGHT_FIXED;
}

/**
 * The stored enabled-library list, keeping only non-empty ids and always
 * starting with the bundled library. Anything else in storage - a single id
 * from before the multi-library change, or a corrupt value - falls back to it.
 * @param {unknown} value
 * @returns {string[]}
 */
function toIdList(value) {
  if (!Array.isArray(value)) return [];
  return value.filter((id) => typeof id === "string" && id);
}

export default class PresetGallerySettings {
  static STYLES = /*css*/ `
    .j0n4t-pg-tab-nav { display: flex ; gap: 4px ; border-bottom: 1px solid #444 ; margin-bottom: 12px; }
    .j0n4t-pg-tab-btn { padding: 6px 14px ; background: transparent ; border: none ; border-bottom: 2px solid transparent ; color: #888 ; cursor: pointer ; font-weight: 600 ; font-size: 12px ; transition: all 0.2s ease; }
    .j0n4t-pg-tab-btn:hover { color: #ddd; }
    .j0n4t-pg-tab-btn.active { border-bottom-color: #007acc ; color: #fff; }
    .j0n4t-pg-tab-panel { display: none; }
    .j0n4t-pg-tab-panel.active { display: flex ; flex-direction: column ; gap: 10px; }
    .j0n4t-pg-shortcuts-grid { display: grid ; grid-template-columns: 1fr 1fr; gap: 12px ; font-size: 11px; }
    .j0n4t-pg-shortcut-group { background: #1a1a1a ; border: 1px solid #333 ; border-radius: 4px ; padding: 8px 10px; }
    .j0n4t-pg-shortcut-group h4 { margin: 0 0 6px 0 ; color: #007acc ; font-size: 11px ; text-transform: uppercase ; letter-spacing: 0.5px; }
    .j0n4t-pg-shortcut-row { display: flex ; justify-content: space-between ; align-items: center ; padding: 4px 0 ; border-bottom: 1px dashed #2a2a2a ; color: #ccc; }
    .j0n4t-pg-shortcut-row:last-child { border-bottom: none; }
    .j0n4t-pg-kbd { background: #2d2d2d ; border: 1px solid #4f4f4f ; border-radius: 3px ; padding: 1px 5px ; color: #eee ; font-family: monospace ; font-size: 10px ; box-shadow: 0 1px 1px rgba(0,0,0,0.4); }

    /* Preset library list */
    .j0n4t-pg-library-list { display: flex ; flex-direction: column ; gap: 2px ; max-height: 180px ; overflow-y: auto ; }
    .j0n4t-pg-library-row { display: flex ; align-items: center ; gap: 6px ; padding: 3px 4px ; background: #161616 ; border: 1px solid #333 ; border-radius: 3px ; font-size: 11px ; }
    .j0n4t-pg-library-row input { width: auto ; margin: 0 ; cursor: pointer ; }
    .j0n4t-pg-library-row input:disabled { cursor: not-allowed ; opacity: 0.5 ; }
    .j0n4t-pg-library-name { flex: 1 ; overflow: hidden ; text-overflow: ellipsis ; white-space: nowrap ; color: #ccc ; }
    .j0n4t-pg-lib-move { display: flex ; gap: 2px ; }
    .j0n4t-pg-lib-move button { background: #2a2a2a ; border: 1px solid #444 ; color: #bbb ; border-radius: 2px ; width: 16px ; height: 16px ; font-size: 8px ; line-height: 1 ; cursor: pointer ; padding: 0 ; }
    .j0n4t-pg-lib-move button:hover, .j0n4t-pg-lib-move button:focus { background: #007acc ; color: #fff ; border-color: #007acc ; }

    /* Auto-Roll Dice Visual Indicators */
    .j0n4t-pg-basket-reroll-btn.roll-overwrite { color: #ff4a4a; filter: drop-shadow(0 0 3px rgba(255,74,74,0.6)); }
    .j0n4t-pg-basket-reroll-btn.roll-variants { color: #00b5b5; filter: drop-shadow(0 0 3px rgba(74,158,255,0.6)); }
    .j0n4t-pg-basket-reroll-btn.auto-roll { border: 1px dashed; border-radius: 50%; }
    .j0n4t-pg-basket-reroll-btn.auto-roll-seed { border: 1px dotted; border-radius: 50%; }
    .j0n4t-pg-basket-reroll-btn.auto-roll.auto-roll-seed { border-style: solid; }
    
    @media (max-width: 512px) {
      .j0n4t-pg-shortcuts-grid { grid-template-columns: 1fr; }
    }
  `;

  /** @param {GalleryContext} context  */
  constructor(context) {
    this.context = context;
    /** @type {Array<{ id: string, name: string, default: boolean }>} */
    this.libraries = [];
    /** The modal the library list is rendered into, kept for re-rendering. */
    /** @type {HTMLDivElement | null} */
    this.modal = null;
    /**
     * Libraries the user switched off. Empty means everything the server serves
     * is in the merge - the default - so a library dropped into the folder joins
     * without being ticked first.
     * @type {string[]}
     */
    this.disabledLibraries = [];
    /**
     * The priority order the user chose. Empty means the server's own order.
     * @type {string[]}
     */
    this.libraryOrder = [];
    this.load();
    this.applyHeightMode();
    this.applyPanelSizes();
    PresetDOM.injectStyles(
      "j0n4t-pg-settings-styles",
      PresetGallerySettings.STYLES,
    );

    // Defer visual update slightly to ensure the main app has finished generating the DOM elements
    setTimeout(() => this.updateDiceVisuals(), 0);
  }

  /**
   * The values a missing, unparseable or wrong-typed settings blob falls back
   * to. Each field is listed once: the defaults used to be repeated in the
   * catch block, so a new field meant editing two lists and the two drifting.
   */
  applyDefaults() {
    this.rollMin = 10;
    this.rollMax = 20;
    this.rollOnGeneration = false;
    this.rollOnSeedChange = false;
    this.diceBehavior = "variants";
    this.heightMode = DEFAULT_HEIGHT_MODE;
    this.heightFixed = DEFAULT_HEIGHT_FIXED;
    this.rememberPanelSizes = false;
    this.panelSizes = /** @type {GalleryPanelSizes} */ ({});
    this.qualifyChips = true;
    this.showChipLibraryBadges = true;
    this.showGridLibraryBadges = true;
    this.disabledLibraries = [];
    this.libraryOrder = [];
  }

  load() {
    // The boundary parses the value and swallows a corrupt one. A valid JSON
    // that is not an object - `null`, a bare string - still has to fall back,
    // because every field below reads a property off it.
    const saved = readJson(STORAGE_KEYS.settings, {}, defaultStorage());
    if (!saved || typeof saved !== "object" || Array.isArray(saved)) {
      this.applyDefaults();
      return;
    }
    this.rollMin = saved.rollMin !== undefined ? saved.rollMin : 10;
    this.rollMax = saved.rollMax !== undefined ? saved.rollMax : 20;
    this.rollOnGeneration =
      saved.rollOnGeneration !== undefined ? saved.rollOnGeneration : false;
    this.rollOnSeedChange =
      saved.rollOnSeedChange !== undefined ? saved.rollOnSeedChange : false;
    this.diceBehavior = saved.diceBehavior || "variants";
    this.heightMode = toHeightMode(saved.heightMode);
    this.heightFixed = toFixedHeight(saved.heightFixed);
    this.rememberPanelSizes = saved.rememberPanelSizes === true;
    this.panelSizes = toPanelSizes(saved.panelSizes);
    this.qualifyChips = saved.qualifyChips !== false;
    this.showChipLibraryBadges = saved.showChipLibraryBadges !== false;
    this.showGridLibraryBadges = saved.showGridLibraryBadges !== false;
    this.disabledLibraries = toIdList(saved.disabledLibraries);
    this.libraryOrder = toIdList(saved.libraryOrder);
  }

  save() {
    const data = {
      rollMin: this.rollMin,
      rollMax: this.rollMax,
      rollOnGeneration: this.rollOnGeneration,
      rollOnSeedChange: this.rollOnSeedChange,
      diceBehavior: this.diceBehavior,
      heightMode: this.heightMode,
      heightFixed: this.heightFixed,
      rememberPanelSizes: this.rememberPanelSizes,
      panelSizes: this.panelSizes,
      qualifyChips: this.qualifyChips,
      showChipLibraryBadges: this.showChipLibraryBadges,
      showGridLibraryBadges: this.showGridLibraryBadges,
      disabledLibraries: this.disabledLibraries,
      libraryOrder: this.libraryOrder,
    };
    writeJson(STORAGE_KEYS.settings, data, defaultStorage());
  }

  /**
   * Mirrors the height preference onto this gallery's element. The modes are
   * ceilings on the gallery viewport, so the grid scrolls inside it instead of
   * growing the node (graph mode) or the app panel to the full height of the
   * preset library. The rules that read these live in
   * PresetGalleryApp.HEIGHT_STYLES.
   */
  applyHeightMode() {
    const wrap = this.context.dom?.wrap;
    if (!wrap) return;
    wrap.dataset.heightMode = this.heightMode;
    wrap.style.setProperty("--pg-fixed-height", `${this.heightFixed}px`);
  }

  /**
   * Restores the panel sizes the user dragged, when they asked for them to be
   * remembered. The basket container and the editor's keyword box are the only
   * resizable elements inside the gallery, and both are plain inline heights -
   * the same thing the browser writes while dragging the handle.
   */
  applyPanelSizes() {
    const dom = this.context.dom;
    if (!dom) return;
    const sizes = /** @type {GalleryPanelSizes} */ (
      this.rememberPanelSizes ? this.panelSizes : {}
    );
    dom.basketContainer.style.height = sizes.basket ? `${sizes.basket}px` : "";
    dom.inpPreset.style.height = sizes.editor ? `${sizes.editor}px` : "";
  }

  /**
   * The libraries to merge, in priority order.
   *
   * Everything the server serves is enabled unless the user switched it off,
   * so a library dropped into the folder joins the merge by itself. The order
   * is `libraryOrder` when the user chose one and the server's own order
   * otherwise - the bundled library is first in both.
   *
   * @returns {string[]}
   */
  enabledIds() {
    const served = (this.libraries || []).map((lib) => lib.id);
    const order = this.libraryOrder.filter((id) => served.includes(id));
    for (const id of served) {
      if (!order.includes(id)) order.push(id);
    }
    return order.filter((id) => !this.disabledLibraries.includes(id));
  }

  /** @param {string} id */
  isLibraryEnabled(id) {
    return !this.disabledLibraries.includes(id);
  }

  /**
   * Fill the library list from what the server serves. The list is not in the
   * template because it is not known until the server is asked.
   *
   * Rows follow `enabledIds()` - the priority order, disabled ones at the end.
   *
   * Existing rows are reused rather than rebuilt: the list re-renders from
   * inside the very click that toggles or moves a row, and replacing that
   * element mid-dispatch makes the browser deliver the click a second time -
   * which toggles the library straight back off.
   *
   * @param {HTMLDivElement | null} modal
   */
  syncLibraryList(modal) {
    const container = modal?.querySelector("#j0n4t-pg-library-list");
    if (!container) return;
    const enabled = this.enabledIds();
    const byId = new Map((this.libraries || []).map((lib) => [lib.id, lib]));
    const orderedIds = /** @type {string[]} */ ([
      ...enabled,
      ...(this.libraries || [])
        .map((lib) => lib.id)
        .filter((id) => !enabled.includes(id)),
    ]);

    /** @type {Map<string, HTMLElement>} */
    const rows = new Map();
    container.querySelectorAll(".j0n4t-pg-library-row").forEach((row) => {
      const id = /** @type {HTMLElement} */ (row).dataset.id || "";
      if (id) rows.set(id, /** @type {HTMLElement} */ (row));
    });

    for (const id of orderedIds) {
      const lib = byId.get(id);
      if (!lib) continue;
      const isMain = id === PresetGalleryAPI.DEFAULT_LIBRARY_ID;
      let row = rows.get(id);
      if (!row) {
        row = document.createElement("div");
        row.className = "j0n4t-pg-library-row";
        row.dataset.id = id;
        row.innerHTML = `
          <input type="checkbox" data-role="enabled" aria-label="Enable ${PresetDOM.escapeHTML(lib.name)}" />
          <span class="j0n4t-pg-library-name">${PresetDOM.escapeHTML(lib.name)}</span>
          <span class="j0n4t-pg-lib-move">
            <button type="button" data-role="up" title="Move up - higher priority" aria-label="Move ${PresetDOM.escapeHTML(lib.name)} up">▲</button>
            <button type="button" data-role="down" title="Move down - lower priority" aria-label="Move ${PresetDOM.escapeHTML(lib.name)} down">▼</button>
          </span>`;
      }
      const box = /** @type {HTMLInputElement | null} */ (
        row.querySelector("input[data-role='enabled']")
      );
      if (box) {
        box.checked = enabled.includes(id);
        box.disabled = isMain;
      }
      // appendChild moves an existing row and inserts a new one
      container.appendChild(row);
    }

    // a library the server stopped serving must not leave a row behind
    for (const [id, row] of rows) {
      if (!orderedIds.includes(id)) row.remove();
    }
  }

  /**
   * Merge another set of libraries into every gallery. The set is global, so
   * this is the one Display option that takes effect outside the modal it was
   * picked in - the grid reloads for every open instance.
   * @param {string[]} ids priority order; the first one wins a shared key
   */
  applyLibraries(ids) {
    // record the order that was actually merged, so a reload reproduces it
    this.libraryOrder = [...ids];
    this.save();
    this.context.applyLibraries(ids);
  }

  /** @param {string} id */
  toggleLibrary(id) {
    const disabled = this.isLibraryEnabled(id)
      ? [...this.disabledLibraries, id]
      : this.disabledLibraries.filter((lib) => lib !== id);
    this.disabledLibraries = disabled;
    this.syncLibraryList(this.modal);
    this.applyLibraries(this.enabledIds());
  }

  /**
   * Move a library one slot along the priority order and re-apply. The first
   * library in the list wins a key another one also has.
   * @param {string} id
   * @param {number} delta -1 moves up, +1 moves down
   */
  moveLibrary(id, delta) {
    const order = this.enabledIds();
    const at = order.indexOf(id);
    if (at === -1) return;
    const to = Math.min(Math.max(at + delta, 0), order.length - 1);
    if (to === at) return;
    order.splice(at, 1);
    order.splice(to, 0, id);
    this.libraryOrder = order;
    this.syncLibraryList(this.modal);
    this.applyLibraries(order);
  }

  updateDiceVisuals() {
    const diceBtn = document.querySelector(".j0n4t-pg-basket-reroll-btn");
    if (!diceBtn) return;
    diceBtn.classList.remove(
      "roll-overwrite",
      "roll-variants",
      "auto-roll",
      "auto-roll-seed",
    );
    const modeClass =
      this.diceBehavior === "overwrite" ? "roll-overwrite" : "roll-variants";
    diceBtn.classList.add(modeClass);
    if (this.rollOnGeneration) {
      diceBtn.classList.add("auto-roll");
    }
    if (this.rollOnSeedChange) {
      diceBtn.classList.add("auto-roll-seed");
    }
  }

  async openModal() {
    /** @type {HTMLInputElement | null} */
    let minInput;
    /** @type {HTMLInputElement | null} */
    let maxInput;
    /** @type {HTMLInputElement | null} */
    let genCheck;
    /** @type {HTMLInputElement | null} */
    let seedCheck;
    /** @type {HTMLInputElement | null} */
    let diceSelect;
    /** @type {HTMLSelectElement | null} */
    let heightModeSelect;
    /** @type {HTMLInputElement | null} */
    let heightFixedInput;
    /** @type {HTMLDivElement | null} */
    let heightFixedField;
    /** @type {HTMLInputElement | null} */
    let rememberPanelsCheck;
    /** @type {HTMLInputElement | null} */
    let qualifyChipsCheck;
    /** @type {HTMLInputElement | null} */
    let showChipLibraryBadgesCheck;
    /** @type {HTMLInputElement | null} */
    let showGridLibraryBadgesCheck;

    const content = `
      <div class="j0n4t-pg-tab-nav">
        <button type="button" class="j0n4t-pg-tab-btn active" data-tab="settings">Rolling Options</button>
        <button type="button" class="j0n4t-pg-tab-btn" data-tab="display">Display</button>
        <button type="button" class="j0n4t-pg-tab-btn" data-tab="shortcuts">Keyboard Shortcuts</button>
      </div>

      <div id="j0n4t-pg-tab-settings" class="j0n4t-pg-tab-panel active">
        <div class="j0n4t-pg-modal-field">
          <label>Basket Dice Roll Main Behavior</label>
          <select id="j0n4t-pg-dice-behavior">
            <option value="variants" ${this.diceBehavior === "variants" ? "selected" : ""}>Re-roll Variants Only</option>
            <option value="overwrite" ${this.diceBehavior === "overwrite" ? "selected" : ""}>Overwrite with New Presets</option>
          </select>
        </div>

        <div class="j0n4t-pg-modal-field">
          <label>Preset Count Range for Rolling</label>
          <div style="display: flex; gap: 8px; align-items: center;">
            <input type="number" id="j0n4t-pg-roll-min" value="${this.rollMin}" min="1" max="100" style="width: 80px;" placeholder="Min" />
            <span style="color: #aaa;">to</span>
            <input type="number" id="j0n4t-pg-roll-max" value="${this.rollMax}" min="1" max="200" style="width: 80px;" placeholder="Max" />
          </div>
        </div>

        <div class="j0n4t-pg-modal-field">
          <label class="j0n4t-pg-checkbox-wrap" style="height: auto; cursor: pointer; display: flex; align-items: center; gap: 6px;">
            <input type="checkbox" id="j0n4t-pg-roll-on-gen" ${this.rollOnGeneration ? "checked" : ""} />
            Dice roll on each generation run
          </label>
        </div>

        <div class="j0n4t-pg-modal-field">
          <label class="j0n4t-pg-checkbox-wrap" style="height: auto; cursor: pointer; display: flex; align-items: center; gap: 6px;">
            <input type="checkbox" id="j0n4t-pg-roll-on-seed" ${this.rollOnSeedChange ? "checked" : ""} />
            Dice roll on generation seed changes
          </label>
        </div>
      </div>

      <div id="j0n4t-pg-tab-display" class="j0n4t-pg-tab-panel">
        <div class="j0n4t-pg-modal-field">
          <label>Preset Libraries</label>
          <div id="j0n4t-pg-library-list" class="j0n4t-pg-library-list"></div>
          <div style="font-size: 10px; color: #888; line-height: 1.4;">
            Every checked library merges into one grid. A name two libraries share is
            resolved in favour of the <b>last</b> one in the list, so the arrows set the
            priority.
          </div>
        </div>

        <div class="j0n4t-pg-modal-field">
          <label class="j0n4t-pg-checkbox-wrap" style="height: auto; cursor: pointer; display: flex; align-items: center; gap: 6px;">
            <input type="checkbox" id="j0n4t-pg-qualify-chips" ${this.qualifyChips ? "checked" : ""} />
            Tag basket chips with their library
          </label>
          <div style="font-size: 10px; color: #888; line-height: 1.4;">
            Keep the <b>library&nbsp;#&nbsp;</b> prefix when a preset is added to the basket, so a
            chip from a library the merge shadowed still expands to that library's copy.
            Turn it off to store every chip as a plain preset name.
          </div>
        </div>

        <div class="j0n4t-pg-modal-field">
          <label class="j0n4t-pg-checkbox-wrap" style="height: auto; cursor: pointer; display: flex; align-items: center; gap: 6px;">
            <input type="checkbox" id="j0n4t-pg-show-chip-library-badges" ${this.showChipLibraryBadges ? "checked" : ""} />
            Show library badges on basket chips
          </label>
          <label class="j0n4t-pg-checkbox-wrap" style="height: auto; cursor: pointer; display: flex; align-items: center; gap: 6px;">
            <input type="checkbox" id="j0n4t-pg-show-grid-library-badges" ${this.showGridLibraryBadges ? "checked" : ""} />
            Show library badges on grid items
          </label>
        </div>

        <div class="j0n4t-pg-modal-field">
          <label>Gallery Height</label>
          <select id="j0n4t-pg-height-mode">
            <option value="fit" ${this.heightMode === "fit" ? "selected" : ""}>Fit to node / panel</option>
            <option value="fixed" ${this.heightMode === "fixed" ? "selected" : ""}>Fixed height</option>
            <option value="unlimited" ${this.heightMode === "unlimited" ? "selected" : ""}>Unlimited</option>
          </select>
        </div>

        <div class="j0n4t-pg-modal-field" id="j0n4t-pg-height-fixed-field">
          <label>Fixed Height (px)</label>
          <input type="number" id="j0n4t-pg-height-fixed" value="${this.heightFixed}" min="120" max="4000" />
        </div>

        <div class="j0n4t-pg-modal-field">
          <label class="j0n4t-pg-checkbox-wrap" style="height: auto; cursor: pointer; display: flex; align-items: center; gap: 6px;">
            <input type="checkbox" id="j0n4t-pg-remember-panels" ${this.rememberPanelSizes ? "checked" : ""} />
            Remember basket and editor sizes
          </label>
        </div>

        <div style="font-size: 10px; color: #888; line-height: 1.4;">
          Every mode caps the gallery viewport, so the grid scrolls inside it.
          <br /><b>Fit</b> follows the node size in graph mode and the app panel in app mode - resize the node to resize the gallery.
          <br /><b>Fixed height</b> is drag-resizable: pull the gallery's bottom-right corner to adjust the value.
          <br /><b>Unlimited</b> grows the gallery with the preset library.
        </div>
      </div>

      <div id="j0n4t-pg-tab-shortcuts" class="j0n4t-pg-tab-panel">
        <div class="j0n4t-pg-shortcuts-grid">
          <div class="j0n4t-pg-shortcut-group">
            <h4>Global</h4>
            <div class="j0n4t-pg-shortcut-row"><span>Focus Search</span> <div><span class="j0n4t-pg-kbd">Ctrl</span> + <span class="j0n4t-pg-kbd">F</span> or <span class="j0n4t-pg-kbd">/</span></div></div>
            <div class="j0n4t-pg-shortcut-row"><span>Toggle Editor</span> <div><span class="j0n4t-pg-kbd">Ctrl</span> + <span class="j0n4t-pg-kbd">E</span></div></div>
            <div class="j0n4t-pg-shortcut-row"><span>Toggle Gallery</span> <div><span class="j0n4t-pg-kbd">Ctrl</span> + <span class="j0n4t-pg-kbd">H</span></div></div>
            <div class="j0n4t-pg-shortcut-row"><span>Clear Search / Defocus</span> <div><span class="j0n4t-pg-kbd">Esc</span></div></div>
          </div>
          
          <div class="j0n4t-pg-shortcut-group">
            <h4>Basket Actions</h4>
            <div class="j0n4t-pg-shortcut-row"><span>Roll Main ${this.diceBehavior === "variants" ? "(variants)" : "(presets)"}</span> <div><span class="j0n4t-pg-kbd">Ctrl</span> + <span class="j0n4t-pg-kbd">D</span></div></div>
            <div class="j0n4t-pg-shortcut-row"><span>Roll Alt ${this.diceBehavior !== "variants" ? "(variants)" : "(presets)"}</span> <div><span class="j0n4t-pg-kbd">Ctrl</span>+<span class="j0n4t-pg-kbd">Shift</span>+<span class="j0n4t-pg-kbd">D</span></div></div>
          </div>

          <div class="j0n4t-pg-shortcut-group">
            <h4>Chip Navigation</h4>
            <div class="j0n4t-pg-shortcut-row"><span>Navigate Basket</span> <div><span class="j0n4t-pg-kbd">Arrows</span></div></div>
            <div class="j0n4t-pg-shortcut-row"><span>Move/Reorder Chip</span> <div><span class="j0n4t-pg-kbd">Alt</span> + <span class="j0n4t-pg-kbd">Arrows</span></div></div>
            <div class="j0n4t-pg-shortcut-row"><span>Delete Chip</span> <div><span class="j0n4t-pg-kbd">Del</span></div></div>
          </div>

          <div class="j0n4t-pg-shortcut-group">
            <h4>Chip Editing</h4>
            <div class="j0n4t-pg-shortcut-row"><span>Increase/Decrease Weight</span> <div><span class="j0n4t-pg-kbd">+</span> / <span class="j0n4t-pg-kbd">-</span></div></div>
            <div class="j0n4t-pg-shortcut-row"><span>Pin/Unpin Preset</span> <div><span class="j0n4t-pg-kbd">P</span></div></div>
            <div class="j0n4t-pg-shortcut-row"><span>Quick Save (Editor)</span> <div><span class="j0n4t-pg-kbd">Shift</span> + <span class="j0n4t-pg-kbd">Enter</span></div></div>
          </div>
        </div>
      </div>
    `;

    const result = await ModalUtils.show({
      title: "Preset Gallery Settings",
      content,
      buttons: [
        { text: "Cancel", closeOnFinish: true },
        {
          text: "Save",
          isDefault: true,
          closeOnFinish: true,
          callback: () => {
            const minVal = Number(minInput?.value);
            const maxVal = Number(maxInput?.value);
            this.rollMin = !isNaN(minVal) ? Math.max(1, minVal) : 10;
            this.rollMax = !isNaN(maxVal) ? Math.max(this.rollMin, maxVal) : 20;
            this.rollOnGeneration = genCheck?.checked;
            this.rollOnSeedChange = seedCheck?.checked;
            this.diceBehavior = diceSelect?.value;
            this.heightMode = toHeightMode(heightModeSelect?.value);
            this.heightFixed = toFixedHeight(heightFixedInput?.value);
            this.rememberPanelSizes = rememberPanelsCheck?.checked === true;
            this.qualifyChips = qualifyChipsCheck?.checked !== false;
            this.showChipLibraryBadges =
              showChipLibraryBadgesCheck?.checked !== false;
            this.showGridLibraryBadges =
              showGridLibraryBadgesCheck?.checked !== false;

            this.save();
            this.applyHeightMode();
            this.applyPanelSizes();
            this.updateDiceVisuals(); // Instantly update the color indicator
            this.context.grid?.compile(this.context.cache);
            this.context.syncUI(this.context.widget.value);
            return true;
          },
        },
      ],
      onOpen: (modal) => {
        minInput = modal.querySelector("#j0n4t-pg-roll-min");
        maxInput = modal.querySelector("#j0n4t-pg-roll-max");
        genCheck = modal.querySelector("#j0n4t-pg-roll-on-gen");
        seedCheck = modal.querySelector("#j0n4t-pg-roll-on-seed");
        diceSelect = modal.querySelector("#j0n4t-pg-dice-behavior");
        heightModeSelect = modal.querySelector("#j0n4t-pg-height-mode");
        heightFixedInput = modal.querySelector("#j0n4t-pg-height-fixed");
        heightFixedField = modal.querySelector("#j0n4t-pg-height-fixed-field");
        rememberPanelsCheck = modal.querySelector("#j0n4t-pg-remember-panels");
        qualifyChipsCheck = modal.querySelector("#j0n4t-pg-qualify-chips");
        showChipLibraryBadgesCheck = modal.querySelector(
          "#j0n4t-pg-show-chip-library-badges",
        );
        showGridLibraryBadgesCheck = modal.querySelector(
          "#j0n4t-pg-show-grid-library-badges",
        );

        // The library list comes from the server, so it is fetched on every open
        // and filled from whatever is served right now.
        this.modal = modal;
        const libraryList = modal.querySelector("#j0n4t-pg-library-list");
        libraryList?.addEventListener("change", (e) => {
          const target = e.target instanceof HTMLElement ? e.target : null;
          const box = target?.closest("input[data-role='enabled']");
          if (!box) return;
          const row = box.closest(".j0n4t-pg-library-row");
          const id = row instanceof HTMLElement ? row.dataset.id || "" : "";
          if (id) this.toggleLibrary(id);
        });
        libraryList?.addEventListener("click", (e) => {
          const target = e.target instanceof HTMLElement ? e.target : null;
          const btn = target?.closest("button[data-role]");
          if (!(btn instanceof HTMLElement)) return;
          const row = btn.closest(".j0n4t-pg-library-row");
          const id = row instanceof HTMLElement ? row.dataset.id || "" : "";
          const delta = btn.dataset.role === "up" ? -1 : 1;
          this.moveLibrary(id, delta);
        });
        PresetGalleryAPI.fetchLibraries().then((libs) => {
          this.libraries = libs;
          this.syncLibraryList(modal);
        });

        // The pixel field only means anything in fixed mode.
        const syncFixedField = () => {
          if (heightFixedField) {
            heightFixedField.style.display =
              heightModeSelect?.value === "fixed" ? "" : "none";
          }
        };
        heightModeSelect?.addEventListener("change", syncFixedField);
        syncFixedField();

        const tabButtons = modal.querySelectorAll(".j0n4t-pg-tab-btn");
        const tabPanels = modal.querySelectorAll(".j0n4t-pg-tab-panel");

        tabButtons.forEach((btn) => {
          btn.addEventListener("click", () => {
            const targetTab = btn.getAttribute("data-tab");

            tabButtons.forEach((b) => b.classList.remove("active"));
            tabPanels.forEach((p) => p.classList.remove("active"));

            btn.classList.add("active");
            const activePanel = modal.querySelector(
              `#j0n4t-pg-tab-${targetTab}`,
            );
            if (activePanel) activePanel.classList.add("active");
          });
        });
      },
    });

    return result === true;
  }
}

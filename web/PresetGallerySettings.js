import ModalUtils from "./ModalUtils.js";
import PresetDOM from "./PresetDOM.js";
import PresetGalleryAPI from "./PresetGalleryAPI.js";

/**
 * Height modes offered in the Display tab, mirrored onto `data-height-mode` on
 * the wrap. "fit" caps the gallery viewport at the node's own size in graph
 * mode and at the app panel in app mode; "fixed" caps it at `heightFixed`;
 * "unlimited" leaves it uncapped so the gallery grows with the preset library.
 * Kept in sync with PresetGalleryApp.HEIGHT_STYLES.
 */
const HEIGHT_MODES = /** @type {GalleryHeightMode[]} */ (["fit", "fixed", "unlimited"]);
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
  return Number.isFinite(parsed) && parsed > 0 ? Math.round(parsed) : DEFAULT_HEIGHT_FIXED;
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
    this.load();
    this.applyHeightMode();
    this.applyPanelSizes();
    PresetDOM.injectStyles('j0n4t-pg-settings-styles', PresetGallerySettings.STYLES);

    // Defer visual update slightly to ensure the main app has finished generating the DOM elements
    setTimeout(() => this.updateDiceVisuals(), 0);
  }

  load() {
    try {
      const saved = JSON.parse(localStorage.getItem("pg_settings") || "{}");
      this.rollMin = saved.rollMin !== undefined ? saved.rollMin : 10;
      this.rollMax = saved.rollMax !== undefined ? saved.rollMax : 20;
      this.rollOnGeneration = saved.rollOnGeneration !== undefined ? saved.rollOnGeneration : false;
      this.rollOnSeedChange = saved.rollOnSeedChange !== undefined ? saved.rollOnSeedChange : false;
      this.diceBehavior = saved.diceBehavior || "variants";
      this.heightMode = toHeightMode(saved.heightMode);
      this.heightFixed = toFixedHeight(saved.heightFixed);
      this.rememberPanelSizes = saved.rememberPanelSizes === true;
      this.panelSizes = toPanelSizes(saved.panelSizes);
      this.libraryId = saved.libraryId || "";
    } catch {
      this.rollMin = 10;
      this.rollMax = 20;
      this.rollOnGeneration = false;
      this.rollOnSeedChange = false;
      this.diceBehavior = "variants";
      this.heightMode = DEFAULT_HEIGHT_MODE;
      this.heightFixed = DEFAULT_HEIGHT_FIXED;
      this.rememberPanelSizes = false;
      this.panelSizes = /** @type {GalleryPanelSizes} */ ({});
    }
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
      libraryId: this.libraryId
    };
    localStorage.setItem("pg_settings", JSON.stringify(data));
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
    const sizes = /** @type {GalleryPanelSizes} */ (this.rememberPanelSizes ? this.panelSizes : {});
    dom.basketContainer.style.height = sizes.basket ? `${sizes.basket}px` : "";
    dom.inpPreset.style.height = sizes.editor ? `${sizes.editor}px` : "";
  }

  /**
   * Fill the library picker from what the server serves. The list is not in the
   * template because it is not known until the server is asked.
   * @param {HTMLDivElement} modal
   */
  syncLibrarySelect(modal) {
    const select = modal.querySelector("#j0n4t-pg-library");
    if (!select) return;
    select.innerHTML = (this.libraries || [])
      .map(
        (lib) =>
          `<option value="${PresetDOM.escapeHTML(lib.id)}" ${lib.id === this.libraryId ? "selected" : ""}>${PresetDOM.escapeHTML(lib.name)}</option>`
      )
      .join("");
  }

  /**
   * Switch every gallery to another library. The library is a global choice, so
   * this is the one Display option that takes effect outside the modal it was
   * picked in - the grid reloads for every open instance.
   * @param {string} id
   */
  applyLibrary(id) {
    this.libraryId = id;
    this.save();
    this.context.switchLibrary(id);
  }

  updateDiceVisuals() {
    const diceBtn = document.querySelector('.j0n4t-pg-basket-reroll-btn');
    if (!diceBtn) return;
    diceBtn.classList.remove('roll-overwrite', 'roll-variants', 'auto-roll', 'auto-roll-seed');
    const modeClass = this.diceBehavior === 'overwrite' ? 'roll-overwrite' : 'roll-variants';
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
          <label>Preset Library</label>
          <select id="j0n4t-pg-library"></select>
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

            this.save();
            this.applyHeightMode();
            this.applyPanelSizes();
            this.updateDiceVisuals(); // Instantly update the color indicator
            this.context.syncUI(this.context.widget.value);
            return true;
          }
        }
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
        const librarySelect = modal.querySelector("#j0n4t-pg-library");

        // The library list comes from the server, so it is fetched on every open
        // and the picker is filled from whatever is served right now.
        librarySelect?.addEventListener("change", () => {
          const value = /** @type {HTMLSelectElement} */ (librarySelect).value;
          if (value) this.applyLibrary(value);
        });
        PresetGalleryAPI.fetchLibraries().then((libs) => {
          this.libraries = libs;
          this.syncLibrarySelect(modal);
        });

        // The pixel field only means anything in fixed mode.
        const syncFixedField = () => {
          if (heightFixedField) {
            heightFixedField.style.display = heightModeSelect?.value === "fixed" ? "" : "none";
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
            const activePanel = modal.querySelector(`#j0n4t-pg-tab-${targetTab}`);
            if (activePanel) activePanel.classList.add("active");
          });
        });
      }
    });

    return result === true;
  }
}
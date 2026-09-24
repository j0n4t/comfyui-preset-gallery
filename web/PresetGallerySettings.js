import ModalUtils from "./ModalUtils.js";
import PresetDOM from "./PresetDOM.js";

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

    @media (max-width: 512px) {
      .j0n4t-pg-shortcuts-grid { grid-template-columns: 1fr; }
    }
  `;

  /** @param {import("./PresetGalleryApp.js").default} context  */
  constructor(context) {
    this.context = context;
    this.load();
    PresetDOM.injectStyles('j0n4t-pg-settings-styles', PresetGallerySettings.STYLES);
  }

  load() {
    try {
      const saved = JSON.parse(localStorage.getItem("pg_settings") || "{}");
      this.rollMin = saved.rollMin !== undefined ? saved.rollMin : 10;
      this.rollMax = saved.rollMax !== undefined ? saved.rollMax : 20;
      this.rollOnGeneration = saved.rollOnGeneration !== undefined ? saved.rollOnGeneration : false;
      this.rollOnSeedChange = saved.rollOnSeedChange !== undefined ? saved.rollOnSeedChange : false;
      this.diceBehavior = saved.diceBehavior || "variants";
    } catch (e) {
      this.rollMin = 10;
      this.rollMax = 20;
      this.rollOnGeneration = false;
      this.rollOnSeedChange = false;
      this.diceBehavior = "variants";
    }
  }

  save() {
    const data = {
      rollMin: this.rollMin,
      rollMax: this.rollMax,
      rollOnGeneration: this.rollOnGeneration,
      rollOnSeedChange: this.rollOnSeedChange,
      diceBehavior: this.diceBehavior
    };
    localStorage.setItem("pg_settings", JSON.stringify(data));
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

    const content = `
      <div class="j0n4t-pg-tab-nav">
        <button type="button" class="j0n4t-pg-tab-btn active" data-tab="settings">Rolling Options</button>
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
            <div class="j0n4t-pg-shortcut-row"><span>Clear Basket</span> <div><span class="j0n4t-pg-kbd">Alt</span> + <span class="j0n4t-pg-kbd">L</span></div></div>
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
            this.save();
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
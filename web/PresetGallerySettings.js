import ModalUtils from "./ModalUtils.js";
import PresetDOM from "./PresetDOM.js";

export default class PresetGallerySettings {
  /** @param {import("./PresetGalleryApp.js").default} context  */
  constructor(context) {
    this.context = context;
    this.load();
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
      <div style="display: flex; flex-direction: column; gap: 10px;">
        <div style="font-size: 12px; font-weight: bold; color: #fff; border-bottom: 1px solid #444; padding-bottom: 4px;">Rolling Options</div>
        
        <div class="j0n4t-pg-modal-field">
          <label>Basket Dice Roll Behavior</label>
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
    `;

    const result = await ModalUtils.show({
      title: "Preset Gallery Settings",
      isLarge: true,
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
      }
    });

    return result === true;
  }
}
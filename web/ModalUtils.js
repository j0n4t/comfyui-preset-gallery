import PresetUtils from "./PresetUtils.js";

export default class ModalUtils {
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
    .j0n4t-pg-modal-field input { background: #111; border: 1px solid #444; color: #fff; padding: 6px; border-radius: 4px; font-size: 11px; outline: none; width: 100%; box-sizing: border-box; }
    .j0n4t-pg-modal-field input:focus { border-color: #007acc; }
    .j0n4t-pg-modal-actions { display: flex; justify-content: flex-end; gap: 8px; margin-top: 4px; }
  `;

  static injectStyles() {
    PresetUtils.injectStyles("j0n4t-pg-modal-styles", ModalUtils.MODAL_STYLES);
  }

  /**
   * Create and show a basic alert modal
   * @param {string} message - The message to display
   * @returns {Promise} - Resolves when user clicks OK
   */
  static alert(message) {
    return ModalUtils.show({
      title: "Notice",
      content: `<div style="font-size: 11px; color: #ccc; line-height: 1.4;">${PresetUtils.escapeHTML(message)}</div>`,
      buttons: [{ text: "OK", isDefault: true, closeOnFinish: true }]
    });
  }

  /**
   * Create and show a confirmation modal
   * @param {string} message - The message to display
   * @returns {Promise<boolean>} - Resolves with true if user confirms, false if cancels
   */
  static async confirm(message) {
    const result = await ModalUtils.show({
      title: "Confirmation",
      content: `<div style="font-size: 11px; color: #ccc; line-height: 1.4;">${PresetUtils.escapeHTML(message)}</div>`,
      buttons: [
        { text: "Cancel", closeOnFinish: true, callback: () => false },
        { text: "Confirm", isDefault: true, closeOnFinish: true, callback: () => true }
      ]
    });
    return result === true;
  }

  /**
   * Create and show a prompt modal with an input field
   * @param {string} title - The title of the modal
   * @param {string} defaultValue - The default value for the input field
   * @returns {Promise<string|null>} - Resolves with the input value if confirmed, or null if cancelled
   */
  static async prompt(title, defaultValue = "") {
    let inputEl;
    const result = await ModalUtils.show({
      title,
      isLarge: true,
      content: `
        <div class="j0n4t-pg-modal-field">
          <input type="text" class="j0n4t-pg-modal-input" value="${PresetUtils.escapeHTML(defaultValue)}" />
        </div>
      `,
      buttons: [
        { text: "Cancel", closeOnFinish: true, callback: () => null },
        { text: "OK", isDefault: true, closeOnFinish: true, callback: () => (inputEl ? inputEl.value : null) }
      ],
      onOpen: (modal) => {
        inputEl = modal.querySelector(".j0n4t-pg-modal-input");
        if (inputEl) {
          setTimeout(() => { inputEl.focus(); inputEl.select(); }, 50);
          inputEl.addEventListener("keydown", (e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              const okBtn = modal.querySelectorAll(".j0n4t-pg-btn")[1];
              if (okBtn) okBtn.click();
            } else if (e.key === "Escape") {
              e.preventDefault();
              const cancelBtn = modal.querySelectorAll(".j0n4t-pg-btn")[0];
              if (cancelBtn) cancelBtn.click();
            }
          });
        }
      }
    });
    return result ?? null;
  }

  /**
   * Create and show a generic modal with custom content
   * @param {Object} options - Modal configuration options
   * @param {string} options.title - The modal title
   * @param {string} options.content - The modal content HTML
   * @param {Array} options.buttons - Array of button objects {text, className, callback, isDefault, closeOnFinish}
   * @param {boolean} options.isLarge - Whether to use large modal variant
   * @param {Function} options.onOpen - Optional callback executed when modal is opened
   * @returns {Promise<any>} - Resolves with the result from button callbacks
   */
  static show(options) {
    return new Promise((resolve) => {
      ModalUtils.injectStyles();
      const overlay = document.createElement("div");
      overlay.className = "j0n4t-pg-modal-overlay";
      const modal = document.createElement("div");
      modal.className = `j0n4t-pg-modal${options.isLarge ? " j0n4t-pg-modal-large" : ""}`;
      const buttonsHTML = options.buttons
        ? options.buttons.map((btn) =>
          `<button type="button" class="j0n4t-pg-btn${btn.className ? " " + btn.className : ""}" ${btn.isDefault ? 'style="background:#007acc;"' : ""}>
            ${PresetUtils.escapeHTML(btn.text)}
          </button>`
        ).join("")
        : `<button type="button" class="j0n4t-pg-btn" style="background:#007acc;">OK</button>`;
      modal.innerHTML = `
        <h3>${PresetUtils.escapeHTML(options.title || "Modal")}</h3>
        <div class="j0n4t-pg-modal-content">${options.content}</div>
        <div class="j0n4t-pg-modal-actions">${buttonsHTML}</div>
      `;
      overlay.appendChild(modal);
      if (options.buttons) {
        options.buttons.forEach((button, index) => {
          const btnElement = modal.querySelectorAll(".j0n4t-pg-btn")[index];
          if (btnElement) {
            btnElement.addEventListener("click", () => {
              const result = button.callback ? button.callback() : undefined;
              if (button.closeOnFinish) overlay.remove();
              resolve(result);
            });
          }
        });
      } else {
        modal.querySelector(".j0n4t-pg-btn").addEventListener("click", () => {
          overlay.remove();
          resolve();
        });
      }
      overlay.addEventListener("click", (e) => {
        if (e.target === overlay) {
          overlay.remove();
          resolve();
        }
      });
      document.body.appendChild(overlay);
      if (options.onOpen) { options.onOpen(modal, overlay); }
    });
  }
}
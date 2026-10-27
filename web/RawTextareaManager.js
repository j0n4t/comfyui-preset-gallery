import RawTextHighlighting from "./RawTextHighlighting.js";
import RawTextHover from "./RawTextHover.js";
import RawTextAutocomplete from "./RawTextAutocomplete.js";
import PresetDOM from "./PresetDOM.js";

export default class RawTextareaManager {
  static STYLES = /*css*/ `
    .j0n4t-pg-raw-wrapper { position: relative; width: 100%; height: 100%; display: block; box-sizing: border-box; }
    .j0n4t-pg-raw-highlights, .j0n4t-pg-raw-textarea { width: 100%; height: 100%; min-height: 48px; font-family: monospace; font-size: 11px; padding: 5px; box-sizing: border-box; border-radius: 3px; margin: 0; white-space: pre-wrap; word-wrap: break-word; overflow-wrap: break-word; line-height: 1.4; border: 1px solid #444; letter-spacing: normal; word-spacing: normal; text-transform: none; text-indent: 0px; text-shadow: none; }
    .j0n4t-pg-raw-highlights { position: absolute; top: 0; left: 0; right: 0; bottom: 0; pointer-events: none; color: transparent; overflow: hidden; background: transparent; border-color: transparent; width: 100%; height: 100%; }
    .j0n4t-pg-raw-textarea { display: block; background: transparent; border-color: #444; color: transparent; caret-color: #fff; resize: vertical; position: relative; outline: none; }
    .j0n4t-pg-raw-textarea:focus { border-color: #007acc; }
    .j0n4t-pg-raw-token { color: #569cd6; font-weight: bold; }
    .j0n4t-pg-raw-token.plain-text { color: #cccccc; font-weight: normal; }
  `;

  /**
   * @param {string} tokenText
   * @returns {string}
   */
  static extractGroupName(tokenText) {
    const inner = tokenText.slice(1, -1);
    const colonIdx = inner.indexOf(":");
    return (colonIdx === -1 ? inner : inner.slice(0, colonIdx)).trim();
  }

  /**
   * @param {HTMLTextAreaElement | HTMLInputElement} textarea
   * @param {GalleryContext} context
   * @param {string|null} ignorePreset
   * @param {(textareaValue: string) => void} onSync
   */
  constructor(textarea, context, ignorePreset, onSync) {
    this.textarea = textarea;
    this.context = context;
    this.onSync = onSync;
    this.highlightsEl = null;
    this.ignorePreset = ignorePreset || "";

    this.highlighting = new RawTextHighlighting(this.textarea, this.context, this.ignorePreset, this.onSync);
    this.hover = new RawTextHover(this.textarea, this.context, this.ignorePreset);
    this.autocomplete = new RawTextAutocomplete(this.textarea, this.context, this.ignorePreset, this.onSync, this);

    PresetDOM.injectStyles("j0n4t-pg-raw-textarea-styles", RawTextareaManager.STYLES);
    this.initWrapper();
    this.initEvents();
    this.updateHighlights(this.ignorePreset);
  }

  initWrapper() {
    const parent = this.textarea.parentNode;
    if (!parent) return;

    const wrapper = document.createElement("div");
    wrapper.className = "j0n4t-pg-raw-wrapper";

    this.highlightsEl = document.createElement("div");
    this.highlightsEl.className = "j0n4t-pg-raw-highlights";

    parent.insertBefore(wrapper, this.textarea);
    wrapper.appendChild(this.highlightsEl);
    wrapper.appendChild(this.textarea);

    this.textarea.className = "j0n4t-pg-raw-textarea";
    this.highlighting.attach(this.highlightsEl);
  }

  updateHighlights(ignorePreset = "") {
    this.highlighting.updateHighlights(ignorePreset);
  }

  initEvents() {
    const sync = () => {
      this.updateHighlights(this.ignorePreset);
      if (this.onSync) this.onSync(this.textarea.value);
    };

    this.textarea.addEventListener("input", () => this.updateHighlights(this.ignorePreset));
    this.textarea.addEventListener("scroll", () => {
      if (this.highlightsEl) {
        this.highlightsEl.scrollTop = this.textarea.scrollTop;
        this.highlightsEl.scrollLeft = this.textarea.scrollLeft;
      }
    });
    this.textarea.addEventListener("change", sync);
    this.textarea.addEventListener("mousedown", (e) => e.stopPropagation());

    this.textarea.addEventListener("mousemove", (e) => this.handleMouseMove(/** @type {MouseEvent} */(e)));
    this.textarea.addEventListener("mouseleave", () => this.textarea.title = "");
  }

  /**
   * @param {MouseEvent} e
   */
  handleMouseMove(e) {
    this.hover.handleMouseMove(e);
  }

  /**
   * @param {number} x
   * @param {number} y
   */
  getCharPositionAt(x, y) {
    return this.hover.getCharPositionAt(x, y);
  }

  /**
   * @param {number} pos
   */
  _normalizeTokenPosition(pos) {
    return this.hover._normalizeTokenPosition(pos);
  }

  /**
   * @param {number} pos
   */
  getTokenAtPosition(pos) {
    return this.hover.getTokenAtPosition(pos);
  }

}
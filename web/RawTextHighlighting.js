import PresetLogic from "./PresetLogic.js";
import PresetDOM from "./PresetDOM.js";
import PresetDisplay from "./PresetDisplay.js";

export default class RawTextHighlighting {
  /**
   * @param {HTMLTextAreaElement | HTMLInputElement} textarea
   * @param {GalleryContext} context
   * @param {string|null} ignorePreset
   * @param {(value: string) => void} onSync
   */
  constructor(textarea, context, ignorePreset, onSync) {
    this.textarea = textarea;
    this.context = context;
    this.onSync = onSync;
    this.ignorePreset = ignorePreset || "";
    /** @type {HTMLDivElement | null} */
    this.highlightsEl = null;
  }

  /**
   * @param {HTMLDivElement} highlightsEl
   */
  attach(highlightsEl) {
    this.highlightsEl = highlightsEl;
  }

  updateHighlights(ignorePreset = "") {
    this.ignorePreset = ignorePreset;
    if (!this.highlightsEl) return;
    const val = this.textarea.value || "";
    if (!val) {
      this.highlightsEl.innerHTML = "";
      return;
    }

    const tokens = PresetLogic.parseTokens(
      val,
      this.context.cache,
      this.ignorePreset,
    );
    let html = "";

    tokens.forEach((token) => {
      if (token.isDelimiter || token.isPlainText) {
        html += `<span class="j0n4t-pg-raw-token plain-text">${PresetDOM.escapeHTML(token.text)}</span>`;
      } else if (token.isTag) {
        html += `<span class="j0n4t-pg-raw-token" style="color: #4fc1ff;">${PresetDOM.escapeHTML(token.text)}</span>`;
      } else if (token.isVar || /^\{[^{}]+\}$/.test(token.text)) {
        const groupName = RawTextHighlighting.extractGroupName(token.text);
        const varColor = PresetDisplay.getPresetColor(
          groupName,
          this.context.cache,
        );
        html += `<span class="j0n4t-pg-raw-token" style="color: ${varColor}; font-weight: bold;">${PresetDOM.escapeHTML(token.text)}</span>`;
      } else {
        const itemKey = token.key || "";
        const item = token.item;
        const textColor = itemKey
          ? PresetDisplay.getPresetColor(itemKey, this.context.cache)
          : "";
        const styleAttr = textColor ? ` style="color: ${textColor};"` : "";
        const titleAttr = item
          ? ` title="${PresetDOM.escapeHTML(`${PresetDisplay.toTitleCase(PresetDisplay.getPresetName(itemKey))} [${itemKey}]\n${PresetDOM.escapeHTML(item.preset || "")}`)}"`
          : "";

        html += `<span class="j0n4t-pg-raw-token"${styleAttr}${titleAttr}>${PresetDOM.escapeHTML(token.text)}</span>`;
      }
    });

    this.highlightsEl.innerHTML = html + "\n";
    this.highlightsEl.scrollTop = this.textarea.scrollTop;
    this.highlightsEl.scrollLeft = this.textarea.scrollLeft;
  }

  /**
   * @param {string} tokenText
   */
  static extractGroupName(tokenText) {
    const inner = tokenText.slice(1, -1);
    const colonIdx = inner.indexOf(":");
    return (colonIdx === -1 ? inner : inner.slice(0, colonIdx)).trim();
  }
}

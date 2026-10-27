import PresetLogic from "./PresetLogic.js";
import PresetDisplay from "./PresetDisplay.js";

export default class RawTextHover {
  /**
   * @param {HTMLTextAreaElement | HTMLInputElement} textarea
   * @param {GalleryContext} context
   * @param {string|null} ignorePreset
   */
  constructor(textarea, context, ignorePreset) {
    this.textarea = textarea;
    this.context = context;
    this.ignorePreset = ignorePreset || "";
  }

  /** @param {MouseEvent} e */
  handleMouseMove(e) {
    const rect = this.textarea.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const pos = this.getCharPositionAt(x, y);
    if (pos === -1) {
      this.textarea.title = "";
      return;
    }

    const token = this.getTokenAtPosition(pos);
    if (token && token.item && !token.isPlainText) {
      this.textarea.title = `${PresetDisplay.toTitleCase(PresetDisplay.getPresetName(token.key))} [${token.key}]\n${token.item.preset || ""}`;
    } else {
      this.textarea.title = "";
    }
  }

  /**
   * @param {number} x
   * @param {number} y
   */
  getCharPositionAt(x, y) {
    const rect = this.textarea.getBoundingClientRect();
    const clientX = rect.left + x;
    const clientY = rect.top + y;

    let pos = -1;
    if (document.caretPositionFromPoint) {
      const caretPos = document.caretPositionFromPoint(clientX, clientY);
      if (caretPos && caretPos.offsetNode === this.textarea) {
        pos = caretPos.offset;
      }
    } else if (document.caretRangeFromPoint) {
      const range = document.caretRangeFromPoint(clientX, clientY);
      if (range && range.startContainer === this.textarea) {
        pos = range.startOffset;
      }
    }

    if (pos !== -1) {
      return this._normalizeTokenPosition(pos);
    }

    const style = window.getComputedStyle(this.textarea);
    const paddingLeft = parseFloat(style.paddingLeft);
    const paddingRight = parseFloat(style.paddingRight);
    const paddingTop = parseFloat(style.paddingTop);
    const paddingBottom = parseFloat(style.paddingBottom);
    const borderLeft = parseFloat(style.borderLeftWidth);

    const xPos = x - paddingLeft - borderLeft;
    const yPos = y - paddingTop - parseFloat(style.borderTopWidth);

    const innerWidth = this.textarea.clientWidth - paddingLeft - paddingRight - borderLeft - parseFloat(style.borderRightWidth);
    const innerHeight = this.textarea.clientHeight - paddingTop - paddingBottom - parseFloat(style.borderTopWidth) - parseFloat(style.borderBottomWidth);

    if (xPos < 0 || yPos < 0 || xPos > innerWidth || yPos > innerHeight) return -1;

    const fontSize = parseFloat(style.fontSize);
    const lineHeight = parseFloat(style.lineHeight) || fontSize * 1.2;
    const charWidth = fontSize * 0.6;

    const charsPerLine = Math.max(1, Math.floor(innerWidth / charWidth));
    const linesCount = Math.max(1, Math.floor(innerHeight / lineHeight));

    const col = Math.min(Math.round(xPos / charWidth), charsPerLine - 1);
    const row = Math.min(Math.floor(yPos / lineHeight), linesCount - 1);

    const calcPos = row * charsPerLine + col;
    const text = this.textarea.value;
    if (!text) return -1;
    return this._normalizeTokenPosition(Math.min(calcPos, text.length));
  }

  /** @param {number} pos */
  _normalizeTokenPosition(pos) {
    const value = this.textarea.value;
    if (!value) return 0;

    if (pos < 0) return 0;
    if (pos > value.length) return value.length;

    const ch = value[pos];
    if (ch !== "," && !/\s/.test(ch)) {
      return pos;
    }

    let left = pos - 1;
    while (left >= 0 && (value[left] === "," || /\s/.test(value[left]))) {
      left--;
    }
    let right = pos + 1;
    while (right < value.length && (value[right] === "," || /\s/.test(value[right]))) {
      right++;
    }

    const leftDist = pos - (left + 1);
    const rightDist = right - pos;
    return leftDist <= rightDist ? left + 1 : right - 1;
  }

  /** @param {number} pos */
  getTokenAtPosition(pos) {
    const value = this.textarea.value;
    if (!value || pos < 0 || pos > value.length) return null;

    const tokens = PresetLogic.parseTokens(value, this.context.cache, this.ignorePreset);
    for (const token of tokens) {
      if (token.isDelimiter) continue;
      if (pos >= token.start && pos <= token.end) {
        return {
          key: token.key || token.text,
          item: token.item || null,
          isPlainText: token.isPlainText,
          start: token.start,
          end: token.end
        };
      }
    }
    return null;
  }
}

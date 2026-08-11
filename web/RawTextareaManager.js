import AutocompleteManager from "./AutocompleteManager.js";
import PresetDOM from "./PresetDOM.js";
import PresetLogic from "./PresetLogic.js";

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

  constructor(textarea, context, ignorePreset = null, onSync = null) {
    this.textarea = textarea;
    this.context = context;
    this.onSync = onSync;
    this.highlightsEl = null;
    this.ignorePreset = ignorePreset;

    PresetDOM.injectStyles("j0n4t-pg-raw-textarea-styles", RawTextareaManager.STYLES);
    this.initWrapper();
    this.initEvents();
    this.initAutocomplete();
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
  }

  updateHighlights(ignorePreset = null) {
    this.ignorePreset = ignorePreset;
    if (!this.highlightsEl) return;
    const val = this.textarea.value || "";
    if (!val) {
      this.highlightsEl.innerHTML = "";
      return;
    }

    const tokens = PresetLogic.parseTokens(val, this.context.cache, this.ignorePreset);
    let html = "";

    tokens.forEach((token) => {
      if (token.isDelimiter || token.isPlainText) {
        html += `<span class="j0n4t-pg-raw-token plain-text">${PresetDOM.escapeHTML(token.text)}</span>`;
      } else if (token.isTag) {
        html += `<span class="j0n4t-pg-raw-token" style="color: #4fc1ff;">${PresetDOM.escapeHTML(token.text)}</span>`;
      } else if (token.isVar || /^\{[^{}]+\}$/.test(token.text)) {
        html += `<span class="j0n4t-pg-raw-token" style="color: #d1a119; font-weight: bold;">${PresetDOM.escapeHTML(token.text)}</span>`;
      } else {
        const itemKey = token.key;
        const item = token.item;
        const textColor = itemKey ? PresetLogic.getPresetColor(itemKey, this.context.cache) : "";
        const styleAttr = textColor ? ` style="color: ${textColor};"` : "";
        const titleAttr = item
          ? ` title="${PresetDOM.escapeHTML(`${PresetLogic.toTitleCase(PresetLogic.getPresetName(itemKey))} [${itemKey}]\n${PresetDOM.escapeHTML(item.preset || "")}`)}"`
          : "";

        html += `<span class="j0n4t-pg-raw-token"${styleAttr}${titleAttr}>${PresetDOM.escapeHTML(token.text)}</span>`;
      }
    });

    this.highlightsEl.innerHTML = html + "\n";
    this.highlightsEl.scrollTop = this.textarea.scrollTop;
    this.highlightsEl.scrollLeft = this.textarea.scrollLeft;
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

    this.textarea.addEventListener("mousemove", (e) => this.handleMouseMove(e));
    this.textarea.addEventListener("mouseleave", () => this.textarea.title = "");
  }

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
      this.textarea.title = `${PresetLogic.toTitleCase(PresetLogic.getPresetName(token.key))} [${token.key}]\n${token.item.preset || ""}`;
    } else {
      this.textarea.title = "";
    }
  }

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

  _normalizeTokenPosition(pos) {
    const value = this.textarea.value;
    if (!value) return 0;

    if (pos < 0) return 0;
    if (pos > value.length) return value.length;

    const ch = value[pos];
    if (ch !== ',' && !/\s/.test(ch)) {
      return pos;
    }

    let left = pos - 1;
    while (left >= 0 && (value[left] === ',' || /\s/.test(value[left]))) {
      left--;
    }
    let right = pos + 1;
    while (right < value.length && (value[right] === ',' || /\s/.test(value[right]))) {
      right++;
    }

    const leftDist = pos - (left + 1);
    const rightDist = right - pos;
    return leftDist <= rightDist ? left + 1 : right - 1;
  }

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

  initAutocomplete() {
    const manager = new AutocompleteManager({
      input: this.textarea,
      container: document.body,
      getMatches: (text, cursor) => {
        const textBeforeCursor = text.substring(0, cursor);
        const lastOpenBrace = textBeforeCursor.lastIndexOf('{');
        const lastCloseBrace = textBeforeCursor.lastIndexOf('}');
        const isInsideBrackets = lastOpenBrace !== -1 && lastOpenBrace > lastCloseBrace;

        if (isInsideBrackets) {
          const bracketContent = textBeforeCursor.substring(lastOpenBrace + 1);
          const colonIndex = bracketContent.indexOf(':');

          if (colonIndex === -1) {
            // Typing variant group name
            const groupQuery = bracketContent.trim().toLowerCase();
            const groupsSet = new Set();
            for (const k of Object.keys(this.context.cache)) {
              const folder = PresetLogic.getPresetFolder ? PresetLogic.getPresetFolder(k) : k.split('/')[0];
              if (folder) groupsSet.add(folder);
            }
            const groups = Array.from(groupsSet);
            const dummyCache = {};
            groups.forEach(g => { dummyCache[g] = { preset: g }; });
            return PresetLogic.getTopMatches(
              groups,
              groupQuery,
              (g) => g,
              dummyCache
            );
          } else {
            // Typing preset name inside a specific variant group
            const groupName = bracketContent.substring(0, colonIndex).trim().toLowerCase();
            const presetQuery = bracketContent.substring(colonIndex + 1).trim().toLowerCase();

            const presetMatches = Object.keys(this.context.cache).filter((k) => {
              if (!this.context.cache[k]?.preset) return false;
              const folder = PresetLogic.getPresetFolder ? PresetLogic.getPresetFolder(k) : k.split('/')[0];
              return folder.toLowerCase() === groupName || folder.toLowerCase().startsWith(groupName + "/") || folder.toLowerCase().endsWith("/" + groupName);
            });

            return PresetLogic.getTopMatches(
              presetMatches,
              presetQuery,
              (k) => PresetLogic.getSearchBlob(k, this.context.cache[k]),
              this.context.cache
            );
          }
        } else {
          const lastCommaIndex = text.slice(0, cursor).lastIndexOf(",");
          const currentToken = (
            lastCommaIndex === -1
              ? text.slice(0, cursor)
              : text.slice(lastCommaIndex + 1, cursor)
          ).trimStart();
          if (!currentToken) return [];

          return PresetLogic.getTopMatches(
            Object.keys(this.context.cache),
            currentToken,
            (k) => PresetLogic.getSearchBlob(k, this.context.cache[k]),
            this.context.cache,
            this.ignorePreset
          );
        }
      },
      renderItem: (match) =>
        `<span>${PresetDOM.escapeHTML(PresetLogic.toTitleCase(match.split("/").pop()))}</span><span class="j0n4t-pg-autocomplete-meta">${PresetDOM.escapeHTML(match)}</span>`,
      onSelect: (match) => {
        const query = this.textarea.value;
        const cursor = this.textarea.selectionStart;
        const textBeforeCursor = query.substring(0, cursor);
        const lastOpenBrace = textBeforeCursor.lastIndexOf('{');
        const lastCloseBrace = textBeforeCursor.lastIndexOf('}');
        const isInsideBrackets = lastOpenBrace !== -1 && lastOpenBrace > lastCloseBrace;
        const leftText = this.textarea.value.slice(0, cursor);
        const prefix =
          leftText.lastIndexOf(",") === -1
            ? ""
            : leftText.slice(0, leftText.lastIndexOf(",") + 1) + " ";
        const insertedText = PresetLogic.expandRecursively(match, this.context.cache);
        if (isInsideBrackets) {
          const bracketContent = textBeforeCursor.substring(lastOpenBrace + 1);
          const colonIndex = bracketContent.indexOf(':');
          if (colonIndex === -1) {
            // Group selected: insert group name with a trailing colon and keep popup open for preset suggestions
            const before = query.substring(0, lastOpenBrace);
            const after = query.substring(cursor);
            this.textarea.value = `${before}{${match}:${after}`;
            const newCursor = before.length + match.length + 2;
            if (this.onSync) this.onSync(this.textarea.value);
            this.updateHighlights(this.ignorePreset);
            this.textarea.setSelectionRange(newCursor, newCursor);
            this.textarea.focus();
            manager.evaluate();
            return true; // Keep popup open
          } else {
            // Preset selected inside group: complete the variant format and finish editing
            const groupName = bracketContent.substring(0, colonIndex).trim();
            const before = query.substring(0, lastOpenBrace);
            const after = query.substring(cursor);
            this.textarea.value = `${before}{${groupName}:${match}}${after}`;
            if (this.onSync) this.onSync(this.textarea.value);
            this.updateHighlights(this.ignorePreset);
            this.textarea.focus();
            this.textarea.selectionStart = this.textarea.selectionEnd =
              prefix.length + insertedText.length + 2;
            return false;
          }
        } else {
          this.textarea.value =
            prefix + insertedText + ", " + this.textarea.value.slice(cursor);

          if (this.onSync) this.onSync(this.textarea.value);
          this.updateHighlights(this.ignorePreset);
          this.textarea.focus();
          this.textarea.selectionStart = this.textarea.selectionEnd =
            prefix.length + insertedText.length + 2;
        }
      },
      onKeyDown: (e, { activeMatch }) => {
        if (
          e.key === "ArrowRight" &&
          this.textarea.selectionStart === this.textarea.value.length &&
          activeMatch
        ) {
          return false;
        }
      },
    });
  }
}